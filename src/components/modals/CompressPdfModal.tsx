import React, { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import {
  PdfEditService,
  COMPRESSION_LEVELS,
  type CompressionLevel,
  type CompressionOptions
} from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { saveBytes, stripExtension, type SavedFile } from '../../services/fileSaveService';
import { SaveDestination, SavedFilesNotice, useSaveDestination } from '../common/SaveDestination';
import { t, type MessageKey } from '@/i18n';
import {
  X,
  Minimize2,
  FileCheck,
  Download,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';

type Preset = CompressionLevel | 'custom';
type CleanupKey = 'removeMetadata' | 'removeThumbnails' | 'removeAttachments' | 'removeJavaScript';

const CLEANUP_OPTIONS: { key: CleanupKey; label: MessageKey; desc: MessageKey }[] = [
  { key: 'removeMetadata', label: 'compression_remove_metadata', desc: 'compression_remove_metadata_desc' },
  { key: 'removeThumbnails', label: 'compression_remove_thumbnails', desc: 'compression_remove_thumbnails_desc' },
  { key: 'removeAttachments', label: 'compression_remove_attachments', desc: 'compression_remove_attachments_desc' },
  { key: 'removeJavaScript', label: 'compression_remove_javascript', desc: 'compression_remove_javascript_desc' }
];

export const CompressPdfModal: React.FC = () => {
  const {
    compressModalOpen,
    setCompressModalOpen,
    tabs,
    activeTabId,
    updateTab
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [level, setLevel] = useState<Preset>('balanced');
  const [customMaxSide, setCustomMaxSide] = useState(1600);
  const [customQuality, setCustomQuality] = useState(70);
  const [grayscale, setGrayscale] = useState(false);
  const [cleanup, setCleanup] = useState<Record<CleanupKey, boolean>>({
    removeMetadata: false,
    removeThumbnails: true,
    removeAttachments: false,
    removeJavaScript: false
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [compressionResult, setCompressionResult] = useState<{
    originalSize: number;
    newSize: number;
    savedPercent: number;
    compressedBytes: Uint8Array;
    imagesTotal: number;
    imagesOptimized: number;
    objectsRemoved: number;
    alreadyOptimized: boolean;
  } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const dest = useSaveDestination({
    open: compressModalOpen && !!activeTab,
    suggestedName: activeTab ? `${stripExtension(activeTab.fileName)}_compressed` : 'compressed',
    sourcePath: activeTab?.filePath
  });

  // Sonuç, kaydırılabilir gövdenin altında kalabilir; görünür alana getir
  useEffect(() => {
    if (compressionResult) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [compressionResult]);

  if (!compressModalOpen || !activeTab) return null;

  const currentSizeBytes = activeTab.data.byteLength;
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleClose = () => {
    setCompressionResult(null);
    setSavedFiles([]);
    setProgress(null);
    setCompressModalOpen(false);
  };

  /** Ayar değişince eski sonuç geçersiz olur */
  const changeSetting = (apply: () => void) => {
    apply();
    setCompressionResult(null);
    setSavedFiles([]);
  };

  const buildOptions = (): CompressionOptions => {
    const base =
      level === 'custom'
        ? { maxSide: customMaxSide, quality: customQuality / 100 }
        : COMPRESSION_LEVELS[level];
    return { ...base, grayscale, ...cleanup };
  };

  const handleRunCompression = async () => {
    try {
      setIsProcessing(true);
      setProgress(null);
      const originalBytes = activeTab.data.slice();
      const result = await PdfEditService.compressPdf(originalBytes, buildOptions(), (done, total) =>
        setProgress({ done, total })
      );

      const originalSize = originalBytes.byteLength;
      const newSize = result.bytes.byteLength;
      const savedPercent = Math.max(
        0,
        Math.round(((originalSize - newSize) / originalSize) * 100)
      );

      setCompressionResult({
        originalSize,
        newSize,
        savedPercent,
        compressedBytes: result.bytes,
        imagesTotal: result.imagesTotal,
        imagesOptimized: result.imagesOptimized,
        objectsRemoved: result.objectsRemoved,
        alreadyOptimized: result.alreadyOptimized
      });
    } catch (err: any) {
      console.error('Compression error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleSave = async () => {
    if (!compressionResult || !dest.isValid) return;
    try {
      setIsProcessing(true);
      const saved = await saveBytes(compressionResult.compressedBytes, dest.directory, dest.fileName);
      setSavedFiles([saved]);
    } catch (err: any) {
      console.error('Save error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-lg max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Minimize2 className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-sm">
              {t('compress_optimize_pdf')}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
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
              {t('compression_explainer')}
            </p>
          </div>

          {/* Sıkıştırma Seviyesi */}
          <div className="grid grid-cols-2 gap-2">
            {(['light', 'balanced', 'strong', 'custom'] as const).map((value) => (
              <label
                key={value}
                className={`flex items-start space-x-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  level === value
                    ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-acrobat-darkPanel'
                }`}
              >
                <input
                  type="radio"
                  name="compressionLevel"
                  checked={level === value}
                  disabled={isProcessing}
                  onChange={() => changeSetting(() => setLevel(value))}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{t(`compression_${value}`)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{t(`compression_${value}_desc`)}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Özel Ayarlar */}
          {level === 'custom' && (
            <div className="flex flex-col space-y-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20">
              <label className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('compression_max_resolution')}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{customMaxSide} px</span>
                </div>
                <input
                  type="range"
                  min={400}
                  max={4000}
                  step={100}
                  value={customMaxSide}
                  disabled={isProcessing}
                  onChange={(e) => changeSetting(() => setCustomMaxSide(Number(e.target.value)))}
                  className="accent-indigo-600"
                />
              </label>
              <label className="flex flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('compression_image_quality')}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{customQuality}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={95}
                  step={5}
                  value={customQuality}
                  disabled={isProcessing}
                  onChange={(e) => changeSetting(() => setCustomQuality(Number(e.target.value)))}
                  className="accent-indigo-600"
                />
              </label>
            </div>
          )}

          {/* Gelişmiş Seçenekler */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-acrobat-darkPanel rounded-lg transition-colors"
            >
              <span>{t('compression_advanced')}</span>
              {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showAdvanced && (
              <div className="flex flex-col space-y-2.5 px-3 pb-3 pt-1">
                {[
                  { key: 'grayscale' as const, label: 'compression_grayscale' as MessageKey, desc: 'compression_grayscale_desc' as MessageKey },
                  ...CLEANUP_OPTIONS
                ].map(({ key, label, desc }) => {
                  const checked = key === 'grayscale' ? grayscale : cleanup[key];
                  return (
                    <label key={key} className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isProcessing}
                        onChange={(e) =>
                          changeSetting(() =>
                            key === 'grayscale'
                              ? setGrayscale(e.target.checked)
                              : setCleanup((c) => ({ ...c, [key]: e.target.checked }))
                          )
                        }
                        className="mt-0.5 rounded-sm text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-slate-800 dark:text-slate-200">{t(label)}</div>
                        <div className="text-[11px] text-slate-400">{t(desc)}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* İlerleme */}
          {isProcessing && progress && progress.total > 0 && (
            <div className="flex flex-col space-y-1.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('compression_progress', [progress.done, progress.total])}
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-150"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Sonuç Alanı */}
          <div ref={resultRef} className="empty:hidden">
          {compressionResult?.alreadyOptimized && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start space-x-2 text-amber-700 dark:text-amber-300">
              <Info className="w-5 h-5 shrink-0" />
              <span className="leading-relaxed">{t('compression_already_optimized')}</span>
            </div>
          )}

          {compressionResult && !compressionResult.alreadyOptimized && (
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
                <ArrowRight className="w-4 h-4 text-emerald-500 mx-2 shrink-0" />
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

              <div className="border-t border-emerald-500/20 pt-2 flex flex-col space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t('compression_images_optimized', [compressionResult.imagesOptimized, compressionResult.imagesTotal])}</span>
                </div>
                {compressionResult.objectsRemoved > 0 && (
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t('compression_objects_removed', [compressionResult.objectsRemoved])}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>

          {/* Kayıt konumu: sıkıştırılmış kopyanın nereye yazılacağı */}
          {compressionResult && !compressionResult.alreadyOptimized && (
            savedFiles.length > 0 ? (
              <SavedFilesNotice files={savedFiles} />
            ) : (
              <SaveDestination dest={dest} disabled={isProcessing} />
            )
          )}
        </div>

        {/* Butonlar */}
        <div className="flex items-center justify-end space-x-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors font-medium"
          >
            {t('close')}
          </button>

          {!compressionResult || compressionResult.alreadyOptimized ? (
            <button
              onClick={handleRunCompression}
              disabled={isProcessing}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium shadow-md transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isProcessing
                  ? t('compressing')
                  : compressionResult
                    ? t('compression_try_again')
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
              {savedFiles.length === 0 && (
                <button
                  onClick={handleSave}
                  disabled={isProcessing || !dest.isValid}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium shadow-md transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('save_copy')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
