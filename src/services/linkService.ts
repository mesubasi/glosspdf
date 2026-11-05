/**
 * Bağlantı yardımcıları: güvenli adres denetimi, kullanıcının yazdığı adresin doğrulanması ve
 * sayfa metnindeki URL'lerin bulunması (Acrobat "URL'lerden Bağlantı Oluştur").
 * pdf.js'e ve tarayıcıya bağımlı değildir; node testlerinde doğrudan içe alınabilir.
 */

/** Yalnızca bu şemalar açılır ve yazılır; javascript:, file:, data: vb. hiçbir zaman */
export const isSafeLinkUrl = (url: string) => /^(https?|mailto):/i.test(url);

/** Kullanıcının yazdığı adresi doğrular; "www." ile başlayana https:// eklenir. Geçersizse null. */
export function normalizeLinkUrl(input: string): string | null {
  const text = /^www\./i.test(input.trim()) ? `https://${input.trim()}` : input.trim();
  try {
    const url = new URL(text);
    return isSafeLinkUrl(url.protocol) && (url.protocol === 'mailto:' ? url.pathname : url.hostname) ? text : null;
  } catch {
    return null;
  }
}

/** [x, y, w, h] dikdörtgenleri kesişiyor mu */
export const rectsOverlap = (a: number[], b: number[]) =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** pdf.js getTextContent() öğesinin kullanılan alanları */
export interface TextRun {
  str: string;
  transform: number[];
  width: number;
  hasEOL?: boolean;
  fontName?: string;
}

/** pdf.js PageViewport'un kullanılan kısmı (ölçek 1, /Rotate uygulanmış) */
export interface PointConverter {
  convertToViewportPoint(x: number, y: number): number[];
}

export interface FoundLink {
  url: string;
  rect: [number, number, number, number]; // AnnotationItem koordinatı: sol üst başlangıçlı, 72 DPI
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

/** Sondaki noktalama ve eşi olmayan ")" adresin parçası sayılmaz */
function trimUrl(url: string): string {
  for (;;) {
    if (/[.,;:!?]$/.test(url)) url = url.slice(0, -1);
    else if (url.endsWith(')') && url.split('(').length < url.split(')').length) url = url.slice(0, -1);
    else return url;
  }
}

/**
 * Helvetica genişlikleri (1/1000 em, ASCII 32–126). Metin parçası glif konumu vermez; karakter
 * konumu parça genişliği bu oranlarla bölünerek tahmin edilir (eşit bölmek bir karaktere varan kayma verir).
 * shortcut: gerçek glif genişlikleri yerine tek tablo; tablo dışı karakterler ortalama (556) sayılır.
 */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584
];

const fontHeight = (run: TextRun) => Math.hypot(run.transform[2], run.transform[3]);

/** Yazı yönündeki birim vektör (PDF kullanıcı uzayı) */
function direction(run: TextRun): [number, number] {
  const [a, b] = run.transform;
  const n = Math.hypot(a, b) || 1;
  return [a / n, b / n];
}

/**
 * Sayfa metnindeki http://, https:// ve www. adreslerini ve kapladıkları alanı bulur.
 * Aynı satırdaki ardışık parçalar birleştirilir (adres birden çok metin parçasına bölünmüş olabilir);
 * alan, karakter başına orantılı genişlikle eşleşen parçaların birleşimidir.
 */
export function findWebLinks(
  items: readonly unknown[],
  viewport: PointConverter,
  styles: Record<string, { fontFamily?: string }> = {}
): FoundLink[] {
  const found: FoundLink[] = [];
  let text = '';
  let runs: { run: TextRun; start: number }[] = [];

  const flushLine = () => {
    for (const match of text.matchAll(URL_PATTERN)) {
      const raw = trimUrl(match[0]);
      const url = normalizeLinkUrl(raw);
      if (!url) continue;
      const start = match.index ?? 0;
      const end = start + raw.length;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const { run, start: runStart } of runs) {
        const len = run.str.length;
        const i0 = Math.max(start, runStart) - runStart;
        const i1 = Math.min(end, runStart + len) - runStart;
        if (i1 <= i0) continue;
        // Eş aralıklı yazı tipinde her karakter aynı genişlikte
        const mono = styles[run.fontName ?? '']?.fontFamily === 'monospace';
        const widths = run.str.split('').map((c) => (mono ? 1 : (HELVETICA[c.charCodeAt(0) - 32] ?? 556)));
        const total = widths.reduce((a, b) => a + b, 0) || 1;
        const offset = (i: number) => (run.width * widths.slice(0, i).reduce((a, b) => a + b, 0)) / total;
        const [ux, uy] = direction(run);
        const h = fontHeight(run);
        const [e, f] = [run.transform[4], run.transform[5]];
        // Taban çizgisinin 0.2 em altından 0.8 em üstüne; "yukarı" yazı yönüne diktir
        for (const along of [offset(i0), offset(i1)]) {
          for (const up of [-0.2 * h, 0.8 * h]) {
            const [x, y] = viewport.convertToViewportPoint(e + ux * along - uy * up, f + uy * along + ux * up);
            xs.push(x);
            ys.push(y);
          }
        }
      }
      if (xs.length === 0) continue;
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      found.push({ url, rect: [x, y, Math.max(...xs) - x, Math.max(...ys) - y] });
    }
    text = '';
    runs = [];
  };

  let prev: TextRun | null = null;
  for (const item of items) {
    const run = item as TextRun;
    // İşaretli içerik başlangıç/bitiş öğelerinde metin yoktur
    if (typeof run?.str !== 'string' || !Array.isArray(run.transform)) continue;
    if (prev) {
      const [ux, uy] = direction(prev);
      const [vx, vy] = direction(run);
      const dx = run.transform[4] - prev.transform[4];
      const dy = run.transform[5] - prev.transform[5];
      const h = Math.max(fontHeight(prev), fontHeight(run));
      const gap = ux * dx + uy * dy - prev.width; // önceki parçanın bitişinden bu parçanın başına
      const sameLine =
        !prev.hasEOL && Math.abs(ux * vy - uy * vx) < 0.01 && Math.abs(ux * dy - uy * dx) < h * 0.5 && gap > -h;
      if (!sameLine) flushLine();
      // Aradaki boşluk metinde yoksa (ör. iki sütun aynı satırda) adresler birbirine eklenmesin
      else if (gap > h * 0.25 && !/\s$/.test(text) && !/^\s/.test(run.str)) text += ' ';
    }
    runs.push({ run, start: text.length });
    text += run.str;
    prev = run;
  }
  flushLine();
  return found;
}
