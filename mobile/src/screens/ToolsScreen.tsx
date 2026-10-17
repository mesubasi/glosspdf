import type { CSSProperties } from 'react';
import { Dock } from '../components/Dock';
import { Icon } from '../components/Icon';
import { useMobile } from '../store';
import { S } from '../strings';
import { TOOLS, type ToolId } from '../tools/registry';

type Tone = 'red' | 'white' | 'black';

const TONES: Record<Tone, { card: CSSProperties; badge: CSSProperties; hint: string }> = {
  red: {
    card: { background: 'var(--red)', color: '#FFFFFF' },
    badge: { background: 'rgba(255,255,255,0.2)' },
    hint: 'rgba(255,255,255,0.88)'
  },
  white: {
    card: { background: '#FFFFFF', color: 'var(--ink)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    badge: { background: 'var(--red-tint)', color: 'var(--red-ink)' },
    hint: 'var(--muted)'
  },
  black: {
    card: { background: 'var(--ink)', color: '#FFFFFF' },
    badge: { background: 'rgba(255,255,255,0.12)' },
    hint: 'rgba(255,255,255,0.72)'
  }
};

// Tasarımdaki yerleşim: birleştir geniş kırmızı kart, parola koru koyu kart
const LAYOUT: { id: ToolId; tone: Tone; wide?: boolean }[] = [
  { id: 'merge', tone: 'red', wide: true },
  { id: 'split', tone: 'white' },
  { id: 'compress', tone: 'white' },
  { id: 'protect', tone: 'black' },
  { id: 'watermark', tone: 'white' },
  { id: 'images', tone: 'white' },
  { id: 'insertImage', tone: 'white' }
];

export function ToolsScreen() {
  const openTool = useMobile((s) => s.openTool);
  const openOrganize = useMobile((s) => s.openOrganize);
  const leaveTools = useMobile((s) => s.leaveTools);
  const fromViewer = useMobile((s) => s.toolsReturnTo === 'viewer');
  const preset = useMobile((s) => s.toolPreset);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ padding: `calc(var(--sat) + 20px) 20px calc(var(--sab) + ${fromViewer ? 32 : 112}px)` }}
    >
      {fromViewer && (
        <button className="round-btn glass -ml-1 mb-3" aria-label={S.back} onClick={leaveTools}>
          <Icon name="back" size={22} strokeWidth={2} />
        </button>
      )}
      <h1 className="text-[42px] font-bold leading-[1.05] tracking-[-0.045em]">{S.tools}</h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
        {preset ? `${S.toolsForDoc}: ${preset.name}` : S.toolsHint}
      </p>

      <div className="mt-[18px] grid grid-cols-2 gap-2.5">
        {LAYOUT.map(({ id, tone, wide }) => {
          const tool = TOOLS[id];
          const t = TONES[tone];
          return (
            <button
              key={id}
              onClick={() => openTool(id)}
              className={`relative flex flex-col justify-between overflow-hidden border-0 text-left ${
                wide ? 'col-span-2 h-[120px] rounded-[26px] px-[18px] py-4' : 'h-[112px] rounded-3xl p-3.5'
              }`}
              style={t.card}
            >
              <span
                className={`flex items-center justify-center rounded-full ${wide ? 'h-[38px] w-[38px]' : 'h-9 w-9'}`}
                style={t.badge}
              >
                <Icon name={tool.icon} size={wide ? 20 : 19} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={wide ? 'text-xl font-bold tracking-[-0.03em]' : 'text-[15.5px] font-semibold'}>
                  {tool.title}
                </span>
                <span className={id === 'protect' ? 'mono text-[11.5px]' : 'text-xs'} style={{ color: t.hint }}>
                  {tool.hint}
                </span>
              </span>
              {wide && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute right-[54px] top-[18px] h-[84px] w-[62px] rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.55)', transform: 'rotate(-10deg)' }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute right-[22px] top-[22px] h-[84px] w-[62px] rounded-lg bg-white"
                    style={{ transform: 'rotate(7deg)', boxShadow: '0 8px 18px rgba(80,0,4,0.25)' }}
                  />
                </>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => openOrganize()}
        className="mt-2.5 flex h-16 w-full items-center gap-3 rounded-[22px] border-0 bg-white px-3.5 text-left"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
      >
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
          style={{ background: 'var(--red-tint)', color: 'var(--red-ink)' }}
        >
          <Icon name="grid" size={19} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15.5px] font-semibold">{S.organizeCard}</span>
          <span className="truncate text-xs" style={{ color: 'var(--muted)' }}>
            {S.organizeHint}
          </span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          <Icon name="right" size={18} strokeWidth={2} />
        </span>
      </button>

      {!fromViewer && <Dock active="tools" />}
    </div>
  );
}
