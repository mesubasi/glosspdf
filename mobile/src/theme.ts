import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'glosspdf_mobile_theme';
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Depolama kapalı: sistem teması kullanılır
  }
  return 'system';
}

let preference = readThemePreference();

/** <html data-theme> ve Android durum/gezinme çubuğu simgelerinin rengi */
function apply() {
  const dark = preference === 'dark' || (preference === 'system' && !!media?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F0F12' : '#F2F2F5');
  if (Capacitor.isNativePlatform()) {
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
  }
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Kaydedilemese de bu oturumda uygulanır
  }
  apply();
}

/** Açılışta bir kez: kayıtlı tercihi uygular, "Sistem" seçiliyse cihaz değişikliğini izler */
export function initTheme() {
  apply();
  media?.addEventListener('change', () => preference === 'system' && apply());
}
