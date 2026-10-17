import { Dock } from '../components/Dock';
import { Icon } from '../components/Icon';
import { useMobile } from '../store';
import { S, fill, formatDay } from '../strings';

/** Alt çubuktaki "Son açılanlar": tüm geçmiş, listeden kaldırma burada. */
export function RecentsScreen() {
  const recents = useMobile((s) => s.recents);
  const openRecent = useMobile((s) => s.openRecent);
  const removeRecent = useMobile((s) => s.removeRecent);

  return (
    <div className="h-full overflow-y-auto" style={{ padding: 'calc(var(--sat) + 20px) 20px calc(var(--sab) + 112px)' }}>
      <h1 className="text-[42px] font-bold leading-[1.05] tracking-[-0.045em]">{S.recents}</h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
        {S.localOnly}
      </p>

      {recents.length === 0 ? (
        <p className="mt-[18px] text-sm" style={{ color: 'var(--muted)' }}>
          {S.emptyRecents}
        </p>
      ) : (
        <ul className="mt-[18px] flex flex-col gap-2.5">
          {recents.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-1 rounded-[22px] bg-[var(--card)] py-2.5 pe-1 ps-2.5"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <button onClick={() => openRecent(r.id)} className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-start">
                <span
                  aria-hidden="true"
                  className="flex h-[60px] w-[44px] flex-none items-start justify-center overflow-hidden rounded-lg bg-white"
                  style={{ boxShadow: '0 2px 8px rgba(17,17,26,0.10)' }}
                >
                  {r.thumb ? (
                    <img src={r.thumb} alt="" className="w-full" />
                  ) : (
                    <span className="mt-4" style={{ color: '#9B9BA6' }}>
                      <Icon name="doc" size={20} />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{r.name}</span>
                  <span className="mono text-[11px]" style={{ color: 'var(--muted)' }}>
                    {fill(S.pagesCount, { n: r.pages })} · {formatDay(r.lastOpened)}
                  </span>
                </span>
              </button>
              <button className="round-btn" aria-label={`${S.remove}: ${r.name}`} onClick={() => removeRecent(r.id)}>
                <Icon name="close" size={18} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dock active="recents" />
    </div>
  );
}
