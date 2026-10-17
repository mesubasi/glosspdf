/** Sayfa düzeni ekranındaki bir sayfa. source = özgün sayfa numarası (1'den), 0 = eklenen boş sayfa. */
export interface PageItem {
  key: string;
  source: number;
  /** Kullanıcının eklediği döndürme (saat yönünde, derece) */
  rotation: 0 | 90 | 180 | 270;
  /** Boş sayfa boyutu (PDF noktası) */
  size?: [number, number];
}

let nextKey = 0;
const newKey = () => `p${++nextKey}`;

export const initialItems = (pageCount: number): PageItem[] =>
  Array.from({ length: pageCount }, (_, i) => ({ key: newKey(), source: i + 1, rotation: 0 }));

/** from konumundaki öğeyi to konumuna taşır (sürükle-bırak). */
export function moveItem(items: PageItem[], from: number, to: number): PageItem[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Seçili sayfaları bir adım öne (-1) ya da arkaya (+1) taşır. Seçili bloklar birlikte kayar;
 * kenara dayanmış bir seçili sayfa yerinde kalır ve arkasındakiler onu aşmaz.
 */
export function moveSelected(items: PageItem[], selected: ReadonlySet<string>, delta: -1 | 1): PageItem[] {
  const next = [...items];
  const order = delta === -1 ? next.map((_, i) => i) : next.map((_, i) => next.length - 1 - i);
  for (const i of order) {
    const j = i + delta;
    if (j < 0 || j >= next.length) continue;
    if (selected.has(next[i].key) && !selected.has(next[j].key)) {
      [next[i], next[j]] = [next[j], next[i]];
    }
  }
  return next;
}

export const rotateSelected = (items: PageItem[], selected: ReadonlySet<string>): PageItem[] =>
  items.map((it) => (selected.has(it.key) ? { ...it, rotation: ((it.rotation + 90) % 360) as PageItem['rotation'] } : it));

/** Seçilileri siler; hepsi seçiliyse null döner (belge boş kalamaz). */
export function deleteSelected(items: PageItem[], selected: ReadonlySet<string>): PageItem[] | null {
  const next = items.filter((it) => !selected.has(it.key));
  return next.length ? next : null;
}

/** Son seçili sayfanın arkasına (seçim yoksa sona) boş sayfa ekler. */
export function insertBlank(items: PageItem[], selected: ReadonlySet<string>, size: [number, number]): PageItem[] {
  let at = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    if (selected.has(items[i].key)) {
      at = i + 1;
      break;
    }
  }
  const next = [...items];
  next.splice(at, 0, { key: newKey(), source: 0, rotation: 0, size });
  return next;
}

/** Başlangıç durumundan farklı mı (kaydedilmemiş değişiklik uyarısı için). */
export const isChanged = (items: PageItem[], pageCount: number) =>
  items.length !== pageCount || items.some((it, i) => it.source !== i + 1 || it.rotation !== 0);
