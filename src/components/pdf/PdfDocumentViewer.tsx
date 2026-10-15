import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfPage } from './PdfPage';
import { SearchBar } from './SearchBar';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUp, UploadCloud, FileText, Clock, Trash2, FolderOpen } from 'lucide-react';

interface PdfDocumentViewerProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onOpenFile: () => void;
  onFileDrop: (file: File) => void;
  onOpenRecentFile?: (filePath: string, fileName: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  pdfDocument,
  onOpenFile,
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
    language,
    recentFiles,
    clearRecentFiles
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

  // Ctrl + Fare Tekerleği ile Odaklı Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey || !activeTab) return;
    e.preventDefault();

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.max(0.0833, Math.min(activeTab.zoom * zoomFactor, 64.0));
    setZoom(parseFloat(newZoom.toFixed(3)));
  };

  // El Aracı (Pan) Mouse Event İşleyicileri
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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
      if (file.name.toLowerCase().endsWith('.pdf')) {
        onFileDrop(file);
      }
    }
  };

  // Açık Belge Yoksa Boş Karşılama Ekranı
  if (!activeTab) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 flex flex-col items-center justify-center p-6 bg-acrobat-bg dark:bg-acrobat-darkBg text-slate-300 transition-colors overflow-y-auto ${
          isDraggingFile ? 'ring-4 ring-acrobat-red ring-inset bg-black/40' : ''
        }`}
      >
        <div className="max-w-xl w-full flex flex-col items-center space-y-6">
          {/* Logo & Başlık Alanı */}
          <div className="flex flex-col items-center text-center">
            <img src="/logo.png" alt="GlossPDF" className="w-16 h-16 rounded-2xl shadow-xl mb-3" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Gloss<span className="text-acrobat-red">PDF</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {language === 'tr'
                ? 'Hızlı, modern ve gizlilik odaklı masaüstü PDF iş istasyonu.'
                : 'Fast, modern, and privacy-respecting desktop PDF workstation.'}
            </p>
          </div>

          {/* Sürükle Bırak / Dosya Aç Kartı */}
          <div className="w-full border-2 border-dashed border-slate-500/40 rounded-2xl p-6 flex flex-col items-center text-center bg-black/15 backdrop-blur-xs shadow-lg">
            <div className="w-12 h-12 rounded-full bg-acrobat-red/10 flex items-center justify-center text-acrobat-red mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>

            <p className="text-xs text-slate-300 mb-4">
              {language === 'tr'
                ? 'PDF dosyanızı buraya sürükleyin veya bilgisayarınızdan seçin'
                : 'Drag and drop your PDF here, or select from your computer'}
            </p>

            <button
              onClick={onOpenFile}
              className="flex items-center space-x-2 px-6 py-2.5 bg-acrobat-red hover:bg-acrobat-darkRed text-white font-medium text-xs rounded-xl shadow-lg hover:shadow-red-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>{language === 'tr' ? 'Dosya Aç (Ctrl+O)' : 'Open File (Ctrl+O)'}</span>
            </button>
          </div>

          {/* Son Açılan Belgeler (Recent Files) */}
          {recentFiles.length > 0 && (
            <div className="w-full bg-black/20 border border-slate-700/50 rounded-2xl p-4 shadow-md text-left">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-acrobat-red" />
                  <span>{language === 'tr' ? 'Son Açılan Belgeler' : 'Recent Documents'}</span>
                </div>
                <button
                  onClick={clearRecentFiles}
                  className="flex items-center space-x-1 text-[11px] text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  title={language === 'tr' ? 'Geçmişi Temizle' : 'Clear Recent List'}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{language === 'tr' ? 'Temizle' : 'Clear'}</span>
                </button>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {recentFiles.map((file, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenRecentFile && onOpenRecentFile(file.filePath, file.fileName)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <FileText className="w-4 h-4 text-acrobat-red flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white block truncate">
                          {file.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {file.filePath}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 ml-2 flex-shrink-0">
                      {new Date(file.lastOpened).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Belge seçildi ancak PDF.js motoru hazırlanıyorsa yükleniyor göstergesi
  if (!pdfDocument) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-acrobat-bg dark:bg-acrobat-darkBg text-slate-300">
        <div className="flex flex-col items-center space-y-3 bg-black/20 px-8 py-6 rounded-xl backdrop-blur-xs shadow-lg">
          <div className="w-8 h-8 border-3 border-acrobat-red border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-300">
            {language === 'tr' ? 'Belge hazırlanıyor...' : 'Preparing document...'}
          </span>
        </div>
      </div>
    );
  }


  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 overflow-auto bg-acrobat-bg dark:bg-acrobat-darkBg p-4 ${
        activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing select-none' : 'cursor-default'
      }`}
    >
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
      <div className="flex flex-col items-center min-w-max pb-12">
        {activeTab.pageDimensions.map((dimension) => (
          <PdfPage
            key={`${dimension.pageNumber}-${activeTab.data.byteLength}`}
            pageNumber={dimension.pageNumber}
            pdfDocument={pdfDocument}
            dimension={dimension}
            scale={activeTab.zoom}
            rotation={activeTab.rotation}
            isVisible={visiblePages.includes(dimension.pageNumber)}
          />
        ))}
      </div>
    </div>
  );
};
