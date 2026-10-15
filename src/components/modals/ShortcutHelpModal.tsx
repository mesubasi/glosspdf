import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { X, Keyboard, HelpCircle } from 'lucide-react';

export const ShortcutHelpModal: React.FC = () => {
  const { shortcutHelpModalOpen, setShortcutHelpModalOpen, language } = usePdfStore();

  if (!shortcutHelpModalOpen) return null;

  const categories = [
    {
      title: language === 'tr' ? 'Dosya İşlemleri' : 'File Operations',
      shortcuts: [
        { keys: ['Ctrl', 'O'], desc: language === 'tr' ? 'PDF Dosyası Aç' : 'Open PDF File' },
        { keys: ['Ctrl', 'S'], desc: language === 'tr' ? 'Belgeyi Kaydet' : 'Save Document' },
        { keys: ['Ctrl', 'Shift', 'S'], desc: language === 'tr' ? 'Farklı Kaydet' : 'Save As...' },
        { keys: ['Ctrl', 'P'], desc: language === 'tr' ? 'Yazdır' : 'Print Document' },
        { keys: ['Ctrl', 'W'], desc: language === 'tr' ? 'Aktif Sekmeyi Kapat' : 'Close Active Tab' }
      ]
    },
    {
      title: language === 'tr' ? 'Gezinme & Zoom' : 'Navigation & Zoom',
      shortcuts: [
        { keys: ['Ctrl', '+'], desc: language === 'tr' ? 'Yakınlaştır (Zoom In)' : 'Zoom In' },
        { keys: ['Ctrl', '-'], desc: language === 'tr' ? 'Uzaklaştır (Zoom Out)' : 'Zoom Out' },
        { keys: ['Ctrl', '0'], desc: language === 'tr' ? 'Sayfaya Sığdır (Fit Page)' : 'Fit Page' },
        { keys: ['Ctrl', '1'], desc: language === 'tr' ? '%100 Gerçek Boyut' : 'Actual Size (100%)' },
        { keys: ['Ctrl', '2'], desc: language === 'tr' ? 'Genişliğe Sığdır (Fit Width)' : 'Fit Width' },
        { keys: ['F11 / Ctrl+L'], desc: language === 'tr' ? 'Tam Ekran Modu' : 'Full Screen Mode' }
      ]
    },
    {
      title: language === 'tr' ? 'Düzenleme & Döndürme' : 'Editing & Rotation',
      shortcuts: [
        { keys: ['Ctrl', 'Z'], desc: language === 'tr' ? 'Geri Al (Undo)' : 'Undo Action' },
        { keys: ['Ctrl', 'Y'], desc: language === 'tr' ? 'İleri Al (Redo)' : 'Redo Action' },
        { keys: ['Delete'], desc: language === 'tr' ? 'Seçili İşareti Sil' : 'Delete Selected Annotation' },
        { keys: ['Ctrl', 'Shift', 'R'], desc: language === 'tr' ? 'Sağa 90° Döndür' : 'Rotate 90° Clockwise' },
        { keys: ['Ctrl', 'Shift', 'L'], desc: language === 'tr' ? 'Sola 90° Döndür' : 'Rotate 90° Counter-Clockwise' }
      ]
    },
    {
      title: language === 'tr' ? 'Arama & Kısayollar' : 'Search & Help',
      shortcuts: [
        { keys: ['Ctrl', 'F'], desc: language === 'tr' ? 'Belgede Ara' : 'Find in Document' },
        { keys: ['F3 / Enter'], desc: language === 'tr' ? 'Sonraki Eşleşme' : 'Next Search Match' },
        { keys: ['Shift', 'F3'], desc: language === 'tr' ? 'Önceki Eşleşme' : 'Previous Search Match' },
        { keys: ['Esc'], desc: language === 'tr' ? 'Aramayı Kapat' : 'Close Search Bar' },
        { keys: ['F1'], desc: language === 'tr' ? 'Kısayol Kılavuzu' : 'Keyboard Shortcuts Cheat Sheet' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-acrobat-red" />
            <h2 className="font-semibold text-sm">
              {language === 'tr' ? 'Klavye Kısayolları Kılavuzu' : 'Keyboard Shortcuts Reference'}
            </h2>
          </div>
          <button
            onClick={() => setShortcutHelpModalOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5"
            >
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xs tracking-wide border-b border-slate-200 dark:border-slate-800 pb-1.5">
                {cat.title}
              </h3>
              <div className="space-y-2">
                {cat.shortcuts.map((sc, scIdx) => (
                  <div key={scIdx} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-300 pr-2">{sc.desc}</span>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 bg-white dark:bg-[#2d2d2d] border border-slate-300 dark:border-slate-600 rounded text-[10px] font-mono font-semibold shadow-xs text-slate-700 dark:text-slate-200"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Alt Bilgi */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <span className="text-[11px] text-slate-400">
            {language === 'tr' ? 'Bu pencereyi kapatmak için Esc tuşuna basabilirsiniz.' : 'Press Esc to close.'}
          </span>
          <button
            onClick={() => setShortcutHelpModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-acrobat-red hover:bg-acrobat-darkRed text-white font-medium transition-colors"
          >
            {language === 'tr' ? 'Anladım' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
