import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Sayfa koordinatları: pdf.js viewport ölçek 1 (sol üst başlangıç, sayfa /Rotate'i uygulanmış).
 * PdfEditService.savePdfWithAnnotations da aynı uzayı bekler.
 */
export interface Pt {
  x: number;
  y: number;
}
export type Rect = [x: number, y: number, w: number, h: number];

/** Bir metin parçası: taban çizgisi başı/sonu ve tabandan yukarı (yazı boyu kadar) vektör. */
export interface TextRun {
  str: string;
  start: Pt;
  end: Pt;
  up: Pt;
}

export interface CharPos {
  run: number;
  /** 0..str.length arası karakter sınırı */
  k: number;
}

// Vurgu kutusu tabanın biraz altından (inen harfler) yazı boyunun biraz üstüne kadar
const BELOW = 0.25;
const ABOVE = 0.95;

const at = (r: TextRun, k: number): Pt => {
  const t = r.str.length ? k / r.str.length : 0;
  return { x: r.start.x + (r.end.x - r.start.x) * t, y: r.start.y + (r.end.y - r.start.y) * t };
};

/** Parçanın k0..k1 karakter aralığını kaplayan eksen hizalı kutu. */
function spanBox(r: TextRun, k0: number, k1: number): Rect {
  const a = at(r, k0);
  const b = at(r, k1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of [a, b]) {
    for (const f of [-BELOW, ABOVE]) {
      xs.push(p.x + r.up.x * f);
      ys.push(p.y + r.up.y * f);
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

const distToBox = (p: Pt, [x, y, w, h]: Rect) =>
  Math.hypot(Math.max(x - p.x, 0, p.x - (x + w)), Math.max(y - p.y, 0, p.y - (y + h)));

/** Noktaya en yakın parçayı ve karakter sınırını bulur; tolerance içinde yoksa null. */
export function locate(runs: TextRun[], p: Pt, tolerance = 18): CharPos | null {
  let best: { run: number; d: number } | null = null;
  runs.forEach((r, i) => {
    const d = distToBox(p, spanBox(r, 0, r.str.length));
    if (d <= tolerance && (!best || d < best.d)) best = { run: i, d };
  });
  if (!best) return null;
  const r = runs[(best as { run: number }).run];
  const dx = r.end.x - r.start.x;
  const dy = r.end.y - r.start.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((p.x - r.start.x) * dx + (p.y - r.start.y) * dy) / len2;
  const k = Math.min(r.str.length, Math.max(0, Math.round(t * r.str.length)));
  return { run: (best as { run: number }).run, k };
}

const before = (a: CharPos, b: CharPos) => a.run < b.run || (a.run === b.run && a.k <= b.k);

/** Tek dokunuşta parmağın altındaki kelimeyi seçmek için sınırları genişletir. */
function wordAt(r: TextRun, k: number): [number, number] {
  const isWord = (c: string | undefined) => !!c && !/\s/.test(c);
  let s = Math.min(k, r.str.length - 1);
  if (!isWord(r.str[s]) && isWord(r.str[s - 1])) s--;
  if (!isWord(r.str[s])) return [k, k];
  let e = s;
  while (isWord(r.str[s - 1])) s--;
  while (isWord(r.str[e])) e++;
  return [s, e];
}

/**
 * a ile b arasındaki metni satır kutularına çevirir (okuma sırası = pdf.js metin sırası).
 * Aynı satırdaki bitişik parçalar tek kutuda birleşir.
 */
export function spanRects(runs: TextRun[], a: CharPos, b: CharPos): { rects: Rect[]; text: string } {
  let [s, e] = before(a, b) ? [a, b] : [b, a];
  if (s.run === e.run && s.k === e.k) {
    const [k0, k1] = wordAt(runs[s.run], s.k);
    s = { run: s.run, k: k0 };
    e = { run: s.run, k: k1 };
  }
  const rects: Rect[] = [];
  const parts: string[] = [];
  for (let i = s.run; i <= e.run; i++) {
    const r = runs[i];
    const k0 = i === s.run ? s.k : 0;
    const k1 = i === e.run ? e.k : r.str.length;
    if (k1 <= k0) continue;
    parts.push(r.str.slice(k0, k1));
    const box = spanBox(r, k0, k1);
    const last = rects[rects.length - 1];
    if (last) {
      const overlap = Math.min(last[1] + last[3], box[1] + box[3]) - Math.max(last[1], box[1]);
      const gap = box[0] - (last[0] + last[2]);
      if (overlap > 0.6 * Math.min(last[3], box[3]) && gap < 0.6 * box[3] && gap > -box[3]) {
        const x = Math.min(last[0], box[0]);
        const y = Math.min(last[1], box[1]);
        rects[rects.length - 1] = [
          x,
          y,
          Math.max(last[0] + last[2], box[0] + box[2]) - x,
          Math.max(last[1] + last[3], box[1] + box[3]) - y
        ];
        continue;
      }
    }
    rects.push(box);
  }
  return { rects, text: parts.join(' ').replace(/\s+/g, ' ').trim() };
}

/**
 * Belgede arama: sorguyu büyük/küçük harf duyarsız arar, her eşleşmenin kutularını döner.
 * shortcut: eşleşme tek metin parçası içinde aranır; satır ya da parça sınırını aşan ifadeler bulunmaz.
 */
export function findInRuns(runs: TextRun[], query: string, locale?: string): Rect[][] {
  const q = query.toLocaleLowerCase(locale);
  if (!q) return [];
  const hits: Rect[][] = [];
  runs.forEach((r, run) => {
    const s = r.str.toLocaleLowerCase(locale);
    for (let k = s.indexOf(q); k !== -1; k = s.indexOf(q, k + q.length)) {
      hits.push(spanRects(runs, { run, k }, { run, k: k + q.length }).rects);
    }
  });
  return hits;
}

const cache = new WeakMap<PDFDocumentProxy, Map<number, Promise<TextRun[]>>>();

/** Sayfanın metin parçalarını sayfa koordinatlarında döner (belge başına önbellekli). */
export function getTextRuns(pdf: PDFDocumentProxy, pageNumber: number): Promise<TextRun[]> {
  let pages = cache.get(pdf);
  if (!pages) cache.set(pdf, (pages = new Map()));
  let runs = pages.get(pageNumber);
  if (!runs) {
    runs = (async () => {
      const page = await pdf.getPage(pageNumber);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const out: TextRun[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim() || !item.width) continue;
        const [a, b, c, d, e, f] = item.transform as number[];
        const ul = Math.hypot(a, b) || 1;
        const vl = Math.hypot(c, d) || 1;
        const h = item.height || vl;
        const toVp = (x: number, y: number): Pt => {
          const [vx, vy] = vp.convertToViewportPoint(x, y);
          return { x: vx, y: vy };
        };
        const start = toVp(e, f);
        const end = toVp(e + (a / ul) * item.width, f + (b / ul) * item.width);
        const top = toVp(e + (c / vl) * h, f + (d / vl) * h);
        out.push({ str: item.str, start, end, up: { x: top.x - start.x, y: top.y - start.y } });
      }
      return out;
    })();
    pages.set(pageNumber, runs);
  }
  return runs;
}
