import { useState } from 'react';
import { LANGUAGES, readLanguagePreference, type LanguagePreference } from '@/i18n/languages';
import { Help, Section, Segmented } from '../components/Fields';
import { Icon } from '../components/Icon';
import { useMobile } from '../store';
import { S, setLanguagePreference } from '../strings';
import { readThemePreference, setThemePreference, type ThemePreference } from '../theme';

export function SettingsScreen() {
  const leaveSettings = useMobile((s) => s.leaveSettings);
  const [theme, setTheme] = useState(readThemePreference);
  const language = readLanguagePreference();

  const languages: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: S.languageSystem },
    ...LANGUAGES.map((l) => ({ value: l.code, label: l.nativeLabel }))
  ];

  return (
    <div className="h-full overflow-y-auto" style={{ padding: 'calc(var(--sat) + 20px) 20px calc(var(--sab) + 32px)' }}>
      <button className="round-btn glass -ms-1 mb-3" aria-label={S.back} onClick={leaveSettings}>
        <Icon name="back" size={22} strokeWidth={2} />
      </button>
      <h1 className="text-[42px] font-bold leading-[1.05] tracking-[-0.045em]">{S.settings}</h1>

      <Section title={S.appearance}>
        <Segmented<ThemePreference>
          label={S.theme}
          value={theme}
          options={[
            { value: 'system', label: S.themeSystem },
            { value: 'light', label: S.themeLight },
            { value: 'dark', label: S.themeDark }
          ]}
          onChange={(t) => {
            setTheme(t);
            setThemePreference(t);
          }}
        />
        <Help>{S.themeHint}</Help>
      </Section>

      <Section title={S.language}>
        <div role="radiogroup" aria-label={S.language} className="-my-1 flex flex-col">
          {languages.map((l) => {
            const on = l.value === language;
            return (
              <button
                key={l.value}
                role="radio"
                aria-checked={on}
                lang={l.value === 'system' ? undefined : l.value}
                onClick={() => !on && setLanguagePreference(l.value)}
                className="flex min-h-12 items-center justify-between gap-3 border-0 bg-transparent p-0 text-start text-[15px] font-medium"
              >
                {l.label}
                {on && (
                  <span style={{ color: 'var(--red-ink)' }}>
                    <Icon name="check" size={20} strokeWidth={2.4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Help>{S.languageHint}</Help>
      </Section>
    </div>
  );
}
