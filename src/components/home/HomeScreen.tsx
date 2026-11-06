import React, { useEffect, useState } from 'react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { usePdfStore } from '../../store/usePdfStore';
import { isRealPath } from '../../services/fileSaveService';
import { useUpdateState } from '../../hooks/useUpdateState';
import { MainMenu } from '../layout/MainMenu';
import { t } from '@/i18n';
import {
  House,
  Plus,
  Search,
  Sun,
  Moon,
  FileUp,
  ArrowUp,
  ArrowRight,
  Lock,
  Clock,
  Folder,
  FolderOpen,
  FileText,
  Merge,
  LayoutGrid,
  List,
  X,
  Keyboard,
  RefreshCw
} from 'lucide-react';

type HomeScreenProps = Omit<React.ComponentProps<typeof MainMenu>, 'onToggleFullScreen' | 'updateReady'>;

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-[#111113]';
const iconButton = `inline-flex items-center justify-center w-10 h-10 rounded-[10px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1F1F23] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${focusRing}`;
const card = 'border border-zinc-200 dark:border-[#26262B] bg-white dark:bg-[#18181B] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const muted = 'text-zinc-500 dark:text-[#8A8A93]';
// Liste görünümünde başlık ve satırlar aynı sütunları paylaşır; son sütun kaldırma düğmesine yer açar
const tableRow = 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_44px] items-center gap-4 px-2';

/** "C:\Users\Ali\Belgeler\Sözleşmeler\x.pdf" → "Belgeler › Sözleşmeler"; yalnızca dosya adıysa boş */
const folderOf = (filePath: string) => filePath.split(/[\\/]/).slice(-3, -1).join(' › ');

/** Bugün/dün için "Bugün, 02:04"; daha eskiler için "1 Kas" */
function formatOpened(timestamp: number, language: string): string {
  const date = new Date(timestamp);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (daysAgo > 1) return date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
  const day = new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-daysAgo, 'day');
  const time = date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
  return `${day.charAt(0).toLocaleUpperCase(language)}${day.slice(1)}, ${time}`;
}

/** "{0}" yer tutucusunun yerine bir öğe koyar (çeviride kelime sırası dile göre değişir) */
function withSlot(text: string, slot: React.ReactNode) {
  const [before, after] = text.split('{0}');
  return (
    <>
      {before}
      {slot}
      {after}
    </>
  );
}

const THUMB_SIZES = {
  sm: { img: 'max-w-[42px] max-h-[54px]', box: 'w-[42px] h-[54px]' },
  md: { img: 'max-w-[116px] max-h-[150px]', box: 'w-[110px] h-[144px]' },
  lg: { img: 'max-w-[76px] max-h-[100px]', box: 'w-[76px] h-[100px]' }
};

/** İlk sayfanın küçük resmi; küçük resmi olmayan eski kayıtlarda boş kağıt gösterilir */
const PageThumb: React.FC<{ src?: string; size: keyof typeof THUMB_SIZES }> = ({ src, size }) =>
  src ? (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`${THUMB_SIZES[size].img} w-auto h-auto rounded-[5px] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.3)]`}
    />
  ) : (
    <span
      className={`${THUMB_SIZES[size].box} flex items-center justify-center rounded-[5px] bg-white text-zinc-300 shadow-[0_8px_20px_rgba(0,0,0,0.3)]`}
    >
      <FileText className="w-1/3 h-1/3" strokeWidth={1.5} />
    </span>
  );

export const HomeScreen: React.FC<HomeScreenProps> = (menuProps) => {
  const { onOpenFile, onOpenRecentFile } = menuProps;
  const {
    language,
    theme,
    toggleTheme,
    toggleFullScreen,
    recentFiles,
    removeRecentFile,
    clearRecentFiles,
    setShortcutHelpModalOpen,
    setUpdateModalOpen,
    setMergeModalOpen
  } = usePdfStore();

  const updateState = useUpdateState();
  const updateReady = updateState.status === 'available' || updateState.status === 'downloaded';
  const [version, setVersion] = useState('');
  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion);
  }, []);

  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<'cards' | 'list'>(() => {
    try {
      return localStorage.getItem('glosspdf_home_view') === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const changeView = (next: 'cards' | 'list') => {
    setView(next);
    try {
      localStorage.setItem('glosspdf_home_view', next);
    } catch {}
  };

  const hour = new Date().getHours();
  const greeting = t(hour >= 5 && hour < 12 ? 'home_greeting_morning' : hour >= 12 && hour < 18 ? 'home_greeting_afternoon' : 'home_greeting_evening');
  const today = new Date().toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' });

  // En son belge "Devam edin" kartında; arama yokken liste geri kalanını gösterir
  const latest = recentFiles[0];
  const needle = query.trim().toLocaleLowerCase(language);
  const listed = needle
    ? recentFiles.filter((file) => file.fileName.toLocaleLowerCase(language).includes(needle))
    : recentFiles.slice(1);
  const latestFolder = latest ? folderOf(latest.filePath) : '';
  const canReveal = !!latest && !!window.electronAPI?.showItemInFolder && isRealPath(latest.filePath);

  const removeButton = (filePath: string, fileName: string, position: string) => (
    <button
      type="button"
      onClick={() => removeRecentFile(filePath)}
      aria-label={`${t('remove_from_list')}: ${fileName}`}
      title={t('remove_from_list')}
      className={`absolute ${position} flex items-center justify-center w-11 h-11 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity ${focusRing}`}
    >
      <span className="flex items-center justify-center w-[30px] h-[30px] rounded-full border border-zinc-200 dark:border-[#34343A] bg-white/90 dark:bg-[#111113]/85 text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400">
        <X className="w-3.5 h-3.5" />
      </span>
    </button>
  );

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-[#111113] text-zinc-900 dark:text-zinc-100 font-geist antialiased"
      onDragOver={() => setDragging(true)}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={() => setDragging(false)}
    >
      {/* Üst çubuk: belge açık değilken sekme çubuğu ve araç çubuğunun yerini alır */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-5 py-2.5 bg-white dark:bg-[#0B0B0D] border-b border-zinc-200 dark:border-[#222226] select-none">
        <div className="flex items-center gap-2.5">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="w-7 h-7" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            Gloss<span className="text-red-600 dark:text-red-400">PDF</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[10px] border border-zinc-200 dark:border-[#2A2A30] bg-zinc-100 dark:bg-[#1C1C20] text-[13.5px] font-medium">
            <House className="w-4 h-4" />
            {t('home_tab')}
          </span>
          <button type="button" onClick={onOpenFile} className={iconButton} aria-label={t('open_new_document_ctrl_o')} title={t('open_new_document_ctrl_o')}>
            <Plus className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex-[1_1_260px] flex justify-center">
          <div className="relative flex items-center w-full max-w-[440px]">
            <Search className={`absolute start-3.5 w-4 h-4 pointer-events-none ${muted}`} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('home_search_recent')}
              placeholder={t('home_search_recent')}
              className={`w-full h-10 ps-[38px] pe-3.5 rounded-[10px] border border-zinc-200 dark:border-[#26262B] bg-zinc-50 dark:bg-[#16161A] text-[13.5px] placeholder:text-zinc-500 dark:placeholder:text-[#8A8A93] ${focusRing}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 ms-auto">
          <button
            type="button"
            onClick={toggleTheme}
            className={iconButton}
            aria-label={t(theme === 'dark' ? 'switch_to_light_theme' : 'switch_to_dark_theme')}
            title={t(theme === 'dark' ? 'switch_to_light_theme' : 'switch_to_dark_theme')}
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <MainMenu
            {...menuProps}
            onToggleFullScreen={toggleFullScreen}
            updateReady={updateReady}
            triggerClassName={`${iconButton} w-auto gap-2 px-3 text-[13.5px] font-medium`}
            panelPositionClassName="top-full end-0 mt-1.5"
          />
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-[1240px] mx-auto px-8 pt-6 pb-5 flex flex-col gap-6">
          <section aria-labelledby="home-hello" className="shrink-0 flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <p className="font-geist-mono text-[12.5px] tracking-[0.04em] text-zinc-600 dark:text-zinc-400">
                {`${today} · ${greeting}`.toLocaleUpperCase(language)}
              </p>
              <h1 id="home-hello" className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em]">
                {withSlot(
                  t('home_headline'),
                  <span className="relative whitespace-nowrap">
                    <span aria-hidden="true" className="absolute -inset-x-[5px] bottom-[3px] h-[0.42em] rounded bg-[#ffd60a]/60 dark:bg-[#ffd60a]/35 -skew-x-[10deg]" />
                    <span className="relative">{t('home_headline_mark')}</span>
                  </span>
                )}
              </h1>
            </div>

            <div className="flex flex-wrap gap-5">
              {/* Bırakma alanı: dosya App kökündeki onDrop ile açılır, burada yalnızca vurgulanır */}
              <div
                className={`flex-[999_1_560px] min-w-0 flex flex-wrap items-center gap-6 px-7 py-5 rounded-[20px] border-[1.5px] border-dashed transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                  dragging
                    ? 'border-red-500 bg-red-500/5'
                    : 'border-zinc-300 dark:border-[#3A3A41] bg-white dark:bg-[#16161A]'
                }`}
              >
                <div aria-hidden="true" className="relative shrink-0 w-[172px] h-[176px] -m-[26px] scale-[0.7]">
                  <span className="absolute left-[22px] top-[22px] w-[108px] h-[140px] rounded-lg bg-zinc-200 dark:bg-[#2A2A30] -rotate-[9deg]" />
                  <span className="absolute left-[38px] top-3 w-[108px] h-[140px] rounded-lg bg-zinc-300 dark:bg-[#3A3A42] rotate-6" />
                  <span className="absolute left-[30px] top-4 w-[108px] h-[140px] px-3.5 py-4 rounded-lg bg-[#F4F4F5] shadow-[0_14px_30px_rgba(0,0,0,0.35)] flex flex-col gap-[7px] overflow-hidden">
                    <span className="absolute top-0 right-0 w-[22px] h-[22px] bg-[#D4D4D8] rounded-bl-md" />
                    <span className="h-1.5 w-[58%] rounded-sm bg-[#3A3F4B]" />
                    <span className="h-1 w-full rounded-sm bg-[#C9CBD2] mt-1.5" />
                    <span className="h-1 w-[92%] rounded-sm bg-[#C9CBD2]" />
                    <span className="h-2 w-[86%] rounded-sm bg-[#ffd60a]/75" />
                    <span className="h-1 w-[96%] rounded-sm bg-[#C9CBD2]" />
                    <span className="h-1 w-[64%] rounded-sm bg-[#C9CBD2]" />
                  </span>
                  <span className="absolute right-1 bottom-1.5 w-[52px] h-[52px] rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-[0_10px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
                    <ArrowUp className="w-6 h-6" strokeWidth={2} />
                  </span>
                </div>

                <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-2.5">
                  <h2 className="text-[19px] leading-tight font-semibold tracking-[-0.015em]">{t('home_drop_title')}</h2>
                  <p className="text-[14.5px] leading-[1.55] text-zinc-600 dark:text-zinc-400 max-w-[420px]">{t('home_drop_subtitle')}</p>
                  <div className="flex flex-wrap gap-2.5 mt-1">
                    <button
                      type="button"
                      onClick={onOpenFile}
                      className={`inline-flex items-center gap-2.5 h-11 px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors ${focusRing}`}
                    >
                      <FileUp className="w-[18px] h-[18px]" />
                      {t('home_open_file')}
                      <kbd className="font-geist-mono text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-black/20">Ctrl O</kbd>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeModalOpen(true)}
                      className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-zinc-300 dark:border-[#34343A] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1F1F23] text-sm font-medium transition-colors ${focusRing}`}
                    >
                      <Merge className="w-[18px] h-[18px]" />
                      {t('home_tool_merge')}
                    </button>
                  </div>
                  <p className={`flex items-center gap-2 mt-0.5 text-[12.5px] ${muted}`}>
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    {t('home_local_note')}
                  </p>
                </div>
              </div>

              {latest && (
                <article aria-labelledby="home-continue" className={`flex-[1_1_340px] min-w-0 flex flex-col gap-3.5 p-5 rounded-[20px] ${card}`}>
                  <p className="flex items-center gap-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-400">
                    <Clock className="w-[15px] h-[15px]" />
                    {t('home_continue')}
                  </p>
                  <div className="flex gap-[18px] items-start">
                    <span className="flex items-center justify-center shrink-0 w-[76px] h-[100px]">
                      <PageThumb src={latest.thumbnail} size="lg" />
                    </span>
                    <div className="min-w-0 flex flex-col gap-2 pt-0.5">
                      <h3 id="home-continue" className="text-[17px] leading-[1.3] font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">
                        {latest.fileName}
                      </h3>
                      {latestFolder && (
                        <p className={`flex items-center gap-1.5 text-[12.5px] min-w-0 ${muted}`} title={latest.filePath}>
                          <Folder className="w-[13px] h-[13px] shrink-0" />
                          <span className="truncate">{latestFolder}</span>
                        </p>
                      )}
                      <p className="font-geist-mono text-xs text-zinc-600 dark:text-zinc-400">{formatOpened(latest.lastOpened, language)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => onOpenRecentFile(latest.filePath, latest.fileName)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-zinc-300 dark:border-[#34343A] bg-zinc-100 dark:bg-[#222226] hover:bg-zinc-200 dark:hover:bg-[#2A2A30] text-sm font-semibold transition-colors ${focusRing}`}
                    >
                      {t('home_continue_button')}
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </button>
                    {canReveal && (
                      <button
                        type="button"
                        onClick={() => window.electronAPI?.showItemInFolder(latest.filePath)}
                        aria-label={t('home_show_in_folder')}
                        title={t('home_show_in_folder')}
                        className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-300 dark:border-[#34343A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1F1F23] transition-colors ${focusRing}`}
                      >
                        <FolderOpen className="w-[17px] h-[17px]" />
                      </button>
                    )}
                  </div>
                </article>
              )}
            </div>
          </section>

          <section aria-labelledby="home-recent" className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
              <h2 id="home-recent" className="text-lg font-semibold tracking-[-0.01em]">{t('home_recent')}</h2>
              {recentFiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <div role="group" aria-label={t('home_view')} className="flex p-[3px] gap-0.5 rounded-[11px] border border-zinc-200 dark:border-[#26262B] bg-white dark:bg-[#16161A]">
                    {([['cards', LayoutGrid, 'home_view_cards'], ['list', List, 'home_view_list']] as const).map(([mode, Icon, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => changeView(mode)}
                        aria-pressed={view === mode}
                        aria-label={t(label)}
                        title={t(label)}
                        className={`inline-flex items-center justify-center w-9 h-[34px] rounded-lg transition-colors ${focusRing} ${
                          view === mode
                            ? 'bg-zinc-100 dark:bg-[#2A2A30] text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={clearRecentFiles}
                    className={`h-10 px-3 rounded-[10px] text-[13px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1F1F23] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${focusRing}`}
                  >
                    {t('home_clear_list')}
                  </button>
                </div>
              )}
            </div>

            {recentFiles.length === 0 ? (
              <p className={`text-[13.5px] ${muted}`}>{t('home_recent_empty')}</p>
            ) : needle && listed.length === 0 ? (
              <p className={`text-[13.5px] ${muted}`}>{t('home_no_matches', [query.trim()])}</p>
            ) : view === 'cards' ? (
              <ul className="flex-1 min-h-0 overflow-y-auto content-start grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-6 p-1 -m-1">
                {listed.map((file) => (
                  <li key={file.filePath} className="group relative">
                    <button
                      type="button"
                      onClick={() => onOpenRecentFile(file.filePath, file.fileName)}
                      title={file.filePath}
                      className={`flex flex-col gap-2.5 w-full text-start rounded-xl ${focusRing}`}
                    >
                      <span className="flex items-center justify-center h-[176px] rounded-xl bg-zinc-100 dark:bg-[#1C1C20] group-hover:ring-2 group-hover:ring-red-500/60 transition-shadow">
                        <PageThumb src={file.thumbnail} size="md" />
                      </span>
                      <span className="flex flex-col gap-0.5 px-0.5 min-w-0">
                        <span className="text-[13px] font-medium truncate">{file.fileName}</span>
                        <span className={`font-geist-mono text-[11.5px] ${muted}`}>{formatOpened(file.lastOpened, language)}</span>
                      </span>
                    </button>
                    {removeButton(file.filePath, file.fileName, 'top-0 end-0')}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className={`${tableRow} sticky top-0 z-10 h-9 border-b border-zinc-200 dark:border-[#26262B] bg-zinc-50 dark:bg-[#111113] text-[11px] font-medium uppercase tracking-[0.06em] ${muted}`}>
                  <span className="ps-[62px]">{t('file_name')}</span>
                  <span>{t('file_location')}</span>
                  <span>{t('home_col_opened')}</span>
                </div>
                <ul>
                  {listed.map((file) => (
                    <li key={file.filePath} className="group relative border-b border-zinc-200 dark:border-[#222226]">
                      <button
                        type="button"
                        onClick={() => onOpenRecentFile(file.filePath, file.fileName)}
                        title={file.filePath}
                        className={`${tableRow} w-full py-2.5 text-start hover:bg-zinc-100 dark:hover:bg-[#18181B] transition-colors ${focusRing}`}
                      >
                        <span className="flex items-center gap-4 min-w-0">
                          <span className="flex items-center justify-center shrink-0 w-[46px] h-[56px]">
                            <PageThumb src={file.thumbnail} size="sm" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-medium truncate">{file.fileName.replace(/\.pdf$/i, '')}</span>
                            <span className={`block text-[11.5px] ${muted}`}>PDF</span>
                          </span>
                        </span>
                        <span className={`text-[13px] truncate ${muted}`}>{folderOf(file.filePath)}</span>
                        <span className={`font-geist-mono text-[12px] ${muted}`}>{formatOpened(file.lastOpened, language)}</span>
                      </button>
                      {removeButton(file.filePath, file.fileName, 'top-1/2 -translate-y-1/2 end-0')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <footer className="shrink-0 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-x-6 gap-y-4 pt-[26px] border-t border-zinc-200 dark:border-[#222226]">
            <div className="flex items-start gap-3 p-2 -m-2">
              <span aria-hidden="true" className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center bg-zinc-100 dark:bg-[#1C1C20] text-zinc-600 dark:text-zinc-400">
                <Lock className="w-[17px] h-[17px]" />
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-[13.5px] font-semibold">{t('home_private_title')}</span>
                <span className="text-[12.5px] leading-[1.45] text-zinc-600 dark:text-zinc-400">{t('home_private_body')}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShortcutHelpModalOpen(true)}
              className={`flex items-start gap-3 p-2 -m-2 rounded-xl text-start hover:bg-zinc-100 dark:hover:bg-[#18181B] transition-colors ${focusRing}`}
            >
              <span aria-hidden="true" className="shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center bg-zinc-100 dark:bg-[#1C1C20] text-zinc-600 dark:text-zinc-400">
                <Keyboard className="w-[17px] h-[17px]" />
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-[13.5px] font-semibold">{t('home_shortcuts_title')}</span>
                <span className="text-[12.5px] leading-[1.45] text-zinc-600 dark:text-zinc-400">
                  {withSlot(
                    t('home_shortcuts_body'),
                    <kbd className="font-geist-mono text-[11px] px-1.5 py-px rounded-md border border-zinc-300 dark:border-[#34343A] bg-white dark:bg-[#1C1C20] text-zinc-800 dark:text-zinc-200">F1</kbd>
                  )}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setUpdateModalOpen(true)}
              className={`flex items-start gap-3 p-2 -m-2 rounded-xl text-start hover:bg-zinc-100 dark:hover:bg-[#18181B] transition-colors ${focusRing}`}
            >
              <span
                aria-hidden="true"
                className={`shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center ${
                  updateReady ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-zinc-100 dark:bg-[#1C1C20] text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <RefreshCw className="w-[17px] h-[17px]" />
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-[13.5px] font-semibold">{version ? t('app_version', { version }) : 'GlossPDF'}</span>
                <span className="text-[12.5px] leading-[1.45] text-zinc-600 dark:text-zinc-400">
                  {updateReady ? t('update_status_available', { version: updateState.version ?? '' }) : t('check_for_updates')}
                </span>
              </span>
            </button>
          </footer>
      </main>
    </div>
  );
};
