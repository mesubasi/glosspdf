import { useEffect, useState, type FormEvent } from 'react';
import type { AnnotationItem } from '@/types/pdf';
import { Slider } from '../components/Fields';
import { Icon } from '../components/Icon';
import { S, fill } from '../strings';
import { measureText } from './AnnotationOverlay';
import { groupOf, newGroup, useAnnot, type AnnotTool } from './state';

const TOOL_ICONS: Record<AnnotTool, string> = {
  highlight: 'M9 11l-5 5v4h4l5-5M13 6l5 5-5 5-5-5zM17 3l4 4',
  underline: 'M7 4v6a5 5 0 0 0 10 0V4M5 20h14',
  strikeout: 'M16 6.5A4 4 0 0 0 12 4c-2.5 0-4 1.5-4 3.3 0 1.4.9 2.4 2.5 3M4 12h16M8.5 17a4 4 0 0 0 3.5 3c2.5 0 4-1.5 4-3.3',
  draw: 'M4 20l4-1 11-11-3-3L5 16zM14 7l3 3',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5',
  rect: 'M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  text: 'M5 7V5h14v2M12 5v14M9 19h6'
};
const TOOLS: AnnotTool[] = ['highlight', 'underline', 'strikeout', 'draw', 'note', 'rect', 'text'];

const COLORS = [
  { hex: '#FFD60A', name: 'colorYellow' },
  { hex: '#34C759', name: 'colorGreen' },
  { hex: '#2F7BEA', name: 'colorBlue' },
  { hex: '#FF4FA0', name: 'colorPink' },
  { hex: '#FF3B30', name: 'colorRed' },
  { hex: '#1E2129', name: 'colorBlack' }
] as const;

const glass = {
  background: 'var(--glass-strong)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  backdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid var(--glass-line)',
  boxShadow: '0 12px 32px rgba(17,17,26,0.14)'
} as const;

const darkGlass = {
  background: 'var(--dock)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  backdropFilter: 'blur(20px) saturate(160%)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
} as const;

function ToolIcon({ d }: { d: string }) {
  return (
    <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function AnnotHeader({ onExit, onDone, busy }: { onExit: () => void; onDone: () => void; busy: boolean }) {
  const canUndo = useAnnot((s) => s.past.length > 0);
  const canRedo = useAnnot((s) => s.future.length > 0);
  const undo = useAnnot((s) => s.undo);
  const redo = useAnnot((s) => s.redo);
  return (
    <header
      className="absolute flex items-center gap-0.5 rounded-[28px] px-1.5"
      style={{ ...glass, top: 'calc(var(--sat) + 8px)', left: 12, right: 12, height: 56 }}
    >
      <button className="round-btn" aria-label={S.exitAnnotate} onClick={onExit}>
        <Icon name="close" size={20} strokeWidth={2} />
      </button>
      <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{S.annotTitle}</div>
      <button className="round-btn" aria-label={S.undo} disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.35 }} onClick={undo}>
        <ToolIcon d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
      </button>
      <button className="round-btn" aria-label={S.redo} disabled={!canRedo} style={{ opacity: canRedo ? 1 : 0.35 }} onClick={redo}>
        <ToolIcon d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
      </button>
      <button
        onClick={onDone}
        disabled={busy}
        className="ms-0.5 h-10 rounded-[20px] border-0 px-4 text-[14px] font-semibold text-white"
        style={{ background: 'var(--red)', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? S.working : S.done}
      </button>
    </header>
  );
}

function StylePanel({ tool }: { tool: AnnotTool }) {
  const color = useAnnot((s) => s.colors[tool]);
  const opacity = useAnnot((s) => s.opacity);
  const stroke = useAnnot((s) => s.stroke);
  const fontSize = useAnnot((s) => s.fontSize);
  const { setColor, setOpacity, setStroke, setFontSize } = useAnnot.getState();
  const pct = (v: number) => fill(S.percent, { v });

  return (
    <section
      aria-label={S.annotStyle}
      className="absolute left-4 right-4 flex flex-col gap-1 rounded-[26px] px-3.5 pb-3 pt-2.5"
      style={{ ...glass, bottom: 'calc(var(--sab) + 102px)' }}
    >
      <div role="radiogroup" aria-label={S.color} className="flex items-center justify-between">
        {COLORS.map((c) => (
          <button
            key={c.hex}
            role="radio"
            aria-checked={color === c.hex}
            aria-label={S[c.name]}
            onClick={() => setColor(c.hex)}
            className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0"
          >
            <span
              className="h-7 w-7 rounded-full"
              style={{ background: c.hex, boxShadow: color === c.hex ? '0 0 0 3px var(--card), 0 0 0 5px var(--ink)' : 'inset 0 0 0 1px var(--line)' }}
            />
          </button>
        ))}
      </div>
      {tool === 'highlight' && (
        <Slider label={S.opacity} value={Math.round(opacity * 100)} min={10} max={100} step={5} format={pct} onChange={(v) => setOpacity(v / 100)} />
      )}
      {(tool === 'draw' || tool === 'rect') && (
        <Slider label={S.thickness} value={stroke} min={1} max={10} format={(v) => `${v} pt`} onChange={setStroke} />
      )}
      {tool === 'text' && <Slider label={S.textSize} value={fontSize} min={8} max={36} format={(v) => `${v} pt`} onChange={setFontSize} />}
    </section>
  );
}

export function ToolDock() {
  const tool = useAnnot((s) => s.tool);
  const setTool = useAnnot((s) => s.setTool);
  return (
    <>
      {tool && <StylePanel tool={tool} />}
      <div
        role="toolbar"
        aria-label={S.annotTools}
        className="absolute left-4 right-4 grid h-16 grid-cols-7 items-center rounded-[32px] px-1.5"
        style={{ ...darkGlass, bottom: 'calc(var(--sab) + 24px)' }}
      >
        {TOOLS.map((t) => {
          const on = tool === t;
          return (
            <button
              key={t}
              aria-label={S[`tool_${t}`]}
              aria-pressed={on}
              onClick={() => setTool(on ? null : t)}
              className="flex h-11 w-11 items-center justify-center justify-self-center rounded-full border-0 p-0"
              style={{ background: on ? '#FFFFFF' : 'transparent', color: on ? '#0E0E11' : 'rgba(255,255,255,0.8)' }}
            >
              <ToolIcon d={TOOL_ICONS[t]} />
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Not, metin kutusu ve vurguya yorum yazma penceresi */
export function EditorSheet() {
  const req = useAnnot((s) => s.editing);
  const [value, setValue] = useState('');
  useEffect(() => setValue(req?.initial ?? ''), [req]);
  if (!req) return null;

  const close = () => useAnnot.getState().setEditing(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const s = useAnnot.getState();
    const text = value.trim();
    const fs = s.fontSize;

    if (req.group) {
      // Var olanı düzenle
      if (req.kind === 'text' && !text) {
        s.removeGroup(req.group);
      } else {
        let first = true;
        s.commit(
          s.items.map((it) => {
            if (groupOf(it.id) !== req.group) return it;
            if (req.kind === 'comment') {
              const out = first ? { ...it, contents: text } : it;
              first = false;
              return out;
            }
            if (it.type === 'text' && it.rect) {
              const size = it.fontSize || fs;
              return { ...it, contents: text, rect: [it.rect[0], it.rect[1], measureText(text, size), size * 1.2] };
            }
            return { ...it, contents: text };
          })
        );
      }
    } else if (req.at && req.page && (text || req.kind === 'note')) {
      const group = newGroup();
      const base = { id: `${group}#0`, pageNumber: req.page, createdAt: new Date().toISOString() };
      const item: AnnotationItem =
        req.kind === 'note'
          ? { ...base, type: 'note', color: s.colors.note, contents: text, rect: [req.at.x - 12, req.at.y - 12, 24, 24] }
          : {
              ...base,
              type: 'text',
              color: s.colors.text,
              contents: text,
              fontSize: fs,
              // Dokunulan nokta satırın ortasına gelsin
              rect: [req.at.x, req.at.y - fs * 0.6, measureText(text, fs), fs * 1.2]
            };
      s.commit([...s.items, item]);
    }
    close();
  };

  const title = req.kind === 'text' ? S.textBox : req.kind === 'note' ? S.note : S.addComment;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end p-3" style={{ background: 'rgba(14,14,17,0.35)' }}>
      <form onSubmit={save} className="glass flex w-full flex-col gap-3 rounded-[26px] p-4" style={{ marginBottom: 'var(--sab)' }}>
        <h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2>
        {req.kind === 'text' ? (
          <input
            autoFocus
            aria-label={title}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 rounded-2xl border-0 bg-[var(--card)] px-4 text-[15px] outline-none"
          />
        ) : (
          <textarea
            autoFocus
            aria-label={title}
            value={value}
            rows={4}
            onChange={(e) => setValue(e.target.value)}
            className="resize-none rounded-2xl border-0 bg-[var(--card)] p-3 text-[15px] outline-none"
          />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={close} className="h-12 flex-1 rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold">
            {S.cancel}
          </button>
          <button type="submit" className="h-12 flex-1 rounded-3xl border-0 text-[15px] font-semibold text-white" style={{ background: 'var(--red)' }}>
            {S.save}
          </button>
        </div>
      </form>
    </div>
  );
}
