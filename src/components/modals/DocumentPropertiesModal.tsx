import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfRenderService } from '../../services/pdfRenderService';
import { formatBytes, isRealPath } from '../../services/fileSaveService';
import type { DocMetadata } from '../../types/pdf';
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

// [etiket, değer, düzenlenebilir satırda input kimliği]
type Row = [string, React.ReactNode, string?];

export const DocumentPropertiesModal: React.FC = () => {
  const { documentPropertiesModalOpen, setDocumentPropertiesModalOpen, tabs, activeTabId } = usePdfStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  // Düzenlenebilir alanlar: bekleyen düzenleme varsa o, yoksa dosyadaki değerler
  const [initial, setInitial] = useState<DocMetadata | null>(null);
  const [form, setForm] = useState<DocMetadata | null>(null);

  useEffect(() => {
    if (!documentPropertiesModalOpen || !activeTab) return;
    let cancelled = false;
    setInfo(null);
    setForm(null);
    PdfRenderService.loadDocument(activeTab.data.slice())
      .then(async (doc) => {
        const { info: docInfo, metadata } = await doc.getMetadata();
        if (!cancelled) {
          const fileInfo = docInfo as PdfInfo;
          // Acrobat XMP'yi tercih eder; pdf.js XMP adlarını küçük harfe çevirir, dc:creator dizi döner
          const xmp = (name: string): string | undefined => {
            const value = metadata?.get(name);
            return (Array.isArray(value) ? value.join('; ') : value) || undefined;
          };
          const values = activeTab.metadata ?? {
            title: xmp('dc:title') ?? fileInfo.Title ?? '',
            author: xmp('dc:creator') ?? fileInfo.Author ?? '',
            subject: xmp('dc:description') ?? fileInfo.Subject ?? '',
            keywords: xmp('pdf:keywords') ?? fileInfo.Keywords ?? ''
          };
          setInfo(fileInfo);
          setInitial(values);
          setForm(values);
        }
        doc.loadingTask.destroy();
      })
      .catch((err) => {
        // Dosya okunamazsa alanlar düzenlenemez: okunamayan değerler boşla ezilmesin
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

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const keys = Object.keys(form ?? {}) as (keyof DocMetadata)[];
    if (form && initial && keys.some((key) => form[key] !== initial[key])) usePdfStore.getState().setMetadata(form);
    close();
  };

  const field = (key: keyof DocMetadata, label: string): Row => [
    label,
    form && (
      <input
        id={`doc-prop-${key}`}
        type="text"
        value={form[key]}
        autoFocus={key === 'title'}
        onChange={(e) => {
          const { value } = e.target;
          setForm((prev) => prev && { ...prev, [key]: value });
        }}
        className="w-full px-2.5 py-1 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] text-xs outline-hidden focus:border-accent"
      />
    ),
    `doc-prop-${key}`
  ];

  const groups: Row[][] = [
    [
      [t('file_name'), activeTab.fileName],
      [t('file_location'), isRealPath(activeTab.filePath) ? activeTab.filePath : undefined],
      [t('file_size'), formatBytes(activeTab.data.byteLength)]
    ],
    [
      field('title', t('doc_title')),
      field('author', t('doc_author')),
      field('subject', t('doc_subject')),
      field('keywords', t('doc_keywords'))
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 animate-in fade-in duration-150"
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-properties-title"
        className="bg-sheet w-full max-w-lg max-h-[90vh] rounded-[14px] shadow-sheet flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs"
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-group-sep bg-sheet">
          <div className="flex items-center space-x-2">
            <Info className="w-5 h-5 text-accent-text" />
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

        <form onSubmit={apply} className="flex-1 min-h-0 flex flex-col">
          {/* Gövde */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {groups.map((rows, i) => (
              <dl
                key={i}
                className={`grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-2 ${
                  i > 0 ? 'pt-4 border-t border-group-sep' : ''
                }`}
              >
                {rows.map(([label, value, inputId]) => (
                  <React.Fragment key={label}>
                    <dt className={`text-slate-500 dark:text-slate-400 ${inputId ? 'self-center' : ''}`}>
                      {inputId ? <label htmlFor={inputId}>{label}</label> : label}
                    </dt>
                    <dd className="break-words select-text">
                      {value === undefined || value === null || value === '' ? '—' : value}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
            ))}
          </div>

          {/* Alt Çubuk */}
          <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-group-sep bg-sheet">
            <button
              type="button"
              autoFocus
              onClick={close}
              className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!form}
              className="px-5 py-1.5 rounded-sm bg-accent hover:bg-accent-hover text-white font-medium shadow-md transition-colors disabled:opacity-40"
            >
              {t('apply_changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
