/** Kayıtlı imzalar: şeffaf PNG data URL'leri, yalnızca bu cihazda (localStorage). */
export interface SavedSignature {
  id: string;
  dataUrl: string;
  /** yükseklik / genişlik */
  aspect: number;
}

const KEY = 'glosspdf_mobile_signatures';
const MAX = 6;

export function loadSignatures(): SavedSignature[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function store(list: SavedSignature[]): SavedSignature[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Depolama dolu: imza bu oturumda yine de kullanılır, yalnızca hatırlanmaz
  }
  return list;
}

export function saveSignature(sig: Omit<SavedSignature, 'id'>): SavedSignature[] {
  const list = loadSignatures().filter((s) => s.dataUrl !== sig.dataUrl);
  return store([{ ...sig, id: `s${Date.now().toString(36)}` }, ...list].slice(0, MAX));
}

export const removeSignature = (id: string) => store(loadSignatures().filter((s) => s.id !== id));

/**
 * Canvas'taki içeriği saydam olmayan piksellerin çevresinden kırpar (kenar boşluğuyla).
 * Boşsa null döner.
 */
export function trimCanvas(src: HTMLCanvasElement, pad = 8): { dataUrl: string; aspect: number } | null {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { dataUrl: out.toDataURL('image/png'), aspect: out.height / out.width };
}
