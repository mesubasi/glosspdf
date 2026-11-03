import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { isDesktop } from '../../services/fileSaveService';
import { t, LANGUAGES, detectSystemLanguage, getLanguageInfo } from '@/i18n';
import {
  Menu,
  FolderOpen,
  Clock,
  Files,
  Save,
  FileDown,
  FileImage,
  Minimize2,
  Lock,
  Printer,
  Search,
  Undo2,
  Redo2,
  Eye,
  Globe,
  FileOutput,
  Info,
  Keyboard,
  RefreshCw,
  X,
  LogOut,
  FileText,
  Trash2
} from 'lucide-react';
import { DropdownMenu, type MenuEntry } from './DropdownMenu';

interface MainMenuProps {
  onOpenFile: () => void;
  onOpenRecentFile: (filePath: string, fileName: string) => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onPrint: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onToggleFullScreen: () => void;
  updateReady: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onOpenFile,
  onOpenRecentFile,
  onSaveFile,
  onSaveFileAs,
  onPrint,
  onFitPage,
  onFitWidth,
  onToggleFullScreen,
  updateReady
}) => {
  const {
    tabs,
    activeTabId,
    requestCloseTab,
    recentFiles,
    clearRecentFiles,
    setMergeModalOpen,
    setExportImagesModalOpen,
    setCompressModalOpen,
    setProtectModalOpen,
    setSearchBarOpen,
    undo,
    redo,
    zoomIn,
    zoomOut,
    setZoom,
    rotateClockwise,
    rotateCounterClockwise,
    leftSidebarTab,
    setLeftSidebarTab,
    rightPanelOpen,
    toggleRightPanel,
    theme,
    toggleTheme,
    isFullScreen,
    languagePreference,
    setLanguagePreference,
    setShortcutHelpModalOpen,
    setUpdateModalOpen,
    setConvertModalOpen,
    setDocumentPropertiesModalOpen
  } = usePdfStore();

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const noDoc = !activeTab;

  const entries: MenuEntry[] = [
    { label: t('open_pdf_file'), icon: FolderOpen, shortcut: 'Ctrl+O', action: onOpenFile },
    {
      label: t('recent_documents'),
      icon: Clock,
      disabled: recentFiles.length === 0,
      submenu: [
        ...recentFiles.map((file) => ({
          label: file.fileName,
          detail: file.filePath,
          icon: FileText,
          hint: new Date(file.lastOpened).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          action: () => onOpenRecentFile(file.filePath, file.fileName)
        })),
        'separator',
        { label: t('clear_recent_list'), icon: Trash2, action: clearRecentFiles }
      ]
    },
    { label: t('merge_pdfs'), icon: Files, action: () => setMergeModalOpen(true) },
    'separator',
    { label: t('save_document'), icon: Save, shortcut: 'Ctrl+S', disabled: noDoc, action: onSaveFile },
    { label: t('save_as'), icon: FileDown, shortcut: 'Ctrl+Shift+S', disabled: noDoc, action: onSaveFileAs },
    { label: t('convert_to_office'), icon: FileOutput, disabled: noDoc, action: () => setConvertModalOpen(true) },
    {
      label: t('export_pages_to_images'),
      icon: FileImage,
      disabled: noDoc,
      action: () => setExportImagesModalOpen(true)
    },
    { label: t('compress_pdf'), icon: Minimize2, disabled: noDoc, action: () => setCompressModalOpen(true) },
    { label: t('protect_with_password'), icon: Lock, disabled: noDoc, action: () => setProtectModalOpen(true) },
    'separator',
    { label: t('print_document'), icon: Printer, shortcut: 'Ctrl+P', disabled: noDoc, action: onPrint },
    {
      label: t('find_in_document'),
      icon: Search,
      shortcut: 'Ctrl+F',
      disabled: noDoc,
      action: () => setSearchBarOpen(true)
    },
    'separator',
    { label: t('undo_action'), icon: Undo2, shortcut: 'Ctrl+Z', disabled: !activeTab?.undoStack?.length, action: undo },
    { label: t('redo_action'), icon: Redo2, shortcut: 'Ctrl+Y', disabled: !activeTab?.redoStack?.length, action: redo },
    'separator',
    {
      label: t('view'),
      icon: Eye,
      submenu: [
        { label: t('zoom_in_2'), shortcut: 'Ctrl++', disabled: noDoc, action: zoomIn },
        { label: t('zoom_out_2'), shortcut: 'Ctrl+-', disabled: noDoc, action: zoomOut },
        { label: t('actual_size_100'), shortcut: 'Ctrl+1', disabled: noDoc, action: () => setZoom(1) },
        'separator',
        { label: t('fit_page'), shortcut: 'Ctrl+0', disabled: noDoc, action: onFitPage },
        { label: t('fit_width'), shortcut: 'Ctrl+2', disabled: noDoc, action: onFitWidth },
        'separator',
        { label: t('rotate_90_clockwise'), shortcut: 'Ctrl+Shift+R', disabled: noDoc, action: rotateClockwise },
        {
          label: t('rotate_90_counter_clockwise'),
          shortcut: 'Ctrl+Shift+L',
          disabled: noDoc,
          action: rotateCounterClockwise
        },
        'separator',
        {
          label: t('navigation_panel'),
          checked: !!leftSidebarTab,
          action: () => setLeftSidebarTab(leftSidebarTab ? null : 'thumbnails')
        },
        { label: t('tools_panel'), checked: rightPanelOpen, action: toggleRightPanel },
        { label: t('dark_theme'), checked: theme === 'dark', action: toggleTheme },
        'separator',
        { label: t('full_screen_mode'), shortcut: 'F11', checked: isFullScreen, action: onToggleFullScreen }
      ]
    },
    {
      label: t('language'),
      icon: Globe,
      hint:
        languagePreference === 'system' ? t('system_language') : getLanguageInfo(languagePreference).nativeLabel,
      submenu: [
        {
          label: `${t('system_language')} (${getLanguageInfo(detectSystemLanguage()).nativeLabel})`,
          checked: languagePreference === 'system',
          action: () => setLanguagePreference('system')
        },
        'separator',
        ...LANGUAGES.map((lang) => ({
          label: lang.nativeLabel,
          checked: languagePreference === lang.code,
          action: () => setLanguagePreference(lang.code)
        }))
      ]
    },
    'separator',
    {
      label: t('keyboard_shortcuts_cheat_sheet'),
      icon: Keyboard,
      shortcut: 'F1',
      action: () => setShortcutHelpModalOpen(true)
    },
    { label: t('check_for_updates'), icon: RefreshCw, badge: updateReady, action: () => setUpdateModalOpen(true) },
    'separator',
    {
      label: t('document_properties'),
      icon: Info,
      shortcut: 'Ctrl+D',
      disabled: noDoc,
      action: () => setDocumentPropertiesModalOpen(true)
    },
    {
      label: t('close_active_tab'),
      icon: X,
      shortcut: 'Ctrl+W',
      disabled: noDoc,
      action: () => activeTabId && requestCloseTab(activeTabId)
    },
    // Tarayıcıda window.close() betikle açılmamış sekmeyi kapatamaz; çıkış yalnızca masaüstünde
    ...(isDesktop()
      ? [{ label: t('quit_app'), icon: LogOut, shortcut: 'Ctrl+Q', action: () => window.close() }]
      : [])
  ];

  return (
    <DropdownMenu
      label={t('menu')}
      entries={entries}
      title={t('menu')}
      trigger={
        <>
          <span className="relative">
            <Menu className="w-[17px] h-[17px]" strokeWidth={1.75} />
            {updateReady && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent ring-2 ring-toolbar" />}
          </span>
          <span className="hidden xl:inline text-[13px] font-medium">{t('menu')}</span>
        </>
      }
    />
  );
};
