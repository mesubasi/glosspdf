import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Android (Capacitor) arayüzü: masaüstü yapılandırmasından ayrı, Electron eklentisiz.
// public/ klasörü (pdf.worker, yazı tipleri) masaüstüyle paylaşılır.
export default defineConfig({
  root: path.resolve(__dirname, 'mobile'),
  publicDir: path.resolve(__dirname, 'public'),
  // Capacitor WebView'ı dosyaları göreli yoldan yükler
  base: './',
  plugins: [react()],
  css: { postcss: __dirname },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') }, // masaüstüyle paylaşılan servisler
      { find: '~', replacement: path.resolve(__dirname, './mobile/src') },
      // esbuild ~1 MB üstü parçaları Windows geçici klasöründe silemeyip derlemeyi düşürüyor
      // ("Erişim engellendi"); küçültülmüş dağıtımlar ve ayrı parçalar sınırın altında kalır.
      { find: '@pdf-lib/fontkit', replacement: path.resolve(__dirname, 'node_modules/@pdf-lib/fontkit/dist/fontkit.es.min.js') },
      { find: /^pdf-lib$/, replacement: path.resolve(__dirname, 'node_modules/pdf-lib/dist/pdf-lib.esm.min.js') }
    ]
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-mobile'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('fontkit')) return 'fontkit';
          if (id.includes('pdf-lib-encrypt')) return 'pdf-lib-encrypt';
          if (id.includes('pdf-lib')) return 'pdf-lib';
        }
      }
    }
  },
  server: { port: 5174 }
});
