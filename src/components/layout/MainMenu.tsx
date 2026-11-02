import React, { useEffect, useRef, useState } from 'react';
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
  ChevronRight,
  Check,
  FileText,
  Trash2,
  type LucideIcon
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  /** İkinci satır (ör. son dosyanın yolu) */
  detail?: string;
  /** Sağdaki soluk değer (ör. seçili dil, tarih) */
  hint?: string;
  checked?: boolean;
  disabled?: boolean;
  badge?: boolean;
  action?: () => void;
  submenu?: MenuEntry[];
}
type MenuEntry = MenuItem | 'separator';

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

const panelClass =
  'p-1 rounded-lg border border-acrobat-border dark:border-acrobat-darkBorder bg-white dark:bg-acrobat-darkPanel shadow-[0_16px_40px_rgba(0,0,0,0.25)]';
const itemClass =
  'w-full flex items-center gap-2.5 px-2.5 rounded-[5px] text-start text-[12.5px] whitespace-nowrap text-slate-700 dark:text-slate-200 outline-hidden hover:bg-black/5 dark:hover:bg-white/10 focus-visible:bg-black/5 dark:focus-visible:bg-white/10 aria-expanded:bg-black/5 dark:aria-expanded:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent';
const mutedClass = 'shrink-0 text-[11.5px] text-slate-500 dark:text-slate-400';

const Separator = () => <div role="separator" className="h-px my-1 mx-1.5 bg-acrobat-border dark:bg-acrobat-darkBorder" />;

const isRtl = () => document.documentElement.dir === 'rtl';

const focusFirstItem = (menu: Element | null | undefined) =>
  menu?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')?.focus();

// Ekranın altına taşan alt menüyü yukarı kaydır
const fitToViewport = (el: HTMLDivElement | null) => {
  if (!el) return;
  const overflow = el.getBoundingClientRect().bottom - (window.innerHeight - 8);
  if (overflow > 0) el.style.top = `${Math.max(8, parseFloat(el.style.top) - overflow)}px`;
};

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

  const [open, setOpen] = useState(false);
  // Alt menü fixed konumlanır: ana menü kaydırılabilir olduğu için içinde kalsa kırpılırdı
  const [sub, setSub] = useState<{ index: number; top: number; inset: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const noDoc = !activeTab;

  const close = () => {
    setOpen(false);
    setSub(null);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onMouseDown);
    // Fareyle açılışta odak halkası görünmez (focus-visible); klavyeyle açan doğrudan oklarla gezer
    focusFirstItem(menuRef.current);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const openSub = (index: number, anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect();
    setSub({ index, top: r.top - 5, inset: isRtl() ? window.innerWidth - r.left + 2 : r.right + 2 });
  };

  // Klavyeyle açılan alt menüde odak, menü DOM'a girdiği anda ilk öğeye geçer
  const focusSubOnMount = useRef(false);
  const onSubMount = (el: HTMLDivElement | null) => {
    fitToViewport(el);
    if (el && focusSubOnMount.current) {
      focusSubOnMount.current = false;
      focusFirstItem(el);
    }
  };

  const focusSubParent = () =>
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${sub?.index}"]`)?.focus();

  const run = (item: MenuItem) => {
    close();
    item.action?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const current = document.activeElement as HTMLElement | null;
    const list = current?.closest<HTMLElement>('[role="menu"]');
    const inSub = list?.dataset.submenu !== undefined;
    const forward = isRtl() ? 'ArrowLeft' : 'ArrowRight';
    const back = isRtl() ? 'ArrowRight' : 'ArrowLeft';

    if (e.key === 'Escape') {
      if (inSub) {
        focusSubParent();
        setSub(null);
      } else {
        close();
        triggerRef.current?.focus();
      }
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list && current) {
      const items = Array.from(list.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')).filter(
        (el) => el.closest('[role="menu"]') === list
      );
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(items.indexOf(current) + step + items.length) % items.length]?.focus();
    } else if (e.key === forward && current?.getAttribute('aria-haspopup')) {
      focusSubOnMount.current = true;
      openSub(Number(current.dataset.index), current);
    } else if (e.key === back && inSub) {
      focusSubParent();
      setSub(null);
    } else {
      return;
    }
    // Belge görüntüleyicinin ve genel kısayolların ok/Esc tuşlarını almasını engelle
    e.preventDefault();
    e.stopPropagation();
  };

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

  const renderItem = (item: MenuItem, extra: React.ComponentProps<'button'> & { 'data-index'?: number }) => {
    const Icon = item.icon ?? (item.checked ? Check : undefined);
    return (
      <button
        type="button"
        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={item.checked}
        disabled={item.disabled}
        className={`${itemClass} ${item.detail ? 'h-10' : 'h-7'}`}
        {...extra}
      >
        {Icon ? (
          <Icon
            className={`w-[15px] h-[15px] shrink-0 ${
              item.icon ? 'text-slate-500 dark:text-slate-400' : 'text-acrobat-red'
            }`}
          />
        ) : (
          <span className="w-[15px] shrink-0" />
        )}
        <span className="flex-1 min-w-0">
          <span className="block truncate">{item.label}</span>
          {item.detail && (
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</span>
          )}
        </span>
        {item.badge && <span className="w-[7px] h-[7px] rounded-full bg-acrobat-red shrink-0" />}
        {item.hint && <span className={mutedClass}>{item.hint}</span>}
        {item.shortcut && (
          <span className={`ms-5 ${mutedClass}`} dir="ltr">
            {item.shortcut}
          </span>
        )}
        {item.submenu && (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500 dark:text-slate-400 rtl:rotate-180" />
        )}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
          open ? 'bg-black/15 dark:bg-white/15' : ''
        }`}
      >
        <Menu className="w-4 h-4" />
        <span className="font-medium text-[11px]">{t('menu')}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t('menu')}
          onScroll={() => setSub(null)}
          className={`absolute top-full start-0 mt-1.5 z-50 w-max min-w-[280px] max-w-[400px] max-h-[calc(100vh-90px)] overflow-y-auto ${panelClass}`}
        >
          {entries.map((entry, i) => {
            if (entry === 'separator') return <Separator key={i} />;
            if (!entry.submenu) {
              return (
                <React.Fragment key={i}>
                  {renderItem(entry, { onClick: () => run(entry), onMouseEnter: () => setSub(null) })}
                </React.Fragment>
              );
            }
            const isOpen = sub?.index === i;
            return (
              <div
                key={i}
                onMouseEnter={(e) => {
                  if (entry.disabled) setSub(null);
                  else if (!isOpen) openSub(i, e.currentTarget);
                }}
              >
                {renderItem(entry, {
                  'data-index': i,
                  'aria-haspopup': 'menu',
                  'aria-expanded': isOpen,
                  onClick: (e) => (isOpen ? setSub(null) : openSub(i, e.currentTarget))
                })}
                {isOpen && (
                  <div
                    ref={onSubMount}
                    role="menu"
                    aria-label={entry.label}
                    data-submenu=""
                    style={{ top: sub.top, insetInlineStart: sub.inset }}
                    className={`fixed z-50 w-max min-w-[220px] max-w-[360px] max-h-[calc(100vh-16px)] overflow-y-auto ${panelClass}`}
                  >
                    {entry.submenu.map((child, j) =>
                      child === 'separator' ? (
                        <Separator key={j} />
                      ) : (
                        <React.Fragment key={j}>{renderItem(child, { onClick: () => run(child) })}</React.Fragment>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
