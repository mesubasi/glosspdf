import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';

interface UnsavedChangesModalProps {
  /** Etkin sekmeyi kaydeder; kullanıcı vazgeçerse ya da hata olursa sekme değişmiş kalır */
  onSave: () => Promise<void>;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({ onSave }) => {
  const { closeRequest, setCloseRequest, tabs, closeTab, setActiveTab, language } = usePdfStore();
  const tab = tabs.find((x) => x.id === closeRequest?.tabIds[0]);

  if (!closeRequest || !tab) return null;

  // Sıradaki sekmeye geç; sıra bitince (pencere kapanıyorsa) pencereyi kapat
  const advance = () => {
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
    if (!usePdfStore.getState().tabs.find((x) => x.id === tab.id)?.isModified) advance();
  };

  const secondaryClass =
    'px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs"
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <h2 id="unsaved-title" className="font-semibold text-sm">
            {t('unsaved_changes_title')}
          </h2>
        </div>

        <p className="p-5 text-slate-600 dark:text-slate-300">{t('unsaved_changes_message', { name: tab.fileName })}</p>

        <div className="flex items-center justify-end space-x-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button onClick={advance} className={secondaryClass}>
            {t('dont_save')}
          </button>
          <button onClick={() => setCloseRequest(null)} className={secondaryClass}>
            {t('cancel')}
          </button>
          <button
            autoFocus
            onClick={save}
            className="px-4 py-1.5 rounded-lg bg-acrobat-red hover:bg-acrobat-darkRed text-white font-medium transition-colors"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};
