import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PdfRenderService } from '../../services/pdfRenderService';
import { PageDimension } from '../../types/pdf';
import { AnnotationLayer } from '../annotations/AnnotationLayer';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';

interface PdfPageProps {
  pageNumber: number;
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  dimension: PageDimension;
  scale: number;
  rotation: number;
  isVisible: boolean;
}

export const PdfPage: React.FC<PdfPageProps> = ({
  pageNumber,
  pdfDocument,
  dimension,
  scale,
  rotation,
  isVisible
}) => {
  const { activeTool, searchQuery, searchMatchCase, searchResults, currentSearchIndex } = usePdfStore();
  const isTextMarkupTool = activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikeout';
  const isTextEditTool = activeTool === 'edittext';

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const formLayerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  // Metin katmanı (yeniden) çizildikçe artar; arama vurgusu bu değişince yeniden uygulanır
  const [textLayerVersion, setTextLayerVersion] = useState(0);
  const activeRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Sayfa yönüne göre genişlik ve yükseklik
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const targetWidth = Math.floor(
    (isRotated90or270 ? dimension.originalHeight : dimension.originalWidth) * scale
  );
  const targetHeight = Math.floor(
    (isRotated90or270 ? dimension.originalWidth : dimension.originalHeight) * scale
  );

  useEffect(() => {
    if (!isVisible) {
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel();
        activeRenderTaskRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        // Önceki aktif çizim varsa iptal et
        if (activeRenderTaskRef.current) {
          activeRenderTaskRef.current.cancel();
          activeRenderTaskRef.current = null;
        }

        // 1. Canvas Çizimi
        const { renderTask } = PdfRenderService.renderPageToCanvas(
          page,
          canvasRef.current,
          scale,
          rotation
        );
        activeRenderTaskRef.current = renderTask;

        await renderTask.promise;
        activeRenderTaskRef.current = null;
        if (isCancelled) return;

        // Çizim tamamlandığında yükleniyor göstergesini kaldır ve sayfayı göster
        setIsRendered(true);

        // 2. Metin Katmanı Çizimi (TextLayer - arka planda)
        if (textLayerRef.current) {
          await PdfRenderService.renderTextLayer(
            page,
            textLayerRef.current,
            scale,
            rotation
          );
          if (!isCancelled) setTextLayerVersion((v) => v + 1);
        }

        // 3. İnteraktif Form Katmanı Çizimi (Faz 3 - AcroForms)
        if (formLayerRef.current) {
          await PdfRenderService.renderFormLayer(
            page,
            formLayerRef.current,
            scale,
            rotation
          );
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNumber} render error:`, err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (activeRenderTaskRef.current) {
        activeRenderTaskRef.current.cancel();
        activeRenderTaskRef.current = null;
      }
    };
  }, [isVisible, pageNumber, scale, rotation, pdfDocument]);

  // Arama eşleşmelerini sayfada vurgula (etkin eşleşme turuncu)
  useEffect(() => {
    const layer = textLayerRef.current;
    if (!layer) return;
    const spans = Array.from(layer.querySelectorAll('span'));
    spans.forEach((s) => s.classList.remove('highlight', 'selected'));

    const query = searchQuery.trim();
    if (!query || searchResults.length === 0) return;

    const norm = (s: string) => (searchMatchCase ? s : s.toLocaleLowerCase('tr-TR'));
    const needle = norm(query);
    const active = searchResults[currentSearchIndex];
    const activeOnPage = active?.pageIndex === pageNumber ? active.matchIndex : -1;

    let occurrence = 0;
    let activeSpan: HTMLElement | null = null;
    for (const span of spans) {
      const text = norm(span.textContent || '');
      let from = 0;
      let hit = false;
      while ((from = text.indexOf(needle, from)) !== -1) {
        hit = true;
        if (occurrence === activeOnPage) activeSpan = span;
        occurrence++;
        from += needle.length;
      }
      if (hit) span.classList.add('highlight');
    }
    if (activeSpan) {
      activeSpan.classList.add('selected');
      const target = activeSpan;
      // Sayfa atlama (SearchBar) bittikten sonra eşleşmeyi ortala
      const timer = setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
      return () => clearTimeout(timer);
    }
  }, [searchResults, currentSearchIndex, searchQuery, searchMatchCase, textLayerVersion, pageNumber]);

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      data-page-number={pageNumber}
      style={{
        width: `${targetWidth}px`,
        height: `${targetHeight}px`
      }}
      className="relative bg-white shadow-2xl mx-auto my-4 select-text"
    >
      {/* Çizim Yüzeyi (Canvas) */}
      <canvas
        ref={canvasRef}
        style={{
          width: `${targetWidth}px`,
          height: `${targetHeight}px`
        }}
        className="block"
      />

      {/* Seçilebilir Metin Katmanı (TextLayer) */}
      <div
        ref={textLayerRef}
        className={`textLayer ${isTextMarkupTool ? 'z-30! cursor-text select-text pointer-events-auto' : ''} ${
          isTextEditTool ? 'textLayer--editing z-30! pointer-events-auto' : ''
        }`}
      />

      {/* İnteraktif Form Katmanı (Faz 3 - AcroForm Fields) */}
      <div
        ref={formLayerRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ width: `${targetWidth}px`, height: `${targetHeight}px` }}
      />

      {/* İnteraktif İşaretleme Katmanı (Faz 2 - AnnotationLayer) */}
      <AnnotationLayer
        pageNumber={pageNumber}
        scale={scale}
        rotation={rotation}
        pageWidth={targetWidth}
        pageHeight={targetHeight}
      />

      {/* Yükleniyor Göstergesi */}
      {isVisible && !isRendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-slate-500 text-xs font-medium">
          {t('page_loading', [pageNumber])}
        </div>
      )}
    </div>
  );
};
