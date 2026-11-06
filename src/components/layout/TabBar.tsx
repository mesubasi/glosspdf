import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { X, Plus } from 'lucide-react';
import { t } from '@/i18n';

interface TabBarProps {
  onOpenFile: () => void;
}

/** Kırmızı PDF belge simgesi; sekmeler birbirinden bir bakışta ayrılsın diye dolgulu */
const PdfIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" className="fill-red-600 dark:fill-red-500" />
    <path d="M14 2v6h6" className="fill-red-300" />
  </svg>
);

export const TabBar: React.FC<TabBarProps> = ({ onOpenFile }) => {
  const { tabs, activeTabId, setActiveTab, requestCloseTab } = usePdfStore();

  if (tabs.length === 0) return null;

  return (
    <nav className="flex items-end gap-0.5 h-10 shrink-0 px-2 bg-tabs border-b border-separator dark:border-group-sep text-[12.5px] select-none overflow-x-auto no-scrollbar">
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeTabId;
        // Ayraç yalnızca iki pasif sekme arasında; aktif sekmenin kenarlığı zaten ayırır
        const showDivider = i > 0 && !isActive && tabs[i - 1].id !== activeTabId;
        return (
          <React.Fragment key={tab.id}>
            {showDivider && <span aria-hidden="true" className="w-px h-[18px] mb-2 shrink-0 bg-slate-300 dark:bg-slate-600" />}
            <div
              className={`flex items-center gap-1.5 flex-[0_1_236px] min-w-[130px] h-[34px] ps-3 pe-1.5 rounded-t-[9px] ${
                isActive
                  ? '-mb-px bg-group border border-separator border-b-group dark:border-group-sep dark:border-b-group text-label font-semibold'
                  : 'text-secondary font-medium hover:bg-hover'
              }`}
              title={tab.filePath}
            >
              <button
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex items-center gap-2 min-w-0 h-full text-start"
              >
                <PdfIcon />
                <span className="truncate">{tab.fileName}</span>
              </button>
              {tab.isModified && (
                <span
                  role="img"
                  aria-label={t('unsaved_changes_title')}
                  title={t('unsaved_changes_title')}
                  className="w-[7px] h-[7px] shrink-0 rounded-full bg-red-600 dark:bg-red-500"
                />
              )}
              <button
                onClick={() => requestCloseTab(tab.id)}
                className="grid place-items-center w-[22px] h-[22px] shrink-0 rounded-md hover:bg-black/10 dark:hover:bg-white/15 hover:text-label"
                title={t('close_ctrl_w')}
                aria-label={`${t('close_ctrl_w')}: ${tab.fileName}`}
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.2} />
              </button>
            </div>
          </React.Fragment>
        );
      })}

      <button
        onClick={onOpenFile}
        className="grid place-items-center w-7 h-7 shrink-0 ms-1 mb-1 rounded-[7px] text-secondary hover:bg-black/10 dark:hover:bg-white/15 hover:text-label"
        title={t('open_new_document_ctrl_o')}
        aria-label={t('open_new_document_ctrl_o')}
      >
        <Plus className="w-4 h-4" strokeWidth={2} />
      </button>
    </nav>
  );
};
