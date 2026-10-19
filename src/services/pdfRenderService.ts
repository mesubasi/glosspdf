import * as pdfjsLib from 'pdfjs-dist';
import { BookmarkItem, PageDimension } from '../types/pdf';

/**
 * Uygulama varlıklarının (worker, yazı tipleri) mutlak adresi.
 * Paketlenmiş Electron uygulaması file:// altında çalıştığı için "/..." kökü yerine
 * sayfanın kendi adresine göre çözülür.
 */
function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;
}

// PDF.js Web Worker yapılandırması
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = assetUrl('pdf.worker.min.js');
}

/** cmap ve standart yazı tipleri: mobil derleme pakete gömer (çevrimdışı), masaüstü CDN'den alır */
const pdfjsDataUrl = (dir: string) =>
  import.meta.env.VITE_PDFJS_DATA
    ? assetUrl(`${import.meta.env.VITE_PDFJS_DATA}${dir}/`)
    : `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/${dir}/`;

/**
 * Sayfanın kendi /Rotate değeri + kullanıcının görünüm döndürmesi.
 * (getViewport'a rotation verildiğinde sayfanın doğal döndürmesi EZİLİR; bu yüzden toplanmalıdır.)
 */
export function viewportFor(page: pdfjsLib.PDFPageProxy, scale: number, viewRotation = 0) {
  return page.getViewport({ scale, rotation: (page.rotate + viewRotation) % 360 });
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
      cMapUrl: pdfjsDataUrl('cmaps'),
      cMapPacked: true,
      standardFontDataUrl: pdfjsDataUrl('standard_fonts'),
      // CVE-2024-4367: kötü niyetli yazı tipi verisi eval ile kod çalıştırabiliyor; 4.2.67+ sürümüne geçilene kadar kapalı
      isEvalSupported: false
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
    rotation: number = 0,
    // Retina / Yüksek DPI Ekran Desteği; mobil yakınlaştırmada bellek için düşürülebilir
    outputScale: number = window.devicePixelRatio || 1
  ): RenderResult {
    const viewport = viewportFor(page, scale, rotation);
    const context = canvas.getContext('2d');

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
    const viewport = viewportFor(page, scale, rotation);
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
      console.warn('Text layer render warning (can be ignored):', e);
    }
  }

  /**
   * Sayfadaki interaktif form alanlarını (AcroForms - Text, Checkbox, Choice) DOM üzerinde render eder
   */
  static async renderFormLayer(
    page: pdfjsLib.PDFPageProxy,
    container: HTMLElement,
    scale: number,
    rotation: number = 0,
    onFieldChange?: (name: string, value: string | boolean) => void
  ): Promise<void> {
    container.innerHTML = '';
    const viewport = viewportFor(page, scale, rotation);

    try {
      const annotations = await page.getAnnotations({ intent: 'display' });
      const widgetAnnots = annotations.filter((a: any) => a.subtype === 'Widget');
      if (widgetAnnots.length === 0) return;

      for (const annot of widgetAnnots) {
        if (!annot.rect) continue;

        // PDF koordinatlarını (sol alttan) ekran koordinatlarına (sol üstten) çevir
        const rect = viewport.convertToViewportRectangle(annot.rect);
        const minX = Math.min(rect[0], rect[2]);
        const minY = Math.min(rect[1], rect[3]);
        const width = Math.abs(rect[0] - rect[2]);
        const height = Math.abs(rect[1] - rect[3]);

        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${minX}px`;
        wrapper.style.top = `${minY}px`;
        wrapper.style.width = `${width}px`;
        wrapper.style.height = `${height}px`;
        wrapper.style.zIndex = '15';

        if (annot.fieldType === 'Tx') {
          // Metin Giriş Alanı (Text Field)
          const input = annot.multiLine
            ? document.createElement('textarea')
            : document.createElement('input');

          input.style.width = '100%';
          input.style.height = '100%';
          input.style.fontSize = `${Math.max(10, height * 0.65)}px`;
          input.style.backgroundColor = 'rgba(238, 242, 255, 0.7)';
          input.style.border = '1px solid #6366f1';
          input.style.borderRadius = '2px';
          input.style.color = '#1e1e1e';
          input.style.padding = '1px 3px';
          input.style.outline = 'none';
          input.style.boxSizing = 'border-box';
          input.value = annot.fieldValue || '';
          if (annot.readOnly) input.disabled = true;

          input.addEventListener('change', () => {
            if (onFieldChange) onFieldChange(annot.fieldName, input.value);
          });

          wrapper.appendChild(input);
        } else if (annot.fieldType === 'Btn') {
          // Onay Kutusu (Checkbox) veya Buton
          if (!annot.pushButton) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.width = '100%';
            checkbox.style.height = '100%';
            checkbox.style.cursor = 'pointer';
            checkbox.checked = annot.fieldValue === 'Yes' || annot.fieldValue === true;
            if (annot.readOnly) checkbox.disabled = true;

            checkbox.addEventListener('change', () => {
              if (onFieldChange) onFieldChange(annot.fieldName, checkbox.checked);
            });

            wrapper.appendChild(checkbox);
          }
        } else if (annot.fieldType === 'Ch') {
          // Açılır Menü (Choice / Dropdown)
          const select = document.createElement('select');
          select.style.width = '100%';
          select.style.height = '100%';
          select.style.fontSize = `${Math.max(10, height * 0.65)}px`;
          select.style.backgroundColor = 'rgba(238, 242, 255, 0.85)';
          select.style.border = '1px solid #6366f1';

          if (annot.options && Array.isArray(annot.options)) {
            for (const opt of annot.options) {
              const optionEl = document.createElement('option');
              optionEl.value = opt.exportValue || opt.displayValue;
              optionEl.textContent = opt.displayValue;
              if (opt.exportValue === annot.fieldValue) optionEl.selected = true;
              select.appendChild(optionEl);
            }
          }

          select.addEventListener('change', () => {
            if (onFieldChange) onFieldChange(annot.fieldName, select.value);
          });

          wrapper.appendChild(select);
        }

        container.appendChild(wrapper);
      }
    } catch (e) {
      console.warn('Form layer render warning:', e);
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
      console.warn('Could not read the document outline:', e);
      return [];
    }
  }
}
