import React, { useEffect, useReducer, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import { viewportFor } from '../../services/pdfRenderService';
import type { BookmarkItem } from '../../types/pdf';
import { itemClass, panelClass, type MenuEntry } from './DropdownMenu';
import { t } from '@/i18n';
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  LocateFixed,
  Pencil,
  Trash2
} from 'lucide-react';

/** Satır kimliği: her seviyedeki sıra (ağaç her değişiklikte yenilenir) */
type Path = number[];
type DropPos = 'before' | 'after' | 'inside';

const keyOf = (path: Path) => path.join('.');
const isPrefix = (prefix: Path, path: Path) => prefix.length <= path.length && prefix.every((v, i) => path[i] === v);
const nodeAt = (tree: BookmarkItem[], path: Path): BookmarkItem | undefined =>
  path.reduce<BookmarkItem | undefined>((node, i, depth) => (depth === 0 ? tree : node?.children)?.[i], undefined);
/** Yolun bulunduğu kardeş listesi (yalnızca ağaç kopyasında: eksik children oluşturulur) */
const siblingsOf = (tree: BookmarkItem[], path: Path) =>
  path.slice(0, -1).reduce((list, i) => (list[i].children ??= []), tree);

// Cmd/Ctrl+B ve başlıktaki düğme: panel o an açık değilse açıldığında eklenir
const ADD_EVENT = 'glosspdf:add-bookmark';
let pendingAdd = false;
export function requestAddBookmark() {
  pendingAdd = true;
  window.dispatchEvent(new Event(ADD_EVENT));
}

/** Belgede seçili metin (yeni yer iminin adı) */
function selectedText(): string {
  const selection = window.getSelection();
  const inDocument = selection?.anchorNode?.parentElement?.closest('[data-page-number]');
  return inDocument ? selection!.toString().replace(/\s+/g, ' ').trim() : '';
}

/** Görünen konum: etkin sayfa ve pencerenin üst kenarının o sayfadaki PDF y'si */
async function currentView(pdfDocument: pdfjsLib.PDFDocumentProxy | null): Promise<Pick<BookmarkItem, 'pageNumber' | 'top'>> {
  const { tabs, activeTabId } = usePdfStore.getState();
  const tab = tabs.find((tb) => tb.id === activeTabId);
  const pageNumber = tab?.currentPage ?? 1;
  const pageEl = document.getElementById(`pdf-page-${pageNumber}`);
  const container = pageEl?.offsetParent;
  if (!pdfDocument || !pageEl || !(container instanceof HTMLElement)) return { pageNumber, top: undefined };
  const viewport = viewportFor(await pdfDocument.getPage(pageNumber), 1, tab?.rotation);
  // Yan çevrilmiş sayfada dikey konum PDF x'ine düşer: sayfanın başı
  if (viewport.rotation % 180 !== 0) return { pageNumber, top: undefined };
  const offset = Math.min(Math.max(container.scrollTop - pageEl.offsetTop, 0), pageEl.offsetHeight);
  const [, top] = viewport.convertToPdfPoint(0, (offset * viewport.height) / pageEl.offsetHeight);
  return { pageNumber, top: Math.round(top * 100) / 100 };
}

interface BookmarksPanelProps {
  outline: BookmarkItem[];
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onPageClick: (pageNumber: number, top?: number) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ outline, pdfDocument, onPageClick }) => {
  const [selected, setSelected] = useState<Path | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; path: Path } | null>(null);
  const [drag, setDrag] = useState<Path | null>(null);
  const [drop, setDrop] = useState<{ key: string; pos: DropPos } | null>(null);
  // Kapalı düğümler nesneyle tutulur; kopyalanan ağaçta da kapalı kalırlar
  const collapsed = useRef(new WeakSet<BookmarkItem>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Ağacın kopyasını değiştirir ve tek geri alma adımı olarak kaydeder */
  const edit = (change: (tree: BookmarkItem[]) => void) => {
    const next = new WeakSet<BookmarkItem>();
    const copy = (items: BookmarkItem[]): BookmarkItem[] =>
      items.map((item) => {
        const clone = { ...item, children: copy(item.children ?? []) };
        if (collapsed.current.has(item)) next.add(clone);
        return clone;
      });
    const tree = copy(outline);
    change(tree);
    collapsed.current = next;
    usePdfStore.getState().setOutline(tree);
    return tree;
  };

  const add = async (parent?: Path) => {
    const title = selectedText();
    const view = await currentView(pdfDocument);
    // Acrobat gibi: seçili yer iminin hemen arkasına (aynı seviye), yoksa sona
    const path = parent
      ? [...parent, nodeAt(outline, parent)?.children?.length ?? 0]
      : selected && nodeAt(outline, selected)
        ? [...selected.slice(0, -1), selected[selected.length - 1] + 1]
        : [outline.length];
    const tree = edit((tree) =>
      siblingsOf(tree, path).splice(path[path.length - 1], 0, { title: title || t('page', [view.pageNumber]), ...view, children: [] })
    );
    if (parent) collapsed.current.delete(nodeAt(tree, parent)!);
    setSelected(path);
    setEditing(keyOf(path));
  };

  useEffect(() => {
    const run = () => {
      if (!pendingAdd) return;
      pendingAdd = false;
      add();
    };
    run();
    window.addEventListener(ADD_EVENT, run);
    return () => window.removeEventListener(ADD_EVENT, run);
  });

  const rename = (path: Path, value: string) => {
    setEditing(null);
    const title = value.trim();
    const node = nodeAt(outline, path);
    if (node && title && title !== node.title) edit((tree) => (nodeAt(tree, path)!.title = title));
  };

  const setDestination = async (path: Path) => {
    const view = await currentView(pdfDocument);
    edit((tree) => Object.assign(nodeAt(tree, path)!, view));
  };

  const remove = (path: Path) => {
    edit((tree) => siblingsOf(tree, path).splice(path[path.length - 1], 1));
    setSelected(null);
  };

  const move = (from: Path, to: Path, pos: DropPos) => {
    const toNode = nodeAt(outline, to);
    // Açık bir düğümün alt çizgisi, altındaki ilk çocuğun üstüdür
    if (pos === 'after' && toNode?.children?.length && !collapsed.current.has(toNode)) {
      to = [...to, 0];
      pos = 'before';
    }
    // Aynı listede öndeki öğe çıkarılınca hedefin sırası bir azalır
    const depth = from.length - 1;
    const target = [...to];
    if (target.length > depth && isPrefix(from.slice(0, -1), target) && from[depth] < target[depth]) target[depth]--;
    let moved: Path = [];
    const tree = edit((tree) => {
      const [item] = siblingsOf(tree, from).splice(from[depth], 1);
      if (pos === 'inside') {
        const children = (nodeAt(tree, target)!.children ??= []);
        moved = [...target, children.push(item) - 1];
      } else {
        moved = [...target.slice(0, -1), target[target.length - 1] + (pos === 'after' ? 1 : 0)];
        siblingsOf(tree, moved).splice(moved[moved.length - 1], 0, item);
      }
    });
    if (pos === 'inside') collapsed.current.delete(nodeAt(tree, target)!);
    setSelected(moved);
  };

  const endDrag = () => {
    setDrag(null);
    setDrop(null);
  };

  const toggle = (item: BookmarkItem) => {
    if (collapsed.current.has(item)) collapsed.current.delete(item);
    else collapsed.current.add(item);
    rerender();
  };

  // Yalnızca panel odaktayken; ad yazılırken değil
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selected || !nodeAt(outline, selected) || (e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'F2') setEditing(keyOf(selected));
    else if (e.key === 'Delete' || e.key === 'Backspace') remove(selected);
    else return;
    e.preventDefault();
    e.stopPropagation(); // Seçili işaretleme de silinmesin
  };

  const renderItems = (items: BookmarkItem[], parent: Path): React.ReactNode =>
    items.map((item, i) => {
      const path = [...parent, i];
      const key = keyOf(path);
      const hasChildren = !!item.children?.length;
      const open = !collapsed.current.has(item);
      const isSelected = selected !== null && keyOf(selected) === key;
      const dropPos = drag && drop?.key === key ? drop.pos : null;
      return (
        <React.Fragment key={key}>
          <div
            role="treeitem"
            aria-level={path.length}
            aria-selected={isSelected}
            aria-expanded={hasChildren ? open : undefined}
            draggable={editing !== key}
            onClick={() => {
              setSelected(path);
              onPageClick(item.pageNumber, item.top);
            }}
            onDoubleClick={() => setEditing(key)}
            onContextMenu={(e) => {
              e.preventDefault();
              setSelected(path);
              setMenu({ x: e.clientX, y: e.clientY, path });
            }}
            onDragStart={(e) => {
              setDrag(path);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.title);
            }}
            onDragOver={(e) => {
              // Dışarıdan sürüklenen dosyalar ve kendi içine/altına bırakma kabul edilmez
              if (!drag || isPrefix(drag, path)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const rect = e.currentTarget.getBoundingClientRect();
              const y = (e.clientY - rect.top) / rect.height;
              const pos: DropPos = y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
              if (drop?.key !== key || drop.pos !== pos) setDrop({ key, pos });
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation(); // Uygulamanın dosya bırakma işleyicisine gitmesin
              if (drag && dropPos) move(drag, path, dropPos);
              endDrag();
            }}
            onDragEnd={endDrag}
            style={{ paddingInlineStart: (path.length - 1) * 14 + 2 }}
            className={`relative flex items-center gap-1 h-7 pe-1.5 rounded-md cursor-pointer ${
              isSelected ? 'bg-accent text-white' : 'text-label hover:bg-hover'
            } ${dropPos === 'inside' ? 'ring-2 ring-inset ring-accent' : ''} ${drag && isPrefix(drag, path) ? 'opacity-40' : ''}`}
          >
            {/* Bırakma yeri göstergesi: satırın üstünde ya da altında yatay çizgi */}
            {(dropPos === 'before' || dropPos === 'after') && (
              <span
                aria-hidden
                className={`absolute inset-x-1 h-0.5 rounded-full bg-accent pointer-events-none ${
                  dropPos === 'before' ? '-top-px' : '-bottom-px'
                }`}
              />
            )}
            <span
              title={t('bookmark_drag_hint')}
              className={`shrink-0 cursor-grab active:cursor-grabbing ${isSelected ? 'text-white/70' : 'text-secondary'}`}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(item);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                aria-label={t(open ? 'bookmark_collapse' : 'bookmark_expand')}
                className={`p-0.5 shrink-0 ${isSelected ? 'text-white/80' : 'text-secondary hover:text-label'}`}
              >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 rtl:rotate-180" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {editing === key ? (
              <input
                autoFocus
                defaultValue={item.title}
                aria-label={t('bookmark_rename')}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  // Odak panele döner, blur adı kaydeder; Esc önce eski adı geri koyar
                  if (e.key === 'Escape') e.currentTarget.value = item.title;
                  if (e.key === 'Enter' || e.key === 'Escape') panelRef.current?.focus();
                }}
                onBlur={(e) => rename(path, e.currentTarget.value)}
                className="flex-1 min-w-0 h-5 px-1 rounded-sm bg-group text-label text-[13px] outline-hidden ring-2 ring-accent select-text"
              />
            ) : (
              <span className="flex-1 truncate">{item.title}</span>
            )}
            <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-secondary'}`}>{item.pageNumber}</span>
          </div>
          {hasChildren && open && renderItems(item.children!, path)}
        </React.Fragment>
      );
    });

  const menuEntries = (path: Path): MenuEntry[] => [
    { label: t('bookmark_rename'), icon: Pencil, action: () => setEditing(keyOf(path)) },
    { label: t('bookmark_set_destination'), icon: LocateFixed, action: () => setDestination(path) },
    { label: t('bookmark_add_child'), icon: CornerDownRight, action: () => add(path) },
    'separator',
    { label: t('delete'), icon: Trash2, action: () => remove(path) }
  ];

  return (
    <div
      ref={panelRef}
      role="tree"
      aria-label={t('bookmarks')}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-y-auto px-2 pb-3 text-[13px] outline-hidden"
    >
      {outline.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center text-secondary">
          <Bookmark className="w-7 h-7 mb-1" strokeWidth={1.5} />
          <p className="text-[13px] font-semibold text-label">{t('no_bookmarks_in_document')}</p>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // Belgedeki metin seçimi (yer imi adı) kaybolmasın
            onClick={() => add()}
            className="flex items-center gap-1.5 h-[26px] mt-2 px-3 rounded-[7px] bg-group text-label text-[13px] shadow-btn hover:bg-hover"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            {t('bookmark_add')}
          </button>
        </div>
      ) : (
        renderItems(outline, [])
      )}
      {menu && nodeAt(outline, menu.path) && (
        <ContextMenu x={menu.x} y={menu.y} entries={menuEntries(menu.path)} onClose={() => setMenu(null)} />
      )}
    </div>
  );
};

/** Sağ tık menüsü: uygulamanın açılır menüleriyle aynı görünüm */
const ContextMenu: React.FC<{ x: number; y: number; entries: MenuEntry[]; onClose: () => void }> = ({
  x,
  y,
  entries,
  onClose
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Klavye odağı menüden önceki yere (panel) döner; ad kutusu açılırsa onun autoFocus'u sonra gelir
  const previous = useRef<HTMLElement | null>(null);
  const close = () => {
    previous.current?.focus();
    onClose();
  };

  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', onClose);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      role="menu"
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: Math.min(x, window.innerWidth - 260), top: Math.min(y, window.innerHeight - 160) }}
      className={`fixed z-50 w-max min-w-[220px] ${panelClass}`}
    >
      {entries.map((entry, i) =>
        entry === 'separator' ? (
          <div key={i} role="separator" className="h-px my-1 mx-2 bg-group-sep" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              entry.action?.();
            }}
            className={`${itemClass} h-7`}
          >
            {entry.icon && (
              <entry.icon className="w-[15px] h-[15px] shrink-0 text-secondary group-hover:text-white/80 group-focus-visible:text-white/80" />
            )}
            <span className="flex-1">{entry.label}</span>
          </button>
        )
      )}
    </div>
  );
};
