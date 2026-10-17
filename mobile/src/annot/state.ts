import { create } from 'zustand';
import type { AnnotationItem } from '@/types/pdf';
import { S } from '../strings';
import type { Pt } from './textRuns';

export type AnnotTool = 'highlight' | 'underline' | 'strikeout' | 'draw' | 'note' | 'rect' | 'text';

export const TEXT_MARKUP: ReadonlySet<string> = new Set(['highlight', 'underline', 'strikeout']);

/** Tek hareketle oluşan öğeler (ör. çok satırlı vurgu) aynı grubu paylaşır: id = "grup#sıra" */
export const groupOf = (id: string) => id.split('#')[0];
let seq = 0;
export const newGroup = () => `a${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Not / metin kutusu yazma penceresi */
export interface EditRequest {
  kind: 'note' | 'text' | 'comment';
  /** Var olan öğeyi düzenlerken */
  group?: string;
  /** Yeni öğe eklerken */
  page?: number;
  at?: Pt;
  initial: string;
}

const DEFAULT_COLORS: Record<AnnotTool, string> = {
  highlight: '#FFD60A',
  underline: '#2F7BEA',
  strikeout: '#FF3B30',
  draw: '#FF3B30',
  note: '#FFD60A',
  rect: '#FF3B30',
  text: '#1E2129'
};

interface AnnotState {
  active: boolean;
  tool: AnnotTool | null;
  colors: Record<AnnotTool, string>;
  /** Vurgu opaklığı (0.1–1) */
  opacity: number;
  /** Kalem ve dikdörtgen çizgi kalınlığı (pt) */
  stroke: number;
  /** Metin kutusu yazı boyu (pt) */
  fontSize: number;
  items: AnnotationItem[];
  past: AnnotationItem[][];
  future: AnnotationItem[][];
  selected: string | null;
  editing: EditRequest | null;

  begin: (tool?: AnnotTool | null) => void;
  reset: () => void;
  /** Kaydedilmemiş işaretleme varsa onay ister; çıkıldıysa true */
  exit: () => boolean;
  setTool: (tool: AnnotTool | null) => void;
  setColor: (color: string) => void;
  setOpacity: (v: number) => void;
  setStroke: (v: number) => void;
  setFontSize: (v: number) => void;
  /** Geri alınabilir değişiklik */
  commit: (next: AnnotationItem[]) => void;
  undo: () => void;
  redo: () => void;
  select: (group: string | null) => void;
  removeGroup: (group: string) => void;
  setEditing: (req: EditRequest | null) => void;
}

const fresh = { items: [], past: [], future: [], selected: null, editing: null };

export const useAnnot = create<AnnotState>((set, get) => ({
  active: false,
  tool: null,
  colors: DEFAULT_COLORS,
  opacity: 0.4,
  stroke: 2,
  fontSize: 14,
  ...fresh,

  begin: (tool = 'highlight') => set({ active: true, tool, ...fresh }),
  reset: () => set({ active: false, tool: null, ...fresh }),
  exit: () => {
    if (get().items.length && !window.confirm(S.discardChanges)) return false;
    get().reset();
    return true;
  },
  setTool: (tool) => set({ tool, selected: null }),
  setColor: (color) => {
    const { tool, colors } = get();
    if (tool) set({ colors: { ...colors, [tool]: color } });
  },
  setOpacity: (opacity) => set({ opacity }),
  setStroke: (stroke) => set({ stroke }),
  setFontSize: (fontSize) => set({ fontSize }),

  commit: (next) => set(({ items, past }) => ({ items: next, past: [...past, items], future: [] })),
  undo: () =>
    set(({ items, past, future }) =>
      past.length ? { items: past[past.length - 1], past: past.slice(0, -1), future: [items, ...future], selected: null } : {}
    ),
  redo: () =>
    set(({ items, past, future }) =>
      future.length ? { items: future[0], past: [...past, items], future: future.slice(1), selected: null } : {}
    ),
  select: (selected) => set({ selected }),
  removeGroup: (group) => {
    get().commit(get().items.filter((it) => groupOf(it.id) !== group));
    set({ selected: null });
  },
  setEditing: (editing) => set({ editing })
}));
