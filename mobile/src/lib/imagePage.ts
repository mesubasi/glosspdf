const A4: [number, number] = [595.28, 841.89];
const A4_MARGIN = 24;

/**
 * Görselin PDF sayfasındaki yeri. 'fit': sayfa görselin kendisi (72 dpi'de en uzun kenar A4 yüksekliği).
 * 'a4': görselin yönündeki A4 sayfaya kenar boşluğuyla ortalanır.
 */
export function imagePlacement(iw: number, ih: number, size: 'fit' | 'a4') {
  if (size === 'fit') {
    const k = A4[1] / Math.max(iw, ih);
    return { page: [iw * k, ih * k] as [number, number], x: 0, y: 0, w: iw * k, h: ih * k };
  }
  const page: [number, number] = iw > ih ? [A4[1], A4[0]] : A4;
  const k = Math.min((page[0] - 2 * A4_MARGIN) / iw, (page[1] - 2 * A4_MARGIN) / ih);
  const w = iw * k;
  const h = ih * k;
  return { page, x: (page[0] - w) / 2, y: (page[1] - h) / 2, w, h };
}
