/**
 * Araç pencerelerinin (birleştir, böl, sıkıştır, koru, dışa aktar, dönüştür) ortak kayıt katmanı.
 *
 * Masaüstünde konum, iş bitince işletim sisteminin kayıt penceresiyle sorulur (tek dosya: "Farklı
 * Kaydet", çok dosya: klasör seçimi); tarayıcıda (electronAPI yok) indirme klasörüne indirilir.
 */
import { getLanguage } from '@/i18n';

export interface SavedFile {
  /** Masaüstünde tam yol; tarayıcıda yalnızca dosya adı */
  filePath: string;
  fileName: string;
}

export const isDesktop = () => typeof window !== 'undefined' && !!window.electronAPI?.writeFileTo;

/** Büyük dosyalarda String.fromCharCode yığın taşmasını önlemek için parça parça çevirir */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/** Klasör ayırıcılarını ve dosya sistemlerinde geçersiz karakterleri temizler */
export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
}

/** Uzantıyı (ör. ".pdf") tekilleştirir: "rapor" ve "rapor.pdf" → "rapor.pdf" */
export function withExtension(name: string, extension: string): string {
  const clean = sanitizeFileName(name) || 'Document';
  return clean.toLowerCase().endsWith(extension.toLowerCase()) ? clean : `${clean}${extension}`;
}

/** "rapor.pdf" → "rapor" */
export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Gerçek bir disk yolu mu? (sürükle-bırak / kaydedilmemiş sekmelerde yol yalnızca dosya adıdır) */
export function isRealPath(filePath?: string): filePath is string {
  return !!filePath && (/^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/') || filePath.startsWith('\\\\'));
}

/** Klasör + ad birleşimi (yalnızca gösterim için; ayırıcı klasör yolundan seçilir) */
export function joinPath(dir: string, fileName: string): string {
  if (!dir) return fileName;
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return dir.endsWith(sep) ? `${dir}${fileName}` : `${dir}${sep}${fileName}`;
}

export async function getDefaultSaveDir(sourcePath?: string): Promise<string> {
  if (!isDesktop()) return '';
  try {
    return await window.electronAPI!.getDefaultSaveDir(isRealPath(sourcePath) ? sourcePath : undefined);
  } catch {
    return '';
  }
}

function downloadInBrowser(bytes: Uint8Array, fileName: string, mimeType: string) {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Tek dosya: "Farklı Kaydet" penceresi kaynak belgenin klasöründe, önerilen adla açılır
 * (üzerine yazma onayını pencere kendisi sorar). Kullanıcı vazgeçerse null döner.
 */
export async function saveFileAs(
  bytes: Uint8Array,
  suggestedName: string,
  options: { sourcePath?: string; mimeType?: string } = {}
): Promise<SavedFile | null> {
  const { sourcePath, mimeType = 'application/pdf' } = options;
  const fileName = sanitizeFileName(suggestedName) || 'Document';

  if (!isDesktop()) {
    downloadInBrowser(bytes, fileName, mimeType);
    return { filePath: fileName, fileName };
  }

  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];
  const defaultPath = joinPath(await getDefaultSaveDir(sourcePath), fileName);
  const res = await window.electronAPI!.savePdfAs(defaultPath, bytesToBase64(bytes), getLanguage(), extension);
  if (res.canceled) return null;
  if (!res.success || !res.filePath) throw new Error(res.error || 'Unknown error');
  return { filePath: res.filePath, fileName: res.fileName || fileName };
}

/** Çok dosyalı çıktı: klasör seçme penceresi. Vazgeçilirse null; tarayıcıda '' (indirme klasörü) */
export async function pickOutputFolder(sourcePath?: string): Promise<string | null> {
  if (!isDesktop()) return '';
  const res = await window.electronAPI!.pickFolder(await getDefaultSaveDir(sourcePath), getLanguage());
  return res.success && res.folderPath ? res.folderPath : null;
}

/** pickOutputFolder ile seçilen klasöre yazar; aynı adda dosya varsa korunur ("ad (2).pdf") */
export async function saveBytes(
  bytes: Uint8Array,
  dir: string,
  fileName: string,
  mimeType = 'application/pdf'
): Promise<SavedFile> {
  if (!isDesktop() || !dir) {
    downloadInBrowser(bytes, fileName, mimeType);
    return { filePath: fileName, fileName };
  }

  const res = await window.electronAPI!.writeFileTo(dir, fileName, bytesToBase64(bytes), 'rename');
  if (!res.success || !res.filePath) {
    throw new Error(res.error || 'Unknown error');
  }
  return { filePath: res.filePath, fileName: res.fileName || fileName };
}

export async function showInFolder(targetPath: string) {
  if (isDesktop() && isRealPath(targetPath)) {
    await window.electronAPI!.showItemInFolder(targetPath);
  }
}
