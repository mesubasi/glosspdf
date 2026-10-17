import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.glosspdf',
  appName: 'GlossPDF',
  webDir: 'dist-mobile',
  android: {
    // Şifreli/yerel PDF'ler için karışık içerik gerekmez; varsayılanlar güvenli
    allowMixedContent: false
  }
};

export default config;
