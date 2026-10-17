import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PdfRenderService } from '@/services/pdfRenderService';
import { Help } from '../components/Fields';
import { Icon, type IconName } from '../components/Icon';
import { ResultSheet } from '../components/ResultSheet';
import { messageFor } from '../errors';
import {
  deleteSelected,
  initialItems,
  insertBlank,
  isChanged,
  moveItem,
  moveSelected,
  rotateSelected,
  type PageItem
} from '../lib/pageOps';
import type { OutputFile } from '../lib/share';
import { buildFromPages } from '../lib/tools';
import { useMobile } from '../store';
import { S, fill } from '../strings';

const GAP = 12;
const COLUMNS = 3;
const TILE_ASPECT = 1.414;
const LONG_PRESS_MS = 380;
const MOVE_TOLERANCE = 10;
const A4: [number, number] = [595.28, 841.89];

// ---------- Küçük resim ----------

interface TileProps {
  pdf: PDFDocumentProxy | null;
  item: PageItem;
  index: number;
  width: number;
  selected: boolean;
  dragging: boolean;
  scrollRoot: RefObject<HTMLElement>;
  onClick: () => void;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}

function PageTile({ pdf, item, index, width, selected, dragging, scrollRoot, onClick, onPointerDown }: TileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const height = width * TILE_ASPECT;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), {
      root: scrollRoot.current,
      rootMargin: '100% 0px'
    });
    io.observe(el);
    return () => io.disconnect();
    // index: React karoyu DOM'da taşıyınca Chrome gözlemcisi "görünmüyor" raporlayıp güncellemiyor;
    // sıra her değiştiğinde gözlemci yeniden kurulur ve güncel durumu hemen bildirir.
  }, [scrollRoot, index]);

  // Yalnızca ekrana yakın küçük resimler çizilir; uzaklaşınca canvas bırakılır
  useEffect(() => {
    if (!pdf || !near || !width || item.source === 0) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    (async () => {
      const page = await pdf.getPage(item.source);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(width / base.width, height / base.height);
      task = PdfRenderService.renderPageToCanvas(page, canvas, scale).renderTask;
      setBox({ w: base.width * scale, h: base.height * scale });
      await task.promise.catch((e) => {
        if (e?.name !== 'RenderingCancelledException') console.warn('Thumbnail failed:', e);
      });
    })().catch((e) => console.warn('Thumbnail load failed:', e));
    return () => {
      cancelled = true;
      task?.cancel();
      const canvas = canvasRef.current;
      if (canvas) canvas.width = canvas.height = 0;
    };
  }, [pdf, near, width, height, item.source]);

  // Döndürülmüş sayfa kutuya sığsın diye küçültülür
  const rotated = item.rotation % 180 !== 0;
  const fit = box ? Math.min(1, width / (rotated ? box.h : box.w), height / (rotated ? box.w : box.h)) : 1;
  const label = String(index + 1).padStart(2, '0');
  const name = item.source === 0 ? fill(S.blankPageLabel, { n: index + 1 }) : fill(S.pageLabel, { n: index + 1 });

  return (
    <button
      ref={ref}
      data-key={item.key}
      aria-label={selected ? `${name}, ${S.selectedSuffix}` : name}
      aria-pressed={selected}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex items-center justify-center overflow-hidden border-0 bg-white p-0"
      style={{
        height,
        borderRadius: 16,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        transform: dragging ? 'scale(1.06)' : selected ? 'scale(0.96)' : 'none',
        zIndex: dragging ? 10 : undefined,
        boxShadow: dragging
          ? '0 18px 36px rgba(17,17,26,0.28)'
          : selected
            ? '0 0 0 2.5px var(--red), 0 10px 22px rgba(216,30,36,0.18)'
            : '0 4px 14px rgba(17,17,26,0.06)'
      }}
    >
      {item.source === 0 ? (
        <span aria-hidden="true" style={{ color: 'var(--muted)' }}>
          <Icon name="pageAdd" size={26} />
        </span>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ transform: `rotate(${item.rotation}deg) scale(${fit})`, transition: 'transform 160ms ease' }}
        />
      )}
      <span
        className="mono absolute bottom-2 left-2 flex h-5 items-center rounded-[10px] px-[7px] text-[11px]"
        style={{ background: selected ? 'var(--red)' : 'var(--bg)', color: selected ? '#FFFFFF' : '#3E3E47' }}
      >
        {label}
      </span>
      {selected && (
        <span
          className="absolute bottom-2 right-2 flex h-[22px] w-[22px] items-center justify-center rounded-full text-white"
          style={{ background: 'var(--red)' }}
        >
          <Icon name="check" size={13} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

// ---------- Ekran ----------

function ToolbarButton(props: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 p-0 text-white"
      style={{
        background: props.danger ? 'var(--red)' : 'rgba(255,255,255,0.1)',
        opacity: props.disabled ? 0.35 : 1
      }}
    >
      <Icon name={props.icon} size={20} />
    </button>
  );
}

export function OrganizeScreen() {
  const source = useMobile((s) => s.organizeSource)!;
  const leaveOrganize = useMobile((s) => s.leaveOrganize);
  const setDirty = useMobile((s) => s.setOrganizeDirty);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [items, setItems] = useState(() => initialItems(source.pages));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [tileWidth, setTileWidth] = useState(0);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ files: OutputFile[]; whole: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Son kaydedilen/paylaşılan düzen; ondan sonra değişiklik yoksa çıkışta uyarı gerekmez */
  const [delivered, setDelivered] = useState<PageItem[] | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ key: string; x: number; y: number; pointerId: number; el: HTMLElement; timer: number } | null>(null);
  const drag = useRef<{ key: string; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    let doc: PDFDocumentProxy | undefined;
    PdfRenderService.loadDocument(source.data.slice())
      .then((d) => setPdf((doc = d)))
      .catch((e) => setMessage(messageFor(e)));
    return () => void doc?.destroy();
  }, [source]);

  useEffect(() => {
    setDirty(delivered ? items !== delivered : isChanged(items, source.pages));
  }, [items, delivered, source.pages, setDirty]);

  // Izgara sütun genişliği
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setTileWidth(Math.floor((el.clientWidth - GAP * (COLUMNS - 1)) / COLUMNS));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sürükleme sırasında sayfanın kaymasını engelle (dokunmatik kaydırma pointer'ı iptal ederdi)
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => drag.current && e.preventDefault();
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  /** Parmağın altındaki karoya sürüklenen sayfayı taşır. */
  const reorderAt = (x: number, y: number) => {
    const d = drag.current;
    const grid = gridRef.current;
    if (!d || !grid) return;
    const tiles = [...grid.querySelectorAll<HTMLElement>('[data-key]')];
    const hit = tiles.find((t) => {
      const r = t.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    const targetKey = hit?.dataset.key;
    if (!targetKey || targetKey === d.key) return;
    setItems((prev) =>
      moveItem(
        prev,
        prev.findIndex((it) => it.key === d.key),
        prev.findIndex((it) => it.key === targetKey)
      )
    );
  };

  // Kenara yaklaşınca otomatik kaydırma
  useEffect(() => {
    if (!draggingKey) return;
    const id = window.setInterval(() => {
      const d = drag.current;
      const sc = scrollerRef.current;
      if (!d || !sc) return;
      const r = sc.getBoundingClientRect();
      const dy = d.y < r.top + 100 ? -12 : d.y > r.bottom - 140 ? 12 : 0;
      if (dy) {
        sc.scrollBy(0, dy);
        reorderAt(d.x, d.y);
      }
    }, 16);
    return () => window.clearInterval(id);
  }, [draggingKey]);

  const startPress = (key: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (working) return;
    const el = e.currentTarget;
    const timer = window.setTimeout(() => {
      const p = press.current;
      if (!p) return;
      drag.current = { key: p.key, x: p.x, y: p.y };
      try {
        p.el.setPointerCapture(p.pointerId);
      } catch {
        // Parmak zaten kalkmışsa yakalama başarısız olur; sürükleme pointerup'ta biter
      }
      setDraggingKey(p.key);
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    }, LONG_PRESS_MS);
    press.current = { key, x: e.clientX, y: e.clientY, pointerId: e.pointerId, el, timer };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (d) {
      d.x = e.clientX;
      d.y = e.clientY;
      reorderAt(e.clientX, e.clientY);
      return;
    }
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) {
      // Basılı tutmadan kıpırdadı: kaydırma niyeti
      window.clearTimeout(p.timer);
      press.current = null;
    }
  };

  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    if (drag.current) {
      drag.current = null;
      // Sürüklemenin hemen ardından gelen click seçimi değiştirmesin; click gelmezse
      // bayrak bir sonraki gerçek dokunuşu yutmasın diye aynı turda kapatılır.
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      setDraggingKey(null);
    }
  };

  const toggle = (key: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = selected.size === items.length;
  const hasSelection = selected.size > 0;

  const remove = () => {
    const next = deleteSelected(items, selected);
    if (!next) {
      setMessage(S.cantDeleteAll);
      return;
    }
    setItems(next);
    setSelected(new Set());
  };

  /** Boş sayfa, son seçili sayfanın boyutunda (seçim yoksa son sayfanınkinde) eklenir. */
  const addBlank = async () => {
    const ref = [...items].reverse().find((it) => it.source > 0 && (!hasSelection || selected.has(it.key)));
    let size = A4;
    if (pdf && ref) {
      const v = (await pdf.getPage(ref.source)).getViewport({ scale: 1 });
      size = [v.width, v.height];
    }
    setItems((prev) => insertBlank(prev, selected, size));
  };

  /** whole = tüm düzen (Kaydet); değilse seçili sayfalardan ayrı dosya */
  const build = async (pages: PageItem[], whole: boolean) => {
    setWorking(true);
    setMessage(null);
    try {
      setResult({ files: await buildFromPages(source, pages, whole ? 'organized' : 'pages'), whole });
    } catch (e) {
      setMessage(messageFor(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="relative h-full" style={{ background: 'var(--bg)' }}>
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto px-4"
        style={{ paddingTop: 'calc(var(--sat) + 8px)', paddingBottom: 'calc(var(--sab) + 112px)' }}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
      >
        <div className="flex items-center justify-between px-1">
          <button
            aria-label={S.close}
            onClick={leaveOrganize}
            className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white p-0"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
          >
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => build(items, true)}
            disabled={working || !pdf}
            className="flex h-11 items-center rounded-full border-0 px-[18px] text-[14px] font-semibold text-white"
            style={{ background: 'var(--ink)', opacity: working || !pdf ? 0.5 : 1 }}
          >
            {working ? S.working : S.save}
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between px-1">
          <div className="min-w-0">
            <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.04em]">{S.organizeTitle}</h1>
            <p className="mono mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
              {fill(S.pageSummary, { p: items.length, n: selected.size })}
            </p>
          </div>
          <button
            onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((it) => it.key)))}
            className="h-11 border-0 bg-transparent px-0.5 text-[14px] font-semibold"
            style={{ color: 'var(--red-ink)' }}
          >
            {allSelected ? S.clearSelection : S.selectAll}
          </button>
        </div>

        <div className="mt-2 px-1">
          <Help tone={message ? 'error' : 'muted'}>{message ?? S.organizeTip}</Help>
        </div>

        <div
          ref={gridRef}
          className="mt-3 grid"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`, gap: GAP }}
        >
          {tileWidth > 0 &&
            items.map((it, i) => (
              <PageTile
                key={it.key}
                pdf={pdf}
                item={it}
                index={i}
                width={tileWidth}
                selected={selected.has(it.key)}
                dragging={draggingKey === it.key}
                scrollRoot={scrollerRef}
                onClick={() => toggle(it.key)}
                onPointerDown={startPress(it.key)}
              />
            ))}
        </div>
      </div>

      <div
        role="toolbar"
        aria-label={S.organizeTitle}
        className="absolute left-4 right-4 flex h-16 items-center gap-0.5 rounded-[32px] pl-5 pr-2"
        style={{
          bottom: 'calc(var(--sab) + 24px)',
          background: 'rgba(16,16,20,0.88)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          backdropFilter: 'blur(20px) saturate(160%)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
        }}
      >
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
          {fill(S.selectedCount, { n: selected.size })}
        </span>
        <ToolbarButton
          icon="left"
          label={S.moveEarlier}
          disabled={!hasSelection}
          onClick={() => setItems((prev) => moveSelected(prev, selected, -1))}
        />
        <ToolbarButton
          icon="right"
          label={S.moveLater}
          disabled={!hasSelection}
          onClick={() => setItems((prev) => moveSelected(prev, selected, 1))}
        />
        <ToolbarButton
          icon="rotate"
          label={S.rotate}
          disabled={!hasSelection}
          onClick={() => setItems((prev) => rotateSelected(prev, selected))}
        />
        <ToolbarButton
          icon="share"
          label={S.extractSelected}
          disabled={!hasSelection || working || !pdf}
          onClick={() => build(items.filter((it) => selected.has(it.key)), false)}
        />
        <ToolbarButton icon="pageAdd" label={S.addBlank} onClick={addBlank} />
        <ToolbarButton icon="trash" label={S.deletePages} danger disabled={!hasSelection} onClick={remove} />
      </div>

      {result && (
        <ResultSheet
          title={S.organizeTitle}
          outputs={result.files}
          onDelivered={result.whole ? () => setDelivered(items) : undefined}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}
