import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface RecentDoc {
  id: string;
  name: string;
  pages: number;
  size: number;
  lastOpened: number;
  /** Birinci sayfanın küçük JPEG önizlemesi (data URL) */
  thumb?: string;
}

const MAX_RECENTS = 12;
const META_KEY = 'glosspdf_mobile_recents';
const DB_NAME = 'glosspdf-mobile';
const STORE = 'files';

// ---------- Yerel dosya deposu (IndexedDB) ----------
// Seçici'den gelen content:// adresi uygulama yeniden açılınca geçersiz olur;
// "Son açılanlar" çalışsın diye PDF baytları uygulamanın kendi deposuna kopyalanır.

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const putBytes = (id: string, data: Uint8Array) => withStore('readwrite', (s) => s.put(data, id));
const deleteBytes = (id: string) => withStore('readwrite', (s) => s.delete(id));

export async function readStoredBytes(id: string): Promise<Uint8Array | null> {
  const value = await withStore<Uint8Array | undefined>('readonly', (s) => s.get(id));
  return value ?? null;
}

// ---------- Son açılanlar (meta veri) ----------

export function loadRecents(): RecentDoc[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecents(list: RecentDoc[]) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {
    // Depolama dolu/kapalı: son açılanlar kaydedilemez ama uygulama çalışmaya devam eder
  }
}

export const docId = (name: string, size: number) => `${name}|${size}`;

/** Belgeyi son açılanların başına koyar; baytlar depoya yazılır, sınırı aşanlar silinir. */
export async function rememberDocument(
  doc: Omit<RecentDoc, 'lastOpened'>,
  data: Uint8Array
): Promise<RecentDoc[]> {
  await putBytes(doc.id, data);
  const list = [{ ...doc, lastOpened: Date.now() }, ...loadRecents().filter((r) => r.id !== doc.id)];
  const evicted = list.slice(MAX_RECENTS);
  const kept = list.slice(0, MAX_RECENTS);
  await Promise.all(evicted.map((r) => deleteBytes(r.id).catch(() => undefined)));
  saveRecents(kept);
  return kept;
}

export function touchRecent(id: string): RecentDoc[] {
  const list = loadRecents();
  const hit = list.find((r) => r.id === id);
  if (!hit) return list;
  const next = [{ ...hit, lastOpened: Date.now() }, ...list.filter((r) => r.id !== id)];
  saveRecents(next);
  return next;
}

export async function forgetDocument(id: string): Promise<RecentDoc[]> {
  await deleteBytes(id).catch(() => undefined);
  const next = loadRecents().filter((r) => r.id !== id);
  saveRecents(next);
  return next;
}

// ---------- Dosya seçici ----------

export interface PickedFile {
  name: string;
  data: Uint8Array;
}
export type PickedPdf = PickedFile;

export class NotAPdfError extends Error {}

const isPdf = (b: Uint8Array) =>
  // %PDF- imzası; bazı üreticiler başa birkaç bayt çöp koyar, ilk 1 KB'ta aranır
  new TextDecoder('latin1').decode(b.subarray(0, 1024)).includes('%PDF-');

export function assertPdf(data: Uint8Array) {
  if (!isPdf(data)) throw new NotAPdfError('not a pdf');
}

/** Sistem seçicisini açar ve seçilen dosyaları okur. İptalde boş dizi döner. limit 0 = sınırsız. */
async function pickFiles(types: string[], limit: number): Promise<PickedFile[]> {
  let files;
  try {
    ({ files } = await FilePicker.pickFiles({ types, limit }));
  } catch (e: any) {
    if (/cancel/i.test(e?.message || '')) return [];
    throw e;
  }
  return Promise.all(
    files.map(async (f) => {
      const buffer = f.blob
        ? await f.blob.arrayBuffer()
        : await (await fetch(Capacitor.convertFileSrc(f.path!))).arrayBuffer();
      return { name: f.name, data: new Uint8Array(buffer) };
    })
  );
}

/** Bir veya (multiple ise) birden çok PDF seçtirir; PDF olmayan dosya NotAPdfError atar. */
export async function pickPdfs(multiple = false): Promise<PickedPdf[]> {
  const picked = await pickFiles(['application/pdf'], multiple ? 0 : 1);
  picked.forEach((p) => assertPdf(p.data));
  return picked;
}

/** Kullanıcıya PDF seçtirir. İptal edilirse null döner. */
export async function pickPdf(): Promise<PickedPdf | null> {
  return (await pickPdfs())[0] ?? null;
}

/** Tek görsel seçtirir (PNG, JPEG, WebP…). İptalde null. */
export async function pickImage(): Promise<PickedFile | null> {
  return (await pickFiles(['image/*'], 1))[0] ?? null;
}

/** Birinci sayfadan küçük önizleme üretir; başarısız olursa undefined (kart yer tutucu gösterir). */
export async function makeThumbnail(pdf: PDFDocumentProxy): Promise<string | undefined> {
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 264 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}
