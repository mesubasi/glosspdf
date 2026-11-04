import React, { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import type { UpdateState } from '../../types/electron';
import { readAloudSupported, useReadAloud } from '../../hooks/useReadAloud';
import { MainMenu } from './MainMenu';
import { t } from '@/i18n';
import {
  PanelLeft,
  PanelRight,
  BookOpen,
  Highlighter,
  TextCursorInput,
  Signature,
  FolderOpen,
  Save,
  Printer,
  Search,
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
  onCreatePdf: () => void;
  onOpenRecentFile: (filePath: string, fileName: string) => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onPrint: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onPageChange: (pageNum: number) => void;
}

// macOS'ta başlık çubuğu gizli; trafik ışıklarına yer açılır (electron/main.ts trafficLightPosition)
const IS_MAC_DESKTOP = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) && !!window.electronAPI;

/** Araç çubuğu simge düğmesi: 32×28, etkinken vurgu tonu */
export const ToolbarButton: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, active, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={`relative grid place-items-center w-8 h-7 rounded-md transition-colors disabled:opacity-35 ${
      active ? 'bg-accent/15 text-accent-text' : 'text-secondary hover:bg-hover hover:text-label'
    }`}
  >
    {children}
  </button>
);

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  pdfDocument,
  onOpenFile,
  onCreatePdf,
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
    undo,
    redo,
    searchBarOpen,
    setSearchBarOpen,
    leftSidebarTab,
    setLeftSidebarTab,
    rightPanelOpen,
    toggleRightPanel,
    isFullScreen,
    toggleFullScreen,
    annotationModeOpen,
    setAnnotationModeOpen,
    signatureModalOpen,
    setSignatureModalOpen
  } = usePdfStore();

  // Güncelleme durumu: menü kapalıyken de menü düğmesinde rozet göstermek için burada izlenir
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateState) return;
    const off = api.onUpdateState(setUpdateState);
    api.getUpdateState().then(({ autoDownload, ...current }) => setUpdateState(current));
    return off;
  }, []);
  const updateReady = updateState.status === 'available' || updateState.status === 'downloaded';

  // Yerel tam ekranda trafik ışıkları yok; onlara ayrılan sol boşluk kaldırılır
  const [nativeFullScreen, setNativeFullScreen] = useState(false);
  useEffect(() => window.electronAPI?.onFullScreenChange?.(setNativeFullScreen), []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const readAloud = useReadAloud(pdfDocument, onPageChange);
  const handleReadAloud = async () => {
    if (readAloud.status === 'playing') return readAloud.pause();
    if (readAloud.status === 'paused') return readAloud.resume();
    if (activeTab && !(await readAloud.start(activeTab.currentPage))) alert(t('read_aloud_no_text'));
  };

  // Çalışma modu: Görüntüle / İşaretle / Düzenle / İmzala (mevcut araç durumundan türetilir)
  const mode = annotationModeOpen
    ? 'markup'
    : activeTool === 'edittext'
      ? 'edit'
      : activeTool === 'signature' || signatureModalOpen
        ? 'sign'
        : 'view';
  const modes = [
    {
      id: 'view',
      label: t('mode_view'),
      icon: BookOpen,
      action: () => {
        setAnnotationModeOpen(false);
        setActiveTool('select');
      }
    },
    {
      id: 'markup',
      label: t('annotate'),
      icon: Highlighter,
      action: () => {
        setAnnotationModeOpen(true);
        setActiveTool('highlight');
      }
    },
    {
      id: 'edit',
      label: t('edit_text'),
      icon: TextCursorInput,
      action: () => {
        setAnnotationModeOpen(false);
        setActiveTool('edittext');
      }
    },
    {
      id: 'sign',
      label: t('sign'),
      icon: Signature,
      action: () => {
        // Önceki mod (Metni Düzenle, işaretleme aracı) açık kalmasın; imza onaylanınca modal 'signature' aracını seçer
        setAnnotationModeOpen(false);
        setActiveTool('select');
        setSignatureModalOpen(true);
      }
    }
  ] as const;

  return (
    <header
      className={`app-drag flex items-center gap-3 h-[52px] shrink-0 pr-3 bg-toolbar border-b border-separator text-label select-none ${
        IS_MAC_DESKTOP && !isFullScreen && !nativeFullScreen ? 'pl-[84px]' : 'pl-3'
      }`}
    >
      {/* Sol: ana menü, kenar çubuğu ve belge başlığı */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <MainMenu
          onOpenFile={onOpenFile}
          onCreatePdf={onCreatePdf}
          onOpenRecentFile={onOpenRecentFile}
          onSaveFile={onSaveFile}
          onSaveFileAs={onSaveFileAs}
          onPrint={onPrint}
          onFitPage={onFitPage}
          onFitWidth={onFitWidth}
          onToggleFullScreen={toggleFullScreen}
          updateReady={updateReady}
        />
        <ToolbarButton
          label={t('navigation_panel')}
          active={!!leftSidebarTab}
          disabled={!activeTab}
          onClick={() => setLeftSidebarTab(leftSidebarTab ? null : 'thumbnails')}
        >
          <PanelLeft className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>
        <div className="flex flex-col min-w-0 ml-2 leading-tight">
          <span className="text-[13px] font-semibold truncate">
            {activeTab ? activeTab.fileName.replace(/\.pdf$/i, '') : 'GlossPDF'}
          </span>
          {activeTab?.isModified && <span className="text-[11px] text-secondary">{t('edited')}</span>}
        </div>
      </div>

      {/* Orta: çalışma modu */}
      <div role="group" aria-label={t('tools')} className="flex gap-0.5 p-0.5 rounded-lg bg-fill">
        {modes.map((m) => {
          const Icon = m.icon;
          const on = activeTab && mode === m.id;
          return (
            <button
              key={m.id}
              onClick={m.action}
              disabled={!activeTab}
              aria-pressed={!!on}
              title={m.label}
              className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                on ? 'bg-seg-on text-label shadow-seg' : 'text-secondary hover:text-label'
              }`}
            >
              <Icon className="w-[15px] h-[15px]" strokeWidth={1.8} />
              <span className="hidden lg:inline">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sağ: dosya, geri al, sesli okuma, arama, inceleyici */}
      <div className="flex items-center justify-end gap-1 flex-1">
        <ToolbarButton label={t('open_file_ctrl_o')} onClick={onOpenFile}>
          <FolderOpen className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t('save_ctrl_s')} onClick={onSaveFile} disabled={!activeTab}>
          <Save className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t('print_ctrl_p')} onClick={onPrint} disabled={!activeTab}>
          <Printer className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t('undo_ctrl_z')} onClick={undo} disabled={!activeTab?.undoStack?.length}>
          <Undo2 className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label={t('redo_ctrl_y')} onClick={redo} disabled={!activeTab?.redoStack?.length}>
          <Redo2 className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>

        {/* Sesli okuma: geçerli sayfadan başlar; okurken duraklat/devam et ve durdur */}
        <ToolbarButton
          label={t(
            readAloud.status === 'playing' ? 'pause_reading' : readAloud.status === 'paused' ? 'resume_reading' : 'read_aloud'
          )}
          active={readAloud.status !== 'idle'}
          disabled={!activeTab || !pdfDocument || !readAloudSupported}
          onClick={handleReadAloud}
        >
          {readAloud.status === 'playing' ? (
            <Pause className="w-[17px] h-[17px]" strokeWidth={1.75} />
          ) : readAloud.status === 'paused' ? (
            <Play className="w-[17px] h-[17px]" strokeWidth={1.75} />
          ) : (
            <Volume2 className="w-[17px] h-[17px]" strokeWidth={1.75} />
          )}
        </ToolbarButton>
        {readAloud.status !== 'idle' && (
          <ToolbarButton label={t('stop_reading')} onClick={readAloud.stop}>
            <Square className="w-3.5 h-3.5 fill-current" strokeWidth={1.75} />
          </ToolbarButton>
        )}

        <button
          onClick={() => setSearchBarOpen(!searchBarOpen)}
          disabled={!activeTab}
          title={t('find_in_document_ctrl_f')}
          aria-pressed={searchBarOpen}
          className={`hidden md:flex items-center gap-1.5 w-44 h-7 mx-1 px-2 rounded-[7px] text-[13px] text-left transition-colors disabled:opacity-40 ${
            searchBarOpen ? 'bg-accent/15 text-accent-text' : 'bg-fill text-secondary'
          }`}
        >
          <Search className="w-3.5 h-3.5" strokeWidth={2} />
          <span className="flex-1 truncate">{t('find_in_document_2')}</span>
          <span className="text-[11px]">{IS_MAC_DESKTOP ? '⌘F' : 'Ctrl+F'}</span>
        </button>

        <ToolbarButton label={t('inspector')} active={rightPanelOpen} onClick={toggleRightPanel}>
          <PanelRight className="w-[17px] h-[17px]" strokeWidth={1.75} />
        </ToolbarButton>
      </div>
    </header>
  );
};
