import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import { viewportFor } from '../../services/pdfRenderService';
import { findWebLinks, rectsOverlap } from '../../services/linkService';
import type { AnnotationItem } from '../../types/pdf';
import { t } from '@/i18n';
import { X, Link, Unlink } from 'lucide-react';

interface WebLinksModalProps {
  mode: 'create' | 'remove';
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
}

/**
 * Acrobat "Web Bağlantıları Oluştur" (URL'lerden bağlantı oluştur) ve "Web Bağlantılarını Kaldır".
 * Sayfalar: Tümü ya da Başlangıç–Bitiş; Tamam'da sessizce ve tek geri al adımıyla uygulanır.
 */
export const WebLinksModal: React.FC<WebLinksModalProps> = ({ mode, pdfDocument }) => {
  const { setWebLinksModalOpen, tabs, activeTabId, addAnnotations, deleteAnnotations } = usePdfStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [allPages, setAllPages] = useState(true);
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState(String(activeTab?.numPages || 1));
  const [busy, setBusy] = useState(false);

  if (!activeTab) return null;
  const numPages = activeTab.numPages;
  const [first, last] = allPages ? [1, numPages] : [Number(from), Number(to)];
  const valid = Number.isInteger(first) && Number.isInteger(last) && first >= 1 && first <= last && last <= numPages;
  const close = () => setWebLinksModalOpen(null);

  const apply = async () => {
    const links = activeTab.annotations.filter(
      (a) => a.type === 'link' && a.pageNumber >= first && a.pageNumber <= last
    );
    if (mode === 'remove') {
      // Yalnızca web adresleri; belge içi sayfa bağlantıları kalır
      deleteAnnotations(links.filter((a) => a.linkUrl).map((a) => a.id));
      return close();
    }
    if (!pdfDocument) return;
    setBusy(true);
    try {
      const created: AnnotationItem[] = [];
      const createdAt = new Date().toISOString();
      for (let n = first; n <= last; n++) {
        const page = await pdfDocument.getPage(n);
        const content = await page.getTextContent();
        // Zaten bağlantısı olan metne ikinci bağlantı eklenmez
        const taken = links.filter((a) => a.pageNumber === n && a.rect).map((a) => a.rect!);
        for (const { url, rect } of findWebLinks(content.items, viewportFor(page, 1), content.styles)) {
          if (taken.some((r) => rectsOverlap(r, rect))) continue;
          taken.push(rect);
          created.push({
            id: `annot-link-${Date.now()}-${created.length}`,
            pageNumber: n,
            type: 'link',
            color: '#2563eb',
            rect,
            linkUrl: url,
            createdAt,
            author: t('annotation_author_default')
          });
        }
      }
      addAnnotations(created);
      close();
    } catch (err: any) {
      console.error('Create web links failed:', err);
      alert(t('error_generic', { message: err?.message || String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const Icon = mode === 'create' ? Link : Unlink;
  const pageField =
    'w-16 px-2 py-1 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] text-xs outline-hidden focus:border-accent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-links-title"
        className="bg-sheet w-full max-w-sm rounded-[14px] shadow-sheet flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-group-sep">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5 text-accent-text" />
            <h2 id="web-links-title" className="font-semibold text-sm">{mode === 'create' ? t('create_web_links') : t('remove_web_links')}</h2>
          </div>
          <button
            onClick={close}
            aria-label={t('close')}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <fieldset className="m-5 p-3 pt-1 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          <legend className="px-1 font-semibold">{t('section_pages')}</legend>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="webLinksPages" checked={allPages} onChange={() => setAllPages(true)} className="accent-accent" />
            <span>{t('pages_all')}</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="webLinksPages"
              checked={!allPages}
              onChange={() => setAllPages(false)}
              aria-label={t('pages_from')}
              className="accent-accent"
            />
            <label className="flex items-center gap-2">
              <span>{t('pages_from')}</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={from}
                onFocus={() => setAllPages(false)}
                onChange={(e) => setFrom(e.target.value)}
                className={pageField}
              />
            </label>
            <label className="flex items-center gap-2">
              <span>{t('pages_to')}</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={to}
                onFocus={() => setAllPages(false)}
                onChange={(e) => setTo(e.target.value)}
                className={pageField}
              />
            </label>
          </div>
        </fieldset>

        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-group-sep">
          <button
            onClick={close}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={apply}
            disabled={!valid || busy || (mode === 'create' && !pdfDocument)}
            className="px-5 py-1.5 rounded-sm bg-accent hover:bg-accent-hover text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
          >
            {t('ok')}
          </button>
        </div>
      </div>
    </div>
  );
};
