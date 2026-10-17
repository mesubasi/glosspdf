import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
  type RefObject
} from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { AnnotationItem } from '@/types/pdf';
import { S } from '../strings';
import { TEXT_MARKUP, groupOf, newGroup, useAnnot, type AnnotTool } from './state';
import { getTextRuns, locate, spanRects, type CharPos, type Pt, type Rect, type TextRun } from './textRuns';

const NOTE_SIZE = 24;
const TAP_SLOP = 8; // CSS px
/** Kaydırma (taranmış sayfa) şeridinin yüksekliği, pt */
const BAND_HEIGHT = 14;

// ---------- Geometri ----------

export function boundsOf(items: AnnotationItem[]): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const it of items) {
    if (it.type === 'draw' && it.points) {
      const pad = (it.strokeWidth || 2) / 2;
      for (const p of it.points) {
        x0 = Math.min(x0, p.x - pad);
        y0 = Math.min(y0, p.y - pad);
        x1 = Math.max(x1, p.x + pad);
        y1 = Math.max(y1, p.y + pad);
      }
    } else if (it.rect) {
      const [x, y] = it.rect;
      const [w, h] = it.type === 'note' ? [NOTE_SIZE, NOTE_SIZE] : [it.rect[2], it.rect[3]];
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + w);
      y1 = Math.max(y1, y + h);
    }
  }
  return x0 === Infinity ? null : [x0, y0, x1 - x0, y1 - y0];
}

const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
};

/** p'ye dokunulan öğe (en üstteki önce); tol sayfa biriminde */
function hitTest(items: AnnotationItem[], p: Pt, tol: number): AnnotationItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type === 'draw' && it.points) {
      const lim = Math.max(tol, (it.strokeWidth || 2) / 2 + tol / 2);
      for (let j = 1; j < it.points.length; j++) if (segDist(p, it.points[j - 1], it.points[j]) <= lim) return it;
      continue;
    }
    const b = boundsOf([it]);
    if (b && p.x >= b[0] - tol && p.x <= b[0] + b[2] + tol && p.y >= b[1] - tol && p.y <= b[1] + b[3] + tol) return it;
  }
  return null;
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Metin kutusunun genişliği (GlossSans = kayıtta gömülen Liberation Sans) */
export function measureText(text: string, fontSize: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.55;
  measureCtx.font = `${fontSize}px GlossSans, sans-serif`;
  return measureCtx.measureText(text).width;
}

const shift = (it: AnnotationItem, dx: number, dy: number): AnnotationItem =>
  it.points
    ? { ...it, points: it.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    : it.rect
      ? { ...it, rect: [it.rect[0] + dx, it.rect[1] + dy, it.rect[2], it.rect[3]] }
      : it;

// ---------- Çizim ----------

function Shape({ it }: { it: AnnotationItem }) {
  const r = it.rect;
  switch (it.type) {
    case 'highlight':
      return r ? (
        <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={it.color} opacity={it.opacity ?? 0.35} style={{ mixBlendMode: 'multiply' }} />
      ) : null;
    case 'underline':
    case 'strikeout': {
      if (!r) return null;
      const y = it.type === 'underline' ? r[1] + r[3] - 1 : r[1] + r[3] / 2;
      return <line x1={r[0]} x2={r[0] + r[2]} y1={y} y2={y} stroke={it.color} strokeWidth={1.5} />;
    }
    case 'draw':
      return it.points ? (
        <polyline
          points={it.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={it.color}
          strokeWidth={it.strokeWidth || 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null;
    case 'rect':
      return r ? <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill="none" stroke={it.color} strokeWidth={it.strokeWidth || 2} /> : null;
    case 'note':
      return r ? (
        <g transform={`translate(${r[0]} ${r[1]})`}>
          <rect x={1} y={1} width={22} height={22} rx={5} fill={it.color} stroke="#333" strokeWidth={1} />
          <path d="M6 8h12M6 12h12M6 16h8" stroke="#262626" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      ) : null;
    case 'text':
      return r && it.contents ? (
        <text x={r[0]} y={r[1] + (it.fontSize || 14) * 0.85} fontSize={it.fontSize || 14} fill={it.color} style={{ fontFamily: 'GlossSans, sans-serif' }}>
          {it.contents}
        </text>
      ) : null;
    case 'signature':
      return r && it.imageData ? <image href={it.imageData} x={r[0]} y={r[1]} width={r[2]} height={r[3]} preserveAspectRatio="none" /> : null;
    default:
      return null;
  }
}

// ---------- Seçili öğe araç çubuğu ----------

function SelectionBar({ group, items, box, scale, pageW }: { group: string; items: AnnotationItem[]; box: Rect; scale: number; pageW: number }) {
  const removeGroup = useAnnot((s) => s.removeGroup);
  const setEditing = useAnnot((s) => s.setEditing);
  const first = items[0];
  const isMarkup = TEXT_MARKUP.has(first.type);
  const copied = items.map((it) => it.originalText).filter(Boolean).join(' ');

  const width = isMarkup ? 236 : 150;
  const left = Math.max(4, Math.min(pageW * scale - width - 4, box[0] * scale + (box[2] * scale - width) / 2));
  const above = box[1] * scale - 50;
  const top = above > 4 ? above : (box[1] + box[3]) * scale + 10;

  const btn = 'h-[34px] whitespace-nowrap rounded-[17px] border-0 px-3 text-[12.5px] font-semibold text-white';
  return (
    <div
      role="toolbar"
      aria-label={S.annotSelected}
      className="absolute z-20 flex gap-0.5 rounded-[20px] p-[3px]"
      style={{ left, top, background: 'var(--ink)', boxShadow: '0 10px 24px rgba(0,0,0,0.25)' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {(isMarkup || first.type === 'note' || first.type === 'text') && (
        <button
          className={btn}
          style={{ background: 'rgba(255,255,255,0.12)' }}
          onClick={() =>
            setEditing({
              kind: isMarkup ? 'comment' : (first.type as 'note' | 'text'),
              group,
              initial: first.contents || ''
            })
          }
        >
          {isMarkup ? S.addComment : S.edit}
        </button>
      )}
      {isMarkup && copied && (
        <button className={btn} style={{ background: 'transparent' }} onClick={() => void navigator.clipboard?.writeText(copied).catch(() => undefined)}>
          {S.copy}
        </button>
      )}
      <button className={btn} style={{ background: 'transparent', color: '#FF7A7E' }} onClick={() => removeGroup(group)}>
        {S.deletePages}
      </button>
    </div>
  );
}

// ---------- Katman ----------

type Gesture =
  | { kind: 'pan'; lastY: number }
  | { kind: 'markup'; tool: AnnotTool; from: CharPos | null; p0: Pt }
  | { kind: 'draw'; pts: Pt[] }
  | { kind: 'rect'; p0: Pt }
  | { kind: 'tap'; tool: AnnotTool; p0: Pt; cx: number; cy: number }
  | { kind: 'move'; p0: Pt }
  | { kind: 'resize'; p0: Pt; box: Rect };

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** CSS px / sayfa birimi */
  scale: number;
  pageW: number;
  pageH: number;
  scrollRoot: RefObject<HTMLElement>;
}

export function AnnotationOverlay({ pdf, pageNumber, scale, pageW, pageH, scrollRoot }: Props) {
  const active = useAnnot((s) => s.active);
  const tool = useAnnot((s) => s.tool);
  const allItems = useAnnot((s) => s.items);
  const selected = useAnnot((s) => s.selected);
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [draft, setDraft] = useState<AnnotationItem[] | null>(null);
  const [offset, setOffset] = useState<{ dx: number; dy: number; dw: number } | null>(null);
  const [runs, setRuns] = useState<TextRun[] | null>(null);

  const items = useMemo(() => allItems.filter((it) => it.pageNumber === pageNumber), [allItems, pageNumber]);
  const selItems = useMemo(() => (selected ? items.filter((it) => groupOf(it.id) === selected) : []), [items, selected]);

  // Metne yapışan araçlar için sayfa metnini önceden hazırla
  useEffect(() => {
    if (!active || !tool || !TEXT_MARKUP.has(tool) || runs) return;
    let alive = true;
    getTextRuns(pdf, pageNumber)
      .then((r) => alive && setRuns(r))
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, [active, tool, pdf, pageNumber, runs]);

  if (!active) return null;

  const toPage = (e: { clientX: number; clientY: number }): Pt => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const st = () => useAnnot.getState();
  const base = (type: AnnotationItem['type'], group: string, i: number): AnnotationItem => ({
    id: `${group}#${i}`,
    pageNumber,
    type,
    color: st().colors[(type === 'signature' ? 'rect' : type) as AnnotTool] ?? '#000000',
    createdAt: new Date().toISOString()
  });

  /** Metin işaretleme taslağı: metne yapışır, metin yoksa düz şerit */
  const markupDraft = (g: Extract<Gesture, { kind: 'markup' }>, p: Pt): AnnotationItem[] => {
    const group = 'draft';
    const extra = g.tool === 'highlight' ? { opacity: st().opacity } : {};
    if (g.from && runs) {
      const to = locate(runs, p, 40) ?? g.from;
      const { rects, text } = spanRects(runs, g.from, to);
      return rects.map((rect, i) => ({ ...base(g.tool, group, i), ...extra, rect, originalText: i === 0 ? text : undefined }));
    }
    const x = Math.min(g.p0.x, p.x);
    const w = Math.max(Math.abs(p.x - g.p0.x), 4);
    return [{ ...base(g.tool, group, 0), ...extra, rect: [x, g.p0.y - BAND_HEIGHT / 2, w, BAND_HEIGHT] }];
  };

  const finishDraft = () => {
    if (!draft?.length) return setDraft(null);
    const group = newGroup();
    st().commit([...st().items, ...draft.map((it, i) => ({ ...it, id: `${group}#${i}` }))]);
    setDraft(null);
  };

  // ----- Araç modu: çiz / işaretle / yerleştir; iki parmak kaydırır -----
  const onToolDown = (e: RPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const ys = [...pointers.current.values()].map((p) => p.y);
      gesture.current = { kind: 'pan', lastY: (ys[0] + ys[1]) / 2 };
      setDraft(null);
      return;
    }
    if (pointers.current.size > 2 || !tool) return;
    rootRef.current?.setPointerCapture(e.pointerId);
    const p = toPage(e);
    if (TEXT_MARKUP.has(tool)) {
      const g: Gesture = { kind: 'markup', tool, from: runs ? locate(runs, p) : null, p0: p };
      gesture.current = g;
      setDraft(markupDraft(g, p));
    } else if (tool === 'draw') {
      gesture.current = { kind: 'draw', pts: [p] };
    } else if (tool === 'rect') {
      gesture.current = { kind: 'rect', p0: p };
    } else {
      gesture.current = { kind: 'tap', tool, p0: p, cx: e.clientX, cy: e.clientY };
    }
  };

  const onToolMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan') {
      const ys = [...pointers.current.values()].map((p) => p.y);
      const y = ys.reduce((a, b) => a + b, 0) / ys.length;
      scrollRoot.current?.scrollBy(0, g.lastY - y);
      g.lastY = y;
      return;
    }
    const p = toPage(e);
    const s = st();
    if (g.kind === 'markup') setDraft(markupDraft(g, p));
    else if (g.kind === 'draw') {
      const last = g.pts[g.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) * scale < 1.5) return;
      g.pts.push(p);
      setDraft([{ ...base('draw', 'draft', 0), points: [...g.pts], strokeWidth: s.stroke }]);
    } else if (g.kind === 'rect') {
      setDraft([
        {
          ...base('rect', 'draft', 0),
          rect: [Math.min(g.p0.x, p.x), Math.min(g.p0.y, p.y), Math.abs(p.x - g.p0.x), Math.abs(p.y - g.p0.y)],
          strokeWidth: s.stroke
        }
      ]);
    }
  };

  const onToolUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (e.type === 'pointercancel') return setDraft(null);
    if (g.kind === 'tap') {
      if (Math.hypot(e.clientX - g.cx, e.clientY - g.cy) <= TAP_SLOP) {
        st().setEditing({ kind: g.tool === 'note' ? 'note' : 'text', page: pageNumber, at: g.p0, initial: '' });
      }
      return;
    }
    // Çok küçük dikdörtgen/çizgi kazara dokunuştur
    if (g.kind === 'rect' && draft?.[0]?.rect && (draft[0].rect[2] * scale < 6 || draft[0].rect[3] * scale < 6)) return setDraft(null);
    if (g.kind === 'draw' && g.pts.length < 2) return setDraft(null);
    finishDraft();
  };

  // ----- Gezinme modu: dokunarak seç; seçili öğe sürüklenir / boyutlanır -----
  const onBrowseClick = (e: RMouseEvent) => {
    const hit = hitTest(items, toPage(e), 10 / scale);
    st().select(hit ? groupOf(hit.id) : null);
  };

  const box = boundsOf(selItems);
  const movable = selItems.length > 0 && !TEXT_MARKUP.has(selItems[0].type);
  const resizable = selItems.length === 1 && (selItems[0].type === 'signature' || selItems[0].type === 'rect');

  const startMove = (kind: 'move' | 'resize') => (e: RPointerEvent) => {
    e.stopPropagation();
    if (!box) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesture.current = kind === 'move' ? { kind, p0: toPage(e) } : { kind, p0: toPage(e), box };
    setOffset({ dx: 0, dy: 0, dw: 0 });
  };
  const onMove = (e: RPointerEvent) => {
    const g = gesture.current;
    if (!g || (g.kind !== 'move' && g.kind !== 'resize')) return;
    const p = toPage(e);
    if (g.kind === 'move') setOffset({ dx: p.x - g.p0.x, dy: p.y - g.p0.y, dw: 0 });
    else setOffset({ dx: 0, dy: 0, dw: Math.max(24 - g.box[2], p.x - g.p0.x) });
  };
  const endMove = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !offset || !selected) return setOffset(null);
    const { dx, dy, dw } = offset;
    setOffset(null);
    if (!dx && !dy && !dw) return;
    st().commit(
      st().items.map((it) => {
        if (groupOf(it.id) !== selected || it.pageNumber !== pageNumber) return it;
        if (g.kind === 'move') return shift(it, dx, dy);
        const [x, y, w, h] = it.rect!;
        const nw = w + dw;
        // İmza oranını korur; dikdörtgen yalnızca genişler (yükseklik oranla)
        return { ...it, rect: [x, y, nw, (h * nw) / w] };
      })
    );
  };

  const shown = (it: AnnotationItem) => {
    if (!offset || !selected || groupOf(it.id) !== selected) return it;
    if (offset.dw && it.rect) {
      const [x, y, w, h] = it.rect;
      const nw = w + offset.dw;
      return { ...it, rect: [x, y, nw, (h * nw) / w] as AnnotationItem['rect'] };
    }
    return shift(it, offset.dx, offset.dy);
  };
  const liveBox = box && offset ? [box[0] + offset.dx, box[1] + offset.dy, box[2] + offset.dw, (box[3] * (box[2] + offset.dw)) / box[2]] as Rect : box;

  const toolMode = !!tool;
  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-10"
      style={{ touchAction: toolMode ? 'none' : 'pan-y', cursor: toolMode ? 'crosshair' : 'default' }}
      onPointerDown={toolMode ? onToolDown : undefined}
      onPointerMove={toolMode ? onToolMove : onMove}
      onPointerUp={toolMode ? onToolUp : endMove}
      onPointerCancel={toolMode ? onToolUp : endMove}
      onClick={toolMode ? undefined : onBrowseClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        className="pointer-events-none absolute left-0 top-0"
        width={pageW * scale}
        height={pageH * scale}
        viewBox={`0 0 ${pageW} ${pageH}`}
        aria-hidden="true"
      >
        {items.map((it) => (
          <Shape key={it.id} it={shown(it)} />
        ))}
        {draft?.map((it) => <Shape key={it.id} it={it} />)}
        {liveBox && (
          <rect
            x={liveBox[0] - 3}
            y={liveBox[1] - 3}
            width={liveBox[2] + 6}
            height={liveBox[3] + 6}
            fill="none"
            stroke="#2F7BEA"
            strokeWidth={1.5 / scale}
            strokeDasharray={`${4 / scale} ${3 / scale}`}
          />
        )}
      </svg>

      {!toolMode && liveBox && movable && (
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            left: (liveBox[0] - 6) * scale,
            top: (liveBox[1] - 6) * scale,
            width: (liveBox[2] + 12) * scale,
            height: (liveBox[3] + 12) * scale,
            touchAction: 'none'
          }}
          onPointerDown={startMove('move')}
          onClick={(e) => e.stopPropagation()}
        >
          {resizable && (
            <span
              className="absolute flex h-11 w-11 items-center justify-center"
              style={{ right: -22, bottom: -22, touchAction: 'none' }}
              onPointerDown={startMove('resize')}
            >
              <span className="h-4 w-4 rounded-full border-2 border-white" style={{ background: '#2F7BEA' }} />
            </span>
          )}
        </div>
      )}

      {!toolMode && selected && liveBox && !offset && (
        <SelectionBar group={selected} items={selItems} box={liveBox} scale={scale} pageW={pageW} />
      )}
    </div>
  );
}
