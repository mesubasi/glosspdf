import React from 'react';
import { usePdfStore, ZOOM_LEVELS } from '../../store/usePdfStore';
import {
  t,
  LANGUAGES,
  detectSystemLanguage,
  getLanguageInfo,
  type LanguagePreference
} from '@/i18n';
import {
  FolderOpen,
  Save,
  Printer,
  MousePointer,
  Hand,
  Highlighter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  RotateCcw,
  Search,
  Sun,
  Moon,
  Layout,
  Expand,
  HelpCircle,
  TextCursorInput,
  FileSignature
} from 'lucide-react';

interface HeaderToolbarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onPrint: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
}

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  onOpenFile,
  onSaveFile,
  onSaveFileAs,
  onPrint,
  onFitPage,
  onFitWidth
}) => {
  const {
    tabs,
    activeTabId,
    activeTool,
    setActiveTool,
    zoomIn,
    zoomOut,
    setZoom,
    rotateClockwise,
    rotateCounterClockwise,
    searchBarOpen,
    setSearchBarOpen,
    theme,
    toggleTheme,
    language,
    languagePreference,
    setLanguagePreference,
    toggleLanguage,
    leftSidebarTab,
    setLeftSidebarTab,
    rightPanelOpen,
    toggleRightPanel,
    isFullScreen,
    setIsFullScreen,
    annotationModeOpen,
    setAnnotationModeOpen,
    setSignatureModalOpen,
    setShortcutHelpModalOpen
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const currentZoomPercent = activeTab ? Math.round(activeTab.zoom * 100) : 100;

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullScreen(false));
    }
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

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Dosya Aç */}
        <button
          onClick={onOpenFile}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('open_file_ctrl_o')}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Kaydet */}
        <button
          onClick={onSaveFile}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('save_ctrl_s')}
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Yazdır */}
        <button
          onClick={onPrint}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('print_ctrl_p')}
        >
          <Printer className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

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

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* İşaretleme ve Not Ekleme Modu Aç/Kapat */}
        <button
          onClick={handleToggleAnnotationMode}
          disabled={!activeTab}
          className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
            annotationModeOpen
              ? 'bg-acrobat-red text-white font-medium shadow-sm'
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
              ? 'bg-acrobat-red text-white font-medium shadow-sm'
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
              ? 'bg-acrobat-red text-white font-medium shadow-sm'
              : 'hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200'
          }`}
          title={t('sign')}
        >
          <FileSignature className="w-3.5 h-3.5" />
          <span className="font-medium text-[11px]">{t('sign')}</span>
        </button>
      </div>

      {/* Orta Araç Grubu: Zoom & Sığdırma & Döndürme */}
      <div className="flex items-center space-x-1">
        {/* Zoom Out */}
        <button
          onClick={zoomOut}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('zoom_out_ctrl')}
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Zoom Yüzdesi Seçim Açılır Menüsü */}
        <select
          value={activeTab?.zoom || 1.0}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          disabled={!activeTab}
          className="bg-white dark:bg-[#1e1e1e] border border-acrobat-border dark:border-acrobat-darkBorder rounded px-2 py-0.5 text-xs text-center cursor-pointer outline-none focus:border-acrobat-red"
        >
          {ZOOM_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {Math.round(lvl * 100)}%
            </option>
          ))}
          {!ZOOM_LEVELS.includes(activeTab?.zoom || 1.0) && (
            <option value={activeTab?.zoom}>{currentZoomPercent}%</option>
          )}
        </select>

        {/* Zoom In */}
        <button
          onClick={zoomIn}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('zoom_in_ctrl')}
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Sayfaya Sığdır */}
        <button
          onClick={onFitPage}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('fit_page_ctrl_0')}
        >
          <Expand className="w-4 h-4" />
        </button>

        {/* Genişliğe Sığdır */}
        <button
          onClick={onFitWidth}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('fit_width_ctrl_2')}
        >
          <span className="font-semibold text-[11px] px-0.5 border border-current rounded">↔</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Saat Yönünde Döndür */}
        <button
          onClick={rotateClockwise}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('rotate_clockwise_ctrl_shift_r')}
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Saatin Tersine Döndür */}
        <button
          onClick={rotateCounterClockwise}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={t('rotate_counter_clockwise_ctrl_shift_l')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Sağ Araç Grubu: Arama, Tema, Dil ve Tam Ekran */}
      <div className="flex items-center space-x-1">
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
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t(theme === 'dark' ? 'switch_to_light_theme' : 'switch_to_dark_theme')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Dil Seçici (Sistem dili + desteklenen diller) */}
        <select
          value={languagePreference}
          onChange={(e) => setLanguagePreference(e.target.value as LanguagePreference)}
          title={t('language')}
          aria-label={t('language')}
          className="px-1.5 py-1 rounded text-[11px] bg-transparent hover:bg-black/10 dark:hover:bg-white/10 border border-slate-300/60 dark:border-slate-600/60 outline-none cursor-pointer max-w-[150px] truncate"
        >
          <option value="system">
            {t('system_language')} ({getLanguageInfo(detectSystemLanguage()).nativeLabel})
          </option>
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeLabel}
            </option>
          ))}
        </select>

        {/* Tam Ekran */}
        <button
          onClick={toggleFullScreen}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('full_screen_f11_ctrl_l')}
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Kısayollar ve Yardım */}
        <button
          onClick={() => setShortcutHelpModalOpen(true)}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={t('keyboard_shortcuts_f1')}
        >
          <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

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
