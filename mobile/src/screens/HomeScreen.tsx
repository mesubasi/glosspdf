import { useState } from 'react';
import { Dock } from '../components/Dock';
import { Icon } from '../components/Icon';
import { useMobile } from '../store';
import { S } from '../strings';

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString(navigator.language, { day: 'numeric', month: 'short' });

export function HomeScreen() {
  const recents = useMobile((s) => s.recents);
  const pickAndOpen = useMobile((s) => s.pickAndOpen);
  const openRecent = useMobile((s) => s.openRecent);
  const removeRecent = useMobile((s) => s.removeRecent);
  const [query, setQuery] = useState('');

  const q = query.trim().toLocaleLowerCase();
  const shown = q ? recents.filter((r) => r.name.toLocaleLowerCase().includes(q)) : recents;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ padding: 'calc(var(--sat) + 20px) 20px calc(var(--sab) + 112px)' }}
    >
      <div className="flex items-center gap-[9px]">
        <div
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'var(--red)' }}
        >
          <div className="relative h-3.5 w-[11px] rounded-sm bg-white">
            <div className="absolute inset-x-0.5 top-1.5 h-[3px] rounded-[1px]" style={{ background: '#FFD60A' }} />
          </div>
        </div>
        <span className="text-[17px] font-bold tracking-[-0.02em]">{S.appName}</span>
      </div>

      <h1 className="mt-5 text-[42px] font-bold leading-[1.05] tracking-[-0.045em]">{S.documents}</h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
        {S.localOnly}
      </p>

      <label
        className="mt-4 flex h-12 items-center gap-2.5 rounded-3xl bg-white px-4"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
      >
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

      <button
        onClick={pickAndOpen}
        className="mt-3.5 flex h-[120px] w-full flex-col justify-between rounded-[26px] border-0 p-4 text-left text-white"
        style={{ background: 'var(--red)' }}
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          <Icon name="plus" size={22} strokeWidth={2.2} />
        </span>
        <span className="flex flex-col gap-[3px]">
          <span className="text-[22px] font-bold tracking-[-0.03em]">{S.openPdf}</span>
          <span className="text-[12.5px]" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {S.openPdfHint}
          </span>
        </span>
      </button>

      <h2 className="mt-6 text-lg font-bold tracking-[-0.02em]">{S.recents}</h2>

      {shown.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          {recents.length === 0 ? S.emptyRecents : S.noMatches}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
          {shown.map((r) => (
            <li key={r.id} className="relative min-w-0">
              <button onClick={() => openRecent(r.id)} className="block w-full border-0 bg-transparent p-0 text-left">
                <span
                  className="flex h-[190px] w-full items-start justify-center overflow-hidden rounded-[18px] bg-white"
                  style={{ boxShadow: '0 6px 18px rgba(17,17,26,0.08)' }}
                >
                  {r.thumb ? (
                    <img src={r.thumb} alt="" className="w-full" />
                  ) : (
                    <span className="mt-16" style={{ color: 'var(--muted)' }}>
                      <Icon name="doc" size={32} />
                    </span>
                  )}
                </span>
                <span className="mt-2 block truncate px-0.5 text-[13.5px] font-semibold">{r.name}</span>
                <span className="mono block px-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                  {r.pages} {S.pages} · {fmtDate(r.lastOpened)}
                </span>
              </button>
              <button
                aria-label={`${S.remove}: ${r.name}`}
                onClick={() => removeRecent(r.id)}
                className="glass absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full p-0"
              >
                <Icon name="close" size={16} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dock active="home" />
    </div>
  );
}
