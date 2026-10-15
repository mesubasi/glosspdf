import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfPage } from './PdfPage';
import { SearchBar } from './SearchBar';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUp, UploadCloud } from 'lucide-react';

interface PdfDocumentViewerProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onOpenFile: () => void;
  onFileDrop: (file: File) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  pdfDocument,
  onOpenFile,
  onFileDrop,
  containerRef
}) => {
  const {
    tabs,
    activeTabId,
    activeTool,
    setZoom,
    setCurrentPage,
    language
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
        className={`flex-1 flex flex-col items-center justify-center p-8 bg-acrobat-bg dark:bg-acrobat-darkBg text-slate-300 transition-colors ${
          isDraggingFile ? 'ring-4 ring-acrobat-red ring-inset bg-black/40' : ''
        }`}
      >
        <div className="max-w-md w-full border-2 border-dashed border-slate-500/50 rounded-2xl p-10 flex flex-col items-center text-center bg-black/10 backdrop-blur-sm shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-acrobat-red/10 flex items-center justify-center text-acrobat-red mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {language === 'tr' ? 'PDF Dosyası Aç' : 'Open PDF File'}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            {language === 'tr'
              ? 'Görüntülemek veya düzenlemek istediğiniz PDF dosyasını buraya sürükleyin veya bilgisayarınızdan seçin.'
              : 'Drag and drop your PDF here, or select a file from your computer to view and edit.'}
          </p>

          <button
            onClick={onOpenFile}
            className="flex items-center space-x-2 px-5 py-2.5 bg-acrobat-red hover:bg-acrobat-darkRed text-white font-medium text-xs rounded-lg shadow-lg hover:shadow-red-500/20 transition-all active:scale-95"
          >
            <FileUp className="w-4 h-4" />
            <span>{language === 'tr' ? 'Dosya Seç (Ctrl+O)' : 'Select File (Ctrl+O)'}</span>
          </button>
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
            key={dimension.pageNumber}
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
