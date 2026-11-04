/**
 * Başka dosyalardan PDF oluşturma: görseller cihazda pdf-lib ile sayfaya dönüşür,
 * Word / Excel / PowerPoint dosyaları masaüstünde kurulu LibreOffice ile çevrilir (electron/main.ts).
 */
import { PDFDocument } from 'pdf-lib';
import { PdfEditService } from './pdfEditService';
import { bytesToBase64, stripExtension } from './fileSaveService';
import { t } from '@/i18n';

/** Chromium'un çözebildiği görseller (HEIC ve TIFF çözülemez) */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
/** electron/main.ts içindeki OFFICE_EXTENSIONS ile aynı olmalı */
const OFFICE_EXTENSIONS = ['doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp'];

/** Dosya seçicilerin accept değeri: PDF ve PDF'e dönüştürülebilen her şey */
export const OPENABLE_ACCEPT = ['pdf', ...IMAGE_EXTENSIONS, ...OFFICE_EXTENSIONS].map((ext) => `.${ext}`).join(',');

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

export const isPdfName = (name: string) => extensionOf(name) === 'pdf';
export const isOpenableName = (name: string) => OPENABLE_ACCEPT.split(',').includes(`.${extensionOf(name)}`);

/** LibreOffice yoksa indirme sayfasını önermek için ayırt edilen hata */
export class LibreOfficeMissingError extends Error {}

/** Telefon fotoğrafları A4 kadar olur; küçük görseller büyütülmez (1 piksel = 1 pt) */
const MAX_PAGE_SIDE = 842;

/** JPEG EXIF yön etiketi (1 = düz). Etiket yoksa ya da dosya bozuksa 1 */
export function jpegOrientation(bytes: Uint8Array): number {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset + 10 < view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const count = view.getUint16(ifd, little);
        for (let i = 0; i < count; i++) {
          const entry = ifd + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
        }
        return 1;
      }
      // Görüntü verisi (SOS) başladıysa ya da işaretçi bozuksa EXIF yoktur
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1;
      offset += 2 + view.getUint16(offset + 2);
    }
  } catch {
    // Kesik dosya: DataView sınır dışı okumada hata atar
  }
  return 1;
}

/** Tarayıcı çözücüsüyle (EXIF yönü uygulanmış) yeniden kodlar: JPEG kaynaklar JPEG, diğerleri PNG kalır */
async function reencodeImage(bytes: Uint8Array, asJpeg: boolean): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, asJpeg ? 'image/jpeg' : 'image/png', 0.92)
    );
    if (!blob) throw new Error('Image could not be encoded');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

async function imageToPdf(name: string, bytes: Uint8Array): Promise<Uint8Array> {
  const ext = extensionOf(name);
  const isJpeg = ext === 'jpg' || ext === 'jpeg';
  const doc = await PDFDocument.create();

  let image;
  if (isJpeg && jpegOrientation(bytes) === 1) {
    image = await doc.embedJpg(bytes); // Olduğu gibi gömülür: kalite kaybı yok
  } else if (ext === 'png') {
    image = await doc.embedPng(bytes).catch(async () => doc.embedPng(await reencodeImage(bytes, false)));
  } else if (isJpeg) {
    image = await doc.embedJpg(await reencodeImage(bytes, true)); // Döndürülmüş fotoğraf düz yazılır
  } else {
    image = await doc.embedPng(await reencodeImage(bytes, false));
  }

  const scale = Math.min(1, MAX_PAGE_SIDE / Math.max(image.width, image.height));
  const width = image.width * scale;
  const height = image.height * scale;
  doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  doc.setTitle(stripExtension(name));
  return doc.save({ useObjectStreams: true });
}

async function officeToPdf(name: string, bytes: Uint8Array): Promise<Uint8Array> {
  const convert = window.electronAPI?.convertOfficeToPdf;
  if (!convert) throw new Error(t('office_needs_desktop'));
  const res = await convert(name, bytesToBase64(bytes));
  if (res.error === 'not-installed') throw new LibreOfficeMissingError();
  if (!res.success || !res.data) throw new Error(res.error || 'LibreOffice');
  const binary = atob(res.data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** PDF'i olduğu gibi döndürür; görsel ve Office dosyasını PDF'e çevirir */
export async function fileToPdf(name: string, bytes: Uint8Array): Promise<Uint8Array> {
  if (isPdfName(name)) return bytes;
  const ext = extensionOf(name);
  if (IMAGE_EXTENSIONS.includes(ext)) return imageToPdf(name, bytes);
  if (OFFICE_EXTENSIONS.includes(ext)) return officeToPdf(name, bytes);
  throw new Error(t('unsupported_file_type'));
}

/** Seçilen sırayla tek bir PDF'te birleştirir */
export async function filesToPdf(files: { name: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  const pdfs: Uint8Array[] = [];
  for (const file of files) {
    try {
      pdfs.push(await fileToPdf(file.name, file.bytes));
    } catch (err) {
      if (err instanceof LibreOfficeMissingError) throw err;
      throw new Error(`${file.name}: ${(err as Error)?.message || String(err)}`);
    }
  }
  return pdfs.length === 1 ? pdfs[0] : PdfEditService.mergePdfs(pdfs);
}

/** LibreOffice eksikse indirme sayfasını önerir, diğer hatalarda mesaj gösterir */
export function reportConversionError(err: unknown) {
  if (err instanceof LibreOfficeMissingError) {
    // Ana süreç https bağlantılarını varsayılan tarayıcıda açar
    if (window.confirm(t('office_needs_libreoffice'))) window.open('https://www.libreoffice.org/download/', '_blank');
    return;
  }
  console.error('PDF could not be created:', err);
  alert(t('error_converting_file', { message: (err as Error)?.message || String(err) }));
}
