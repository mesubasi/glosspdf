import React, { useState, useEffect, useRef } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import * as pdfjsLib from 'pdfjs-dist';
import { t } from '@/i18n';
import {
  X,
  RotateCw,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Layers,
  FileDown
} from 'lucide-react';

interface PageCardState {
  originalPageNumber: number;
  rotationDelta: number; // 0, 90, 180, 270
}

export const OrganizePagesModal: React.FC = () => {
  const {
    organizeModalOpen,
    setOrganizeModalOpen,
    tabs,
    activeTabId,
    updateTab,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [pages, setPages] = useState<PageCardState[]>([]);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!organizeModalOpen || !activeTab) return;

    // Sayfa durumlarını başlat
    const initialPages: PageCardState[] = Array.from(
      { length: activeTab.numPages },
      (_, i) => ({
        originalPageNumber: i + 1,
        rotationDelta: 0
      })
    );
    setPages(initialPages);

    // Önizleme için PDF'i yükle
    PdfRenderService.loadDocument(activeTab.data.slice()).then((doc) => {
      setPdfDoc(doc);
    });
  }, [organizeModalOpen, activeTab?.id]);

  if (!organizeModalOpen || !activeTab) return null;

  // Sayfayı sola taşı
  const moveLeft = (index: number) => {
    if (index <= 0) return;
    const newPages = [...pages];
    const temp = newPages[index - 1];
    newPages[index - 1] = newPages[index];
    newPages[index] = temp;
    setPages(newPages);
  };

  // Sayfayı sağa taşı
  const moveRight = (index: number) => {
    if (index >= pages.length - 1) return;
    const newPages = [...pages];
    const temp = newPages[index + 1];
    newPages[index + 1] = newPages[index];
    newPages[index] = temp;
    setPages(newPages);
  };

  // Tek sayfayı döndür
  const rotatePage = (index: number, clockwise: boolean) => {
    const newPages = [...pages];
    const current = newPages[index].rotationDelta;
    newPages[index].rotationDelta = clockwise
      ? (current + 90) % 360
      : (current - 90 + 360) % 360;
    setPages(newPages);
  };

  // Tek sayfayı sil
  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      alert(t('document_must_have_at_least_1_page'));
      return;
    }
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
  };

  // Boş sayfa ekle
  const insertBlank = async () => {
    try {
      setIsProcessing(true);
      // Sayfa yapısı değişeceği için bekleyen işaretlemeler önce sayfalara yazılır
      const baked = await PdfEditService.savePdfWithAnnotations(activeTab.data.slice(), activeTab.annotations || []);
      const newBytes = await PdfEditService.insertBlankPage(baked, pages.length);
      const newDoc = await PdfRenderService.loadDocument(newBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(newDoc);
      updateTab(activeTab.id, {
        data: newBytes,
        numPages: newDoc.numPages,
        pageDimensions: dims,
        annotations: [],
        undoStack: [],
        redoStack: [],
        isModified: true
      });
      setPdfDoc(newDoc);
      setPages(Array.from({ length: newDoc.numPages }, (_, i) => ({
        originalPageNumber: i + 1,
        rotationDelta: 0
      })));
    } catch (err: any) {
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Değişiklikleri Uygula
  const handleApplyChanges = async () => {
    try {
      setIsProcessing(true);

      // 1. Sıralamayı uygula (reorder)
      const pageOrder = pages.map((p) => p.originalPageNumber);
      // Sayfa sırası/sayısı değişeceği için bekleyen işaretlemeler önce sayfalara yazılır
      const baked = await PdfEditService.savePdfWithAnnotations(activeTab.data.slice(), activeTab.annotations || []);
      let updatedBytes = await PdfEditService.reorderPages(baked, pageOrder);

      // 2. Döndürmeleri uygula
      for (let i = 0; i < pages.length; i++) {
        const delta = pages[i].rotationDelta;
        if (delta !== 0) {
          const turns = delta / 90;
          for (let t = 0; t < turns; t++) {
            updatedBytes = await PdfEditService.rotatePage(updatedBytes, i, true);
          }
        }
      }

      // Yeni dökümanı yükle ve state'i güncelle
      const newDoc = await PdfRenderService.loadDocument(updatedBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(newDoc);

      updateTab(activeTab.id, {
        data: updatedBytes,
        numPages: newDoc.numPages,
        pageDimensions: dims,
        annotations: [],
        undoStack: [],
        redoStack: [],
        isModified: true,
        currentPage: 1
      });

      setOrganizeModalOpen(false);
    } catch (err: any) {
      console.error('Page organization error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Üst Başlık ve Araçlar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('organize_pages_2')}
            </h2>
            <span className="text-xs text-slate-400">{t('total_pages_count', [pages.length])}</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Boş Sayfa Ekle */}
            <button
              onClick={insertBlank}
              disabled={isProcessing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('add_blank_page')}</span>
            </button>

            <button
              onClick={() => setOrganizeModalOpen(false)}
              className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sayfa Kartları Grid Alanı */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-[#181818]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {pages.map((p, idx) => (
              <div
                key={`${p.originalPageNumber}-${idx}`}
                className="group relative bg-white dark:bg-acrobat-darkPanel rounded-lg shadow-md border border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center transition-all hover:shadow-xl hover:border-red-500"
              >
                {/* Sayfa Önizleme Tuvali */}
                <div className="relative w-full aspect-[1/1.4] bg-white rounded-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex items-center justify-center">
                  {pdfDoc ? (
                    <OrganizeThumbnailCanvas
                      pdfDoc={pdfDoc}
                      pageNumber={p.originalPageNumber}
                      rotationDelta={p.rotationDelta}
                    />
                  ) : (
                    <span className="text-xs text-slate-400">{t('loading')}</span>
                  )}

                  {/* Üst Sağdaki Sil Butonu */}
                  <button
                    onClick={() => deletePage(idx)}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 hover:bg-red-600 text-white rounded-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('delete_page')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Alt Kontroller: Sayfa No ve Döndürme/Sıralama */}
                <div className="w-full mt-3 flex items-center justify-between text-xs">
                  {/* Sola Taşı */}
                  <button
                    onClick={() => moveLeft(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-500"
                    title={t('move_left')}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Döndür Butonları */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => rotatePage(idx, false)}
                      className="p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      title={t('rotate_left')}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 px-1">
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => rotatePage(idx, true)}
                      className="p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      title={t('rotate_right')}
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Sağa Taşı */}
                  <button
                    onClick={() => moveRight(idx)}
                    disabled={idx === pages.length - 1}
                    className="p-1 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-500"
                    title={t('move_right')}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alt Eylem Çubuğu */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-acrobat-darkPanel">
          <span className="text-xs text-slate-500">
            {t('rotate_delete_or_reorder_pages_with_arrows')}
          </span>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setOrganizeModalOpen(false)}
              className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              {t('cancel_2')}
            </button>

            <button
              onClick={handleApplyChanges}
              disabled={isProcessing}
              className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isProcessing ? t('processing') : (t('apply_changes'))}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sayfa Küçük Resim Çizicisi
const OrganizeThumbnailCanvas: React.FC<{
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  rotationDelta: number;
}> = ({ pdfDoc, pageNumber, rotationDelta }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let isCancelled = false;

    pdfDoc.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const totalRotation = (page.rotate + rotationDelta) % 360;
      const viewport = page.getViewport({ scale: 0.25, rotation: totalRotation });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        page.render({ canvas, viewport }).promise;
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, rotationDelta]);

  return <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pointer-events-none" />;
};
