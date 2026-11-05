import * as PDFLib from 'pdf-lib';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFHexString,
  PDFString,
  PDFPage,
  PDFFont,
  PDFRef,
  PDFDict,
  PDFStream,
  PDFObject,
  PDFRawStream,
  PDFNumber,
  decodePDFRawStream,
  degrees,
  rgb
} from 'pdf-lib';
import { PdfRenderService, viewportFor } from './pdfRenderService';
import fontkit from '@pdf-lib/fontkit';
import { configure, lock, unlockInPlace } from 'pdf-lib-encrypt';
import { AnnotationItem, BookmarkItem, DocMetadata, PdfTab } from '../types/pdf';
import { offsetOutline, sliceOutline, writeOutline } from './outlineService';
import { writeMetadata } from './metadataService';
import { t } from '@/i18n';
import { DEFAULT_WATERMARK_PLACEMENT, watermarkCenter, type WatermarkPlacement } from './watermarkLayout';
import { isSafeLinkUrl } from './linkService';

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

/** Kayıtta işaretlemelerle birlikte yazılan belge düzeyi düzenlemeler */
export interface DocEdits {
  outline?: BookmarkItem[];
  metadata?: DocMetadata;
}

/** Sekmenin bekleyen belge düzeyi düzenlemeleri (yalnızca değişenler yazılır) */
export const docEditsOf = (tab: Pick<PdfTab, 'outline' | 'outlineModified' | 'metadata'>): DocEdits => ({
  outline: tab.outlineModified ? tab.outline : undefined,
  metadata: tab.metadata
});

/** pdf-lib Producer alanına kendi adını yazar; onun yerine GlossPDF ve değiştirme tarihi yazılır */
function stampProducer(doc: PDFDocument): PDFDocument {
  doc.setProducer('GlossPDF');
  doc.setModificationDate(new Date());
  return doc;
}

/** Sıfırdan belge: Producer/Creator GlossPDF olur */
async function createPdf(): Promise<PDFDocument> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setCreator('GlossPDF');
  doc.setCreationDate(new Date());
  return stampProducer(doc);
}

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

/** Karartılan sayfaların görüntü çözünürlüğü */
const REDACT_DPI = 200;

/**
 * Kökten (katalog, bilgi sözlüğü) erişilemeyen nesneleri siler. pdf-lib save() bağlamdaki her
 * nesneyi yazar; silinmezse karartılan sayfanın eski içerik akışları dosyada kalır.
 */
function removeUnreachableObjects(doc: PDFDocument) {
  const { context } = doc;
  const reachable = new Set<PDFRef>();
  const { Root, Info, Encrypt } = context.trailerInfo;
  const stack: (PDFObject | undefined)[] = [Root, Info, Encrypt];
  while (stack.length > 0) {
    const obj = stack.pop();
    if (obj instanceof PDFRef) {
      if (reachable.has(obj)) continue;
      reachable.add(obj);
      stack.push(context.lookup(obj));
    } else if (obj instanceof PDFDict) {
      for (const [, value] of obj.entries()) stack.push(value);
    } else if (obj instanceof PDFArray) {
      stack.push(...obj.asArray());
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict);
    }
  }
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref)) context.delete(ref);
  }
}

/** Verilen işaretlemeleri (pdf.js kimliği, ör. "12R") açılır pencereleri ve yanıtlarıyla birlikte sayfalardan kaldırır */
function removeAnnotations(doc: PDFDocument, pdfjsIds: Set<string>) {
  const refs = new Set([...pdfjsIds].map((id) => id.replace(/^(\d+)R(\d*)$/, (_, n, g) => `${n} ${g || 0} R`)));
  const gone = (v: PDFObject | undefined) => v instanceof PDFRef && refs.has(v.toString());
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const annot = annots.lookup(i);
      if (
        gone(annots.get(i)) ||
        (annot instanceof PDFDict && (gone(annot.get(PDFName.of('Parent'))) || gone(annot.get(PDFName.of('IRT')))))
      ) {
        annots.remove(i);
      }
    }
  }
}

/** Hedefi (/Dest ya da GoTo eylemi) verilen sayfalardan birine giden bağlantıları kaldırır */
function removeLinksTo(doc: PDFDocument, pageRefs: Set<PDFRef>) {
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const annot = annots.lookup(i);
      if (!(annot instanceof PDFDict) || annot.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue;
      const action = annot.lookup(PDFName.of('A'));
      const dest = annot.lookup(PDFName.of('Dest')) ?? (action instanceof PDFDict ? action.lookup(PDFName.of('D')) : undefined);
      const target = dest instanceof PDFArray ? dest.get(0) : undefined;
      if (target instanceof PDFRef && pageRefs.has(target)) annots.remove(i);
    }
  }
}

/** Sıkıştırma seviyeleri: görüntünün uzun kenarı en fazla maxSide piksel, JPEG kalitesi quality */
export const COMPRESSION_LEVELS = {
  light: { maxSide: 2400, quality: 0.85 },
  balanced: { maxSide: 1600, quality: 0.7 },
  strong: { maxSide: 1000, quality: 0.5 }
} as const;
export type CompressionLevel = keyof typeof COMPRESSION_LEVELS;

/** Sıkıştırma ayarları; hazır seviyeler yalnızca maxSide/quality değerlerini belirler */
export interface CompressionOptions {
  /** Görüntünün uzun kenarı en fazla bu kadar piksel olur */
  maxSide: number;
  /** JPEG kalitesi (0–1) */
  quality: number;
  /** Renkli görüntüleri gri tonlamaya çevirir (metin ve vektörler değişmez) */
  grayscale?: boolean;
  /** Belge bilgisi (Info) ve XMP üst verisini siler */
  removeMetadata?: boolean;
  /** Gömülü sayfa küçük resimlerini (/Thumb) siler */
  removeThumbnails?: boolean;
  /** Gömülü dosya eklerini siler */
  removeAttachments?: boolean;
  /** Belge ve sayfa JavaScript'ini ve otomatik eylemleri siler */
  removeJavaScript?: boolean;
}

export interface CompressionResult {
  bytes: Uint8Array;
  /** Sıkıştırılabilir görüntü sayısı (yumuşak maskeler hariç) */
  imagesTotal: number;
  /** Yeniden kodlanan görüntü sayısı */
  imagesOptimized: number;
  /** Dosyadan çıkarılan nesne sayısı */
  objectsRemoved: number;
  /** Sonuç küçülmediyse true; bytes bu durumda özgün veridir */
  alreadyOptimized: boolean;
}

/**
 * 8 bit RGB/gri JPEG veya Flate görüntüyü küçültüp JPEG olarak yeniden kodlar; küçülmezse null döner.
 * Maskeli, CMYK, paletli, Decode dizili ve tahminci (predictor) kullanan görüntüler olduğu gibi kalır.
 * grayscale: renkli görüntü gri tonlamaya çevrilir; bu durumda küçülmese de sonuç kabul edilir.
 * shortcut: boyut sınırı sayfadaki gerçek DPI'ya değil piksele bakar; içerik akışı ayrıştırılırsa DPI'ya geçilmeli.
 */
async function recompressImage(
  stream: PDFRawStream,
  maxSide: number,
  quality: number,
  grayscale = false
): Promise<PDFRawStream | null> {
  const { dict } = stream;
  const get = (key: string) => dict.lookup(PDFName.of(key));
  const width = get('Width');
  const height = get('Height');
  if (
    !(width instanceof PDFNumber) ||
    !(height instanceof PDFNumber) ||
    get('BitsPerComponent')?.toString() !== '8' ||
    get('Mask') ||
    get('Decode') ||
    get('DecodeParms')
  ) {
    return null;
  }

  let filter = get('Filter');
  if (filter instanceof PDFArray && filter.size() === 1) filter = filter.lookup(0);
  let colorSpace = get('ColorSpace');
  if (colorSpace instanceof PDFArray && colorSpace.lookup(0) === PDFName.of('ICCBased')) {
    const n = (colorSpace.lookup(1) as PDFStream | undefined)?.dict.lookup(PDFName.of('N'))?.toString();
    colorSpace = n === '3' ? PDFName.of('DeviceRGB') : n === '1' ? PDFName.of('DeviceGray') : colorSpace;
  }
  const channels = colorSpace === PDFName.of('DeviceRGB') ? 3 : colorSpace === PDFName.of('DeviceGray') ? 1 : 0;
  if (!channels) return null;
  const toGray = grayscale && channels === 3;

  const w = width.asNumber();
  const h = height.asNumber();
  let source: CanvasImageSource;
  if (filter === PDFName.of('DCTDecode')) {
    source = await createImageBitmap(new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }));
  } else if (filter === PDFName.of('FlateDecode')) {
    const pixels = decodePDFRawStream(stream).decode();
    if (pixels.length < w * h * channels) return null;
    const rgba = new ImageData(w, h);
    for (let i = 0, p = 0; i < w * h; i++, p += channels) {
      rgba.data[i * 4] = pixels[p];
      rgba.data[i * 4 + 1] = pixels[channels === 3 ? p + 1 : p];
      rgba.data[i * 4 + 2] = pixels[channels === 3 ? p + 2 : p];
      rgba.data[i * 4 + 3] = 255;
    }
    source = await createImageBitmap(rgba);
  } else {
    return null;
  }

  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (toGray) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // ITU-R BT.601 parlaklık katsayıları
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(img, 0, 0);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return null;
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  if (!toGray && jpeg.length >= stream.contents.length) return null;

  // Tuval her zaman RGB JPEG üretir
  dict.set(PDFName.of('Width'), PDFNumber.of(canvas.width));
  dict.set(PDFName.of('Height'), PDFNumber.of(canvas.height));
  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
  dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
  return PDFRawStream.of(dict, jpeg);
}

/** Bir eylem sözlüğü (veya Next zinciri) JavaScript içeriyorsa true */
function isJavaScriptAction(action: PDFObject | undefined, context: PDFDocument['context']): boolean {
  const dict = action instanceof PDFRef ? context.lookup(action) : action;
  if (!(dict instanceof PDFDict)) return false;
  if (dict.lookup(PDFName.of('S')) === PDFName.of('JavaScript')) return true;
  const next = dict.lookup(PDFName.of('Next'));
  if (next instanceof PDFArray) return next.asArray().some((a) => isJavaScriptAction(a, context));
  return isJavaScriptAction(next, context);
}

/** Sıkıştırma öncesi isteğe bağlı temizlik: üst veri, küçük resimler, ekler, JavaScript */
function stripOptionalData(doc: PDFDocument, options: CompressionOptions) {
  const { context, catalog } = doc;
  const names = catalog.lookup(PDFName.of('Names'));
  const pages = doc.getPages();

  if (options.removeMetadata) {
    context.trailerInfo.Info = undefined;
    for (const [, obj] of context.enumerateIndirectObjects()) {
      const dict = obj instanceof PDFDict ? obj : obj instanceof PDFStream ? obj.dict : undefined;
      if (!dict) continue;
      // Görüntü/sayfa/katalog üzerindeki XMP akışları ve uygulamaya özel veriler
      dict.delete(PDFName.of('Metadata'));
      dict.delete(PDFName.of('PieceInfo'));
    }
    catalog.delete(PDFName.of('Metadata'));
  }

  if (options.removeThumbnails) {
    for (const page of pages) page.node.delete(PDFName.of('Thumb'));
  }

  if (options.removeAttachments) {
    if (names instanceof PDFDict) names.delete(PDFName.of('EmbeddedFiles'));
    catalog.delete(PDFName.of('AF'));
    for (const page of pages) {
      const annots = page.node.lookup(PDFName.of('Annots'));
      if (!(annots instanceof PDFArray)) continue;
      for (let i = annots.size() - 1; i >= 0; i--) {
        const annot = annots.lookup(i);
        if (annot instanceof PDFDict && annot.lookup(PDFName.of('Subtype')) === PDFName.of('FileAttachment')) {
          annots.remove(i);
        }
      }
    }
  }

  if (options.removeJavaScript) {
    if (names instanceof PDFDict) names.delete(PDFName.of('JavaScript'));
    if (isJavaScriptAction(catalog.get(PDFName.of('OpenAction')), context)) catalog.delete(PDFName.of('OpenAction'));
    catalog.delete(PDFName.of('AA'));
    for (const page of pages) page.node.delete(PDFName.of('AA'));
    // Bağlantı ve form alanlarındaki JavaScript eylemleri
    for (const [, obj] of context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFDict)) continue;
      if (isJavaScriptAction(obj.get(PDFName.of('A')), context)) obj.delete(PDFName.of('A'));
      const aa = obj.lookup(PDFName.of('AA'));
      if (aa instanceof PDFDict && obj.lookup(PDFName.of('Subtype')) === PDFName.of('Widget')) {
        obj.delete(PDFName.of('AA'));
      }
    }
  }
}

export class PdfEditService {
  /**
   * PDF belgesini yükler
   */
  static async loadPdf(data: Uint8Array): Promise<PDFDocument> {
    return stampProducer(await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false }));
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
    annotations: AnnotationItem[],
    imported: AnnotationItem[] = [],
    edits: DocEdits = {}
  ): Promise<Uint8Array> {
    // Dosyadan içe alınan işaretlemeler değişmediyse yerinde kalır; bir parçası değişen ya da silinen
    // işaretleme dosyadan kaldırılır ve kalan parçaları yeni işaretleme olarak yazılır.
    const current = new Map(annotations.map((a) => [a.id, JSON.stringify(a)]));
    const replacedRefs = new Set(
      imported.filter((a) => current.get(a.id) !== JSON.stringify(a)).map((a) => a.sourceRef!)
    );
    annotations = annotations.filter((a) => !a.sourceRef || replacedRefs.has(a.sourceRef));

    // Hiçbir değişiklik yoksa baytlara dokunma (şifreli belgeyi bozmamak için de gerekli)
    if (annotations.length === 0 && replacedRefs.size === 0 && !edits.outline && !edits.metadata) return data;

    const doc = await this.loadPdf(data);
    if (replacedRefs.size > 0) removeAnnotations(doc, replacedRefs);
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
        const author = PDFHexString.fromText(item.author || t('annotation_author_default'));

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
              Contents: PDFHexString.fromText(item.contents || '')
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
              { Name: 'Comment', C: [r, g, b], Contents: PDFHexString.fromText(item.contents || ''), T: author }
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
              const bytes = dataUrlToBytes(item.imageData);
              images.set(
                item.imageData,
                item.imageData.startsWith('data:image/jpeg') ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
              );
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

          case 'link': {
            // Görünmez bağlantı (görünüm akışı yok); URI 7 bit ASCII olmalı, parantez ve ters bölü kaçışlı yazılır
            const target =
              item.linkUrl && isSafeLinkUrl(item.linkUrl)
                ? { A: { S: 'URI', URI: PDFString.of(new URL(item.linkUrl).href.replace(/[\\()]/g, '\\$&')) } }
                : item.linkPage && pages[item.linkPage - 1]
                  ? { Dest: [pages[item.linkPage - 1].ref, 'Fit'] }
                  : null;
            if (!item.rect || !target) break;
            const box = map.rect(...item.rect);
            annots.push(
              context.register(
                context.obj({
                  Type: 'Annot',
                  Subtype: 'Link',
                  Rect: [box.x, box.y, box.x + box.width, box.y + box.height].map(num),
                  Border: [0, 0, 0],
                  ...target
                })
              )
            );
            break;
          }
        }
      }
    }

    if (edits.outline) writeOutline(doc, edits.outline);
    if (edits.metadata) writeMetadata(doc, edits.metadata);
    // Silinen yorumların metni dosyada sahipsiz nesne olarak kalmasın
    if (replacedRefs.size > 0) removeUnreachableObjects(doc);
    const saved = await doc.save({ useObjectStreams: true });
    const redactions = annotations.filter((a) => a.type === 'redact' && a.rect);
    return redactions.length > 0 ? await this.applyRedactions(saved, redactions) : saved;
  }

  /**
   * Karartma: işaretli her sayfa, kutular siyaha boyanmış hâliyle görüntüye çevrilir ve sayfanın
   * eski içeriği (metin, vektör, görseller, işaretlemeler, form alanları) dosyadan silinir.
   * Sayfa sözlüğü yerinde kalır; yer imleri ve bağlantılar bozulmaz. Diğer sayfalar aynen kalır.
   * shortcut: sayfanın tamamı görüntüye döner (o sayfada metin seçilemez/aranamaz); yalnızca kutu
   * altındaki glifleri silmek içerik akışı ayrıştırıcısı ister, istenirse o zaman eklenmeli.
   */
  static async applyRedactions(data: Uint8Array, redactions: AnnotationItem[]): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const { context } = doc;
    const pages = doc.getPages();
    const pageNumbers = [...new Set(redactions.map((r) => r.pageNumber))].filter((n) => n >= 1 && n <= pages.length);

    // Form alanları AcroForm'dan da erişilir: değerleri kalmasın diye sayfalar temizlenmeden önce kaldırılır
    const redactedAnnots = new Set<PDFRef>();
    for (const n of pageNumbers) {
      const annots = pages[n - 1].node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      annots?.asArray().forEach((ref) => ref instanceof PDFRef && redactedAnnots.add(ref));
    }
    if (redactedAnnots.size > 0 && doc.catalog.has(PDFName.of('AcroForm'))) {
      const form = doc.getForm();
      for (const field of form.getFields()) {
        const onRedactedPage = field.acroField
          .getWidgets()
          .some((widget) => redactedAnnots.has(context.getObjectRef(widget.dict)!));
        if (onRedactedPage) form.removeField(field);
      }
    }

    const pdfjsDoc = await PdfRenderService.loadDocument(data.slice());
    try {
      for (const n of pageNumbers) {
        const pdfjsPage = await pdfjsDoc.getPage(n);
        const scale = REDACT_DPI / 72;
        const viewport = viewportFor(pdfjsPage, scale);
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await pdfjsPage.render({ canvas, viewport, intent: 'print', background: '#ffffff' }).promise;

        // Kutular sayfa-ekran noktası (sol üst, /Rotate uygulanmış); kenar pikselleri de örtülsün diye dışa yuvarlanır
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000000';
        for (const r of redactions) {
          if (r.pageNumber !== n || !r.rect) continue;
          const [x, y, w, h] = r.rect;
          const left = Math.floor(x * scale);
          const top = Math.floor(y * scale);
          ctx.fillRect(left, top, Math.ceil((x + w) * scale) - left, Math.ceil((y + h) * scale) - top);
        }

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (!blob) throw new Error(`Page ${n} could not be rendered for redaction`);
        const image = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const { width, height } = viewportFor(pdfjsPage, 1);
        pdfjsPage.cleanup();

        // Yalnızca /Type ve /Parent kalır; /Rotate ve kutular üst düğümden miras alınmasın diye açıkça yazılır
        const node = pages[n - 1].node;
        for (const key of node.keys()) {
          if (key !== PDFName.of('Type') && key !== PDFName.of('Parent')) node.delete(key);
        }
        const box = context.obj([0, 0, num(width), num(height)]);
        node.set(PDFName.of('MediaBox'), box);
        node.set(PDFName.of('CropBox'), box);
        node.set(PDFName.of('Rotate'), context.obj(0));
        node.set(PDFName.of('Resources'), context.obj({ XObject: { Im0: image.ref } }));
        node.set(
          PDFName.of('Contents'),
          context.register(context.flateStream(`q ${num(width)} 0 0 ${num(height)} 0 0 cm /Im0 Do Q`))
        );
      }
    } finally {
      pdfjsDoc.loadingTask.destroy();
    }

    // Etiket ağacı karartılan metnin kopyasını (/ActualText, /Alt) taşıyabilir
    doc.catalog.delete(PDFName.of('StructTreeRoot'));
    doc.catalog.delete(PDFName.of('MarkInfo'));
    removeUnreachableObjects(doc);
    // Alan görünümlerini yeniden üretmek Unicode olmayan Helvetica ister; karartma buna gerek duymaz
    return await doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  }

  /**
   * Birden fazla PDF dosyasını tek bir belgede sırayla birleştirir (Merge)
   */
  static async mergePdfs(pdfBuffers: Uint8Array[], outlines: BookmarkItem[][] = []): Promise<Uint8Array> {
    const mergedDoc = await createPdf();
    // Her kaynağın yer imleri, kendi sayfalarının birleşik belgedeki yerine kaydırılarak eklenir
    const outline: BookmarkItem[] = [];

    for (const [i, buf] of pdfBuffers.entries()) {
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
      outline.push(...offsetOutline(outlines[i] ?? [], mergedDoc.getPageCount()));
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    writeOutline(mergedDoc, outline);
    return await mergedDoc.save({ useObjectStreams: true });
  }

  /**
   * PDF belgesini sayfa aralıklarına göre böler (Split)
   */
  static async splitPdf(
    data: Uint8Array,
    ranges: { start: number; end: number }[],
    outline: BookmarkItem[] = [],
    metadata?: DocMetadata
  ): Promise<Uint8Array[]> {
    const sourceDoc = await this.loadPdf(data);
    const results: Uint8Array[] = [];
    // Parçalar kaynağın başlık/yazar/konu/anahtar kelimelerini taşır (bekleyen düzenleme varsa onu)
    const meta = metadata ?? {
      title: sourceDoc.getTitle() ?? '',
      author: sourceDoc.getAuthor() ?? '',
      subject: sourceDoc.getSubject() ?? '',
      keywords: sourceDoc.getKeywords() ?? ''
    };

    for (const range of ranges) {
      const subDoc = await createPdf();
      const pageIndices: number[] = [];
      for (let i = range.start - 1; i <= range.end - 1; i++) {
        if (i >= 0 && i < sourceDoc.getPageCount()) {
          pageIndices.push(i);
        }
      }

      if (pageIndices.length > 0) {
        const copied = await subDoc.copyPages(sourceDoc, pageIndices);
        copied.forEach((p) => subDoc.addPage(p));
        writeOutline(subDoc, sliceOutline(outline, pageIndices[0] + 1, pageIndices[pageIndices.length - 1] + 1));
        writeMetadata(subDoc, meta);
        results.push(await subDoc.save({ useObjectStreams: true }));
      }
    }

    return results;
  }

  /**
   * Sayfaları yeni sıralamaya göre yeniden dizer (Reorder Pages); sırada olmayan sayfalar silinir.
   * Aynı belgede yapılır: katalog (Info, XMP, yer imleri, adlandırılmış hedefler, formlar, sayfa etiketleri) korunur.
   */
  static async reorderPages(data: Uint8Array, pageOrder: number[]): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const pages = doc.getPages();
    // Ara /Pages düğümlerinden devralınan öznitelikler sayfaya yazılır: ağaçta yeri değişince kaybolmasın
    for (const page of pages) {
      for (const key of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) {
        const value = page.node.getInheritableAttribute(PDFName.of(key));
        if (value) page.node.set(PDFName.of(key), value);
      }
    }
    const order = [...new Set(pageOrder)].filter((p) => p >= 1 && p <= pages.length);
    for (let i = pages.length - 1; i >= 0; i--) doc.removePage(i);
    order.forEach((p, i) => doc.insertPage(i, pages[p - 1]));
    // Silinen sayfaya giden bağlantılar kaldırılır: ağaçta olmayan sayfa hedefi okuyucularda hata verir
    const removed = new Set(pages.filter((_, i) => !order.includes(i + 1)).map((page) => page.ref));
    if (removed.size > 0) removeLinksTo(doc, removed);
    // Silinen sayfalar ve boşalan ara düğümler dosyada sahipsiz kalmasın
    removeUnreachableObjects(doc);

    return await doc.save({ useObjectStreams: true });
  }

  /**
   * Seçili sayfaları ayıklar ve yeni bir PDF olarak verir (Extract Pages)
   */
  static async extractPages(data: Uint8Array, pageNumbers: number[]): Promise<Uint8Array> {
    const sourceDoc = await this.loadPdf(data);
    const newDoc = await createPdf();

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
   * Belgenin tüm sayfalarına yarı saydam filigran (Watermark) ekler; varsayılan yer sayfa ortası, 45°
   */
  static async addWatermark(
    data: Uint8Array,
    text: string,
    options?: { colorHex?: string; opacity?: number; size?: number; placement?: WatermarkPlacement }
  ): Promise<Uint8Array> {
    const doc = await this.loadPdf(data);
    const font = await embedUnicodeFont(doc, true);
    const pages = doc.getPages();

    const opacity = options?.opacity ?? 0.22;
    const size = options?.size ?? 50;
    const place = options?.placement ?? DEFAULT_WATERMARK_PLACEMENT;
    const { r, g, b } = options?.colorHex ? hexToRgb(options.colorHex) : { r: 0.8, g: 0.2, b: 0.2 };
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size, { descender: false });

    for (const page of pages) {
      const { rot, pt } = pageMapper(page);
      const { width, height } = page.getCropBox();
      const [viewW, viewH] = rot % 180 ? [height, width] : [width, height];
      const c = watermarkCenter(viewW, viewH, textWidth, textHeight, place);
      const at = pt(c.x, c.y);
      // Görünen açıyı korumak için sayfa dönüşü eklenir; drawText taban çizgisinin sol ucundan döndürür
      const angle = place.angle + rot;
      const rad = (angle * Math.PI) / 180;

      page.drawText(text, {
        x: at.x - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad),
        y: at.y - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad),
        size,
        font,
        color: rgb(r, g, b),
        opacity,
        rotate: degrees(angle)
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
   * PDF'i sıkıştırır: görüntüleri küçültüp yeniden kodlar, isteğe bağlı verileri temizler,
   * erişilemeyen nesneleri atar ve nesne akışlarıyla kaydeder. Sonuç küçülmezse özgün veri döner.
   */
  static async compressPdf(
    data: Uint8Array,
    options: CompressionOptions = COMPRESSION_LEVELS.balanced,
    onProgress?: (done: number, total: number) => void
  ): Promise<CompressionResult> {
    // Üst veri silinecekse pdf-lib'in Producer/ModDate yazmasını engelle
    const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
    if (!options.removeMetadata) stampProducer(doc);
    const { maxSide, quality, grayscale = false } = options;

    stripOptionalData(doc, options);

    const objects = doc.context.enumerateIndirectObjects();
    // Yumuşak maskeler gri kalmalı (tuval yalnızca RGB JPEG üretir); onlara dokunulmaz
    const softMasks = new Set<PDFObject | undefined>();
    for (const [, obj] of objects) {
      if (obj instanceof PDFRawStream) softMasks.add(obj.dict.get(PDFName.of('SMask')));
    }
    const images = objects.filter(
      ([ref, obj]) =>
        obj instanceof PDFRawStream &&
        !softMasks.has(ref) &&
        obj.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image')
    ) as [PDFRef, PDFRawStream][];

    let imagesOptimized = 0;
    onProgress?.(0, images.length);
    for (let i = 0; i < images.length; i++) {
      const [ref, obj] = images[i];
      const smaller = await recompressImage(obj, maxSide, quality, grayscale).catch((err) => {
        console.warn(`Image ${ref} was left as is:`, err);
        return null;
      });
      if (smaller) {
        doc.context.assign(ref, smaller);
        imagesOptimized++;
      }
      onProgress?.(i + 1, images.length);
    }

    // Önceki artımlı kayıtlardan kalan ve temizlikten sonra sahipsiz kalan nesneler de dosyadan çıkar
    const countBefore = doc.context.enumerateIndirectObjects().length;
    removeUnreachableObjects(doc);
    const objectsRemoved = countBefore - doc.context.enumerateIndirectObjects().length;

    const bytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
    // Gri tonlama istendiyse dosya büyüse de sonuç korunur (istenen bir görsel değişiklik)
    const alreadyOptimized = bytes.byteLength >= data.byteLength && !(grayscale && imagesOptimized > 0);
    return {
      bytes: alreadyOptimized ? data : bytes,
      imagesTotal: images.length,
      imagesOptimized: alreadyOptimized ? 0 : imagesOptimized,
      objectsRemoved: alreadyOptimized ? 0 : objectsRemoved,
      alreadyOptimized
    };
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
    const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
    await unlockInPlace(doc, password);
    stampProducer(doc);
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
