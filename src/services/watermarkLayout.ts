import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Filigranın sayfadaki yeri; sayfanın ekranda göründüğü hâline göre (/Rotate uygulanmış) */
export interface WatermarkPlacement {
  /** Metin merkezi: 0 = sol / üst kenar, 1 = sağ / alt kenar (kenar boşluğu içinde) */
  x: number;
  y: number;
  /** Saat yönünün tersine derece */
  angle: number;
}

export const DEFAULT_WATERMARK_PLACEMENT: WatermarkPlacement = { x: 0.5, y: 0.5, angle: 45 };

/** PDF birimi (1/72 inç) */
const MARGIN = 24;
/** LiberationSans-Bold yükselen payı / punto; önizleme metin yüksekliğini bununla tahmin eder */
const ASCENT = 0.905;

/**
 * Döndürülmüş metnin merkezi (sol üst başlangıç). Metin kenar boşluğu içinde kalır;
 * bir eksende sığmıyorsa o eksende ortalanır.
 */
export function watermarkCenter(
  pageW: number,
  pageH: number,
  textW: number,
  textH: number,
  p: WatermarkPlacement,
  margin = MARGIN
): { x: number; y: number } {
  const rad = (p.angle * Math.PI) / 180;
  const boxW = Math.abs(textW * Math.cos(rad)) + Math.abs(textH * Math.sin(rad));
  const boxH = Math.abs(textW * Math.sin(rad)) + Math.abs(textH * Math.cos(rad));
  const axis = (size: number, box: number, f: number) => {
    const free = size - box - 2 * margin;
    return free > 0 ? margin + box / 2 + f * free : size / 2;
  };
  return { x: axis(pageW, boxW, p.x), y: axis(pageH, boxH, p.y) };
}

/** watermarkCenter'ın tersi: merkezi verilen noktaya en yakın düşen yerleşim (0..1'e kırpılır) */
export function placementAt(
  pageW: number,
  pageH: number,
  textW: number,
  textH: number,
  angle: number,
  point: { x: number; y: number },
  margin = MARGIN
): { x: number; y: number } {
  const lo = watermarkCenter(pageW, pageH, textW, textH, { x: 0, y: 0, angle }, margin);
  const hi = watermarkCenter(pageW, pageH, textW, textH, { x: 1, y: 1, angle }, margin);
  const axis = (v: number, a: number, b: number) => (b > a ? Math.min(1, Math.max(0, (v - a) / (b - a))) : 0.5);
  return { x: axis(point.x, lo.x, hi.x), y: axis(point.y, lo.y, hi.y) };
}

const previewFont = (px: number) => `bold ${px}px GlossSans, sans-serif`;

/** Önizleme tuvalindeki bir noktaya (tuval pikseli) göre yerleşim; çizimle aynı yazı tipi ve kenar boşluğu */
export function previewPlacementAt(
  canvas: HTMLCanvasElement,
  page: { scale: number },
  text: string,
  size: number,
  angle: number,
  point: { x: number; y: number }
): { x: number; y: number } {
  const ctx = canvas.getContext('2d')!;
  const px = size * page.scale;
  ctx.font = previewFont(px);
  return placementAt(canvas.width, canvas.height, ctx.measureText(text).width, px * ASCENT, angle, point, MARGIN * page.scale);
}

/** Önizleme için sayfanın görüntüsü; scale = piksel / PDF birimi */
export async function renderPreviewPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  width: number
): Promise<{ image: HTMLCanvasElement; scale: number }> {
  const page = await pdf.getPage(pageNumber);
  const scale = width / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const image = document.createElement('canvas');
  image.width = Math.floor(viewport.width);
  image.height = Math.floor(viewport.height);
  const ctx = image.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, image.width, image.height);
  await page.render({ canvas: image, viewport }).promise;
  return { image, scale };
}

/** Sayfa görüntüsünü ve üstüne filigranı, kayıttaki yerleşim hesabıyla çizer */
export function drawWatermarkPreview(
  canvas: HTMLCanvasElement,
  page: { image: HTMLCanvasElement; scale: number },
  text: string,
  style: { colorHex: string; opacity: number; size: number },
  p: WatermarkPlacement
): void {
  canvas.width = page.image.width;
  canvas.height = page.image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(page.image, 0, 0);
  if (!text) return;
  const size = style.size * page.scale;
  ctx.font = previewFont(size);
  const c = watermarkCenter(canvas.width, canvas.height, ctx.measureText(text).width, size * ASCENT, p, MARGIN * page.scale);
  ctx.globalAlpha = style.opacity;
  ctx.fillStyle = style.colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(c.x, c.y);
  ctx.rotate((-p.angle * Math.PI) / 180);
  ctx.fillText(text, 0, 0);
}
