import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { PdfRenderService } from '@/services/pdfRenderService';
import { AnnotationOverlay } from '../annot/AnnotationOverlay';
import { S } from '../strings';

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** Sayfanın ekranda kaplayacağı CSS genişliği */
  width: number;
  /** Sayfa gerçek boyutunu öğrenene kadar kullanılan yükseklik/genişlik oranı */
  fallbackAspect: number;
  scrollRoot: RefObject<HTMLElement>;
  onVisibleRatio: (pageNumber: number, ratio: number) => void;
}

/**
 * Tek PDF sayfası. Yalnızca görünür alanın bir ekran yakınındayken canvas'a çizilir,
 * uzaklaşınca canvas boşaltılır; yüzlerce sayfalık belgelerde WebView belleği şişmez.
 */
export function PageView({ pdf, pageNumber, width, fallbackAspect, scrollRoot, onVisibleRatio }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  /** Sayfanın ölçek 1 boyutu (sayfa birimi); işaretleme katmanı da bunu kullanır */
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const root = scrollRoot.current;

    // 1) Çizim bölgesi: görünür alanın 1 ekran öncesi/sonrası
    const nearObserver = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      root,
      rootMargin: '100% 0px'
    });
    // 2) Sayfa sayacı: marjinsiz oran
    const ratioObserver = new IntersectionObserver(
      ([e]) => onVisibleRatio(pageNumber, e.isIntersecting ? e.intersectionRatio : 0),
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    nearObserver.observe(el);
    ratioObserver.observe(el);
    return () => {
      nearObserver.disconnect();
      ratioObserver.disconnect();
      onVisibleRatio(pageNumber, 0);
    };
  }, [pageNumber, scrollRoot, onVisibleRatio]);

  useEffect(() => {
    if (!near || !width) return;
    let cancelled = false;
    let task: RenderTask | undefined;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const base = page.getViewport({ scale: 1 });
      setBase({ w: base.width, h: base.height });
      task = PdfRenderService.renderPageToCanvas(page, canvas, width / base.width).renderTask;
      try {
        await task.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') console.warn('Page render failed:', e);
      }
    })().catch((e) => console.warn('Page load failed:', e));

    return () => {
      cancelled = true;
      task?.cancel();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [near, width, pdf, pageNumber]);

  return (
    <article
      ref={wrapRef}
      aria-label={`${S.page} ${pageNumber}`}
      className="relative mx-auto flex-none overflow-hidden rounded-[10px] bg-white"
      style={{
        width,
        height: Math.round(width * (base ? base.h / base.w : fallbackAspect)),
        boxShadow: '0 8px 28px rgba(17,17,26,0.10)'
      }}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0" />
      {base && (
        <AnnotationOverlay
          pdf={pdf}
          pageNumber={pageNumber}
          scale={width / base.w}
          pageW={base.w}
          pageH={base.h}
          scrollRoot={scrollRoot}
        />
      )}
    </article>
  );
}
