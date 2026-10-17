import { useMobile } from '../store';
import { S } from '../strings';
import { Icon } from './Icon';

/** Ana sayfa ve araçlar arasındaki yüzen koyu cam gezinme çubuğu. */
export function Dock({ active }: { active: 'home' | 'tools' }) {
  const goHome = useMobile((s) => s.goHome);
  const openTools = useMobile((s) => s.openTools);
  const pickAndOpen = useMobile((s) => s.pickAndOpen);

  const item = (on: boolean) =>
    ({
      background: on ? '#FFFFFF' : 'transparent',
      color: on ? 'var(--ink)' : 'rgba(255,255,255,0.78)'
    }) as const;

  return (
    <nav
      aria-label={S.appName}
      className="fixed left-5 right-5 z-30 grid h-16 grid-cols-3 items-center rounded-[32px] px-2"
      style={{
        bottom: 'calc(var(--sab) + 24px)',
        background: 'rgba(16,16,20,0.88)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)'
      }}
    >
      <button
        aria-label={S.documents}
        aria-current={active === 'home' ? 'page' : undefined}
        onClick={goHome}
        className="flex h-[46px] w-[46px] items-center justify-center justify-self-center rounded-full border-0 p-0"
        style={item(active === 'home')}
      >
        <Icon name="doc" size={21} />
      </button>
      <button
        aria-label={S.openPdf}
        onClick={pickAndOpen}
        className="flex h-[50px] w-[50px] items-center justify-center justify-self-center rounded-full border-0 p-0 text-white"
        style={{ background: 'var(--red)' }}
      >
        <Icon name="plus" size={22} strokeWidth={2.2} />
      </button>
      <button
        aria-label={S.tools}
        aria-current={active === 'tools' ? 'page' : undefined}
        onClick={() => openTools('home')}
        className="flex h-[46px] w-[46px] items-center justify-center justify-self-center rounded-full border-0 p-0"
        style={item(active === 'tools')}
      >
        <Icon name="grid" size={21} />
      </button>
    </nav>
  );
}
