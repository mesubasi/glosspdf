import { getLanguage, persistLanguagePreference, type Language, type LanguagePreference } from '@/i18n/languages';
import { ar } from './locales/ar';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { tr, type Strings } from './locales/tr';
import { zh } from './locales/zh';

const DICTS: Record<Language, Strings> = { tr, en, de, fr, es, ar, zh };

/**
 * Arayüz dili: kayıtlı tercih, yoksa cihaz dili (masaüstüyle aynı algılama ve aynı 7 dil).
 * languages.ts yüklenirken <html lang dir> özniteliklerini de ayarlar (Arapça = rtl).
 */
export const LANG: Language = getLanguage();
export const S: Strings = DICTS[LANG];

/** Metinler modül yüklenirken seçildiği için dil değişince uygulama yeniden yüklenir. */
export function setLanguagePreference(preference: LanguagePreference) {
  persistLanguagePreference(preference);
  location.reload();
}

const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);

/** Son açılanlar için kısa tarih: "Bugün", "Dün", yoksa "14 Eki" (arayüz dilinde). */
export function formatDay(t: number): string {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(t)) / 86_400_000);
  if (days === 0 || days === 1) {
    const s = new Intl.RelativeTimeFormat(LANG, { numeric: 'auto' }).format(-days, 'day');
    return s.charAt(0).toLocaleUpperCase(LANG) + s.slice(1);
  }
  return new Date(t).toLocaleDateString(LANG, { day: 'numeric', month: 'short' });
}

/** "{n}" gibi yer tutucuları doldurur. */
export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
