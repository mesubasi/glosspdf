/**
 * Desteklenen diller, dil tercihi ve sistem dili algılama.
 *
 * Bu modül bilinçli olarak React'ten ve store'dan bağımsızdır; hem store hem
 * `@/i18n` tarafından içe aktarılabilir (döngüsel import oluşmaz).
 */

export type Language = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar' | 'zh';

/** 'system' = bilgisayarın dilini kullan (varsayılan davranış) */
export type LanguagePreference = Language | 'system';

export interface LanguageInfo {
  code: Language;
  /** Dilin kendi dilindeki adı (menüde gösterilir) */
  nativeLabel: string;
  englishLabel: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'tr', nativeLabel: 'Türkçe', englishLabel: 'Turkish', dir: 'ltr' },
  { code: 'en', nativeLabel: 'English', englishLabel: 'English', dir: 'ltr' },
  { code: 'de', nativeLabel: 'Deutsch', englishLabel: 'German', dir: 'ltr' },
  { code: 'fr', nativeLabel: 'Français', englishLabel: 'French', dir: 'ltr' },
  { code: 'es', nativeLabel: 'Español', englishLabel: 'Spanish', dir: 'ltr' },
  { code: 'ar', nativeLabel: 'العربية', englishLabel: 'Arabic', dir: 'rtl' },
  { code: 'zh', nativeLabel: '简体中文', englishLabel: 'Chinese (Simplified)', dir: 'ltr' }
];

export const DEFAULT_LANGUAGE: Language = 'en';
export const LANGUAGE_CODES: Language[] = LANGUAGES.map((l) => l.code);
export const LANGUAGE_STORAGE_KEY = 'glosspdf_lang';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGE_CODES as string[]).includes(value);
}

export function getLanguageInfo(code: Language): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[1];
}

export function getLanguageDir(code: Language): 'ltr' | 'rtl' {
  return getLanguageInfo(code).dir;
}

/**
 * 'tr-TR', 'zh_CN', 'zh-Hans-CN', 'ar-EG' gibi etiketleri desteklenen dile indirger.
 * Desteklenmiyorsa null döner.
 */
export function normalizeLanguageTag(tag: string | null | undefined): Language | null {
  if (!tag) return null;
  const base = tag.toLowerCase().replace(/_/g, '-').split('-')[0];
  if (base === 'zh') return 'zh';
  if (base === 'ar') return 'ar';
  if (base === 'iw') return 'ar'; // eski İbranice/Arapça kodu
  return isLanguage(base) ? base : null;
}

/** Kullanıcının kayıtlı tercihi (yoksa 'system' = bilgisayarın dili) */
export function readLanguagePreference(): LanguagePreference {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'system') return 'system';
    if (isLanguage(saved)) return saved;
  } catch {}
  return 'system';
}

export function persistLanguagePreference(preference: LanguagePreference): void {
  try {
    if (preference === 'system') {
      localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    } else {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
    }
  } catch {}
}

/**
 * Bilgisayarın / işletim sisteminin dilini algılar.
 *
 * Öncelik sırası:
 *  1) Electron ana sürecinin pencere URL'ine eklediği `?lang=` (en kesin kaynak:
 *     app.getPreferredSystemLanguages() ile OS ayarından gelir)
 *  2) navigator.languages / navigator.language (tarayıcı & dev sunucusu)
 *  3) İngilizce
 */
export function detectSystemLanguage(): Language {
  try {
    if (typeof location !== 'undefined' && location.search) {
      const fromMain = new URLSearchParams(location.search).get('lang');
      const normalized = normalizeLanguageTag(fromMain);
      if (normalized) return normalized;
    }
  } catch {}

  try {
    const candidates: string[] =
      typeof navigator !== 'undefined'
        ? [...(navigator.languages ?? []), navigator.language].filter(Boolean)
        : [];

    for (const candidate of candidates) {
      const normalized = normalizeLanguageTag(candidate);
      if (normalized) return normalized;
    }
  } catch {}

  return DEFAULT_LANGUAGE;
}

export function resolveLanguage(preference: LanguagePreference): Language {
  return preference === 'system' ? detectSystemLanguage() : preference;
}

/** <html lang=".." dir=".."> özniteliklerini günceller */
export function applyDocumentLanguage(language: Language): void {
  try {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = getLanguageDir(language);
  } catch {}
}

// --- Geçerli dil (React dışından da erişilebilir tekil kaynak) ---
let currentLanguage: Language = resolveLanguage(readLanguagePreference());

export function getLanguage(): Language {
  return currentLanguage;
}

export function setCurrentLanguage(language: Language): void {
  currentLanguage = language;
  applyDocumentLanguage(language);
}

// Modül yüklenirken <html lang/dir> doğru olsun
applyDocumentLanguage(currentLanguage);
