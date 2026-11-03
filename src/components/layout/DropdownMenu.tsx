import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Check, type LucideIcon } from 'lucide-react';

export interface MenuItem {
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
export type MenuEntry = MenuItem | 'separator';

interface DropdownMenuProps {
  label: string;
  trigger: React.ReactNode;
  entries: MenuEntry[];
  title?: string;
  disabled?: boolean;
  /** Onay işareti simgeden önce ayrı sütunda durur (Adobe sayfa görünümü menüsü gibi) */
  checkColumn?: boolean;
  triggerClassName?: string;
  /** Açılır panelin tetikleyiciye göre konumu */
  panelPositionClassName?: string;
}

const panelClass =
  'p-1.5 rounded-[10px] bg-group shadow-hud backdrop-blur-xl';
const itemClass =
  'group w-full flex items-center gap-2.5 px-2.5 rounded-md text-start text-[13px] whitespace-nowrap text-label outline-hidden hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white aria-expanded:bg-accent aria-expanded:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-label';
const mutedClass = 'shrink-0 text-[11.5px] text-secondary group-hover:text-white/80 group-focus-visible:text-white/80 group-aria-expanded:text-white/80';

const Separator = () => <div role="separator" className="h-px my-1 mx-2 bg-group-sep" />;

const isRtl = () => document.documentElement.dir === 'rtl';

const focusFirstItem = (menu: Element | null | undefined) =>
  menu?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)')?.focus();

// Ekranın altına taşan alt menüyü yukarı kaydır
const fitToViewport = (el: HTMLDivElement | null) => {
  if (!el) return;
  const overflow = el.getBoundingClientRect().bottom - (window.innerHeight - 8);
  if (overflow > 0) el.style.top = `${Math.max(8, parseFloat(el.style.top) - overflow)}px`;
};

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  label,
  trigger,
  entries,
  title,
  disabled,
  checkColumn,
  triggerClassName = 'flex items-center gap-1.5 h-7 px-2 rounded-md text-secondary hover:bg-hover hover:text-label transition-colors',
  panelPositionClassName = 'top-full start-0 mt-1.5'
}) => {
  const [open, setOpen] = useState(false);
  // Alt menü fixed konumlanır: ana menü kaydırılabilir olduğu için içinde kalsa kırpılırdı
  const [sub, setSub] = useState<{ index: number; top: number; inset: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const renderItem = (item: MenuItem, extra: React.ComponentProps<'button'> & { 'data-index'?: number }) => {
    const Icon = item.icon ?? (item.checked && !checkColumn ? Check : undefined);
    return (
      <button
        type="button"
        role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={item.checked}
        disabled={item.disabled}
        className={`${itemClass} ${item.detail ? 'h-10' : 'h-7'}`}
        {...extra}
      >
        {checkColumn &&
          (item.checked ? (
            <Check className="w-[15px] h-[15px] shrink-0 text-accent-text group-hover:text-white group-focus-visible:text-white" />
          ) : (
            <span className="w-[15px] shrink-0" />
          ))}
        {Icon ? (
          <Icon
            className={`w-[15px] h-[15px] shrink-0 ${
              item.icon ? 'text-secondary group-hover:text-white/80 group-focus-visible:text-white/80 group-aria-expanded:text-white/80' : 'text-accent-text group-hover:text-white group-focus-visible:text-white'
            }`}
          />
        ) : (
          <span className="w-[15px] shrink-0" />
        )}
        <span className="flex-1 min-w-0">
          <span className="block truncate">{item.label}</span>
          {item.detail && (
            <span className="block truncate text-[11px] text-secondary group-hover:text-white/80 group-focus-visible:text-white/80 group-aria-expanded:text-white/80">{item.detail}</span>
          )}
        </span>
        {item.badge && <span className="w-[7px] h-[7px] rounded-full bg-accent shrink-0 group-hover:bg-white" />}
        {item.hint && <span className={mutedClass}>{item.hint}</span>}
        {item.shortcut && (
          <span className={`ms-5 ${mutedClass}`} dir="ltr">
            {item.shortcut}
          </span>
        )}
        {item.submenu && (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-secondary group-hover:text-white/80 group-focus-visible:text-white/80 group-aria-expanded:text-white/80 rtl:rotate-180" />
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
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={`${triggerClassName} disabled:opacity-30 disabled:hover:bg-transparent ${
          open ? 'bg-hover text-label' : ''
        }`}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onScroll={() => setSub(null)}
          className={`absolute ${panelPositionClassName} z-50 w-max min-w-[280px] max-w-[400px] max-h-[calc(100vh-90px)] overflow-y-auto ${panelClass}`}
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
