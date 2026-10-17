import { useMobile } from '../store';
import { S } from '../strings';
import { Icon, type IconName } from './Icon';

type Tab = 'home' | 'signatures' | 'tools' | 'recents';

/** Ana sayfa, İmzalar, Araçlar ve Son açılanlar arasındaki yüzen koyu cam gezinme çubuğu. */
export function Dock({ active }: { active: Tab }) {
  const goHome = useMobile((s) => s.goHome);
  const openSignatures = useMobile((s) => s.openSignatures);
  const openTools = useMobile((s) => s.openTools);
  const openRecents = useMobile((s) => s.openRecents);
  const pickAndOpen = useMobile((s) => s.pickAndOpen);

  const item = (tab: Tab, icon: IconName, label: string, onClick: () => void) => {
    const on = tab === active;
    return (
      <button
        aria-label={label}
        aria-current={on ? 'page' : undefined}
        onClick={onClick}
        className="flex h-[46px] w-[46px] items-center justify-center justify-self-center rounded-full border-0 p-0"
        style={{ background: on ? '#FFFFFF' : 'transparent', color: on ? '#0E0E11' : 'rgba(255,255,255,0.78)' }}
      >
        <Icon name={icon} size={21} />
      </button>
    );
  };

  return (
    <nav
      aria-label={S.appName}
      className="fixed left-5 right-5 z-30 grid h-16 grid-cols-5 items-center rounded-[32px] px-2"
      style={{
        bottom: 'calc(var(--sab) + 24px)',
        background: 'var(--dock)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)'
      }}
    >
      {item('home', 'doc', S.documents, goHome)}
      {item('signatures', 'sign', S.signatures, openSignatures)}
      <button
        aria-label={S.openPdf}
        onClick={pickAndOpen}
        className="flex h-[50px] w-[50px] items-center justify-center justify-self-center rounded-full border-0 p-0 text-white"
        style={{ background: 'var(--red)' }}
      >
        <Icon name="plus" size={22} strokeWidth={2.2} />
      </button>
      {item('tools', 'grid', S.tools, () => openTools('home'))}
      {item('recents', 'clock', S.recents, openRecents)}
    </nav>
  );
}
