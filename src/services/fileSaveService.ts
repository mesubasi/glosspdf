/**
 * Araç pencerelerinin (birleştir, böl, sıkıştır, koru, görüntü dışa aktar) ortak kayıt katmanı.
 *
 * Masaüstünde dosyalar kullanıcının gördüğü ve değiştirebildiği klasöre doğrudan yazılır;
 * tarayıcıda (electronAPI yok) indirme klasörüne indirilir.
 */

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
 * Dosyayı seçilen klasöre yazar.
 * onConflict 'overwrite': kullanıcı bileşende uyarıldı, üzerine yazılır.
 * onConflict 'rename': çoklu çıktılarda mevcut dosyalar korunur ("ad (2).pdf").
 */
export async function saveBytes(
  bytes: Uint8Array,
  dir: string,
  fileName: string,
  options: { onConflict?: 'overwrite' | 'rename'; mimeType?: string } = {}
): Promise<SavedFile> {
  const { onConflict = 'overwrite', mimeType = 'application/pdf' } = options;

  if (!isDesktop() || !dir) {
    downloadInBrowser(bytes, fileName, mimeType);
    return { filePath: fileName, fileName };
  }

  const res = await window.electronAPI!.writeFileTo(dir, fileName, bytesToBase64(bytes), onConflict);
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
