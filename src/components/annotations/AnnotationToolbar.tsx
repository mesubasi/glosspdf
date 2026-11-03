import React, { useRef, useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { ActiveTool } from '../../types/pdf';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import {
  Highlighter,
  Underline,
  Strikethrough,
  MessageSquare,
  Pencil,
  Square,
  Type,
  EyeOff,
  Undo2,
  Redo2,
  Trash2,
  MousePointer2
} from 'lucide-react';

const PALETTE_COLORS: { nameKey: MessageKey; hex: string }[] = [
  { nameKey: 'color_yellow', hex: '#ffeb3b' },
  { nameKey: 'color_green', hex: '#4caf50' },
  { nameKey: 'color_blue', hex: '#2196f3' },
  { nameKey: 'color_pink', hex: '#e91e63' },
  { nameKey: 'color_orange', hex: '#ff9800' },
  { nameKey: 'color_purple', hex: '#9c27b0' },
  { nameKey: 'color_red', hex: '#f44336' },
  { nameKey: 'color_black', hex: '#000000' }
];

const STROKE_WIDTHS = [1, 2, 4, 8];
const FONT_SIZES = [10, 12, 14, 18, 24];

const Divider = () => <span aria-hidden="true" className="shrink-0 w-px h-5 mx-1.5 bg-group-sep" />;

/** İşaretleme modunda belgenin üstünde yüzen araç kapsülü */
export const AnnotationToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    annotationColor,
    setAnnotationColor,
    annotationStrokeWidth,
    setAnnotationStrokeWidth,
    highlightOpacity,
    setHighlightOpacity,
    annotationFontSize,
    setAnnotationFontSize,
    selectedAnnotationId,
    deleteAnnotation,
    tabs,
    activeTabId,
    undo,
    redo,
    setAnnotationModeOpen
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canUndo = (activeTab?.undoStack?.length || 0) > 0;
  const canRedo = (activeTab?.redoStack?.length || 0) > 0;

  const tools: { id: ActiveTool; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'select', label: t('select'), icon: MousePointer2 },
    { id: 'highlight', label: t('highlight'), icon: Highlighter },
    { id: 'underline', label: t('underline'), icon: Underline },
    { id: 'strikeout', label: t('strikeout'), icon: Strikethrough },
    { id: 'note', label: t('sticky_note'), icon: MessageSquare },
    { id: 'draw', label: t('pen'), icon: Pencil },
    { id: 'rect', label: t('rectangle'), icon: Square },
    { id: 'text', label: t('text_box'), icon: Type },
    { id: 'redact', label: t('redact'), icon: EyeOff }
  ];

  const iconBtn = 'grid place-items-center shrink-0 w-8 h-8 rounded-full transition-colors disabled:opacity-35';

  // Üzerine gelinen kontrolün adı kapsülün altında gösterilir. Kapsül yatay kaydığı için
  // (overflow) etiket kapsülün içinde değil dışındaki sarmalayıcıda konumlanır.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ label: string; x: number } | null>(null);
  const showTip = (e: React.SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button[aria-label], select[aria-label]');
    const wrap = wrapRef.current;
    if (!el || !wrap) return setTip(null);
    const r = el.getBoundingClientRect();
    setTip({ label: el.getAttribute('aria-label') || '', x: r.left + r.width / 2 - wrap.getBoundingClientRect().left });
  };
  const hideTip = () => setTip(null);

  return (
    <div ref={wrapRef} className="absolute left-1/2 top-3.5 -translate-x-1/2 z-30 max-w-[calc(100%-2rem)]">
      <div
        role="toolbar"
        aria-label={t('annotate')}
        onMouseOver={showTip}
        onFocus={showTip}
        onMouseLeave={hideTip}
        onBlur={hideTip}
        onScroll={hideTip}
        className="flex items-center h-11 px-1.5 max-w-full overflow-x-auto no-scrollbar rounded-full bg-hud shadow-hud backdrop-blur-xl text-label text-xs select-none whitespace-nowrap"
      >
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              aria-label={tool.label}
              aria-pressed={isActive}
              className={`${iconBtn} w-[34px] ${
                isActive ? 'bg-accent/15 text-accent-text' : 'text-secondary hover:bg-hover hover:text-label'
              }`}
            >
              <Icon className="w-[17px] h-[17px]" strokeWidth={1.8} />
            </button>
          );
        })}

        <Divider />

        <div className="flex items-center gap-1.5 px-1">
          {PALETTE_COLORS.map((c) => {
            const on = annotationColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                onClick={() => setAnnotationColor(c.hex)}
                style={{ backgroundColor: c.hex }}
                aria-label={t(c.nameKey)}
                aria-pressed={on}
                className={`shrink-0 w-[18px] h-[18px] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)] ${
                  on ? 'ring-2 ring-offset-2 ring-offset-group ring-accent' : 'hover:scale-110 transition-transform'
                }`}
              />
            );
          })}
        </div>

        {/* Vurgu opaklığı (vurgula) */}
        {activeTool === 'highlight' && (
          <label className="flex items-center gap-1.5 shrink-0 ml-1.5 px-1 text-secondary">
            <span className="text-[11px]">{t('opacity')}</span>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(highlightOpacity * 100)}
              onChange={(e) => setHighlightOpacity(parseInt(e.target.value, 10) / 100)}
              aria-label={t('opacity')}
              className="w-20"
            />
            <span className="w-8 text-[11px] tabular-nums text-label">{Math.round(highlightOpacity * 100)}%</span>
          </label>
        )}

        {/* Çizgi kalınlığı (kalem ve dikdörtgen) */}
        {(activeTool === 'draw' || activeTool === 'rect') && (
          <select
            value={annotationStrokeWidth}
            onChange={(e) => setAnnotationStrokeWidth(parseInt(e.target.value, 10))}
            aria-label={t('thickness')}
            className="shrink-0 h-7 ml-1.5 px-2 rounded-md bg-fill text-label outline-hidden cursor-pointer"
          >
            {STROKE_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w} px
              </option>
            ))}
          </select>
        )}

        {/* Yazı boyutu (metin kutusu) */}
        {activeTool === 'text' && (
          <select
            value={annotationFontSize}
            onChange={(e) => setAnnotationFontSize(parseInt(e.target.value, 10))}
            aria-label={t('font_size')}
            className="shrink-0 h-7 ml-1.5 px-2 rounded-md bg-fill text-label outline-hidden cursor-pointer"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </select>
        )}

        <Divider />

        <button onClick={undo} disabled={!canUndo} aria-label={t('undo_ctrl_z')} className={`${iconBtn} text-secondary hover:bg-hover hover:text-label`}>
          <Undo2 className="w-4 h-4" strokeWidth={1.8} />
        </button>
        <button onClick={redo} disabled={!canRedo} aria-label={t('redo_ctrl_y')} className={`${iconBtn} text-secondary hover:bg-hover hover:text-label`}>
          <Redo2 className="w-4 h-4" strokeWidth={1.8} />
        </button>
        {selectedAnnotationId && (
          <button
            onClick={() => deleteAnnotation(selectedAnnotationId)}
            aria-label={t('delete_selected_annotation')}
            className={`${iconBtn} text-red-600 dark:text-red-400 hover:bg-red-500/10`}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}

        <button
          onClick={() => {
            setAnnotationModeOpen(false);
            setActiveTool('select');
          }}
          title={t('close_annotation_toolbar')}
          className="shrink-0 h-[30px] ml-1.5 px-3.5 rounded-full bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold"
        >
          {t('done')}
        </button>
      </div>
      {tip && (
        <span
          role="tooltip"
          style={{ left: tip.x }}
          className="absolute top-full mt-1.5 -translate-x-1/2 px-2 py-1 rounded-md bg-label text-window text-[11px] font-medium whitespace-nowrap pointer-events-none shadow-hud"
        >
          {tip.label}
        </span>
      )}
    </div>
  );
};
