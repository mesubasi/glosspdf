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
  ctx.font = `bold ${size}px GlossSans, sans-serif`;
  const c = watermarkCenter(canvas.width, canvas.height, ctx.measureText(text).width, size * ASCENT, p, MARGIN * page.scale);
  ctx.globalAlpha = style.opacity;
  ctx.fillStyle = style.colorHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(c.x, c.y);
  ctx.rotate((-p.angle * Math.PI) / 180);
  ctx.fillText(text, 0, 0);
}
