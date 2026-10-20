import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { X, Keyboard, HelpCircle } from 'lucide-react';
import { t } from '@/i18n';

export const ShortcutHelpModal: React.FC = () => {
  const { shortcutHelpModalOpen, setShortcutHelpModalOpen, language } = usePdfStore();

  if (!shortcutHelpModalOpen) return null;

  const categories = [
    {
      title: t('file_operations'),
      shortcuts: [
        { keys: ['Ctrl', 'O'], desc: t('open_pdf_file') },
        { keys: ['Ctrl', 'S'], desc: t('save_document') },
        { keys: ['Ctrl', 'Shift', 'S'], desc: t('save_as') },
        { keys: ['Ctrl', 'P'], desc: t('print_document') },
        { keys: ['Ctrl', 'W'], desc: t('close_active_tab') }
      ]
    },
    {
      title: t('navigation_zoom'),
      shortcuts: [
        { keys: ['Ctrl', '+'], desc: t('zoom_in_2') },
        { keys: ['Ctrl', '-'], desc: t('zoom_out_2') },
        { keys: ['Ctrl', '0'], desc: t('fit_page') },
        { keys: ['Ctrl', '1'], desc: t('actual_size_100') },
        { keys: ['Ctrl', '2'], desc: t('fit_width') },
        { keys: ['F11 / Ctrl+L'], desc: t('full_screen_mode') }
      ]
    },
    {
      title: t('editing_rotation'),
      shortcuts: [
        { keys: ['Ctrl', 'Z'], desc: t('undo_action') },
        { keys: ['Ctrl', 'Y'], desc: t('redo_action') },
        { keys: ['Delete'], desc: t('delete_selected_annotation_2') },
        { keys: ['Ctrl', 'Shift', 'R'], desc: t('rotate_90_clockwise') },
        { keys: ['Ctrl', 'Shift', 'L'], desc: t('rotate_90_counter_clockwise') }
      ]
    },
    {
      title: t('search_help'),
      shortcuts: [
        { keys: ['Ctrl', 'F'], desc: t('find_in_document') },
        { keys: ['F3 / Enter'], desc: t('next_search_match') },
        { keys: ['Shift', 'F3'], desc: t('previous_search_match') },
        { keys: ['Esc'], desc: t('close_search_bar') },
        { keys: ['F1'], desc: t('keyboard_shortcuts_cheat_sheet') }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-acrobat-red" />
            <h2 className="font-semibold text-sm">
              {t('keyboard_shortcuts_reference')}
            </h2>
          </div>
          <button
            onClick={() => setShortcutHelpModalOpen(false)}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
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
                    <div className="flex items-center space-x-1 shrink-0">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 bg-white dark:bg-[#2d2d2d] border border-slate-300 dark:border-slate-600 rounded-sm text-[10px] font-mono font-semibold shadow-2xs text-slate-700 dark:text-slate-200"
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <span className="text-[11px] text-slate-400">
            {t('press_esc_to_close')}
          </span>
          <button
            onClick={() => setShortcutHelpModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-acrobat-red hover:bg-acrobat-darkRed text-white font-medium transition-colors"
          >
            {t('got_it')}
          </button>
        </div>
      </div>
    </div>
  );
};
