import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { usePdfStore, MAX_ZOOM } from '../../store/usePdfStore';
import { PdfPage } from './PdfPage';
import { SearchBar } from './SearchBar';
import * as pdfjsLib from 'pdfjs-dist';
import { t } from '@/i18n';

interface PdfDocumentViewerProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onFileDrop: (file: File) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  pdfDocument,
  onFileDrop,
  containerRef
}) => {
  const {
    tabs,
    activeTabId,
    activeTool,
    setZoom,
    setCurrentPage,
    setSelectedAnnotationId,
    pendingSignature,
    language,
    pageLayout,
    showCoverPage
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [visiblePages, setVisiblePages] = useState<number[]>([]);

  // Belge yüklendiğinde sayfaların görünürlüğünü başlat
  useEffect(() => {
    if (activeTab) {
      if (activeTab.numPages <= 50) {
        // Küçük/orta belgelerde tüm sayfaları aktif et (Asla beyaz kalmaz)
        setVisiblePages(Array.from({ length: activeTab.numPages }, (_, i) => i + 1));
      } else {
        // Büyük belgelerde ilk 10 sayfayı anında hazırla
        setVisiblePages(Array.from({ length: Math.min(10, activeTab.numPages) }, (_, i) => i + 1));
      }
    }
  }, [activeTab?.id, activeTab?.numPages]);

  // Aktif sayfa değiştiğinde (küçük resim, arama veya durum çubuğundan atlandığında)
  // hedef sayfayı ve hemen yanındaki komşu sayfaları gecikmesiz görünür listesine ekle
  useEffect(() => {
    if (!activeTab || activeTab.numPages <= 50) return;
    const cur = activeTab.currentPage;
    const neighborhood = [cur - 2, cur - 1, cur, cur + 1, cur + 2].filter(
      (p) => p >= 1 && p <= activeTab.numPages
    );
    setVisiblePages((prev) => Array.from(new Set([...prev, ...neighborhood])));
  }, [activeTab?.id, activeTab?.currentPage, activeTab?.numPages]);

  // El Aracı (Pan) ile sürükleme durumu
  const isPanningRef = useRef(false);
  const startPanPosRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Scroll Sırasında Aktif Sayfayı ve Büyük Belgelerde Görünür Sayfaları Güncelleme
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !activeTab) return;

    const container = containerRef.current;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;

    const newVisible: number[] = [];
    let bestCurrentPage = activeTab.currentPage;
    let minDistance = Infinity;

    activeTab.pageDimensions.forEach((dim) => {
      const pageEl = document.getElementById(`pdf-page-${dim.pageNumber}`);
      if (!pageEl) return;

      const pageTop = pageEl.offsetTop;
      const pageBottom = pageTop + pageEl.clientHeight;

      // Tampon (buffer)
      const isNearViewport =
        pageBottom >= containerTop - 1000 && pageTop <= containerBottom + 1000;

      if (isNearViewport) {
        newVisible.push(dim.pageNumber);
      }

      // Aktif sayfayı belirleme
      const pageCenter = (pageTop + pageBottom) / 2;
      const viewportCenter = (containerTop + containerBottom) / 2;
      const distance = Math.abs(pageCenter - viewportCenter);
      if (distance < minDistance) {
        minDistance = distance;
        bestCurrentPage = dim.pageNumber;
      }
    });

    if (activeTab.numPages > 50 && newVisible.length > 0) {
      setVisiblePages(newVisible);
    }
    if (bestCurrentPage !== activeTab.currentPage) {
      setCurrentPage(bestCurrentPage);
    }
  }, [activeTab, containerRef, setCurrentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, containerRef, activeTab?.zoom, activeTab?.rotation]);

  // Yumuşak yakınlaştırma: görünen ölçek (--z) her karede yalnızca CSS ile değişir; sayfalar
  // yakınlaştırma durunca yeni ölçekte arka planda yeniden çizilir. İmleç (tekerlek) ya da ekran
  // ortası (düğmeler, kısayollar) altındaki nokta yerinde kalır.
  const targetZoom = activeTab?.zoom ?? 1;
  const listRef = useRef<HTMLDivElement>(null);
  const displayZoomRef = useRef(targetZoom);
  const anchorRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const tabIdRef = useRef(activeTab?.id);
  const [renderZoom, setRenderZoom] = useState(targetZoom);

  const applyDisplayZoom = useCallback(
    (z: number, anchor: { x: number; y: number } | null) => {
      displayZoomRef.current = z;
      const container = containerRef.current;
      const list = listRef.current;
      if (!container || !list) return;
      const ax = anchor?.x ?? container.clientWidth / 2;
      const ay = anchor?.y ?? container.clientHeight / 2;
      const cx = container.scrollLeft + ax;
      const cy = container.scrollTop + ay;
      // Sayfa araları ölçeklenmediği için konum, odak noktasının bulunduğu sayfaya göre korunur
      const pages = list.querySelectorAll<HTMLElement>('[data-page-number]');
      let page: HTMLElement | null = null;
      for (const p of pages) {
        if (p.offsetTop + p.offsetHeight >= cy) {
          page = p;
          break;
        }
      }
      page ??= pages[pages.length - 1] ?? null;
      const fx = page ? (cx - page.offsetLeft) / page.offsetWidth : 0;
      const fy = page ? (cy - page.offsetTop) / page.offsetHeight : 0;
      list.style.setProperty('--z', String(z));
      if (page) {
        container.scrollLeft = page.offsetLeft + fx * page.offsetWidth - ax;
        container.scrollTop = page.offsetTop + fy * page.offsetHeight - ay;
      }
    },
    [containerRef]
  );

  // Boyama öncesi çalışır: sekme değişiminde yeni sekme bir kare bile eski ölçekle görünmez
  useLayoutEffect(() => {
    // Sekme değişince animasyon yok
    if (tabIdRef.current !== activeTab?.id) {
      tabIdRef.current = activeTab?.id;
      displayZoomRef.current = targetZoom;
      listRef.current?.style.setProperty('--z', String(targetZoom));
      setRenderZoom(targetZoom);
      return;
    }
    const from = displayZoomRef.current;
    const anchor = anchorRef.current?.zoom === targetZoom ? anchorRef.current : null;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      // rAF zaman damgası karenin başlangıcıdır ve `start`tan önce olabilir; negatif ilerleme
      // yakınlaştırırken bir an uzaklaştırıyordu, bu yüzden 0'ın altına inmez
      const p = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
      const eased = 1 - Math.pow(1 - p, 3);
      applyDisplayZoom(from + (targetZoom - from) * eased, anchor);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    if (from !== targetZoom) frame = requestAnimationFrame(step);
    // Keskin çizim, yakınlaştırma durduktan sonra (tekerlekte her çentikte değil)
    const timer = setTimeout(() => {
      // Pencere arka plandayken rAF durur; görünen ölçek hedefte değilse burada tamamlanır
      if (displayZoomRef.current !== targetZoom) applyDisplayZoom(targetZoom, anchor);
      setRenderZoom(targetZoom);
    }, duration + 150);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [targetZoom, activeTab?.id, applyDisplayZoom]);

  // Ctrl + tekerlek / dokunmatik yüzey kıstırma. React'in wheel dinleyicisi pasif olduğundan
  // preventDefault çalışmaz ve sayfa aynı anda kayardı; bu yüzden yerel, pasif olmayan dinleyici.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const { tabs: allTabs, activeTabId: id } = usePdfStore.getState();
      const tab = allTabs.find((tb) => tb.id === id);
      if (!tab) return;
      e.preventDefault();
      // Tekerlek çentiği (~100) ≈ %22; kıstırmanın küçük adımları orantılı ve akıcı kalır
      const delta = Math.max(-100, Math.min(100, e.deltaY));
      const newZoom = parseFloat(Math.max(0.0833, Math.min(tab.zoom * Math.exp(-delta * 0.002), MAX_ZOOM)).toFixed(3));
      if (newZoom === tab.zoom) return;
      const rect = el.getBoundingClientRect();
      anchorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, zoom: newZoom };
      setZoom(newZoom);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, activeTab?.id, setZoom]);

  // El Aracı (Pan) Mouse Event İşleyicileri
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Boş alana tıklamak seçimi kaldırır (imza/metin nesneleri data-annot ile işaretlidir)
    if (activeTool === 'select' && !(e.target as HTMLElement).closest('[data-annot]')) {
      setSelectedAnnotationId(null);
    }
    if (activeTool !== 'hand' || !containerRef.current) return;
    isPanningRef.current = true;
    startPanPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current || !containerRef.current) return;
    const dx = e.clientX - startPanPosRef.current.x;
    const dy = e.clientY - startPanPosRef.current.y;
    containerRef.current.scrollLeft = startPanPosRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = startPanPosRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
  };

  // Dosya Sürükle - Bırak (Drag & Drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        onFileDrop(file);
      }
    }
  };

  // Açık belge yoksa App ana sayfayı gösterir
  if (!activeTab) return null;

  // Belge seçildi ancak PDF.js motoru hazırlanıyorsa yükleniyor göstergesi
  if (!pdfDocument) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-canvas text-secondary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-[2.5px] border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] font-medium">
            {t('preparing_document')}
          </span>
        </div>
      </div>
    );
  }


  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 overflow-auto bg-canvas p-4 ${
        activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing select-none' : 'cursor-default'
      }`}
    >
      {/* Araç ipucu: imza yerleştirme / metin düzenleme */}
      {((activeTool === 'signature' && pendingSignature) || activeTool === 'edittext') && (
        <div className="sticky top-2 z-40 flex justify-center pointer-events-none">
          <div className="px-4 py-1.5 rounded-full bg-hud shadow-hud backdrop-blur-xl text-label text-xs">
            {t(activeTool === 'edittext' ? 'edit_text_hint' : pendingSignature?.isImage ? 'place_image_hint' : 'place_signature_hint')}
          </div>
        </div>
      )}

      {/* Kayan Arama Çubuğu */}
      <SearchBar
        pdfDocument={pdfDocument}
        onJumpToPage={(pageNum) => {
          const el = document.getElementById(`pdf-page-${pageNum}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />

      {/* Sayfa Listesi */}
      <div
        // --z yalnızca applyDisplayZoom ile yazılır; React'e verilseydi animasyon sırasındaki her yeniden
        // çizim (ör. kaydırmayla sayfa no. değişince) eski, daha küçük değeri geri yazar ve sayfa bir an küçülürdü
        ref={listRef}
        className={
          pageLayout === 'two'
            ? 'grid grid-cols-[repeat(2,max-content)] justify-center items-start gap-x-4 min-w-max pb-24'
            : 'flex flex-col items-center min-w-max pb-24'
        }
      >
        {/* Kapak sayfası: ilk sayfa sağ sütunda tek başına durur */}
        {pageLayout === 'two' && showCoverPage && <div aria-hidden />}
        {activeTab.pageDimensions.map((dimension) => (
          <PdfPage
            key={`${dimension.pageNumber}-${activeTab.data.byteLength}`}
            pageNumber={dimension.pageNumber}
            pdfDocument={pdfDocument}
            dimension={dimension}
            scale={renderZoom}
            rotation={activeTab.rotation}
            isVisible={visiblePages.includes(dimension.pageNumber)}
          />
        ))}
      </div>
    </div>
  );
};
