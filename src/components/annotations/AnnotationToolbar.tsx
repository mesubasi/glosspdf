import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { ActiveTool } from '../../types/pdf';
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

const PALETTE_COLORS = [
  { name: 'Sarı', hex: '#ffeb3b' },
  { name: 'Yeşil', hex: '#4caf50' },
  { name: 'Mavi', hex: '#2196f3' },
  { name: 'Pembe', hex: '#e91e63' },
  { name: 'Turuncu', hex: '#ff9800' },
  { name: 'Mor', hex: '#9c27b0' },
  { name: 'Kırmızı', hex: '#f44336' }
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
    { id: 'select', label: language === 'tr' ? 'Seç' : 'Select', icon: MousePointer },
    { id: 'highlight', label: language === 'tr' ? 'Vurgula' : 'Highlight', icon: Highlighter },
    { id: 'underline', label: language === 'tr' ? 'Altı Çiz' : 'Underline', icon: Underline },
    { id: 'strikeout', label: language === 'tr' ? 'Üstü Çiz' : 'Strikeout', icon: Strikethrough },
    { id: 'note', label: language === 'tr' ? 'Not Ekle' : 'Sticky Note', icon: MessageSquare },
    { id: 'draw', label: language === 'tr' ? 'Kalem' : 'Pen', icon: PenTool },
    { id: 'rect', label: language === 'tr' ? 'Dikdörtgen' : 'Rectangle', icon: Square },
    { id: 'text', label: language === 'tr' ? 'Metin' : 'Text Box', icon: Type }
  ];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-[#f0f0f0] dark:bg-[#202020] border-b border-acrobat-border dark:border-acrobat-darkBorder text-slate-700 dark:text-slate-200 select-none text-xs shadow-inner">
      {/* Sol Grup: Araçlar */}
      <div className="flex items-center space-x-1">
        <span className="font-semibold text-slate-500 dark:text-slate-400 mr-2 uppercase tracking-wider text-[11px]">
          {language === 'tr' ? 'İşaretle' : 'Annotate'}:
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
                  ? 'bg-acrobat-red text-white font-medium shadow-sm'
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
        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600" />

        {/* Renk Seçimi */}
        <div className="flex items-center space-x-1 bg-white/70 dark:bg-black/30 p-0.5 rounded border border-slate-300 dark:border-slate-700">
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
              title={c.name}
            />
          ))}
        </div>

        {/* Çizgi Kalınlığı (Kalem ve Dikdörtgen için) */}
        {(activeTool === 'draw' || activeTool === 'rect') && (
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-500">Kalınlık:</span>
            <select
              value={annotationStrokeWidth}
              onChange={(e) => setAnnotationStrokeWidth(parseInt(e.target.value, 10))}
              className="bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs outline-none"
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
            <span className="text-[10px] text-slate-500">Boyut:</span>
            <select
              value={annotationFontSize}
              onChange={(e) => setAnnotationFontSize(parseInt(e.target.value, 10))}
              className="bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs outline-none"
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} pt
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600" />

        {/* Geri Al (Undo) */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Geri Al (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* İleri Al (Redo) */}
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'İleri Al (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Seçili Olanı Sil */}
        {selectedAnnotationId && (
          <button
            onClick={() => deleteAnnotation(selectedAnnotationId)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
            title={language === 'tr' ? 'Seçili İşaretlemeyi Sil (Del)' : 'Delete Selected Annotation'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">{language === 'tr' ? 'Sil' : 'Delete'}</span>
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
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={language === 'tr' ? 'İşaretleme Araç Çubuğunu Kapat' : 'Close Annotation Toolbar'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
