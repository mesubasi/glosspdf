import * as pdfjsLib from 'pdfjs-dist';
import { BookmarkItem, PageDimension } from '../types/pdf';

// PDF.js Web Worker yapılandırması
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export interface RenderResult {
  renderTask: pdfjsLib.RenderTask;
  viewport: pdfjsLib.PageViewport;
}

export class PdfRenderService {
  /**
   * PDF belgesini Uint8Array verisinden yükler
   */
  static async loadDocument(
    data: Uint8Array,
    onPasswordNeeded?: (callback: (password: string) => void) => void
  ): Promise<pdfjsLib.PDFDocumentProxy> {
    const loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    });

    if (onPasswordNeeded) {
      loadingTask.onPassword = (updatePassword: (pw: string) => void, reason: number) => {
        onPasswordNeeded(updatePassword);
      };
    }

    return await loadingTask.promise;
  }

  /**
   * Tüm sayfaların orijinal ve varsayılan boyutlarını toplar
   */
  static async getAllPageDimensions(doc: pdfjsLib.PDFDocumentProxy): Promise<PageDimension[]> {
    const dimensions: PageDimension[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      dimensions.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        originalWidth: viewport.width,
        originalHeight: viewport.height
      });
    }
    return dimensions;
  }

  /**
   * Tekil bir sayfayı belirtilen Canvas üzerine çizer (HiDPI ve Beyaz Arka Plan Desteği)
   */
  static renderPageToCanvas(
    page: pdfjsLib.PDFPageProxy,
    canvas: HTMLCanvasElement,
    scale: number,
    rotation: number = 0
  ): RenderResult {
    const viewport = page.getViewport({ scale, rotation });
    const context = canvas.getContext('2d');

    // Retina / Yüksek DPI Ekran Desteği
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Saydam PDF'ler için beyaz arka plan garanti edilir
    if (context) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    const renderContext = {
      canvasContext: context!,
      viewport: viewport,
      transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined
    };

    const renderTask = page.render(renderContext);
    return { renderTask, viewport };
  }

  /**
   * Sayfadaki metinleri seçilebilir DOM katmanına aktarır (TextLayer)
   */
  static async renderTextLayer(
    page: pdfjsLib.PDFPageProxy,
    container: HTMLElement,
    scale: number,
    rotation: number = 0
  ): Promise<void> {
    container.innerHTML = '';
    const viewport = page.getViewport({ scale, rotation });
    container.style.width = `${Math.floor(viewport.width)}px`;
    container.style.height = `${Math.floor(viewport.height)}px`;
    container.style.setProperty('--scale-factor', `${viewport.scale}`);

    try {
      const textContent = await page.getTextContent();
      // @ts-ignore
      const textLayerTask = pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: container,
        viewport: viewport,
        textDivs: []
      });
      await textLayerTask.promise;
    } catch (e) {
      console.warn('Metin katmanı çizim uyarısı (ihmal edilebilir):', e);
    }
  }

  /**
   * Belgenin içindekiler (Bookmarks / Outline) ağacını çıkarır
   */
  static async getDocumentOutline(doc: pdfjsLib.PDFDocumentProxy): Promise<BookmarkItem[]> {
    try {
      const rawOutline = await doc.getOutline();
      if (!rawOutline || rawOutline.length === 0) return [];

      const parseItems = async (items: any[]): Promise<BookmarkItem[]> => {
        const result: BookmarkItem[] = [];
        for (const item of items) {
          let pageNum = 1;
          if (typeof item.dest === 'string') {
            const destIndex = await doc.getDestination(item.dest);
            if (destIndex && destIndex.length > 0) {
              const ref = destIndex[0];
              pageNum = (await doc.getPageIndex(ref)) + 1;
            }
          } else if (Array.isArray(item.dest) && item.dest.length > 0) {
            const ref = item.dest[0];
            pageNum = (await doc.getPageIndex(ref)) + 1;
          }

          const children = item.items && item.items.length > 0 ? await parseItems(item.items) : [];
          result.push({
            title: item.title,
            pageNumber: pageNum,
            children
          });
        }
        return result;
      };

      return await parseItems(rawOutline);
    } catch (e) {
      console.warn('İçindekiler tablosu alınamadı:', e);
      return [];
    }
  }
}
