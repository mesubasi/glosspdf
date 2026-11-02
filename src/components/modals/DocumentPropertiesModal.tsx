import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfRenderService } from '../../services/pdfRenderService';
import { formatBytes, isRealPath } from '../../services/fileSaveService';
import { t, getLanguage } from '@/i18n';
import { X, Info } from 'lucide-react';

// pdf.js getMetadata().info alanları (yalnızca gösterdiklerimiz)
interface PdfInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  PDFFormatVersion?: string;
}

const formatPdfDate = (value?: string) =>
  value ? (pdfjsLib.PDFDateString.toDateObject(value)?.toLocaleString(getLanguage()) ?? value) : undefined;

const toMm = (pt: number) => Math.round((pt * 25.4) / 72);

export const DocumentPropertiesModal: React.FC = () => {
  const { documentPropertiesModalOpen, setDocumentPropertiesModalOpen, tabs, activeTabId } = usePdfStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [info, setInfo] = useState<PdfInfo | null>(null);

  useEffect(() => {
    if (!documentPropertiesModalOpen || !activeTab) return;
    let cancelled = false;
    setInfo(null);
    PdfRenderService.loadDocument(activeTab.data.slice())
      .then(async (doc) => {
        const { info: docInfo } = await doc.getMetadata();
        if (!cancelled) setInfo(docInfo as PdfInfo);
        doc.loadingTask.destroy();
      })
      .catch((err) => {
        console.error('Document properties error:', err);
        if (!cancelled) setInfo({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentPropertiesModalOpen, activeTab?.id, activeTab?.data]);

  if (!documentPropertiesModalOpen || !activeTab) return null;

  const close = () => setDocumentPropertiesModalOpen(false);
  const firstPage = activeTab.pageDimensions[0];

  const groups: [string, string | number | undefined][][] = [
    [
      [t('file_name'), activeTab.fileName],
      [t('file_location'), isRealPath(activeTab.filePath) ? activeTab.filePath : undefined],
      [t('file_size'), formatBytes(activeTab.data.byteLength)]
    ],
    [
      [t('doc_title'), info?.Title],
      [t('doc_author'), info?.Author],
      [t('doc_subject'), info?.Subject],
      [t('doc_keywords'), info?.Keywords]
    ],
    [
      [t('doc_created'), formatPdfDate(info?.CreationDate)],
      [t('doc_modified'), formatPdfDate(info?.ModDate)],
      [t('doc_creator'), info?.Creator],
      [t('doc_producer'), info?.Producer],
      [t('pdf_version'), info?.PDFFormatVersion],
      [t('page_count'), activeTab.numPages],
      [
        t('page_size'),
        firstPage &&
          `${toMm(firstPage.originalWidth)} × ${toMm(firstPage.originalHeight)} mm (${Math.round(
            firstPage.originalWidth
          )} × ${Math.round(firstPage.originalHeight)} pt)`
      ]
    ]
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-properties-title"
        className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-lg max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs"
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Info className="w-5 h-5 text-red-500" />
            <h2 id="document-properties-title" className="font-semibold text-sm">
              {t('document_properties')}
            </h2>
          </div>
          <button
            onClick={close}
            aria-label={t('close')}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {groups.map((rows, i) => (
            <dl
              key={i}
              className={`grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2 ${
                i > 0 ? 'pt-4 border-t border-slate-200 dark:border-slate-800' : ''
              }`}
            >
              {rows.map(([label, value]) => (
                <React.Fragment key={label}>
                  <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="break-words select-text">{value === undefined || value === '' ? '—' : value}</dd>
                </React.Fragment>
              ))}
            </dl>
          ))}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <button
            autoFocus
            onClick={close}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
