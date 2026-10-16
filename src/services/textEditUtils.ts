const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * Düzenlenecek metnin kapladığı kutudan arka plan ve yazı rengini tahmin eder.
 * Arka plan = en sık görülen renk; yazı rengi = arka plandan en uzak piksel.
 * `cssRect` sayfa canvas'ına göre CSS piksel cinsindendir.
 */
export function sampleTextColors(
  canvas: HTMLCanvasElement,
  cssRect: { x: number; y: number; w: number; h: number }
): { bg: string; fg: string } {
  const fallback = { bg: '#ffffff', fg: '#000000' };
  const ctx = canvas.getContext('2d');
  const cssWidth = canvas.getBoundingClientRect().width;
  if (!ctx || !cssWidth) return fallback;

  const k = canvas.width / cssWidth;
  const x = Math.max(0, Math.floor(cssRect.x * k));
  const y = Math.max(0, Math.floor(cssRect.y * k));
  const w = Math.min(canvas.width - x, Math.ceil(cssRect.w * k));
  const h = Math.min(canvas.height - y, Math.ceil(cssRect.h * k));
  if (w < 1 || h < 1) return fallback;

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(x, y, w, h).data;
  } catch {
    return fallback;
  }

  // 4 bit/kanal'a nicemleyerek en sık rengi bul
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const key = ((pixels[i] >> 4) << 8) | ((pixels[i + 1] >> 4) << 4) | (pixels[i + 2] >> 4);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestKey = 0;
  let bestCount = -1;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  });
  const bg = [((bestKey >> 8) & 15) * 17, ((bestKey >> 4) & 15) * 17, (bestKey & 15) * 17];

  let far = 0;
  let fg = [0, 0, 0];
  for (let i = 0; i < pixels.length; i += 4) {
    const d =
      Math.abs(pixels[i] - bg[0]) + Math.abs(pixels[i + 1] - bg[1]) + Math.abs(pixels[i + 2] - bg[2]);
    if (d > far) {
      far = d;
      fg = [pixels[i], pixels[i + 1], pixels[i + 2]];
    }
  }
  // Belirgin bir yazı rengi bulunamadıysa (boş kutu) siyaha düş
  return { bg: toHex(bg[0], bg[1], bg[2]), fg: far < 60 ? '#000000' : toHex(fg[0], fg[1], fg[2]) };
}
