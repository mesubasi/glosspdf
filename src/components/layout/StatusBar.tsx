import React, { useState, useEffect } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';
import { DropdownMenu, type MenuEntry } from './DropdownMenu';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Expand,
  RotateCw,
  RotateCcw,
  File,
  BookOpen,
  Book,
  Scan,
  MoveHorizontal,
  MoveVertical,
  Maximize2
} from 'lucide-react';

interface StatusBarProps {
  onPageChange: (pageNum: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onFitHeight: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ onPageChange, onFitPage, onFitWidth, onFitHeight }) => {
  const {
    tabs,
    activeTabId,
    zoomIn,
    zoomOut,
    setZoom,
    rotateClockwise,
    rotateCounterClockwise,
    pageLayout,
    setPageLayout,
    showCoverPage,
    setShowCoverPage,
    isFullScreen,
    toggleFullScreen,
    language
  } = usePdfStore();
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

  // Adobe'deki sayfa görünümü menüsü: düzen, yakınlaştırma kipleri ve tam ekran tek yerde
  const viewEntries: MenuEntry[] = [
    { label: t('single_page_view'), icon: File, checked: pageLayout === 'single', action: () => setPageLayout('single') },
    { label: t('two_page_view'), icon: BookOpen, checked: pageLayout === 'two', action: () => setPageLayout('two') },
    {
      label: t('show_cover_page'),
      icon: Book,
      checked: pageLayout === 'two' && showCoverPage,
      disabled: pageLayout !== 'two',
      action: () => setShowCoverPage(!showCoverPage)
    },
    'separator',
    { label: t('actual_size_100'), icon: Scan, shortcut: 'Ctrl+1', checked: activeTab.zoom === 1, action: () => setZoom(1) },
    { label: t('fit_page'), icon: Expand, shortcut: 'Ctrl+0', action: onFitPage },
    { label: t('fit_width'), icon: MoveHorizontal, shortcut: 'Ctrl+2', action: onFitWidth },
    { label: t('fit_height'), icon: MoveVertical, action: onFitHeight },
    'separator',
    { label: t('full_screen_mode'), icon: Maximize2, shortcut: 'F11', checked: isFullScreen, action: toggleFullScreen }
  ];

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

      {/* Sağ: Döndürme, Sayfa Görünümü Menüsü ve Yakınlaştırma */}
      <div className="flex items-center space-x-2">
        <button
          onClick={rotateCounterClockwise}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('rotate_counter_clockwise_ctrl_shift_l')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={rotateClockwise}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('rotate_clockwise_ctrl_shift_r')}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <DropdownMenu
          label={t('page_display')}
          title={t('page_display')}
          entries={viewEntries}
          checkColumn
          triggerClassName="flex items-center gap-0.5 p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          panelPositionClassName="bottom-full end-0 mb-1.5"
          trigger={
            <>
              {pageLayout === 'two' ? <BookOpen className="w-3.5 h-3.5" /> : <File className="w-3.5 h-3.5" />}
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </>
          }
        />

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
