import React, { useState, useEffect, useRef } from 'react';
import { AnnotationItem } from '../../types/pdf';
import { X, Trash2, Check, MessageSquare } from 'lucide-react';

interface NotePopoverProps {
  annotation: AnnotationItem;
  position: { x: number; y: number };
  onSave: (contents: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const NotePopover: React.FC<NotePopoverProps> = ({
  annotation,
  position,
  onSave,
  onDelete,
  onClose
}) => {
  const [text, setText] = useState(annotation.contents || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(annotation.contents || '');
    // Açıldığında metin alanına odaklan
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, [annotation.id]);

  const handleSave = () => {
    onSave(text.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      ref={popoverRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      className="absolute z-50 w-72 bg-white dark:bg-[#252526] rounded-lg shadow-2xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex flex-col text-xs overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Popover Üst Başlık */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
          <span>Not / Yorum</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Notu Sil"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Yazar ve Tarih Bilgisi */}
      <div className="px-3 pt-2 text-[10px] text-slate-400 flex justify-between">
        <span>{annotation.author || 'Kullanıcı'}</span>
        <span>{new Date(annotation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* Metin Giriş Alanı */}
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Yorumunuzu buraya yazın... (Ctrl+Enter ile kaydet)"
          rows={4}
          className="w-full resize-none rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] p-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500 dark:focus:border-amber-400"
        />
      </div>

      {/* Alt Eylem Butonları */}
      <div className="flex items-center justify-end space-x-2 px-3 pb-3">
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          İptal
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          className="flex items-center space-x-1 px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium shadow transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Kaydet</span>
        </button>
      </div>
    </div>
  );
};
