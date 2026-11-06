import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';

interface UnsavedChangesModalProps {
  /** Etkin sekme için "Farklı Kaydet" penceresini açar; kullanıcı vazgeçerse ya da hata olursa sekme değişmiş kalır */
  onSave: () => Promise<void>;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({ onSave }) => {
  const { closeRequest, setCloseRequest, tabs, closeTab, setActiveTab, language } = usePdfStore();
  const tab = tabs.find((x) => x.id === closeRequest?.tabIds[0]);

  if (!closeRequest || !tab) return null;

  const dismiss = () => setCloseRequest(null);

  // Kaydetme: değişiklikleri at; sekmeyi kapat ya da sıradaki belgeye geç, sıra bitince uygulamadan çık
  const discard = () => {
    const rest = closeRequest.tabIds.slice(1);
    if (!closeRequest.closeWindow) closeTab(tab.id);
    if (rest.length > 0) {
      setCloseRequest({ ...closeRequest, tabIds: rest });
      setActiveTab(rest[0]);
      return;
    }
    setCloseRequest(null);
    if (closeRequest.closeWindow) window.electronAPI?.confirmClose();
  };

  const save = async () => {
    await onSave();
    // Hâlâ değişmiş görünüyorsa kullanıcı "Farklı Kaydet"ten vazgeçti ya da kayıt başarısız oldu: soruyu açık bırak
    if (!usePdfStore.getState().tabs.find((x) => x.id === tab.id)?.isModified) dismiss();
  };

  const secondaryClass =
    'px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="bg-sheet w-full max-w-md rounded-[14px] shadow-sheet flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs"
      >
        <div className="px-5 py-3 border-b border-group-sep bg-slate-50 dark:bg-[#252526]">
          <h2 id="unsaved-title" className="font-semibold text-sm">
            {t('unsaved_changes_title')}
          </h2>
        </div>

        <p className="p-5 text-slate-600 dark:text-slate-300">{t('unsaved_changes_message', { name: tab.fileName })}</p>

        <div className="flex items-center justify-end space-x-2 px-5 py-3 border-t border-group-sep bg-slate-50 dark:bg-[#252526]">
          <button onClick={discard} className={secondaryClass}>
            {t('dont_save')}
          </button>
          <button onClick={dismiss} className={secondaryClass}>
            {t('cancel')}
          </button>
          <button
            autoFocus
            onClick={save}
            className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
