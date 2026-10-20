import React, { useState, useEffect } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Expand
} from 'lucide-react';

interface StatusBarProps {
  onPageChange: (pageNum: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ onPageChange, onFitPage, onFitWidth }) => {
  const { tabs, activeTabId, zoomIn, zoomOut, setZoom, language } = usePdfStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [inputPage, setInputPage] = useState<string>('1');

  useEffect(() => {
    if (activeTab) {
      setInputPage(activeTab.currentPage.toString());
    }
  }, [activeTab?.currentPage]);

  if (!activeTab) return null;

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputPage, 10);
    if (!isNaN(num) && num >= 1 && num <= activeTab.numPages) {
      onPageChange(num);
    } else {
      setInputPage(activeTab.currentPage.toString());
    }
  };

  const zoomPercent = Math.round(activeTab.zoom * 100);

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-acrobat-toolbar dark:bg-acrobat-darkToolbar border-t border-acrobat-border dark:border-acrobat-darkBorder text-slate-700 dark:text-slate-300 text-xs select-none">
      {/* Sol: Sayfa Gezinme */}
      <div className="flex items-center space-x-1">
        {/* İlk Sayfa */}
        <button
          onClick={() => onPageChange(1)}
          disabled={activeTab.currentPage <= 1}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('first_page_home')}
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Önceki Sayfa */}
        <button
          onClick={() => onPageChange(activeTab.currentPage - 1)}
          disabled={activeTab.currentPage <= 1}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('previous_page_pageup')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Sayfa Giriş Formu */}
        <form onSubmit={handlePageSubmit} className="flex items-center space-x-1">
          <input
            type="text"
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            className="w-10 bg-white dark:bg-acrobat-darkBg border border-acrobat-border dark:border-acrobat-darkBorder rounded-sm text-center py-0.5 text-xs outline-hidden focus:border-acrobat-red"
          />
          <span className="text-slate-500">/ {activeTab.numPages}</span>
        </form>

        {/* Sonraki Sayfa */}
        <button
          onClick={() => onPageChange(activeTab.currentPage + 1)}
          disabled={activeTab.currentPage >= activeTab.numPages}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('next_page_pagedown')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Son Sayfa */}
        <button
          onClick={() => onPageChange(activeTab.numPages)}
          disabled={activeTab.currentPage >= activeTab.numPages}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('last_page_end')}
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sağ: Zoom Kaydırıcı ve Sığdırma Butonları */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onFitPage}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          title={t('fit_page_ctrl_0')}
        >
          <Expand className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onFitWidth}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          title={t('fit_width_ctrl_2')}
        >
          <span className="font-bold text-[10px] px-1 border border-current rounded-sm">↔</span>
        </button>

        <div className="h-3 w-px bg-slate-300 dark:bg-slate-600" />

        <button
          onClick={zoomOut}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('zoom_out')}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Kaydırıcı (Slider) */}
        <input
          type="range"
          min="0.1"
          max="4.0"
          step="0.05"
          value={activeTab.zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-20 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-acrobat-red"
        />

        <button
          onClick={zoomIn}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('zoom_in')}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <span className="w-12 text-right font-medium">{zoomPercent}%</span>
      </div>
    </div>
  );
};
