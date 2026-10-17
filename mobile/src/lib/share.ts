import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface OutputFile {
  name: string;
  bytes: Uint8Array;
  mime: string;
  /** Sonuç ekranında dosyanın altında gösterilecek ek bilgi (örn. sıkıştırma oranı) */
  note?: string;
}

const OUT_DIR = 'outputs';

// Baytlarımız hiçbir zaman SharedArrayBuffer değil; TS 5.7+ Blob tipi bunu ayrıca istiyor
export const toBlob = (bytes: Uint8Array, type?: string) => new Blob([bytes as Uint8Array<ArrayBuffer>], { type });

function toBase64(bytes: Uint8Array): Promise<string> {
  // FileReader büyük dosyalarda btoa döngüsünden hızlı ve yığın taşırmaz
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(toBlob(bytes));
  });
}

/** Dosya adında Android'in kabul etmediği karakterleri temizler. */
const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_');

/** Tarayıcıda (geliştirme) native menüler yok; dosyalar indirme olarak verilir. */
function download(files: OutputFile[]) {
  for (const f of files) {
    const url = URL.createObjectURL(toBlob(f.bytes, f.mime));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Çıktıları uygulama önbelleğine yazar ve file:// adreslerini döner; önceki işlemin çıktıları silinir. */
async function writeToCache(files: OutputFile[]): Promise<string[]> {
  await Filesystem.rmdir({ path: OUT_DIR, directory: Directory.Cache, recursive: true }).catch(() => undefined);
  const uris: string[] = [];
  for (const f of files) {
    const { uri } = await Filesystem.writeFile({
      path: `${OUT_DIR}/${safeName(f.name)}`,
      data: await toBase64(f.bytes),
      directory: Directory.Cache,
      recursive: true
    });
    uris.push(uri);
  }
  return uris;
}

/**
 * Sonuç dosyalarını Android paylaşım menüsüyle verir (Drive, Mesajlar, e-posta…).
 * Paylaşıldıysa true, kullanıcı menüyü kapattıysa false döner.
 */
export async function shareFiles(files: OutputFile[], title: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    download(files);
    return true;
  }
  const uris = await writeToCache(files);
  try {
    await Share.share({ title, files: uris, dialogTitle: title });
    return true;
  } catch (e: any) {
    if (/cancel/i.test(e?.message || '')) return false;
    throw e;
  }
}

interface SaveFilePlugin {
  save(options: { files: { uri: string; name: string; mime: string }[] }): Promise<{ saved: number }>;
}

// android/app/src/main/java/io/github/glosspdf/SaveFilePlugin.java
const SaveFile = registerPlugin<SaveFilePlugin>('SaveFile');

/**
 * Android'in "Farklı kaydet" penceresini açar: tek dosyada konum + ad seçtirilir,
 * birden çok dosyada klasör seçtirilir. Kaydedilen dosya sayısını döner (iptal = 0).
 */
export async function saveFiles(files: OutputFile[]): Promise<number> {
  if (!Capacitor.isNativePlatform()) {
    download(files);
    return files.length;
  }
  const uris = await writeToCache(files);
  const { saved } = await SaveFile.save({
    files: files.map((f, i) => ({ uri: uris[i], name: safeName(f.name), mime: f.mime }))
  });
  return saved;
}

interface PrintFilePlugin {
  print(options: { uri: string; name: string }): Promise<void>;
}

// android/app/src/main/java/io/github/glosspdf/PrintFilePlugin.java
const PrintFile = registerPlugin<PrintFilePlugin>('PrintFile');

/** Android yazdırma penceresini açar (yazıcı veya "PDF olarak kaydet"). */
export async function printFile(file: OutputFile): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.open(URL.createObjectURL(toBlob(file.bytes, file.mime)));
    return;
  }
  const [uri] = await writeToCache([file]);
  await PrintFile.print({ uri, name: safeName(file.name) });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
