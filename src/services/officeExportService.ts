import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import writeXlsxFile from 'write-excel-file/browser';
import PptxGenJS from 'pptxgenjs';
import { PdfRenderService } from './pdfRenderService';
import { t } from '@/i18n';

export type OfficeFormat = 'docx' | 'xlsx' | 'pptx';

export const OFFICE_MIME_TYPES: Record<OfficeFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

/** Aynı satırdaki metin; aralarında geniş boşluk olan parçalar ayrı hücredir (Excel sütunları) */
interface TextLine {
  y: number;
  size: number;
  cells: { x: number; text: string }[];
}

type OnProgress = (current: number, total: number) => void;

// shortcut: metin sırası soldan sağa ve yatay varsayılır; sağdan sola veya döndürülmüş metinde sıra bozulabilir
async function extractLines(page: pdfjsLib.PDFPageProxy): Promise<TextLine[]> {
  const { items } = await page.getTextContent();
  const chunks = items
    .filter((item): item is TextItem => 'str' in item && item.str.trim() !== '')
    .map((item) => ({
      x: item.transform[4],
      y: item.transform[5],
      size: Math.hypot(item.transform[2], item.transform[3]) || item.height || 10,
      width: item.width,
      text: item.str
    }))
    .sort((a, b) => b.y - a.y);

  // Taban çizgisi yarım satırdan az farklı olan parçalar aynı satırdır
  const rows: { y: number; size: number; chunks: typeof chunks }[] = [];
  for (const chunk of chunks) {
    const row = rows[rows.length - 1];
    if (row && row.y - chunk.y < Math.max(row.size, chunk.size) * 0.5) {
      row.chunks.push(chunk);
      row.size = Math.max(row.size, chunk.size);
    } else {
      rows.push({ y: chunk.y, size: chunk.size, chunks: [chunk] });
    }
  }

  return rows.map((row) => {
    const cells: { x: number; text: string }[] = [];
    let end = -Infinity;
    for (const chunk of row.chunks.sort((a, b) => a.x - b.x)) {
      const gap = chunk.x - end;
      const cell = cells[cells.length - 1];
      if (cell && gap < row.size * 1.5) {
        const needsSpace = gap > row.size * 0.15 && !cell.text.endsWith(' ') && !chunk.text.startsWith(' ');
        cell.text += (needsSpace ? ' ' : '') + chunk.text;
      } else {
        cells.push({ x: chunk.x, text: chunk.text });
      }
      end = chunk.x + chunk.width;
    }
    return { y: row.y, size: row.size, cells: cells.map((cell) => ({ x: cell.x, text: cell.text.trim() })) };
  });
}

function buildParagraphs(lines: TextLine[], bodySize: number, pageBreakBefore: boolean): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: { text: string; size: number; lastY: number } | null = null;

  const flush = () => {
    if (!current) return;
    paragraphs.push(
      new Paragraph({
        pageBreakBefore: pageBreakBefore && paragraphs.length === 0,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: current.text,
            size: Math.max(2, Math.round(current.size * 2)), // docx yarım punto ister
            bold: current.size >= bodySize * 1.2
          })
        ]
      })
    );
    current = null;
  };

  for (const line of lines) {
    const text = line.cells.map((cell) => cell.text).join('  ');
    // Normal satır aralığı ~1.2 × punto; daha geniş boşluk, punto değişimi veya madde işareti yeni paragraftır
    const continues =
      current &&
      current.lastY - line.y < line.size * 1.5 &&
      Math.abs(current.size - line.size) < 1 &&
      !/^([•●▪◦‣∙·]|[-–]\s|\d{1,3}[.)]\s)/.test(text);
    if (current && continues) {
      current.text += (current.text.endsWith('-') ? '' : ' ') + text;
      current.lastY = line.y;
    } else {
      flush();
      current = { text, size: line.size, lastY: line.y };
    }
  }
  flush();

  if (pageBreakBefore && paragraphs.length === 0) paragraphs.push(new Paragraph({ pageBreakBefore: true }));
  return paragraphs;
}

async function buildDocx(pages: TextLine[][], pageSize: { width: number; height: number }): Promise<Blob> {
  const sizes = pages.flat().map((line) => line.size).sort((a, b) => a - b);
  const bodySize = sizes[Math.floor(sizes.length / 2)];
  const doc = new Document({
    sections: [
      {
        // Word sayfa boyutu twip cinsinden (1 pt = 20 twip)
        properties: { page: { size: { width: Math.round(pageSize.width * 20), height: Math.round(pageSize.height * 20) } } },
        children: pages.flatMap((lines, i) => buildParagraphs(lines, bodySize, i > 0))
      }
    ]
  });
  return Packer.toBlob(doc);
}

const toCellValue = (text: string) => (/^-?(0|[1-9]\d{0,14})$/.test(text) ? Number(text) : text);

async function buildXlsx(pages: TextLine[][]): Promise<Blob> {
  const sheets = pages.map((lines, i) => {
    // Hücre başlangıçları 10 pt içinde olanlar aynı sütundur
    const starts: number[] = [];
    for (const x of lines.flatMap((line) => line.cells.map((cell) => cell.x)).sort((a, b) => a - b)) {
      if (!starts.length || x - starts[starts.length - 1] > 10) starts.push(x);
    }
    const widths = starts.map(() => 8);

    const data = lines.map((line) => {
      const row: (string | number | null)[] = starts.map(() => null);
      for (const cell of line.cells) {
        let col = Math.max(0, starts.filter((start) => start <= cell.x).length - 1);
        while (row[col] !== null && col < row.length - 1) col++;
        row[col] = toCellValue(cell.text);
        widths[col] = Math.min(60, Math.max(widths[col], cell.text.length + 2));
      }
      return row;
    });

    return { sheet: t('page', [i + 1]), data, columns: widths.map((width) => ({ width })) };
  });
  return writeXlsxFile(sheets).toBlob();
}

async function buildPptx(doc: pdfjsLib.PDFDocumentProxy, onProgress: OnProgress): Promise<Uint8Array> {
  const first = (await doc.getPage(1)).getViewport({ scale: 1 });
  const slideW = first.width / 72;
  const slideH = first.height / 72;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PDF', width: slideW, height: slideH });
  pptx.layout = 'PDF';

  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(n, doc.numPages);
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;

    // Farklı boyuttaki sayfa slayda oranı korunarak ortalanır
    const pageW = viewport.width / 2 / 72;
    const pageH = viewport.height / 2 / 72;
    const fit = Math.min(slideW / pageW, slideH / pageH);
    const w = pageW * fit;
    const h = pageH * fit;
    pptx.addSlide().addImage({
      data: canvas.toDataURL('image/jpeg', 0.92),
      x: (slideW - w) / 2,
      y: (slideH - h) / 2,
      w,
      h
    });
  }

  return (await pptx.write({ outputType: 'uint8array' })) as Uint8Array;
}

/**
 * PDF'yi Office biçimine dönüştürür. Word ve Excel metin katmanından kurulur (görseller aktarılmaz);
 * PowerPoint her sayfayı görüntü olarak bir slayta koyar.
 */
export async function convertPdfToOffice(
  data: Uint8Array,
  format: OfficeFormat,
  onProgress: OnProgress
): Promise<Uint8Array> {
  const doc = await PdfRenderService.loadDocument(data);
  try {
    // Belge sahibi içerik kopyalamayı kısıtladıysa koruma aşılmaz
    const permissions = await doc.getPermissions();
    if (permissions && !permissions.has(pdfjsLib.PermissionFlag.COPY)) {
      throw new Error(t('convert_copy_restricted'));
    }

    if (format === 'pptx') return await buildPptx(doc, onProgress);

    const pages: TextLine[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(n, doc.numPages);
      pages.push(await extractLines(await doc.getPage(n)));
    }
    if (!pages.some((lines) => lines.length)) throw new Error(t('convert_no_text'));

    const blob =
      format === 'docx'
        ? await buildDocx(pages, (await doc.getPage(1)).getViewport({ scale: 1 }))
        : await buildXlsx(pages);
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    doc.loadingTask.destroy();
  }
}
