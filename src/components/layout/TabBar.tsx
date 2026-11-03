import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { X, Plus, FileText } from 'lucide-react';
import { t } from '@/i18n';

interface TabBarProps {
  onOpenFile: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onOpenFile }) => {
  const { tabs, activeTabId, setActiveTab, requestCloseTab } = usePdfStore();

  if (tabs.length === 0) return null;

  return (
    <nav
      className="flex h-[30px] shrink-0 bg-tabs border-b border-separator text-xs select-none overflow-x-auto no-scrollbar"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group relative flex items-center flex-1 min-w-[150px] border-r border-black/10 dark:border-white/5 ${
              isActive ? 'bg-tab-on text-label font-semibold' : 'text-secondary hover:bg-hover'
            }`}
            title={tab.filePath}
          >
            {/* macOS: kapatma düğmesi solda, üzerine gelince görünür; kaydedilmemişse yerinde nokta durur */}
            <button
              onClick={() => requestCloseTab(tab.id)}
              className="absolute left-2 grid place-items-center w-4 h-4 rounded hover:bg-hover"
              title={t('close_ctrl_w')}
              aria-label={t('close_ctrl_w')}
            >
              <X className="w-3 h-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" strokeWidth={2.2} />
              {tab.isModified && (
                <span className="absolute w-[7px] h-[7px] rounded-full bg-secondary group-hover:opacity-0" />
              )}
            </button>
            <button
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 flex items-center justify-center gap-1.5 min-w-0 h-full px-7"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{tab.fileName}</span>
            </button>
          </div>
        );
      })}

      <button
        onClick={onOpenFile}
        className="grid place-items-center w-9 shrink-0 text-secondary hover:bg-hover hover:text-label"
        title={t('open_new_document_ctrl_o')}
        aria-label={t('open_new_document_ctrl_o')}
      >
        <Plus className="w-4 h-4" strokeWidth={1.8} />
      </button>
    </nav>
  );
};
