import React, { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import type { UpdateState } from '../../types/electron';
import { readAloudSupported, useReadAloud } from '../../hooks/useReadAloud';
import { MainMenu } from './MainMenu';
import { t } from '@/i18n';
import {
  FolderOpen,
  Save,
  Printer,
  MousePointer,
  Hand,
  Highlighter,
  Search,
  Sun,
  Moon,
  Layout,
  HelpCircle,
  TextCursorInput,
  FileSignature,
  RefreshCw,
  Undo2,
  Redo2,
  Volume2,
  Pause,
  Play,
  Square
} from 'lucide-react';

interface HeaderToolbarProps {
  pdfDocument: PDFDocumentProxy | null;
  onOpenFile: () => void;
  onOpenRecentFile: (filePath: string, fileName: string) => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onPrint: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onPageChange: (pageNum: number) => void;
}

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  pdfDocument,
  onOpenFile,
  onOpenRecentFile,
  onSaveFile,
  onSaveFileAs,
  onPrint,
  onFitPage,
  onFitWidth,
  onPageChange
}) => {
  const {
    tabs,
    activeTabId,
    activeTool,
    setActiveTool,
    searchBarOpen,
    setSearchBarOpen,
    theme,
    toggleTheme,
    language,
    undo,
    redo,
    leftSidebarTab,
    setLeftSidebarTab,
    rightPanelOpen,
    toggleRightPanel,
    toggleFullScreen,
    annotationModeOpen,
    setAnnotationModeOpen,
    setSignatureModalOpen,
    setShortcutHelpModalOpen,
    setUpdateModalOpen
  } = usePdfStore();

  // Güncelleme durumu: modal kapalıyken de simgede rozet göstermek için burada izlenir
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateState) return;
    const off = api.onUpdateState(setUpdateState);
    api.getUpdateState().then(({ autoDownload, ...current }) => setUpdateState(current));
    return off;
  }, []);
  const updateReady = updateState.status === 'available' || updateState.status === 'downloaded';

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const readAloud = useReadAloud(pdfDocument, onPageChange);
  const handleReadAloud = async () => {
    if (readAloud.status === 'playing') return readAloud.pause();
    if (readAloud.status === 'paused') return readAloud.resume();
    if (activeTab && !(await readAloud.start(activeTab.currentPage))) alert(t('read_aloud_no_text'));
  };

  const handleToggleAnnotationMode = () => {
    const nextState = !annotationModeOpen;
    setAnnotationModeOpen(nextState);
    if (nextState) {
      setActiveTool('highlight');
    } else {
      setActiveTool('select');
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-acrobat-toolbar dark:bg-acrobat-darkToolbar border-b border-acrobat-border dark:border-acrobat-darkBorder text-slate-700 dark:text-slate-200 select-none text-xs">
      {/* Sol Araç Grubu: Dosya & Yan Panel Butonları */}
      <div className="flex items-center space-x-1">
        <MainMenu
          onOpenFile={onOpenFile}
          onOpenRecentFile={onOpenRecentFile}
          onSaveFile={onSaveFile}
          onSaveFileAs={onSaveFileAs}
          onPrint={onPrint}
          onFitPage={onFitPage}
          onFitWidth={onFitWidth}
          onToggleFullScreen={toggleFullScreen}
          updateReady={updateReady}
        />

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Sol Panel Aç/Kapat */}
        <button
          onClick={() => setLeftSidebarTab(leftSidebarTab ? null : 'thumbnails')}
          className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            leftSidebarTab ? 'bg-black/15 dark:bg-white/15 text-acrobat-red' : ''
          }`}
          title={t('navigation_panel')}
        >
          <Layout className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Dosya Aç */}
        <button
          onClick={onOpenFile}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('open_file_ctrl_o')}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Kaydet */}
        <button
          onClick={onSaveFile}
          disabled={!activeTab}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('save_ctrl_s')}
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Yazdır */}
        <button
          onClick={onPrint}
          disabled={!activeTab}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('print_ctrl_p')}
        >
          <Printer className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* İmleç / Seçim Aracı */}
        <button
          onClick={() => setActiveTool('select')}
          className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            activeTool === 'select' ? 'bg-black/15 dark:bg-white/15 text-blue-500 font-bold' : ''
          }`}
          title={t('select_tool')}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* El Aracı (Pan) */}
        <button
          onClick={() => setActiveTool('hand')}
          className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            activeTool === 'hand' ? 'bg-black/15 dark:bg-white/15 text-blue-500 font-bold' : ''
          }`}
          title={t('hand_tool')}
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* İşaretleme ve Not Ekleme Modu Aç/Kapat */}
        <button
          onClick={handleToggleAnnotationMode}
          disabled={!activeTab}
          className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors disabled:opacity-30 ${
            annotationModeOpen
              ? 'bg-acrobat-red text-white font-medium shadow-xs'
              : 'hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
          }`}
          title={t('annotation_toolbar')}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span className="font-medium text-[11px]">{t('annotate')}</span>
        </button>

        {/* Mevcut PDF metnini düzenle */}
        <button
          onClick={() => setActiveTool(activeTool === 'edittext' ? 'select' : 'edittext')}
          disabled={!activeTab}
          className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors disabled:opacity-30 ${
            activeTool === 'edittext'
              ? 'bg-acrobat-red text-white font-medium shadow-xs'
              : 'hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
          }`}
          title={t('edit_text')}
        >
          <TextCursorInput className="w-3.5 h-3.5" />
          <span className="font-medium text-[11px]">{t('edit_text')}</span>
        </button>

        {/* İmza oluştur ve sayfaya yerleştir */}
        <button
          onClick={() => setSignatureModalOpen(true)}
          disabled={!activeTab}
          className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors disabled:opacity-30 ${
            activeTool === 'signature'
              ? 'bg-acrobat-red text-white font-medium shadow-xs'
              : 'hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
          }`}
          title={t('sign')}
        >
          <FileSignature className="w-3.5 h-3.5" />
          <span className="font-medium text-[11px]">{t('sign')}</span>
        </button>
      </div>

      {/* Sağ Araç Grubu: Sesli Okuma, Arama, Tema ve Geri/İleri Al */}
      <div className="flex items-center space-x-1">
        {/* Sesli Okuma: geçerli sayfadan başlar; okurken duraklat/devam et ve durdur */}
        <button
          onClick={handleReadAloud}
          disabled={!activeTab || !pdfDocument || !readAloudSupported}
          className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${
            readAloud.status !== 'idle' ? 'bg-black/15 dark:bg-white/15 text-acrobat-red' : ''
          }`}
          title={t(
            readAloud.status === 'playing' ? 'pause_reading' : readAloud.status === 'paused' ? 'resume_reading' : 'read_aloud'
          )}
        >
          {readAloud.status === 'playing' ? (
            <Pause className="w-4 h-4" />
          ) : readAloud.status === 'paused' ? (
            <Play className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        {readAloud.status !== 'idle' && (
          <button
            onClick={readAloud.stop}
            className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={t('stop_reading')}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        )}

        {/* Arama Aç/Kapat */}
        <button
          onClick={() => setSearchBarOpen(!searchBarOpen)}
          disabled={!activeTab}
          className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors ${
            searchBarOpen ? 'bg-black/15 dark:bg-white/15 text-acrobat-red' : ''
          }`}
          title={t('find_in_document_ctrl_f')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Tema Değiştir */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t(theme === 'dark' ? 'switch_to_light_theme' : 'switch_to_dark_theme')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Geri Al / İleri Al (dil seçimi Menü > Dil altında) */}
        <button
          onClick={undo}
          disabled={!activeTab?.undoStack?.length}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title={t('undo_ctrl_z')}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={redo}
          disabled={!activeTab?.redoStack?.length}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title={t('redo_ctrl_y')}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Kısayollar ve Yardım */}
        <button
          onClick={() => setShortcutHelpModalOpen(true)}
          className="p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('keyboard_shortcuts_f1')}
        >
          <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
        </button>

        {/* Sürüm ve Güncellemeler */}
        <button
          onClick={() => setUpdateModalOpen(true)}
          className="relative p-1.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={
            updateReady
              ? t(updateState.status === 'downloaded' ? 'update_status_downloaded' : 'update_status_available', {
                  version: updateState.version ?? ''
                })
              : t('check_for_updates')
          }
        >
          <RefreshCw
            className={`w-4 h-4 ${
              updateReady ? 'text-acrobat-red' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          />
          {updateReady && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-acrobat-red ring-2 ring-white dark:ring-acrobat-darkBg" />
          )}
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Sağ Panel Aç/Kapat */}
        <button
          onClick={toggleRightPanel}
          className={`px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 font-medium transition-colors ${
            rightPanelOpen ? 'bg-acrobat-red text-white' : ''
          }`}
          title={t('tools_panel')}
        >
          {t('tools')}
        </button>
      </div>
    </div>
  );
};
