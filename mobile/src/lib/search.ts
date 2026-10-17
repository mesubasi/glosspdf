import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { findInRuns, getTextRuns, type Rect } from '../annot/textRuns';

/** Bir eşleşme: sayfa birimindeki kutuları ve sayfa boyutu (kutular sayfaya oranla çizilir) */
export interface SearchHit {
  page: number;
  rects: Rect[];
  pw: number;
  ph: number;
}

/** Tek harflik aramalar büyük belgede binlerce kutu çizmesin */
export const MAX_HITS = 500;

/** Belgeyi sayfa sayfa arar; her yeni sonuçta onHits çağrılır. cancelled() true olunca durur. */
export async function searchDocument(
  pdf: PDFDocumentProxy,
  query: string,
  locale: string,
  onHits: (hits: SearchHit[]) => void,
  cancelled: () => boolean
): Promise<void> {
  const found: SearchHit[] = [];
  for (let p = 1; p <= pdf.numPages && found.length < MAX_HITS; p++) {
    const page = await pdf.getPage(p);
    const { width: pw, height: ph } = page.getViewport({ scale: 1 });
    const runs = await getTextRuns(pdf, p);
    if (cancelled()) return;
    const before = found.length;
    for (const rects of findInRuns(runs, query, locale)) found.push({ page: p, rects, pw, ph });
    if (found.length > before) onHits(found.slice(0, MAX_HITS));
  }
}

interface SearchState {
  open: boolean;
  hits: SearchHit[];
  index: number;
  /** Tüm sayfalar tarandı */
  done: boolean;
  setOpen: (open: boolean) => void;
  setHits: (hits: SearchHit[], done: boolean) => void;
  setIndex: (index: number) => void;
}

/** Okuyucudaki arama; sayfalar vurguları buradan okur, geri tuşu aramayı kapatır */
export const useSearch = create<SearchState>((set) => ({
  open: false,
  hits: [],
  index: 0,
  done: false,
  setOpen: (open) => set({ open, hits: [], index: 0, done: false }),
  setHits: (hits, done) => set({ hits, done }),
  setIndex: (index) => set({ index })
}));
