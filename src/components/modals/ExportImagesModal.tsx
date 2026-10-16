import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfRenderService } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import {
  X,
  FileImage,
  Download
} from 'lucide-react';

export const ExportImagesModal: React.FC = () => {
  const {
    exportImagesModalOpen,
    setExportImagesModalOpen,
    tabs,
    activeTabId,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(2.0); // 2x = Yüksek çözünürlük
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!exportImagesModalOpen || !activeTab) return null;

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      const doc = await PdfRenderService.loadDocument(activeTab.data.slice());
      const pageNumbers =
        exportScope === 'current'
          ? [activeTab.currentPage]
          : Array.from({ length: doc.numPages }, (_, i) => i + 1);

      setProgress({ current: 0, total: pageNumbers.length });

      for (let i = 0; i < pageNumbers.length; i++) {
        const pageNum = pageNumbers[i];
        setProgress({ current: i + 1, total: pageNumbers.length });

        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scaleMultiplier });

        // Görünmez canvas oluşturup çizim yap
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          const ext = format === 'image/png' ? 'png' : 'jpg';
          const dataUrl = canvas.toDataURL(format, 0.95);
          const fileName = `${activeTab.fileName.replace('.pdf', '')}_sayfa_${pageNum}.${ext}`;

          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = fileName;
          a.click();
        }
      }

      setExportImagesModalOpen(false);
    } catch (err: any) {
      console.error('Export error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <FileImage className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('export_pages_as_images')}
            </h2>
          </div>
          <button
            onClick={() => setExportImagesModalOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4">
          {/* Kapsam Seçimi */}
          <div>
            <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('pages_to_export')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportScope('current')}
                className={`p-2.5 rounded-lg border font-medium text-center transition-colors ${
                  exportScope === 'current'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div>{t('current_page')}</div>
                <div className="text-[10px] text-slate-400">{t('current_page_count', [activeTab.currentPage])}</div>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-2.5 rounded-lg border font-medium text-center transition-colors ${
                  exportScope === 'all'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div>{t('all_pages')}</div>
                <div className="text-[10px] text-slate-400">{t('total_pages_count', [activeTab.numPages])}</div>
              </button>
            </div>
          </div>

          {/* Format Seçimi */}
          <div>
            <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('image_format')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('image/png')}
                className={`py-2 px-3 rounded-lg border font-medium transition-colors ${
                  format === 'image/png'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t('png_lossless')}
              </button>
              <button
                type="button"
                onClick={() => setFormat('image/jpeg')}
                className={`py-2 px-3 rounded-lg border font-medium transition-colors ${
                  format === 'image/jpeg'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t('jpeg_small')}
              </button>
            </div>
          </div>

          {/* Çözünürlük Kalitesi */}
          <div>
            <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('resolution_quality')}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { scale: 1.0, label: '1x (72 DPI)' },
                { scale: 2.0, label: '2x (144 DPI - HD)' },
                { scale: 3.0, label: '3x (216 DPI - Ultra)' }
              ].map((res) => (
                <button
                  key={res.scale}
                  type="button"
                  onClick={() => setScaleMultiplier(res.scale)}
                  className={`py-1.5 rounded border text-center font-medium transition-colors ${
                    scaleMultiplier === res.scale
                      ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          {/* İlerleme Durumu */}
          {isProcessing && (
            <div className="p-3 bg-slate-50 dark:bg-[#252526] rounded-lg border border-slate-200 dark:border-slate-700 text-center">
              <span className="font-semibold text-red-500">
                {t('exporting_pages', [progress.current, progress.total])}
              </span>
            </div>
          )}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button
            onClick={() => setExportImagesModalOpen(false)}
            className="px-4 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isProcessing ? t('exporting') : (t('export'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
