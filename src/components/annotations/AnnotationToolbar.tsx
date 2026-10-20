import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { ActiveTool } from '../../types/pdf';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import {
  Highlighter,
  Underline,
  Strikethrough,
  MessageSquare,
  PenTool,
  Square,
  Type,
  Undo2,
  Redo2,
  Trash2,
  MousePointer,
  X
} from 'lucide-react';

const PALETTE_COLORS: { nameKey: MessageKey; hex: string }[] = [
  { nameKey: 'color_yellow', hex: '#ffeb3b' },
  { nameKey: 'color_green', hex: '#4caf50' },
  { nameKey: 'color_blue', hex: '#2196f3' },
  { nameKey: 'color_pink', hex: '#e91e63' },
  { nameKey: 'color_orange', hex: '#ff9800' },
  { nameKey: 'color_purple', hex: '#9c27b0' },
  { nameKey: 'color_red', hex: '#f44336' }
];

const STROKE_WIDTHS = [1, 2, 4, 8];
const FONT_SIZES = [10, 12, 14, 18, 24];

export const AnnotationToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    annotationColor,
    setAnnotationColor,
    annotationStrokeWidth,
    setAnnotationStrokeWidth,
    annotationFontSize,
    setAnnotationFontSize,
    selectedAnnotationId,
    deleteAnnotation,
    tabs,
    activeTabId,
    undo,
    redo,
    setAnnotationModeOpen,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canUndo = (activeTab?.undoStack?.length || 0) > 0;
  const canRedo = (activeTab?.redoStack?.length || 0) > 0;

  const tools: { id: ActiveTool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'select', label: t('select'), icon: MousePointer },
    { id: 'highlight', label: t('highlight'), icon: Highlighter },
    { id: 'underline', label: t('underline'), icon: Underline },
    { id: 'strikeout', label: t('strikeout'), icon: Strikethrough },
    { id: 'note', label: t('sticky_note'), icon: MessageSquare },
    { id: 'draw', label: t('pen'), icon: PenTool },
    { id: 'rect', label: t('rectangle'), icon: Square },
    { id: 'text', label: t('text_box'), icon: Type }
  ];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[#f0f0f0] dark:bg-[#202020] border-b border-acrobat-border dark:border-acrobat-darkBorder text-slate-700 dark:text-slate-200 select-none text-xs shadow-inner">
      {/* Sol Grup: Araçlar */}
      <div className="flex items-center space-x-1">
        <span className="font-semibold text-slate-500 dark:text-slate-400 mr-2 uppercase tracking-wider text-[11px]">
          {t('annotate')}:
        </span>

        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                isActive
                  ? 'bg-acrobat-red text-white font-medium shadow-xs'
                  : 'hover:bg-black/10 dark:hover:bg-white/10'
              }`}
              title={t.label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Orta Grup: Renk Paleti ve Özellikler */}
      <div className="flex items-center space-x-2">
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />

        {/* Renk Seçimi */}
        <div className="flex items-center space-x-1 bg-white/70 dark:bg-black/30 p-0.5 rounded-sm border border-slate-300 dark:border-slate-700">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => setAnnotationColor(c.hex)}
              style={{ backgroundColor: c.hex }}
              className={`w-4 h-4 rounded-full transition-transform ${
                annotationColor.toLowerCase() === c.hex.toLowerCase()
                  ? 'ring-2 ring-slate-800 dark:ring-white scale-125 z-10'
                  : 'hover:scale-110'
              }`}
              title={t(c.nameKey)}
            />
          ))}
        </div>

        {/* Çizgi Kalınlığı (Kalem ve Dikdörtgen için) */}
        {(activeTool === 'draw' || activeTool === 'rect') && (
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-500">{t('thickness')}</span>
            <select
              value={annotationStrokeWidth}
              onChange={(e) => setAnnotationStrokeWidth(parseInt(e.target.value, 10))}
              className="bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-slate-700 rounded-sm px-1.5 py-0.5 text-xs outline-hidden"
            >
              {STROKE_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w} px
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Yazı Boyutu (Metin Kutusu için) */}
        {activeTool === 'text' && (
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-500">{t('font_size')}</span>
            <select
              value={annotationFontSize}
              onChange={(e) => setAnnotationFontSize(parseInt(e.target.value, 10))}
              className="bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-slate-700 rounded-sm px-1.5 py-0.5 text-xs outline-hidden"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} pt
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600" />

        {/* Geri Al (Undo) */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('undo_ctrl_z')}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* İleri Al (Redo) */}
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('redo_ctrl_y')}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Seçili Olanı Sil */}
        {selectedAnnotationId && (
          <button
            onClick={() => deleteAnnotation(selectedAnnotationId)}
            className="flex items-center space-x-1 px-2 py-1 rounded-sm bg-red-500 hover:bg-red-600 text-white transition-colors"
            title={t('delete_selected_annotation')}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">{t('delete')}</span>
          </button>
        )}
      </div>

      {/* Sağ Grup: Araç Çubuğunu Kapat */}
      <div className="flex items-center">
        <button
          onClick={() => {
            setAnnotationModeOpen(false);
            setActiveTool('select');
          }}
          className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={t('close_annotation_toolbar')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
