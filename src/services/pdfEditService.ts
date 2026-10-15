import * as PDFLib from 'pdf-lib';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFString,
  PDFNumber,
  degrees,
  rgb,
  StandardFonts
} from 'pdf-lib';
import { configure, lock } from 'pdf-lib-encrypt';
import { AnnotationItem } from '../types/pdf';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16) || 0;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}

export class PdfEditService {
  /**
   * PDF belgesini yükler
   */
  static async loadPdf(data: Uint8Array): Promise<PDFDocument> {
    return await PDFDocument.load(data, { ignoreEncryption: true });
  }

  /**
   * İşaretlemeleri (Annotations) hem ISO 32000 sözlükleri hem de görsel katman olarak PDF'e yazar
   */
  static async savePdfWithAnnotations(
    data: Uint8Array,
    annotations: AnnotationItem[]
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const context = doc.context;
    const font = await doc.embedFont(StandardFonts.Helvetica);

    // Her sayfa için işaretlemeleri grupla
    const pages = doc.getPages();

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageNum = pageIdx + 1;
      const pageAnnots = annotations.filter((a) => a.pageNumber === pageNum);
      if (pageAnnots.length === 0) continue;

      const page = pages[pageIdx];
      const pageHeight = page.getHeight();

      // /Annots dizisini hazırla
      let annots = page.node.get(PDFName.of('Annots'));
      if (!annots) {
        const newAnnots = context.obj([]);
        page.node.set(PDFName.of('Annots'), newAnnots);
        annots = newAnnots;
      } else {
        annots = context.lookup(annots);
      }

      for (const item of pageAnnots) {
        const { r, g, b } = hexToRgb(item.color);
        const rgbColor = rgb(r, g, b);

        switch (item.type) {
          case 'highlight': {
            if (!item.rect) break;
            const [x, y, w, h] = item.rect;
            const llx = x;
            const urx = x + w;
            const lly = pageHeight - (y + h);
            const ury = pageHeight - y;

            // 1. ISO 32000 /Highlight nesnesi
            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'Highlight',
              Rect: [llx, lly, urx, ury],
              QuadPoints: [llx, ury, urx, ury, llx, lly, urx, lly],
              C: [r, g, b],
              F: 4,
              Contents: PDFString.of(item.contents || 'Vurgu')
            });
            (annots as any).push(context.register(annotDict));

            // 2. Kalıcı görsel yarı-saydam dikdörtgen
            page.drawRectangle({
              x: llx,
              y: lly,
              width: w,
              height: h,
              color: rgbColor,
              opacity: 0.35
            });
            break;
          }

          case 'underline': {
            if (!item.rect) break;
            const [x, y, w, h] = item.rect;
            const llx = x;
            const urx = x + w;
            const lly = pageHeight - (y + h);
            const ury = pageHeight - y;

            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'Underline',
              Rect: [llx, lly, urx, ury],
              QuadPoints: [llx, ury, urx, ury, llx, lly, urx, lly],
              C: [r, g, b],
              F: 4,
              Contents: PDFString.of(item.contents || 'Altı Çizili')
            });
            (annots as any).push(context.register(annotDict));

            page.drawLine({
              start: { x: llx, y: lly },
              end: { x: urx, y: lly },
              thickness: 1.5,
              color: rgbColor
            });
            break;
          }

          case 'strikeout': {
            if (!item.rect) break;
            const [x, y, w, h] = item.rect;
            const llx = x;
            const urx = x + w;
            const midY = pageHeight - (y + h / 2);

            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'StrikeOut',
              Rect: [llx, pageHeight - (y + h), urx, pageHeight - y],
              QuadPoints: [llx, midY, urx, midY, llx, midY, urx, midY],
              C: [r, g, b],
              F: 4,
              Contents: PDFString.of(item.contents || 'Üstü Çizili')
            });
            (annots as any).push(context.register(annotDict));

            page.drawLine({
              start: { x: llx, y: midY },
              end: { x: urx, y: midY },
              thickness: 1.5,
              color: rgbColor
            });
            break;
          }

          case 'note': {
            if (!item.rect) break;
            const [x, y] = item.rect;
            const llx = x;
            const lly = pageHeight - y - 24;

            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'Text',
              Rect: [llx, lly, llx + 24, lly + 24],
              Name: 'Comment',
              C: [r, g, b],
              Contents: PDFString.of(item.contents || ''),
              T: PDFString.of(item.author || 'Kullanıcı')
            });
            (annots as any).push(context.register(annotDict));

            // Görsel not simgesi
            page.drawRectangle({
              x: llx,
              y: lly,
              width: 18,
              height: 18,
              color: rgbColor,
              borderColor: rgb(0.2, 0.2, 0.2),
              borderWidth: 1
            });
            break;
          }

          case 'draw': {
            if (!item.points || item.points.length < 2) break;
            const strokeWidth = item.strokeWidth || 2;

            // Ink Listesi (PDF koordinatları)
            const inkList: number[] = [];
            const convertedPoints: { x: number; y: number }[] = [];

            for (const pt of item.points) {
              const pyX = pt.x;
              const pyY = pageHeight - pt.y;
              inkList.push(pyX, pyY);
              convertedPoints.push({ x: pyX, y: pyY });
            }

            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'Ink',
              Rect: [0, 0, page.getWidth(), pageHeight],
              InkList: [inkList],
              C: [r, g, b]
            });
            (annots as any).push(context.register(annotDict));

            // Görsel çizgi segmentleri
            for (let i = 0; i < convertedPoints.length - 1; i++) {
              page.drawLine({
                start: convertedPoints[i],
                end: convertedPoints[i + 1],
                thickness: strokeWidth,
                color: rgbColor
              });
            }
            break;
          }

          case 'rect': {
            if (!item.rect) break;
            const [x, y, w, h] = item.rect;
            const llx = x;
            const lly = pageHeight - (y + h);
            const strokeWidth = item.strokeWidth || 2;

            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'Square',
              Rect: [llx, lly, llx + w, lly + h],
              C: [r, g, b],
              BS: context.obj({ W: strokeWidth })
            });
            (annots as any).push(context.register(annotDict));

            page.drawRectangle({
              x: llx,
              y: lly,
              width: w,
              height: h,
              borderWidth: strokeWidth,
              borderColor: rgbColor
            });
            break;
          }

          case 'text': {
            if (!item.rect || !item.contents) break;
            const [x, y, w, h] = item.rect;
            const llx = x;
            const lly = pageHeight - (y + h);
            const fSize = item.fontSize || 14;

            const annotDict = context.obj({
              Type: 'Annot',
              Subtype: 'FreeText',
              Rect: [llx, lly, llx + w, lly + h],
              Contents: PDFString.of(item.contents),
              DA: PDFString.of(`/Helv ${fSize} Tf ${r} ${g} ${b} rg`)
            });
            (annots as any).push(context.register(annotDict));

            page.drawText(item.contents, {
              x: llx,
              y: pageHeight - y - fSize,
              size: fSize,
              font,
              color: rgbColor
            });
            break;
          }
        }
      }
    }

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Birden fazla PDF dosyasını tek bir belgede sırayla birleştirir (Merge)
   */
  static async mergePdfs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
    const mergedDoc = await PDFDocument.create();

    for (const buf of pdfBuffers) {
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    return await mergedDoc.save({ useObjectStreams: true });
  }

  /**
   * PDF belgesini sayfa aralıklarına göre böler (Split)
   */
  static async splitPdf(
    data: Uint8Array,
    ranges: { start: number; end: number }[]
  ): Promise<Uint8Array[]> {
    const sourceDoc = await this.loadPdf(data);
    const results: Uint8Array[] = [];

    for (const range of ranges) {
      const subDoc = await PDFDocument.create();
      const pageIndices: number[] = [];
      for (let i = range.start - 1; i <= range.end - 1; i++) {
        if (i >= 0 && i < sourceDoc.getPageCount()) {
          pageIndices.push(i);
        }
      }

      if (pageIndices.length > 0) {
        const copied = await subDoc.copyPages(sourceDoc, pageIndices);
        copied.forEach((p) => subDoc.addPage(p));
        results.push(await subDoc.save({ useObjectStreams: true }));
      }
    }

    return results;
  }

  /**
   * Sayfaları yeni sıralamaya göre yeniden dizer (Reorder Pages)
   */
  static async reorderPages(data: Uint8Array, pageOrder: number[]): Promise<Uint8Array> {
    const sourceDoc = await this.loadPdf(data);
    const newDoc = await PDFDocument.create();

    const pageIndices = pageOrder
      .map((p) => p - 1)
      .filter((i) => i >= 0 && i < sourceDoc.getPageCount());

    const copied = await newDoc.copyPages(sourceDoc, pageIndices);
    copied.forEach((p) => newDoc.addPage(p));

    return await newDoc.save({ useObjectStreams: true });
  }

  /**
   * Seçili sayfaları ayıklar ve yeni bir PDF olarak verir (Extract Pages)
   */
  static async extractPages(data: Uint8Array, pageNumbers: number[]): Promise<Uint8Array> {
    const sourceDoc = await this.loadPdf(data);
    const newDoc = await PDFDocument.create();

    const indices = pageNumbers
      .map((n) => n - 1)
      .filter((i) => i >= 0 && i < sourceDoc.getPageCount());

    const copied = await newDoc.copyPages(sourceDoc, indices);
    copied.forEach((p) => newDoc.addPage(p));

    return await newDoc.save({ useObjectStreams: true });
  }

  /**
   * Belirli bir sayfadan sonraya boş sayfa ekler (Insert Blank Page)
   */
  static async insertBlankPage(
    data: Uint8Array,
    insertAfterPage: number,
    width: number = 595.28,
    height: number = 841.89
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const targetIdx = Math.min(Math.max(0, insertAfterPage), doc.getPageCount());
    doc.insertPage(targetIdx, [width, height]);
    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Belgenin tüm sayfalarına yarı saydam çapraz filigran (Watermark) ekler
   */
  static async addWatermark(
    data: Uint8Array,
    text: string,
    options?: { colorHex?: string; opacity?: number; size?: number }
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();

    const opacity = options?.opacity ?? 0.22;
    const size = options?.size ?? 50;
    const { r, g, b } = options?.colorHex ? hexToRgb(options.colorHex) : { r: 0.8, g: 0.2, b: 0.2 };

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, size);
      const textHeight = font.heightAtSize(size);

      page.drawText(text, {
        x: width / 2 - textWidth / 2 + 30,
        y: height / 2 - textHeight / 2,
        size,
        font,
        color: rgb(r, g, b),
        opacity,
        rotate: degrees(45)
      });
    }

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Sayfaya profesyonel resmi damga (Stamp) ekler
   */
  static async addStamp(
    data: Uint8Array,
    pageNumber: number,
    stampText: string,
    colorHex: string = '#d32f2f'
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    const targetIdx = pageNumber - 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return data;

    const page = pages[targetIdx];
    const { width, height } = page.getSize();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const subFont = await doc.embedFont(StandardFonts.Helvetica);
    const { r, g, b } = hexToRgb(colorHex);
    const stampColor = rgb(r, g, b);

    // Damga kutusu sağ üst köşeye yerleşir
    const boxW = 160;
    const boxH = 60;
    const margin = 40;
    const boxX = width - boxW - margin;
    const boxY = height - boxH - margin;

    // Çift çerçeve
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      borderColor: stampColor,
      borderWidth: 2,
      opacity: 0.85
    });

    page.drawRectangle({
      x: boxX + 3,
      y: boxY + 3,
      width: boxW - 6,
      height: boxH - 6,
      borderColor: stampColor,
      borderWidth: 1,
      opacity: 0.85
    });

    // Ana metin
    const textW = font.widthOfTextAtSize(stampText, 16);
    page.drawText(stampText, {
      x: boxX + (boxW - textW) / 2,
      y: boxY + 32,
      size: 16,
      font,
      color: stampColor
    });

    // Tarih damgası
    const dateStr = new Date().toLocaleDateString('tr-TR');
    const dateW = subFont.widthOfTextAtSize(dateStr, 10);
    page.drawText(dateStr, {
      x: boxX + (boxW - dateW) / 2,
      y: boxY + 12,
      size: 10,
      font: subFont,
      color: stampColor
    });

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Sayfaya PNG el yazısı imza (Signature) ekler
   */
  static async addSignature(
    data: Uint8Array,
    pageNumber: number,
    pngBytes: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    const targetIdx = pageNumber - 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return data;

    const page = pages[targetIdx];
    const pageH = page.getHeight();
    const pngImage = await doc.embedPng(pngBytes);

    // 72 DPI PDF koordinatına yerleştir (y sol alttan başlar)
    const lly = pageH - (y + height);

    page.drawImage(pngImage, {
      x,
      y: lly,
      width,
      height
    });

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Sayfayı saat yönünde 90 derece döndürür
   */
  static async rotatePage(
    data: Uint8Array,
    pageIndex: number,
    clockwise: boolean = true
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    if (pageIndex >= 0 && pageIndex < pages.length) {
      const page = pages[pageIndex];
      const currentRotation = page.getRotation().angle;
      const newRotation = clockwise
        ? (currentRotation + 90) % 360
        : (currentRotation - 90 + 360) % 360;
      page.setRotation(degrees(newRotation));
    }
    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Tüm sayfaları döndürür
   */
  static async rotateAllPages(
    data: Uint8Array,
    clockwise: boolean = true
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    for (const page of pages) {
      const currentRotation = page.getRotation().angle;
      const newRotation = clockwise
        ? (currentRotation + 90) % 360
        : (currentRotation - 90 + 360) % 360;
      page.setRotation(degrees(newRotation));
    }
    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Sayfa silme
   */
  static async deletePage(data: Uint8Array, pageIndex: number): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    if (doc.getPageCount() > 1 && pageIndex >= 0 && pageIndex < doc.getPageCount()) {
      doc.removePage(pageIndex);
    }
    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Sayfaya PNG veya JPG görseli ekler
   */
  static async insertImage(
    data: Uint8Array,
    pageNumber: number,
    imageBytes: Uint8Array,
    isJpg: boolean,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    const targetIdx = pageNumber - 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return data;

    const page = pages[targetIdx];
    const pageH = page.getHeight();
    const img = isJpg ? await doc.embedJpg(imageBytes) : await doc.embedPng(imageBytes);

    const lly = pageH - (y + height);
    page.drawImage(img, {
      x,
      y: lly,
      width,
      height
    });

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Sayfada belirtilen koordinatları kalıcı olarak siyah bantla karartır (Redact)
   */
  static async applyRedaction(
    data: Uint8Array,
    pageNumber: number,
    rects: [number, number, number, number][] // [x, y, w, h] (72 DPI)
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    const targetIdx = pageNumber - 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return data;

    const page = pages[targetIdx];
    const pageH = page.getHeight();

    for (const [x, y, w, h] of rects) {
      const lly = pageH - (y + h);
      page.drawRectangle({
        x,
        y: lly,
        width: w,
        height: h,
        color: rgb(0, 0, 0),
        borderColor: rgb(0, 0, 0)
      });
    }

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * PDF belgesini nesne akışlarını optimize ederek ve gereksiz verileri temizleyerek sıkıştırır
   */
  static async compressPdf(data: Uint8Array): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    return await doc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
  }

  /**
   * PDF belgesini ISO 32000 AES-256 standardında kullanıcı parolasıyla şifreler
   */
  static async encryptPdf(data: Uint8Array, password: string): Promise<Uint8Array> {
    configure(PDFLib);
    const doc = await this.loadPdf(data);
    const rawBytes = await doc.save({ useObjectStreams: false });
    return await lock(rawBytes, password, { algo: 'aes256' });
  }

  /**
   * Belgeyi optimize edilmiş bayt dizisi olarak kaydeder
   */
  static async savePdf(doc: PDFDocument): Promise<Uint8Array> {
    return await doc.save({ useObjectStreams: true });
  }
}
