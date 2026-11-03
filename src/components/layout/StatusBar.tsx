import React, { useState, useEffect } from 'react';
import { usePdfStore, ZOOM_LEVELS } from '../../store/usePdfStore';
import { t } from '@/i18n';
import { DropdownMenu, type MenuEntry } from './DropdownMenu';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Minus,
  Plus,
  Expand,
  MoveHorizontal,
  MoveVertical,
  Hand,
  RotateCw,
  RotateCcw,
  File,
  BookOpen,
  Book,
  Scan,
  Maximize2
} from 'lucide-react';

interface StatusBarProps {
  onPageChange: (pageNum: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onFitHeight: () => void;
}

const HudButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }> = ({
  label,
  onClick,
  disabled,
  active,
  children
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`grid place-items-center shrink-0 w-[30px] h-7 rounded-full transition-colors disabled:opacity-35 ${
      active ? 'bg-accent/15 text-accent-text' : 'text-secondary hover:bg-hover hover:text-label'
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span aria-hidden="true" className="shrink-0 w-px h-[18px] mx-1 bg-group-sep" />;

/** Belgenin altında yüzen sayfa, döndürme ve görünüm kapsülü (eski durum çubuğunun yerine) */
export const StatusBar: React.FC<StatusBarProps> = ({ onPageChange, onFitPage, onFitWidth, onFitHeight }) => {
  const {
    tabs,
    activeTabId,
    zoomIn,
    zoomOut,
    setZoom,
    activeTool,
    setActiveTool,
    rotateClockwise,
    rotateCounterClockwise,
    pageLayout,
    setPageLayout,
    showCoverPage,
    setShowCoverPage,
    isFullScreen,
    toggleFullScreen
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
  const atFirst = activeTab.currentPage <= 1;
  const atLast = activeTab.currentPage >= activeTab.numPages;

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
    <div
      role="toolbar"
      className="absolute left-1/2 bottom-5 -translate-x-1/2 z-30 flex items-center gap-0.5 h-9 px-1 max-w-[calc(100%-2rem)] rounded-full bg-hud shadow-hud backdrop-blur-xl text-label text-xs select-none whitespace-nowrap"
    >
      <HudButton
        label={t('hand_tool')}
        active={activeTool === 'hand'}
        onClick={() => setActiveTool(activeTool === 'hand' ? 'select' : 'hand')}
      >
        <Hand className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </HudButton>

      <Divider />

      <HudButton label={t('first_page_home')} onClick={() => onPageChange(1)} disabled={atFirst}>
        <ChevronsLeft className="w-4 h-4" strokeWidth={2} />
      </HudButton>
      <HudButton label={t('previous_page_pageup')} onClick={() => onPageChange(activeTab.currentPage - 1)} disabled={atFirst}>
        <ChevronLeft className="w-4 h-4" strokeWidth={2} />
      </HudButton>
      <form onSubmit={handlePageSubmit} className="flex items-center gap-1 px-0.5 tabular-nums">
        <input
          type="text"
          inputMode="numeric"
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onBlur={handlePageSubmit}
          aria-label={t('page', [activeTab.currentPage])}
          className="w-9 h-6 rounded-md bg-fill text-center font-medium outline-hidden focus:ring-2 focus:ring-accent"
        />
        <span className="text-secondary">/ {activeTab.numPages}</span>
      </form>
      <HudButton label={t('next_page_pagedown')} onClick={() => onPageChange(activeTab.currentPage + 1)} disabled={atLast}>
        <ChevronRight className="w-4 h-4" strokeWidth={2} />
      </HudButton>
      <HudButton label={t('last_page_end')} onClick={() => onPageChange(activeTab.numPages)} disabled={atLast}>
        <ChevronsRight className="w-4 h-4" strokeWidth={2} />
      </HudButton>

      <Divider />

      <HudButton label={t('zoom_out')} onClick={zoomOut}>
        <Minus className="w-[15px] h-[15px]" strokeWidth={2} />
      </HudButton>
      <select
        value={activeTab.zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        aria-label={`${zoomPercent}%`}
        className="h-6 px-1 rounded-md bg-transparent hover:bg-hover font-medium tabular-nums text-center outline-hidden cursor-pointer appearance-none"
      >
        {ZOOM_LEVELS.map((lvl) => (
          <option key={lvl} value={lvl}>
            {Math.round(lvl * 100)}%
          </option>
        ))}
        {!ZOOM_LEVELS.includes(activeTab.zoom) && <option value={activeTab.zoom}>{zoomPercent}%</option>}
      </select>
      <HudButton label={t('zoom_in')} onClick={zoomIn}>
        <Plus className="w-[15px] h-[15px]" strokeWidth={2} />
      </HudButton>

      <Divider />

      <HudButton label={t('rotate_counter_clockwise_ctrl_shift_l')} onClick={rotateCounterClockwise}>
        <RotateCcw className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </HudButton>
      <HudButton label={t('rotate_clockwise_ctrl_shift_r')} onClick={rotateClockwise}>
        <RotateCw className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </HudButton>
      <DropdownMenu
        label={t('page_display')}
        title={t('page_display')}
        entries={viewEntries}
        checkColumn
        triggerClassName="flex items-center gap-0.5 h-7 px-1.5 rounded-full text-secondary hover:bg-hover hover:text-label transition-colors"
        panelPositionClassName="bottom-full end-0 mb-2.5"
        trigger={
          <>
            {pageLayout === 'two' ? (
              <BookOpen className="w-[15px] h-[15px]" strokeWidth={1.8} />
            ) : (
              <File className="w-[15px] h-[15px]" strokeWidth={1.8} />
            )}
            <ChevronDown className="w-3 h-3" strokeWidth={2} />
          </>
        }
      />
    </div>
  );
};
