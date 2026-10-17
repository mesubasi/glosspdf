import { useState } from 'react';
import { Dock } from '../components/Dock';
import { Icon } from '../components/Icon';
import { useMobile } from '../store';
import { S, fill, formatDay } from '../strings';

const cardShadow = { boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

export function HomeScreen() {
  const recents = useMobile((s) => s.recents);
  const pickAndOpen = useMobile((s) => s.pickAndOpen);
  const pickAndSign = useMobile((s) => s.pickAndSign);
  const openRecent = useMobile((s) => s.openRecent);
  const openRecents = useMobile((s) => s.openRecents);
  const openSettings = useMobile((s) => s.openSettings);
  const [query, setQuery] = useState('');

  const q = query.trim().toLocaleLowerCase();
  const shown = q ? recents.filter((r) => r.name.toLocaleLowerCase().includes(q)) : recents;

  const openMerge = () => {
    const s = useMobile.getState();
    s.openTools('home');
    s.openTool('merge');
  };

  return (
    <div className="h-full overflow-y-auto" style={{ padding: 'calc(var(--sat) + 20px) 0 calc(var(--sab) + 112px)' }}>
      <div className="px-5">
        <div className="flex items-center gap-[9px]">
          <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--red)' }}>
            <div className="relative h-3.5 w-[11px] rounded-sm bg-white">
              <div className="absolute inset-x-0.5 top-1.5 h-[3px] rounded-[1px]" style={{ background: '#FFD60A' }} />
            </div>
          </div>
          <span className="text-[17px] font-bold tracking-[-0.02em]">{S.appName}</span>
          <button
            className="round-btn ms-auto bg-[var(--card)]"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
            aria-label={S.settings}
            onClick={openSettings}
          >
            <Icon name="sliders" size={20} strokeWidth={1.8} />
          </button>
        </div>

        <h1 className="mt-5 text-[42px] font-bold leading-[1.05] tracking-[-0.045em]">{S.documents}</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
          {S.localOnly}
        </p>

        <label className="mt-4 flex h-12 items-center gap-2.5 rounded-3xl bg-[var(--card)] px-4" style={cardShadow}>
          <span style={{ color: 'var(--muted)' }}>
            <Icon name="search" size={18} strokeWidth={2} />
          </span>
          <input
            type="search"
            aria-label={S.search}
            placeholder={S.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
          />
        </label>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5" style={{ gridTemplateRows: '81px 81px' }}>
          <button
            onClick={pickAndOpen}
            className="row-span-2 flex flex-col justify-between rounded-[26px] border-0 p-4 text-start text-white"
            style={{ background: 'var(--red)' }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Icon name="plus" size={22} strokeWidth={2.2} />
            </span>
            <span className="flex flex-col gap-[3px]">
              <span className="text-[22px] font-bold tracking-[-0.03em]">{S.openPdf}</span>
              <span className="text-[12.5px] leading-[1.35]" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {S.openPdfHint}
              </span>
            </span>
          </button>
          <button
            onClick={pickAndSign}
            className="flex items-center gap-2.5 rounded-[22px] border-0 bg-[var(--card)] px-3.5 text-start"
            style={cardShadow}
          >
            <span
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
              style={{ background: 'var(--red-tint)', color: 'var(--red-ink)' }}
            >
              <Icon name="sign" size={20} />
            </span>
            <span className="text-[15px] font-semibold">{S.dockSign}</span>
          </button>
          <button
            onClick={openMerge}
            className="flex items-center gap-2.5 rounded-[22px] border-0 px-3.5 text-start text-white"
            style={{ background: 'var(--solid)' }}
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Icon name="merge" size={20} />
            </span>
            <span className="text-[15px] font-semibold">{S.mergeTitle}</span>
          </button>
        </div>

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-[-0.02em]">{S.recents}</h2>
          {recents.length > 0 && (
            <button onClick={openRecents} className="border-0 bg-transparent px-0 py-2 text-[14px] font-semibold" style={{ color: 'var(--red-ink)' }}>
              {S.seeAll}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 px-5 text-sm" style={{ color: 'var(--muted)' }}>
          {recents.length === 0 ? S.emptyRecents : S.noMatches}
        </p>
      ) : (
        <ul className="no-scrollbar mt-1.5 flex gap-3 overflow-x-auto px-5 pb-2">
          {shown.map((r) => (
            <li key={r.id} className="w-[132px] flex-none">
              <button onClick={() => openRecent(r.id)} className="flex w-full flex-col gap-2 border-0 bg-transparent p-0 text-start">
                <span
                  aria-hidden="true"
                  className="flex h-[170px] w-full items-start justify-center overflow-hidden rounded-[18px] bg-white"
                  style={{ boxShadow: '0 6px 18px rgba(17,17,26,0.08)' }}
                >
                  {r.thumb ? (
                    <img src={r.thumb} alt="" className="w-full" />
                  ) : (
                    <span className="mt-16" style={{ color: '#9B9BA6' }}>
                      <Icon name="doc" size={32} />
                    </span>
                  )}
                </span>
                <span className="flex w-full flex-col gap-0.5 px-0.5">
                  <span className="truncate text-[13.5px] font-semibold">{r.name}</span>
                  <span className="mono text-[11px]" style={{ color: 'var(--muted)' }}>
                    {fill(S.pagesCount, { n: r.pages })} · {formatDay(r.lastOpened)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dock active="home" />
    </div>
  );
}
