import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { X, Plus, FileText } from 'lucide-react';
import { t } from '@/i18n';

interface TabBarProps {
  onOpenFile: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onOpenFile }) => {
  const { tabs, activeTabId, setActiveTab, closeTab, language } = usePdfStore();

  return (
    <div className="flex items-center bg-[#1c1d1f] text-slate-300 text-xs px-2 pt-1.5 select-none border-b border-black/40 overflow-x-auto no-scrollbar">
      {/* GlossPDF Marka Başlığı */}
      <div className="flex items-center space-x-2 px-2 py-1 mr-2 text-white font-bold tracking-tight text-xs border-r border-slate-700/60 pr-3">
        <img src="/logo.png" alt="GlossPDF" className="w-5 h-5 rounded object-contain shadow-sm" />
        <span className="tracking-wide font-semibold text-slate-100">
          Gloss<span className="text-red-500 font-bold">PDF</span>
        </span>
      </div>

      {/* Sekmeler */}
      <div className="flex items-center space-x-1 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center max-w-[220px] min-w-[120px] px-3 py-1.5 rounded-t-md cursor-pointer transition-all border-t-2 ${
                isActive
                  ? 'bg-acrobat-toolbar dark:bg-acrobat-darkToolbar text-slate-900 dark:text-white font-medium border-acrobat-red shadow-sm'
                  : 'bg-[#2b2b2b] hover:bg-[#353535] text-slate-400 border-transparent'
              }`}
              title={tab.filePath}
            >
              <FileText className={`w-3.5 h-3.5 mr-2 flex-shrink-0 ${isActive ? 'text-acrobat-red' : 'text-slate-400'}`} />
              <span className="truncate flex-1">
                {tab.fileName}
                {tab.isModified && <span className="text-acrobat-red ml-1 font-bold">*</span>}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded-full hover:bg-black/20 text-slate-400 hover:text-slate-200 opacity-60 group-hover:opacity-100 transition-opacity"
                title={t('close_ctrl_w')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Yeni Belge Aç Butonu */}
        <button
          onClick={onOpenFile}
          className="p-1.5 rounded hover:bg-[#383838] text-slate-400 hover:text-white transition-colors ml-1"
          title={t('open_new_document_ctrl_o')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
