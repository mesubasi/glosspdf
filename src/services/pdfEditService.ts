import * as PDFLib from 'pdf-lib';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFString,
  PDFPage,
  PDFFont,
  degrees,
  rgb
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { configure, lock, unlockInPlace } from 'pdf-lib-encrypt';
import { AnnotationItem } from '../types/pdf';
import { t } from '@/i18n';

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

/** XHR kullanılır: Electron'da file:// altında fetch() engellenir, XHR çalışır (status 0). */
function loadBinary(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () =>
      xhr.status === 200 || xhr.status === 0
        ? resolve(new Uint8Array(xhr.response as ArrayBuffer))
        : reject(new Error(`${url}: HTTP ${xhr.status}`));
    xhr.onerror = () => reject(new Error(`${url}: could not be loaded`));
    xhr.send();
  });
}

const fontBytesCache = new Map<string, Promise<Uint8Array>>();

/**
 * Unicode destekli (Latin genişletilmiş: ş ğ ı İ ö ü ç, Kiril, Yunanca) font gömer.
 * Standart Helvetica yalnızca WinAnsi'yi bilir; "ş/ğ/İ" yazan metin kaydı çökertirdi.
 */
async function embedUnicodeFont(doc: PDFDocument, bold = false): Promise<PDFFont> {
  const file = bold ? 'LiberationSans-Bold.ttf' : 'LiberationSans-Regular.ttf';
  if (!fontBytesCache.has(file)) {
    fontBytesCache.set(file, loadBinary(`${import.meta.env.BASE_URL}fonts/${file}`));
  }
  doc.registerFontkit(fontkit);
  return doc.embedFont(await fontBytesCache.get(file)!, { subset: true });
}

/** Önizleme (DOM) ve kayıt aynı satır tabanını kullansın diye ortak oran */
export const BASELINE_RATIO = 0.85;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1] || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Sayfa-ekran koordinatlarını (sol üst başlangıç, /Rotate uygulanmış, 72 DPI) PDF kullanıcı
 * uzayına çevirir. /Rotate'li ve CropBox'ı sıfırdan başlamayan sayfalarda da doğru konum verir.
 */
function pageMapper(page: PDFPage) {
  const { x: x0, y: y0, width: W, height: H } = page.getCropBox();
  const rot = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const pt = (dx: number, dy: number) => {
    switch (rot) {
      case 90:
        return { x: x0 + dy, y: y0 + dx };
      case 180:
        return { x: x0 + W - dx, y: y0 + dy };
      case 270:
        return { x: x0 + W - dy, y: y0 + H - dx };
      default:
        return { x: x0 + dx, y: y0 + H - dy };
    }
  };
  /** Ekran dikdörtgeni [x,y,w,h] → PDF'te eksen hizalı dikdörtgen */
  const rect = (x: number, y: number, w: number, h: number) => {
    const a = pt(x, y);
    const b = pt(x + w, y + h);
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y)
    };
  };
  return { rot, pt, rect };
}

const num = (n: number) => Number(n.toFixed(3));

export class PdfEditService {
  /**
   * PDF belgesini yükler
   */
  static async loadPdf(data: Uint8Array): Promise<PDFDocument> {
    return await PDFDocument.load(data, { ignoreEncryption: true });
  }

  /**
   * Bekleyen düzenlemeleri (işaretleme, imza, metin düzenleme) PDF'e yazar.
   *
   * - Vurgu/altı çizili/üstü çizili/not/kalem/dikdörtgen: ISO 32000 annotation + görünüm akışı (/AP).
   *   (Görsel ayrıca çizilmez; aksi halde çoğu okuyucuda iki kez görünür.)
   * - Metin kutusu, metin düzenleme ve imza: sayfa içeriğine gömülür.
   */
  static async savePdfWithAnnotations(
    data: Uint8Array,
    annotations: AnnotationItem[]
  ): Promise<Uint8Array> {
    // Hiçbir değişiklik yoksa baytlara dokunma (şifreli belgeyi bozmamak için de gerekli)
    if (annotations.length === 0) return data;

    const doc = await this.loadPdf(data);
    const context = doc.context;
    const pages = doc.getPages();
    const needsFont = annotations.some((a) => a.type === 'text' || a.type === 'textedit');
    const font = needsFont ? await embedUnicodeFont(doc) : null;
    const images = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageAnnots = annotations.filter((a) => a.pageNumber === pageIdx + 1);
      if (pageAnnots.length === 0) continue;

      const page = pages[pageIdx];
      const map = pageMapper(page);

      const annots = (() => {
        const existing = page.node.lookup(PDFName.of('Annots'));
        if (existing instanceof PDFArray) return existing;
        const created = context.obj([]);
        page.node.set(PDFName.of('Annots'), created);
        return created;
      })();

      /** /AP içeren bir annotation kaydeder; Rect = BBox */
      const addMarkup = (
        subtype: string,
        box: { x: number; y: number; width: number; height: number },
        ap: string,
        extra: Record<string, any>,
        resources: Record<string, any> = {}
      ) => {
        const bbox = [box.x, box.y, box.x + box.width, box.y + box.height].map(num);
        const stream = context.stream(ap, {
          Type: 'XObject',
          Subtype: 'Form',
          BBox: bbox,
          Resources: resources
        });
        annots.push(
          context.register(
            context.obj({
              Type: 'Annot',
              Subtype: subtype,
              Rect: bbox,
              F: 4,
              AP: { N: context.register(stream) },
              ...extra
            })
          )
        );
      };

      for (const item of pageAnnots) {
        const { r, g, b } = hexToRgb(item.color);
        const col = `${num(r)} ${num(g)} ${num(b)}`;
        const author = PDFString.of(item.author || t('annotation_author_default'));

        switch (item.type) {
          case 'highlight':
          case 'underline':
          case 'strikeout': {
            if (!item.rect) break;
            const box = map.rect(...item.rect);
            const q = [
              box.x, box.y + box.height, box.x + box.width, box.y + box.height,
              box.x, box.y, box.x + box.width, box.y
            ].map(num);
            const common = {
              QuadPoints: q,
              C: [r, g, b],
              T: author,
              Contents: PDFString.of(item.contents || '')
            };
            if (item.type === 'highlight') {
              addMarkup(
                'Highlight',
                box,
                `/GS0 gs ${col} rg ${num(box.x)} ${num(box.y)} ${num(box.width)} ${num(box.height)} re f`,
                common,
                {
                  ExtGState: {
                    GS0: { Type: 'ExtGState', ca: item.opacity ?? 0.35, CA: item.opacity ?? 0.35, BM: 'Multiply' }
                  }
                }
              );
            } else {
              const ly = item.type === 'underline' ? box.y + 1 : box.y + box.height / 2;
              addMarkup(
                item.type === 'underline' ? 'Underline' : 'StrikeOut',
                box,
                `${col} RG 1.5 w ${num(box.x)} ${num(ly)} m ${num(box.x + box.width)} ${num(ly)} l S`,
                common
              );
            }
            break;
          }

          case 'note': {
            if (!item.rect) break;
            const box = map.rect(item.rect[0], item.rect[1], 24, 24);
            const x = num(box.x);
            const y = num(box.y);
            addMarkup(
              'Text',
              box,
              `${col} rg 0.2 0.2 0.2 RG 1 w ${x + 1} ${y + 1} 22 22 re B ` +
                `0.15 0.15 0.15 RG ${x + 5} ${y + 16} m ${x + 19} ${y + 16} l ` +
                `${x + 5} ${y + 12} m ${x + 19} ${y + 12} l ${x + 5} ${y + 8} m ${x + 14} ${y + 8} l S`,
              { Name: 'Comment', C: [r, g, b], Contents: PDFString.of(item.contents || ''), T: author }
            );
            break;
          }

          case 'draw': {
            if (!item.points || item.points.length < 2) break;
            const sw = item.strokeWidth || 2;
            const pts = item.points.map((p) => map.pt(p.x, p.y));
            const xs = pts.map((p) => p.x);
            const ys = pts.map((p) => p.y);
            const box = {
              x: Math.min(...xs) - sw,
              y: Math.min(...ys) - sw,
              width: Math.max(...xs) - Math.min(...xs) + sw * 2,
              height: Math.max(...ys) - Math.min(...ys) + sw * 2
            };
            const path = pts.map((p, i) => `${num(p.x)} ${num(p.y)} ${i === 0 ? 'm' : 'l'}`).join(' ');
            addMarkup('Ink', box, `${col} RG ${sw} w 1 J 1 j ${path} S`, {
              InkList: [pts.flatMap((p) => [num(p.x), num(p.y)])],
              C: [r, g, b],
              BS: { W: sw },
              T: author
            });
            break;
          }

          case 'rect': {
            if (!item.rect) break;
            const sw = item.strokeWidth || 2;
            const inner = map.rect(...item.rect);
            const box = {
              x: inner.x - sw / 2,
              y: inner.y - sw / 2,
              width: inner.width + sw,
              height: inner.height + sw
            };
            addMarkup(
              'Square',
              box,
              `${col} RG ${sw} w ${num(inner.x)} ${num(inner.y)} ${num(inner.width)} ${num(inner.height)} re S`,
              { C: [r, g, b], BS: { W: sw }, T: author }
            );
            break;
          }

          case 'text': {
            if (!item.rect || !item.contents || !font) break;
            const fs = item.fontSize || 14;
            const origin = map.pt(item.rect[0], item.rect[1] + fs * BASELINE_RATIO);
            page.drawText(item.contents, {
              x: origin.x,
              y: origin.y,
              size: fs,
              font,
              color: rgb(r, g, b),
              rotate: degrees(map.rot)
            });
            break;
          }

          case 'textedit': {
            if (!item.rect || !font) break;
            const [x, y, w, h] = item.rect;
            const pad = Math.max(1, (item.fontSize || 12) * 0.1);
            const cover = map.rect(x - pad, y - pad, w + pad * 2, h + pad * 2);
            const bg = hexToRgb(item.bgColor || '#ffffff');
            page.drawRectangle({ ...cover, color: rgb(bg.r, bg.g, bg.b), borderWidth: 0 });
            if (item.contents) {
              const fs = item.fontSize || 12;
              const origin = map.pt(x, y + fs * BASELINE_RATIO);
              page.drawText(item.contents, {
                x: origin.x,
                y: origin.y,
                size: fs,
                font,
                color: rgb(r, g, b),
                rotate: degrees(map.rot)
              });
            }
            break;
          }

          case 'signature': {
            if (!item.rect || !item.imageData) break;
            const [x, y, w, h] = item.rect;
            if (!images.has(item.imageData)) {
              images.set(item.imageData, await doc.embedPng(dataUrlToBytes(item.imageData)));
            }
            const origin = map.pt(x, y + h);
            page.drawImage(images.get(item.imageData)!, {
              x: origin.x,
              y: origin.y,
              width: w,
              height: h,
              rotate: degrees(map.rot)
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
    const font = await embedUnicodeFont(doc, true);
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
    const font = await embedUnicodeFont(doc, true);
    const subFont = await embedUnicodeFont(doc);
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
    const dateStr = new Date().toISOString().slice(0, 10);
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
   * Parolayı kaldırır (kullanıcı ya da sahip parolası). Yanlış parolada veya desteklenmeyen
   * şifrelemede (AES-128, şifreli nesne akışları) pdf-lib-encrypt açıklayıcı hata fırlatır.
   */
  static async decryptPdf(data: Uint8Array, password: string): Promise<Uint8Array> {
    configure(PDFLib);
    const doc = await PDFDocument.load(data, { ignoreEncryption: true });
    await unlockInPlace(doc, password);
    return await doc.save({ useObjectStreams: false });
  }

  /**
   * Form alanlarını doldurur. values: tam alan adı → metin, seçenek ya da onay durumu.
   * Metin ve seçim görünümleri Unicode fontla yeniden çizilir (Helvetica "ş/ğ/İ" yazamaz).
   */
  static async fillForm(data: Uint8Array, values: Record<string, string | boolean>): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const form = doc.getForm();
    const font = await embedUnicodeFont(doc);
    for (const [name, value] of Object.entries(values)) {
      const field = form.getFieldMaybe(name);
      if (field instanceof PDFLib.PDFTextField) {
        field.setText(String(value) || undefined);
        field.updateAppearances(font);
      } else if (field instanceof PDFLib.PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFLib.PDFRadioGroup) {
        // Görüntüleyiciler düğmenin görünüm adını ("0", "1") verir; /Opt varsa pdf-lib seçeneği onun adıyla seçer
        const options = field.getOptions();
        const onValues = field.acroField.getOnValues().map((v) => v.decodeText());
        const option = options.includes(String(value)) ? String(value) : options[onValues.indexOf(String(value))];
        if (option) field.select(option);
      } else if (field instanceof PDFLib.PDFDropdown || field instanceof PDFLib.PDFOptionList) {
        if (field.getOptions().includes(String(value))) {
          field.select(String(value));
          field.updateAppearances(font);
        }
      }
    }
    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Belgeyi optimize edilmiş bayt dizisi olarak kaydeder
   */
  static async savePdf(doc: PDFDocument): Promise<Uint8Array> {
    return await doc.save({ useObjectStreams: true });
  }
}
