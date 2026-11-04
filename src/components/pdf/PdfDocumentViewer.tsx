import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { usePdfStore, MAX_ZOOM } from '../../store/usePdfStore';
import { PdfPage } from './PdfPage';
import { SearchBar } from './SearchBar';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, FileText, FolderOpen, X } from 'lucide-react';
import { t } from '@/i18n';
import { isOpenableName } from '../../services/createPdfService';

interface PdfDocumentViewerProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onOpenFile: () => void;
  onCreatePdf: () => void;
  onFileDrop: (file: File) => void;
  onOpenRecentFile?: (filePath: string, fileName: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  pdfDocument,
  onOpenFile,
  onCreatePdf,
  onFileDrop,
  onOpenRecentFile,
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
    recentFiles,
    clearRecentFiles,
    removeRecentFile,
    pageLayout,
    showCoverPage,
    setMergeModalOpen
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

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
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (isOpenableName(file.name)) {
        onFileDrop(file);
      }
    }
  };

  // Açık Belge Yoksa Karşılama Ekranı
  if (!activeTab) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 overflow-y-auto bg-window text-label"
      >
        <div className="w-full max-w-[960px] mx-auto px-6 pt-14 pb-12 flex flex-col gap-10">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              className="w-[76px] h-[76px] rounded-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_10px_24px_rgba(0,0,0,0.14)]"
            />
            <h1 className="mt-1.5 text-[26px] font-bold tracking-tight">{t('welcome_title')}</h1>
            <p className="max-w-[460px] text-[15px] text-secondary">
              {t('fast_modern_and_privacy_respecting_desktop_pdf_workstati')}
            </p>
          </div>

          {/* Sürükle-bırak alanı */}
          <div
            className={`flex flex-col items-center justify-center gap-2.5 min-h-[184px] px-6 py-7 rounded-2xl border-[1.5px] border-dashed text-center transition-colors ${
              isDraggingFile ? 'border-accent bg-accent/10' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-white/[0.03]'
            }`}
          >
            <Upload className="w-[30px] h-[30px] text-secondary" strokeWidth={1.6} />
            <span className="text-[15px] font-semibold">{t('drop_pdf_here')}</span>
            <span className="text-xs text-secondary">{t('or_choose_from_computer')}</span>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <button
                onClick={onOpenFile}
                className="flex items-center gap-2 h-[30px] px-4 rounded-[7px] bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
              >
                <FolderOpen className="w-4 h-4" strokeWidth={1.8} />
                {t('open_pdf')}
              </button>
              <button
                onClick={onCreatePdf}
                className="h-[30px] px-4 rounded-[7px] bg-group text-label text-[13px] shadow-btn hover:bg-hover"
              >
                {t('create_pdf')}
              </button>
              <button
                onClick={() => setMergeModalOpen(true)}
                className="h-[30px] px-4 rounded-[7px] bg-group text-label text-[13px] shadow-btn hover:bg-hover"
              >
                {t('merge_pdfs')}
              </button>
            </div>
          </div>

          {/* Son Açılan Belgeler */}
          {recentFiles.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[17px] font-semibold">{t('recent_documents')}</h2>
                <button onClick={clearRecentFiles} className="h-6 px-1.5 text-[13px] text-accent-text hover:underline">
                  {t('clear_recent_list')}
                </button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(164px,1fr))] gap-5">
                {recentFiles.map((file) => (
                  <div key={file.filePath} className="group relative">
                    <button
                      onClick={() => onOpenRecentFile && onOpenRecentFile(file.filePath, file.fileName)}
                      title={file.filePath}
                      className="flex flex-col gap-2 w-full text-left"
                    >
                      <span className="flex justify-center items-end w-full h-[148px] pt-4 rounded-[10px] bg-sidebar overflow-hidden group-hover:ring-2 group-hover:ring-accent transition-shadow">
                        <span className="flex items-start justify-center w-[100px] h-[132px] pt-9 bg-white rounded-t-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_4px_12px_rgba(0,0,0,0.08)]">
                          <FileText className="w-8 h-8 text-slate-300" strokeWidth={1.4} />
                        </span>
                      </span>
                      <span className="flex flex-col gap-px px-0.5 min-w-0">
                        <span className="text-[13px] font-medium truncate">{file.fileName}</span>
                        <span className="text-[11px] text-secondary">
                          {new Date(file.lastOpened).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecentFile(file.filePath)}
                      className="absolute top-2 right-2 grid place-items-center w-6 h-6 rounded-full bg-hud shadow-hud text-secondary hover:text-label opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      title={t('remove_from_list')}
                      aria-label={t('remove_from_list')}
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

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
