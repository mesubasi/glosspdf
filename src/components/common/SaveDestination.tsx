import React from 'react';
import { t } from '@/i18n';
import { CheckCircle2, FolderOpen } from 'lucide-react';
import { isDesktop, showInFolder, type SavedFile } from '../../services/fileSaveService';

/** Kayıt sonrası: dosyanın tam olarak nereye yazıldığını gösterir ve klasörde açar */
export const SavedFilesNotice: React.FC<{ files: SavedFile[]; message?: string }> = ({ files, message }) => {
  if (files.length === 0) return null;
  const desktop = isDesktop();
  const first = files[0];

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex flex-col space-y-2 text-xs">
      <div className="flex items-center space-x-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          {message ??
            (desktop
              ? files.length === 1
                ? t('saved_to')
                : t('saved_files_to', [files.length])
              : t('downloaded_files', [files.length]))}
        </span>
      </div>
      {desktop && (
        <>
          <div className="font-mono text-[11px] text-slate-700 dark:text-slate-200 break-all" dir="ltr">
            {first.filePath}
            {files.length > 1 && <span className="text-slate-400"> {t('and_n_more', [files.length - 1])}</span>}
          </div>
          <div>
            <button
              type="button"
              onClick={() => showInFolder(first.filePath)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{t('show_in_folder')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
