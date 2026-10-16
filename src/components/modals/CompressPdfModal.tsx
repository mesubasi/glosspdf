import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import {
  X,
  Minimize2,
  FileCheck,
  Download,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const CompressPdfModal: React.FC = () => {
  const {
    compressModalOpen,
    setCompressModalOpen,
    tabs,
    activeTabId,
    updateTab,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<{
    originalSize: number;
    newSize: number;
    savedPercent: number;
    compressedBytes: Uint8Array;
  } | null>(null);

  if (!compressModalOpen || !activeTab) return null;

  const currentSizeBytes = activeTab.data.byteLength;
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleClose = () => {
    setCompressionResult(null);
    setCompressModalOpen(false);
  };

  const handleRunCompression = async () => {
    try {
      setIsProcessing(true);
      const originalBytes = activeTab.data.slice();
      const compressedBytes = await PdfEditService.compressPdf(originalBytes);

      const originalSize = originalBytes.byteLength;
      const newSize = compressedBytes.byteLength;
      const savedPercent = Math.max(
        0,
        Math.round(((originalSize - newSize) / originalSize) * 100)
      );

      setCompressionResult({
        originalSize,
        newSize,
        savedPercent,
        compressedBytes
      });
    } catch (err: any) {
      console.error('Compression error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAs = async () => {
    if (!compressionResult) return;
    const baseName = activeTab.fileName.replace(/\.pdf$/i, '');
    const compressedFileName = `${baseName}_sikistirilmis.pdf`;
    const bytes = compressionResult.compressedBytes;

    if (window.electronAPI) {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = window.btoa(binary);

      const res = await window.electronAPI.savePdfAs(compressedFileName, b64, language);
      if (res.success) {
        handleClose();
        return;
      } else if (res.canceled) {
        return;
      }
    }

    // Web/Fallback İndirme
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = compressedFileName;
    a.click();
    URL.revokeObjectURL(url);
    handleClose();
  };

  const handleApplyToActive = async () => {
    if (!compressionResult) return;
    try {
      setIsProcessing(true);
      const doc = await PdfRenderService.loadDocument(compressionResult.compressedBytes.slice());
      const pageDims = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1.0 });
        pageDims.push({
          pageNumber: i,
          width: vp.width,
          height: vp.height,
          originalWidth: vp.width,
          originalHeight: vp.height
        });
      }

      updateTab(activeTab.id, {
        data: compressionResult.compressedBytes,
        numPages: doc.numPages,
        pageDimensions: pageDims,
        isModified: true
      });

      handleClose();
    } catch (err: any) {
      console.error('Apply error:', err);
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
            <Minimize2 className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-sm">
              {t('compress_optimize_pdf')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4">
          {/* Mevcut Durum */}
          <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">
                {t('current_file_size')}
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {formatBytes(currentSizeBytes)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">
                {t('page_count')}
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {activeTab.numPages}
              </span>
            </div>
          </div>

          {/* Sıkıştırma Açıklaması */}
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
            <p>
              {t('unnecessary_metadata_is_purged_object_streams_are_optimi')}
            </p>
          </div>

          {/* Sonuç Alanı */}
          {compressionResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col space-y-3">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {t('optimization_complete')}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-center flex-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {t('before')}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatBytes(compressionResult.originalSize)}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-500 mx-2 flex-shrink-0" />
                <div className="text-center flex-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {t('after')}
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatBytes(compressionResult.newSize)}
                  </span>
                </div>
                <div className="text-center flex-1 border-l border-emerald-500/20 pl-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {t('saved')}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    %{compressionResult.savedPercent}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Butonlar */}
        <div className="flex items-center justify-end space-x-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium"
          >
            {t('close')}
          </button>

          {!compressionResult ? (
            <button
              onClick={handleRunCompression}
              disabled={isProcessing}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium shadow-md transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isProcessing
                  ? t('compressing')
                  : t('start_compression')}
              </span>
            </button>
          ) : (
            <>
              <button
                onClick={handleApplyToActive}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium text-slate-700 dark:text-slate-200"
              >
                <Save className="w-4 h-4" />
                <span>{t('apply_to_document')}</span>
              </button>
              <button
                onClick={handleSaveAs}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{t('save_as')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
