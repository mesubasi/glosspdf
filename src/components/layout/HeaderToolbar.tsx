import React from 'react';
import { usePdfStore, ZOOM_LEVELS } from '../../store/usePdfStore';
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
  HelpCircle
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
    toggleLanguage,
    leftSidebarTab,
    setLeftSidebarTab,
    rightPanelOpen,
    toggleRightPanel,
    isFullScreen,
    setIsFullScreen,
    annotationModeOpen,
    setAnnotationModeOpen,
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
          title={language === 'tr' ? 'Gezinme Paneli' : 'Navigation Panel'}
        >
          <Layout className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Dosya Aç */}
        <button
          onClick={onOpenFile}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={language === 'tr' ? 'Dosya Aç (Ctrl+O)' : 'Open File (Ctrl+O)'}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Kaydet */}
        <button
          onClick={onSaveFile}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Kaydet (Ctrl+S)' : 'Save (Ctrl+S)'}
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Yazdır */}
        <button
          onClick={onPrint}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Yazdır (Ctrl+P)' : 'Print (Ctrl+P)'}
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
          title={language === 'tr' ? 'Metin ve Nesne Seçimi' : 'Select Tool'}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* El Aracı (Pan) */}
        <button
          onClick={() => setActiveTool('hand')}
          className={`p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            activeTool === 'hand' ? 'bg-black/15 dark:bg-white/15 text-blue-500 font-bold' : ''
          }`}
          title={language === 'tr' ? 'El Aracı (Kaydırma)' : 'Hand Tool'}
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
          title={language === 'tr' ? 'İşaretleme ve Not Araç Çubuğu' : 'Annotation Toolbar'}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span className="font-medium text-[11px]">{language === 'tr' ? 'İşaretle' : 'Annotate'}</span>
        </button>
      </div>

      {/* Orta Araç Grubu: Zoom & Sığdırma & Döndürme */}
      <div className="flex items-center space-x-1">
        {/* Zoom Out */}
        <button
          onClick={zoomOut}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Uzaklaştır (Ctrl+-)' : 'Zoom Out (Ctrl+-)'}
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
          title={language === 'tr' ? 'Yakınlaştır (Ctrl++)' : 'Zoom In (Ctrl++)'}
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Sayfaya Sığdır */}
        <button
          onClick={onFitPage}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Sayfaya Sığdır (Ctrl+0)' : 'Fit Page (Ctrl+0)'}
        >
          <Expand className="w-4 h-4" />
        </button>

        {/* Genişliğe Sığdır */}
        <button
          onClick={onFitWidth}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Genişliğe Sığdır (Ctrl+2)' : 'Fit Width (Ctrl+2)'}
        >
          <span className="font-semibold text-[11px] px-0.5 border border-current rounded">↔</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600 mx-1" />

        {/* Saat Yönünde Döndür */}
        <button
          onClick={rotateClockwise}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Saat Yönünde Döndür (Ctrl+Shift+R)' : 'Rotate Clockwise (Ctrl+Shift+R)'}
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Saatin Tersine Döndür */}
        <button
          onClick={rotateCounterClockwise}
          disabled={!activeTab}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title={language === 'tr' ? 'Ters Yönde Döndür (Ctrl+Shift+L)' : 'Rotate Counter-Clockwise (Ctrl+Shift+L)'}
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
          title={language === 'tr' ? 'Belgede Ara (Ctrl+F)' : 'Find in Document (Ctrl+F)'}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Tema Değiştir */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Dil Değiştir */}
        <button
          onClick={toggleLanguage}
          className="px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 font-bold uppercase transition-colors"
          title="Dil / Language"
        >
          {language}
        </button>

        {/* Tam Ekran */}
        <button
          onClick={toggleFullScreen}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={language === 'tr' ? 'Tam Ekran (F11 / Ctrl+L)' : 'Full Screen (F11 / Ctrl+L)'}
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Kısayollar ve Yardım */}
        <button
          onClick={() => setShortcutHelpModalOpen(true)}
          className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          title={language === 'tr' ? 'Klavye Kısayolları (F1)' : 'Keyboard Shortcuts (F1)'}
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
          title={language === 'tr' ? 'Araçlar Paneli' : 'Tools Panel'}
        >
          {language === 'tr' ? 'Araçlar' : 'Tools'}
        </button>
      </div>
    </div>
  );
};
