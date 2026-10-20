import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';

/**
 * Preload çıktısı ve temizlenmesi gereken eski dosyalar.
 *
 * `preload.es.js`, `preload.js` ve `preload.mjs` bu projede ÜRETİLMEZ; eski
 * (bozuk) derlemelerden kalan artıklardır. `preload.js` özellikle tehlikelidir:
 * `package.json` "type": "module" olduğu için ESM olarak yorumlanır ve
 * `require` kullanan içerik yüklenemez.
 */
const PRELOAD_CJS_FILE = 'preload.cjs';
const STALE_PRELOAD_FILES = [PRELOAD_CJS_FILE, 'preload.es.js', 'preload.js', 'preload.mjs'];

function preloadBuildGuard(): Plugin {
  let outDir = path.resolve(__dirname, 'dist-electron');
  let isWatchBuild = false;

  return {
    name: 'glosspdf:preload-guard',
    enforce: 'pre',
    configResolved(config) {
      outDir = path.resolve(config.root || __dirname, config.build.outDir || 'dist-electron');
      isWatchBuild = Boolean(config.build.watch);

      // Önceki derlemelerden kalan preload çıktılarını temizle: eski bir
      // `preload.js` (ESM) kalırsa Electron yanlışlıkla onu yükleyebilir.
      for (const file of STALE_PRELOAD_FILES) {
        fs.rmSync(path.join(outDir, file), { force: true });
      }
    },
    closeBundle() {
      // Watch (dev) derlemesinde her rebuild'de doğrulama yapmak izleyiciyi
      // gereksiz yere düşürebilir; yalnızca tek seferlik derlemede doğrula.
      if (isWatchBuild) return;

      const cjsPath = path.join(outDir, PRELOAD_CJS_FILE);
      if (!fs.existsSync(cjsPath)) {
        throw new Error(
          `[GlossPDF] Preload derlemesi ${PRELOAD_CJS_FILE} üretmedi. ` +
            'Dosya açma/kaydetme ve son açılan belgeler çalışmaz.'
        );
      }

      const code = fs.readFileSync(cjsPath, 'utf8');

      if (/^\s*(export|import)\s/m.test(code)) {
        throw new Error(
          `[GlossPDF] ${PRELOAD_CJS_FILE} içinde ESM sözdizimi var: preload derlemesi CJS yerine ESM üretmiş ` +
            '(muhtemelen preload ayarına yeniden `entry` eklenmiş ve varsayılan `formats: ["es"]` birleşmiş). ' +
            'Electron bu dosyayı yükleyemez; dosya açma/kaydetme çalışmaz.'
        );
      }
      if (!/exposeInMainWorld\(\s*['"]electronAPI['"]\s*,/.test(code)) {
        throw new Error(
          `[GlossPDF] ${PRELOAD_CJS_FILE} electronAPI köprüsünü dışa aktarmıyor; preload bozuk.`
        );
      }
      try {
        // Sözdizimi kontrolü (ESM artığı kalırsa burada patlar)
        new Function(code);
      } catch (error: any) {
        throw new Error(`[GlossPDF] ${PRELOAD_CJS_FILE} geçersiz JavaScript: ${error?.message || error}`);
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            emptyOutDir: false,
            rolldownOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        // DİKKAT: `entry` burada BİLEREK verilmiyor.
        //
        // vite-plugin-electron, `entry` verildiğinde kendi varsayılan lib tanımını
        // üretir (`lib.formats: ['es']`) ve bunu projedeki config ile
        // `mergeConfig` ile birleştirir. mergeConfig dizileri BİRLEŞTİRDİĞİ için
        // sonuç `formats: ['es', 'cjs']` olur; `fileName` ise tekil kaldığı için
        // her iki format da aynı dosyaya yazmaya çalışır. Eski yapılandırmada
        // ikisi de `preload.cjs` döndürüyordu ve aynı dosyaya paralel yazım
        // nedeniyle `dist-electron/preload.cjs` içinde `export default ...` gibi
        // ESM artıkları kalıyordu. Bozuk preload yüklenemediği için renderer'da
        // `window.electronAPI` hiç oluşmuyor ve "Son Açılan Belgeler" tıklaması
        // sessizce tarayıcı dosya seçiciye düşüyordu.
        //
        // `entry` verilmeyince varsayılan lib tanımı hiç oluşmaz; aşağıdaki lib
        // tanımı tek başına geçerli olur ve yalnızca `preload.cjs` üretilir.
        entry: undefined,
        onstart(options) {
          options.reload();
        },
        vite: {
          // Preload alt derlemesine özel eklenti (vite-plugin-electron alt
          // derlemeleri `configFile: false` ile çalıştırdığı için kök config'deki
          // eklentiler bu derlemede geçerli olmaz).
          plugins: [preloadBuildGuard()],
          build: {
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => PRELOAD_CJS_FILE
            },
            outDir: 'dist-electron',
            emptyOutDir: false,
            // Preload küçük; okunabilir kalsın ve gereksiz dönüşüm yapılmasın
            minify: false,
            target: 'node18',
            rolldownOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                exports: 'none'
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Tam sürüm (1.2 MB) esbuild'in geçici dosya yoluna düşüyor ve Windows'ta
      // "Erişim engellendi" ile derlemeyi düşürüyor; min sürüm 1 MB'ın altında kalır.
      '@pdf-lib/fontkit': path.resolve(__dirname, 'node_modules/@pdf-lib/fontkit/dist/fontkit.es.min.js')
    }
  },
  // Ön derlenince worker'ın ?url içe aktarımı bozuluyor; pdf.js zaten ESM
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  server: {
    port: 5173
  }
});
