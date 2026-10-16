/**
 * GlossPDF çok dilli (i18n) katmanı.
 *
 * Kullanım:
 *   import { t } from '@/i18n';
 *   <button title={t('open_file_ctrl_o')} />
 *   t('page_loading', [pageNumber])          // {0} yer tutucusu
 *   t('error_generic', { message: err.message }) // {message} yer tutucusu
 *
 * Aktif dil `languages.ts` içindeki tekil kaynaktan okunur; dil değiştiğinde
 * store (zustand) `language` alanını günceller ve App ağacı yeniden kurulur.
 */
import { en, type MessageKey } from './locales/en';
import { tr } from './locales/tr';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { ar } from './locales/ar';
import { zh } from './locales/zh';
import { DEFAULT_LANGUAGE, getLanguage, type Language } from './languages';

export type { Language, LanguagePreference, LanguageInfo } from './languages';
export type { MessageKey } from './locales/en';
export {
  LANGUAGES,
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  detectSystemLanguage,
  getLanguage,
  getLanguageDir,
  getLanguageInfo,
  isLanguage,
  normalizeLanguageTag,
  persistLanguagePreference,
  readLanguagePreference,
  resolveLanguage,
  setCurrentLanguage
} from './languages';

/** Yer tutucu değerleri: dizi ({0}) veya nesne ({message}) */
export type TranslateVars =
  | Record<string, string | number>
  | readonly (string | number | undefined)[];

export const DICTIONARIES: Record<Language, Record<MessageKey, string>> = {
  tr,
  en,
  de,
  fr,
  es,
  ar,
  zh
};

/**
 * Belirtilen dilde çeviri döndürür.
 * Anahtar bulunamazsa İngilizceye, o da yoksa anahtar adına düşer.
 */
export function translate(language: Language, key: MessageKey, vars?: TranslateVars): string {
  const dictionary = DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];
  let text = dictionary[key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? String(key);

  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = (vars as Record<string, unknown>)[name];
      return value === undefined || value === null ? match : String(value);
    });
  }

  return text;
}

/** Aktif dilde çeviri (React dışından da çağrılabilir). */
export function t(key: MessageKey, vars?: TranslateVars): string {
  return translate(getLanguage(), key, vars);
}

/** Eksik anahtar denetimi (geliştirme sırasında kullanışlı). */
export function getMissingKeys(language: Language): MessageKey[] {
  const dictionary = DICTIONARIES[language];
  if (!dictionary) return Object.keys(en) as MessageKey[];
  return (Object.keys(en) as MessageKey[]).filter((key) => !dictionary[key]);
}
