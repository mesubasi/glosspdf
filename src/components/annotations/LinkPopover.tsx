import React, { useId, useState } from 'react';
import { Link } from 'lucide-react';
import { t } from '@/i18n';
import { normalizeLinkUrl } from '../../services/linkService';

/** Bağlantı hedefi: dış adres ya da bu belgedeki sayfa */
export interface LinkTarget {
  linkUrl?: string;
  linkPage?: number;
}

interface LinkPopoverProps extends LinkTarget {
  numPages: number;
  position: { x: number; y: number };
  onSave: (target: LinkTarget) => void;
  onCancel: () => void;
}

/** Acrobat "Bağlantı Oluştur/Düzenle": web adresi ya da bu belgedeki bir sayfa */
export const LinkPopover: React.FC<LinkPopoverProps> = ({ linkUrl, linkPage, numPages, position, onSave, onCancel }) => {
  const initialKind = linkPage && !linkUrl ? 'page' : 'url';
  const [kind, setKind] = useState<'url' | 'page'>(initialKind);
  const [url, setUrl] = useState(linkUrl || '');
  const [page, setPage] = useState(String(linkPage || 1));
  const [error, setError] = useState('');
  const name = useId();

  const choose = (next: 'url' | 'page') => {
    setKind(next);
    setError('');
  };

  const submit = () => {
    if (kind === 'url') {
      const normalized = normalizeLinkUrl(url);
      if (normalized) onSave({ linkUrl: normalized });
      else setError(t('link_invalid_url'));
    } else {
      const n = Number(page);
      if (Number.isInteger(n) && n >= 1 && n <= numPages) onSave({ linkPage: n });
      else setError(t('link_invalid_page', [numPages]));
    }
  };

  const field =
    'px-2 py-1 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] text-xs outline-hidden focus:border-accent';
  const button = 'px-3 py-1 rounded-sm transition-colors';

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      style={{ left: position.x, top: position.y }}
      className="absolute z-50 w-72 pointer-events-auto bg-white dark:bg-acrobat-darkPanel rounded-lg shadow-2xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-acrobat-darkBg border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
        <Link className="w-3.5 h-3.5 text-accent-text" />
        <span>{t('link')}</span>
      </div>

      <div className="p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={name} checked={kind === 'url'} onChange={() => choose('url')} className="accent-accent" />
          <span>{t('link_web_address')}</span>
        </label>
        <input
          type="text"
          autoFocus={initialKind === 'url'}
          value={url}
          onFocus={() => choose('url')}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          aria-label={t('link_web_address')}
          className={`${field} w-full`}
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name={name} checked={kind === 'page'} onChange={() => choose('page')} className="accent-accent" />
          <span className="flex-1">{t('link_page_in_document')}</span>
          <input
            type="number"
            min={1}
            max={numPages}
            autoFocus={initialKind === 'page'}
            value={page}
            onFocus={() => choose('page')}
            onChange={(e) => setPage(e.target.value)}
            aria-label={t('link_page_in_document')}
            className={`${field} w-16`}
          />
        </label>
        {error && (
          <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end space-x-2 px-3 pb-3">
        <button
          type="button"
          onClick={onCancel}
          className={`${button} border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300`}
        >
          {t('cancel')}
        </button>
        <button type="button" onClick={submit} className={`${button} bg-accent hover:bg-accent-hover text-white font-medium shadow-sm`}>
          {t('ok')}
        </button>
      </div>
    </div>
  );
};
