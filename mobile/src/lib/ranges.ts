export interface PageRange {
  start: number;
  end: number;
}

/**
 * "1-3, 5, 7-9" → [{1,3},{5,5},{7,9}]. Biçim hatalı veya sayfa sınırı dışındaysa null döner.
 * Boş girdi de geçersizdir; çağıran "her sayfa" gibi bir varsayılanı kendi seçer.
 */
export function parseRanges(input: string, totalPages: number): PageRange[] | null {
  const parts = input.split(',').map((p) => p.trim());
  if (parts.length === 0 || parts.some((p) => p === '')) return null;

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) return null;
    const start = Number(m[1]);
    const end = m[2] === undefined ? start : Number(m[2]);
    if (start < 1 || end < start || end > totalPages) return null;
    ranges.push({ start, end });
  }
  return ranges;
}

/** Aralıkları tek tek sayfa numaralarına açar (tekrarlar korunur, sıra aynı). */
export function expandRanges(ranges: PageRange[]): number[] {
  return ranges.flatMap(({ start, end }) => Array.from({ length: end - start + 1 }, (_, i) => start + i));
}
