import { PdfRenderService } from '@/services/pdfRenderService';
import type { PickedFile } from './documents';
import type { PageItem } from './pageOps';
import type { PageRange } from './ranges';
import { formatBytes, toBlob, type OutputFile } from './share';

const PDF = 'application/pdf';
const stem = (name: string) => name.replace(/\.pdf$/i, '');

// pdf-lib + fontkit + şifreleme ~1 MB; yalnızca bir araç ilk kez çalışınca yüklenir
const editService = () => import('@/services/pdfEditService').then((m) => m.PdfEditService);

/** pdf-lib şifreli PDF'i çözemez; ignoreEncryption ile işlenirse bozuk çıktı üretir. */
export class EncryptedPdfError extends Error {}
export class UnsupportedImageError extends Error {}

/** Sayfa sayısını döner; şifreli (parolalı ya da yalnızca izin kısıtlı) PDF'i reddeder. */
export async function inspectPdf(data: Uint8Array): Promise<number> {
  const doc = await (await editService()).loadPdf(data);
  if (doc.isEncrypted) throw new EncryptedPdfError('encrypted');
  return doc.getPageCount();
}

export async function mergePdfs(files: PickedFile[]): Promise<OutputFile[]> {
  const bytes = await (await editService()).mergePdfs(files.map((f) => f.data.slice()));
  return [{ name: `${stem(files[0].name)}_merged.pdf`, bytes, mime: PDF }];
}

export async function splitPdf(file: PickedFile, ranges: PageRange[]): Promise<OutputFile[]> {
  const parts = await (await editService()).splitPdf(file.data.slice(), ranges);
  return parts.map((bytes, i) => {
    const { start, end } = ranges[i];
    return { name: `${stem(file.name)}_p${start === end ? start : `${start}-${end}`}.pdf`, bytes, mime: PDF };
  });
}

export async function compressPdf(file: PickedFile, noSavingsNote: string): Promise<OutputFile[]> {
  const before = file.data.length;
  const compressed = await (await editService()).compressPdf(file.data.slice());
  const saved = compressed.length < before;
  return [
    {
      name: `${stem(file.name)}_compressed.pdf`,
      // Küçülmediyse büyümüş dosyayı vermek yerine özgünü ver
      bytes: saved ? compressed : file.data,
      mime: PDF,
      note: saved
        ? `${formatBytes(before)} → ${formatBytes(compressed.length)} (−${Math.round((1 - compressed.length / before) * 100)}%)`
        : noSavingsNote
    }
  ];
}

export async function protectPdf(file: PickedFile, password: string): Promise<OutputFile[]> {
  const bytes = await (await editService()).encryptPdf(file.data.slice(), password);
  return [{ name: `${stem(file.name)}_protected.pdf`, bytes, mime: PDF }];
}

export async function watermarkPdf(
  file: PickedFile,
  text: string,
  colorHex: string,
  opacity: number
): Promise<OutputFile[]> {
  const bytes = await (await editService()).addWatermark(file.data.slice(), text, { colorHex, opacity, size: 48 });
  return [{ name: `${stem(file.name)}_watermarked.pdf`, bytes, mime: PDF }];
}

function canvasToBytes(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject) : reject(new Error('toBlob failed'))),
      mime,
      quality
    )
  );
}

/** Seçili sayfaları sırayla görsele çizer; her sayfadan sonra canvas bırakılır. */
export async function exportImages(
  file: PickedFile,
  pages: number[],
  format: 'png' | 'jpeg',
  scale: number,
  onProgress: (done: number, total: number) => void
): Promise<OutputFile[]> {
  const doc = await PdfRenderService.loadDocument(file.data.slice());
  const mime = `image/${format}`;
  const outputs: OutputFile[] = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      onProgress(i, pages.length);
      const page = await doc.getPage(pages[i]);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const bytes = await canvasToBytes(canvas, mime, format === 'jpeg' ? 0.92 : undefined);
      canvas.width = canvas.height = 0;
      page.cleanup();
      outputs.push({ name: `${stem(file.name)}_p${pages[i]}.${format === 'png' ? 'png' : 'jpg'}`, bytes, mime });
    }
    onProgress(pages.length, pages.length);
  } finally {
    void doc.destroy();
  }
  return outputs;
}

/**
 * Sayfa düzenini tek geçişte uygular: sıra, döndürme, silinenler ve boş sayfalar.
 * shortcut: masaüstündeki reorderPages gibi sayfaları yeni belgeye kopyalar; içindekiler (outline)
 * ve form alanları taşınmaz. Gerekirse kaynak belgede yerinde düzenlemeye geç.
 */
export async function buildFromPages(file: PickedFile, items: PageItem[], suffix: string): Promise<OutputFile[]> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const src = await PDFDocument.load(file.data.slice());
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    items.filter((it) => it.source > 0).map((it) => it.source - 1)
  );
  let k = 0;
  for (const it of items) {
    if (it.source === 0) {
      out.addPage(it.size ?? [595.28, 841.89]);
      continue;
    }
    const page = copied[k++];
    if (it.rotation) page.setRotation(degrees((page.getRotation().angle + it.rotation) % 360));
    out.addPage(page);
  }
  const bytes = await out.save({ useObjectStreams: true });
  return [{ name: `${stem(file.name)}_${suffix}.pdf`, bytes, mime: PDF }];
}

const MAX_IMAGE_EDGE = 2000;

/** Her görsel biçimini (WebP dahil) en uzun kenarı 2000 px olacak şekilde PNG'ye çevirir. */
async function normalizeImage(data: Uint8Array): Promise<{ png: Uint8Array; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(toBlob(data));
  } catch {
    throw new UnsupportedImageError('unsupported image');
  }
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = await canvasToBytes(canvas, 'image/png');
  const size = { width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 0;
  return { png, ...size };
}

/**
 * Görseli sayfanın ortasına, sayfa genişliğinin widthPct yüzdesi kadar yerleştirir.
 * shortcut: konum yalnızca ortalanmış; sürükleyerek yerleştirme okuyucudaki imza akışıyla birlikte gelecek.
 */
export async function insertImage(
  file: PickedFile,
  image: PickedFile,
  pageNumber: number,
  widthPct: number
): Promise<OutputFile[]> {
  const service = await editService();
  const { png, width: iw, height: ih } = await normalizeImage(image.data);
  const { width: pw, height: ph } = (await service.loadPdf(file.data.slice())).getPage(pageNumber - 1).getSize();

  let w = (pw * widthPct) / 100;
  let h = (w * ih) / iw;
  if (h > ph) {
    w = (w * ph) / h;
    h = ph;
  }
  const bytes = await service.insertImage(file.data.slice(), pageNumber, png, false, (pw - w) / 2, (ph - h) / 2, w, h);
  return [{ name: `${stem(file.name)}_image.pdf`, bytes, mime: PDF }];
}
