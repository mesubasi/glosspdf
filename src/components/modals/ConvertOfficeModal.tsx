import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { saveBytes, stripExtension, type SavedFile } from '../../services/fileSaveService';
import { convertPdfToOffice, OFFICE_MIME_TYPES, type OfficeFormat } from '../../services/officeExportService';
import { SaveDestination, SavedFilesNotice, useSaveDestination } from '../common/SaveDestination';
import { t, type MessageKey } from '@/i18n';
import { X, FileOutput, FileText, FileSpreadsheet, Presentation, type LucideIcon } from 'lucide-react';

// Marka adları yalnızca dosyanın hangi programla açılacağını belirtir; logo kullanılmaz
const FORMATS: { id: OfficeFormat; name: string; icon: LucideIcon; desc: MessageKey }[] = [
  { id: 'docx', name: 'Word (.docx)', icon: FileText, desc: 'convert_word_desc' },
  { id: 'xlsx', name: 'Excel (.xlsx)', icon: FileSpreadsheet, desc: 'convert_excel_desc' },
  { id: 'pptx', name: 'PowerPoint (.pptx)', icon: Presentation, desc: 'convert_powerpoint_desc' }
];

export const ConvertOfficeModal: React.FC = () => {
  const { convertModalOpen, setConvertModalOpen, tabs, activeTabId } = usePdfStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [format, setFormat] = useState<OfficeFormat>('docx');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const dest = useSaveDestination({
    open: convertModalOpen && !!activeTab,
    suggestedName: activeTab ? stripExtension(activeTab.fileName) : 'Document',
    sourcePath: activeTab?.filePath,
    extension: `.${format}`
  });

  if (!convertModalOpen || !activeTab) return null;

  const handleClose = () => {
    setSavedFiles([]);
    setConvertModalOpen(false);
  };

  const handleConvert = async () => {
    try {
      setIsProcessing(true);
      setProgress({ current: 0, total: activeTab.numPages });
      const bytes = await convertPdfToOffice(activeTab.data.slice(), format, (current, total) =>
        setProgress({ current, total })
      );
      setSavedFiles([await saveBytes(bytes, dest.directory, dest.fileName, { mimeType: OFFICE_MIME_TYPES[format] })]);
    } catch (err: any) {
      console.error('Convert error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-md max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <FileOutput className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">{t('convert_to_office')}</h2>
          </div>
          <button
            onClick={handleClose}
            aria-label={t('close')}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
          <div>
            <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">{t('output_format')}</span>
            <div className="space-y-2">
              {FORMATS.map(({ id, name, icon: Icon, desc }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={format === id}
                  onClick={() => setFormat(id)}
                  disabled={isProcessing}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-start transition-colors ${
                    format === id
                      ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 mt-0.5 ${format === id ? 'text-red-500' : 'text-slate-400'}`}
                  />
                  <span>
                    <span
                      className={`block font-medium ${format === id ? 'text-red-600 dark:text-red-400' : ''}`}
                    >
                      {name}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t(desc)}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{t('convert_layout_note')}</p>
          </div>

          {/* Kayıt konumu / sonuç */}
          {savedFiles.length > 0 ? (
            <SavedFilesNotice files={savedFiles} />
          ) : (
            <SaveDestination dest={dest} disabled={isProcessing} />
          )}

          {isProcessing && (
            <div className="p-3 bg-slate-50 dark:bg-acrobat-darkPanel rounded-lg border border-slate-200 dark:border-slate-700 text-center">
              <span className="font-semibold text-red-500">
                {t('exporting_pages', [progress.current, progress.total])}
              </span>
            </div>
          )}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <button
            onClick={handleClose}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
          >
            {savedFiles.length > 0 ? t('close') : t('cancel')}
          </button>
          {savedFiles.length === 0 && (
            <button
              onClick={handleConvert}
              disabled={isProcessing || !dest.isValid}
              className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-colors disabled:opacity-40"
            >
              <FileOutput className="w-3.5 h-3.5" />
              <span>{t('convert')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
