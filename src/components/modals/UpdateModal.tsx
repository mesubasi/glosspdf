import React, { useEffect, useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { X, RefreshCw } from 'lucide-react';
import { t, type MessageKey } from '@/i18n';
import type { UpdateState } from '../../types/electron';

const STATUS_TEXT: Partial<Record<UpdateState['status'], MessageKey>> = {
  checking: 'update_status_checking',
  'not-available': 'update_status_not_available',
  available: 'update_status_available',
  downloading: 'update_status_downloading',
  downloaded: 'update_status_downloaded',
  error: 'update_status_error',
  unsupported: 'update_status_unsupported'
};

export const UpdateModal: React.FC = () => {
  const { updateModalOpen, setUpdateModalOpen, language } = usePdfStore();
  const api = window.electronAPI;
  const [version, setVersion] = useState('');
  const [state, setState] = useState<UpdateState>({ status: api ? 'idle' : 'unsupported' });
  const [autoDownload, setAutoDownload] = useState(true);

  useEffect(() => {
    if (!updateModalOpen || !api?.getUpdateState) return;
    api.getVersion().then(setVersion);
    api.getUpdateState().then(({ autoDownload, ...current }) => {
      setAutoDownload(autoDownload);
      setState(current);
    });
    return api.onUpdateState(setState);
  }, [updateModalOpen]);

  if (!updateModalOpen) return null;

  const busy = state.status === 'checking' || state.status === 'downloading';
  const statusKey = STATUS_TEXT[state.status];
  const changeMode = (value: boolean) => {
    setAutoDownload(value);
    api?.setAutoDownload(value);
  };

  const buttonClass =
    'px-4 py-1.5 rounded-lg bg-acrobat-red hover:bg-acrobat-darkRed text-white font-medium transition-colors disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-acrobat-red" />
            <h2 className="font-semibold text-sm">{t('check_for_updates')}</h2>
          </div>
          <button
            onClick={() => setUpdateModalOpen(false)}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 space-y-4">
          <div>
            <div className="font-bold text-sm">GlossPDF</div>
            <div className="text-slate-500">{t('app_version', { version: version || '—' })}</div>
          </div>

          {statusKey && (
            <p className="text-slate-600 dark:text-slate-300" aria-live="polite">
              {t(statusKey, { version: state.version ?? '', percent: state.percent ?? 0 })}
            </p>
          )}

          {state.status !== 'unsupported' && (
            <fieldset className="space-y-2">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="update-mode"
                  checked={autoDownload}
                  onChange={() => changeMode(true)}
                  className="mt-0.5 accent-acrobat-red"
                />
                <span>{t('update_mode_auto')}</span>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="update-mode"
                  checked={!autoDownload}
                  onChange={() => changeMode(false)}
                  className="mt-0.5 accent-acrobat-red"
                />
                <span>{t('update_mode_ask')}</span>
              </label>
            </fieldset>
          )}
        </div>

        {/* Alt Bilgi */}
        <div className="flex items-center justify-end space-x-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          {state.status === 'unsupported' ? (
            api?.openReleases && (
              <button onClick={() => api.openReleases()} className={buttonClass}>
                {t('open_releases_page')}
              </button>
            )
          ) : state.status === 'available' ? (
            <button onClick={() => api?.downloadUpdate()} className={buttonClass}>
              {t('download_update')}
            </button>
          ) : state.status === 'downloaded' ? (
            <button onClick={() => api?.installUpdate()} className={buttonClass}>
              {t('restart_and_install')}
            </button>
          ) : (
            <button onClick={() => api?.checkForUpdates()} disabled={busy} className={buttonClass}>
              {t('check_for_updates')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
