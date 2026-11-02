import React, { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';
import { AlertTriangle, CheckCircle2, Download, FolderOpen, FolderSearch, HardDrive } from 'lucide-react';
import {
  getDefaultSaveDir,
  isDesktop,
  joinPath,
  sanitizeFileName,
  showInFolder,
  stripExtension,
  type SavedFile
} from '../../services/fileSaveService';

export interface SaveDestinationState {
  /** Uzantısız dosya adı (çoklu çıktıda ad öneki) */
  baseName: string;
  setBaseName: (name: string) => void;
  /** Hedef klasör (tarayıcıda boş) */
  directory: string;
  setDirectory: (dir: string) => void;
  extension: string;
  /** Uzantılı, temizlenmiş tam dosya adı */
  fileName: string;
  /** Gösterim için tam yol */
  fullPath: string;
  /** Ad boş mu? (kaydet düğmesi devre dışı bırakılmalı) */
  isValid: boolean;
}

/**
 * Kayıt hedefinin durumu. Pencere her açıldığında kaynak belgenin klasörü ve önerilen ad ile başlar.
 * Kullanıcı adı değiştirdiyse önerilen ad sonradan değişse de (ör. birleştirme listesi) korunur.
 */
export function useSaveDestination({
  open,
  suggestedName,
  sourcePath,
  extension = '.pdf'
}: {
  open: boolean;
  suggestedName: string;
  sourcePath?: string;
  extension?: string;
}): SaveDestinationState {
  const [baseName, setBaseNameState] = useState(stripExtension(suggestedName));
  const [directory, setDirectory] = useState('');
  const nameTouched = useRef(false);

  // Pencere açılınca: varsayılan klasörü (kaynak belgenin klasörü / Belgeler) yükle
  useEffect(() => {
    if (!open) return;
    nameTouched.current = false;
    setBaseNameState(stripExtension(suggestedName));
    let cancelled = false;
    getDefaultSaveDir(sourcePath).then((dir) => {
      if (!cancelled) setDirectory(dir);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourcePath]);

  // Önerilen ad değişince (kullanıcı elle yazmadıysa) güncelle
  useEffect(() => {
    if (open && !nameTouched.current) setBaseNameState(stripExtension(suggestedName));
  }, [open, suggestedName]);

  const setBaseName = (name: string) => {
    nameTouched.current = true;
    setBaseNameState(name);
  };

  const cleanBase = sanitizeFileName(stripExtension(baseName.trim()));
  const fileName = `${cleanBase || 'Document'}${extension}`;

  return {
    baseName,
    setBaseName,
    directory,
    setDirectory,
    extension,
    fileName,
    fullPath: joinPath(directory, fileName),
    isValid: cleanBase.length > 0
  };
}

interface SaveDestinationProps {
  dest: SaveDestinationState;
  /**
   * 'file': tek dosya (ad + klasör, üzerine yazma uyarısı).
   * 'folder': birden çok dosya (ad öneki + klasör); örnek ad gösterilir.
   */
  mode?: 'file' | 'folder';
  /** folder modunda kullanıcıya gösterilecek örnek çıktı adı */
  exampleFileName?: string;
  disabled?: boolean;
  title?: string;
}

const inputClass =
  'w-full min-w-0 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-black/20 text-xs outline-hidden focus:border-slate-500 dark:focus:border-slate-400 focus:ring-2 focus:ring-slate-400/30 disabled:opacity-60';

/** Kaydedilecek dosyanın adını ve klasörünü gösteren / değiştiren ortak bileşen */
export const SaveDestination: React.FC<SaveDestinationProps> = ({
  dest,
  mode = 'file',
  exampleFileName,
  disabled,
  title
}) => {
  const { language } = usePdfStore();
  const desktop = isDesktop();
  const [exists, setExists] = useState(false);

  // Tek dosya modunda: aynı adda dosya varsa uyar
  useEffect(() => {
    if (!desktop || mode !== 'file' || !dest.directory || !dest.isValid) {
      setExists(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await window.electronAPI!.existingFiles(dest.directory, [dest.fileName]);
        if (!cancelled) setExists(found.length > 0);
      } catch {
        if (!cancelled) setExists(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [desktop, mode, dest.directory, dest.fileName, dest.isValid]);

  const handlePickFolder = async () => {
    const res = await window.electronAPI?.pickFolder(dest.directory || undefined, language);
    if (res?.success && res.folderPath) dest.setDirectory(res.folderPath);
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 p-3 flex flex-col space-y-2.5 text-xs">
      <div className="flex items-center space-x-1.5 font-semibold text-slate-700 dark:text-slate-200">
        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
        <span>{title ?? t('save_location')}</span>
      </div>

      {/* Dosya adı / ad öneki */}
      <label className="flex flex-col space-y-1">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {mode === 'file' ? t('file_name') : t('file_name_prefix')}
        </span>
        <div className="flex items-center">
          <input
            type="text"
            value={dest.baseName}
            onChange={(e) => dest.setBaseName(e.target.value)}
            disabled={disabled}
            spellCheck={false}
            className={`${inputClass} ${mode === 'file' ? 'rounded-r-none' : ''}`}
          />
          {mode === 'file' && (
            <span className="px-2 py-1.5 rounded-r-md border border-l-0 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
              {dest.extension}
            </span>
          )}
        </div>
      </label>

      {/* Klasör */}
      {desktop ? (
        <div className="flex flex-col space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('folder')}</span>
          <div className="flex items-center space-x-2">
            <div
              className="flex-1 min-w-0 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-black/20"
              title={dest.directory}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate font-mono text-[11px] text-slate-700 dark:text-slate-200" dir="ltr">
                {dest.directory || '…'}
              </span>
            </div>
            <button
              type="button"
              onClick={handlePickFolder}
              disabled={disabled}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 transition-colors shrink-0 disabled:opacity-50"
            >
              <FolderSearch className="w-3.5 h-3.5" />
              <span>{t('change_folder')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Download className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{t('browser_download_location')}</span>
        </div>
      )}

      {/* Önizleme ve uyarılar */}
      {desktop && dest.directory && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
          <span>{mode === 'file' ? t('will_be_saved_as') : t('example_output')}: </span>
          <span className="font-mono text-slate-700 dark:text-slate-200" dir="ltr">
            {mode === 'file' ? dest.fullPath : joinPath(dest.directory, exampleFileName ?? dest.fileName)}
          </span>
        </div>
      )}
      {mode === 'folder' && desktop && (
        <div className="text-[11px] text-slate-400">{t('existing_files_are_kept')}</div>
      )}
      {exists && (
        <div className="flex items-start space-x-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{t('file_exists_will_be_replaced')}</span>
        </div>
      )}
      {!dest.isValid && (
        <div className="text-[11px] text-red-600 dark:text-red-400">{t('file_name_required')}</div>
      )}
    </div>
  );
};

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
