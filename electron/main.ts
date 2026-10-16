import { app, BrowserWindow, ipcMain, dialog, Notification, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import updater from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

/** Desteklenen diller (src/i18n/languages.ts ile aynı liste) */
const SUPPORTED_LANGUAGES = ['tr', 'en', 'de', 'fr', 'es', 'ar', 'zh'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Yerel diyalog metinleri (işletim sistemi pencereleri için) */
const DIALOG_TEXTS: Record<
  SupportedLanguage,
  {
    openTitle: string;
    saveAsTitle: string;
    pdfFilter: string;
    noWindow: string;
    noPath: string;
    updateTitle: string;
    updateBody: string;
    updateAvailableTitle: string;
    updateAvailableBody: string;
  }
> = {
  tr: {
    openTitle: 'PDF Dosyası Aç',
    saveAsTitle: 'PDF Dosyasını Farklı Kaydet',
    pdfFilter: 'PDF Dosyaları',
    noWindow: 'Pencere bulunamadı',
    noPath: 'Dosya yolu belirtilmedi',
    updateTitle: 'Güncelleme hazır',
    updateBody: '{appName} {version} indirildi; uygulama kapanınca kurulacak.',
    updateAvailableTitle: 'Güncelleme mevcut',
    updateAvailableBody: '{version} sürümü indirilmeye hazır. İndirmek için Güncellemeleri kontrol et düğmesini kullanın.'
  },
  en: {
    openTitle: 'Open PDF File',
    saveAsTitle: 'Save PDF As',
    pdfFilter: 'PDF Files',
    noWindow: 'Window not found',
    noPath: 'No file path provided',
    updateTitle: 'Update ready',
    updateBody: '{appName} {version} has been downloaded and will be installed when you quit.',
    updateAvailableTitle: 'Update available',
    updateAvailableBody: 'Version {version} is ready to download. Use the Check for updates button to get it.'
  },
  de: {
    openTitle: 'PDF-Datei öffnen',
    saveAsTitle: 'PDF speichern unter',
    pdfFilter: 'PDF-Dateien',
    noWindow: 'Fenster nicht gefunden',
    noPath: 'Kein Dateipfad angegeben',
    updateTitle: 'Update bereit',
    updateBody: '{appName} {version} wurde heruntergeladen und wird beim Beenden installiert.',
    updateAvailableTitle: 'Update verfügbar',
    updateAvailableBody: 'Version {version} kann heruntergeladen werden. Verwenden Sie dazu „Nach Updates suchen“.'
  },
  fr: {
    openTitle: 'Ouvrir un fichier PDF',
    saveAsTitle: 'Enregistrer le PDF sous',
    pdfFilter: 'Fichiers PDF',
    noWindow: 'Fenêtre introuvable',
    noPath: 'Aucun chemin de fichier fourni',
    updateTitle: 'Mise à jour prête',
    updateBody: '{appName} {version} a été téléchargé et sera installé à la fermeture.',
    updateAvailableTitle: 'Mise à jour disponible',
    updateAvailableBody: 'La version {version} est prête à être téléchargée. Utilisez le bouton Rechercher des mises à jour.'
  },
  es: {
    openTitle: 'Abrir archivo PDF',
    saveAsTitle: 'Guardar PDF como',
    pdfFilter: 'Archivos PDF',
    noWindow: 'Ventana no encontrada',
    noPath: 'No se proporcionó ninguna ruta de archivo',
    updateTitle: 'Actualización lista',
    updateBody: '{appName} {version} se ha descargado y se instalará al cerrar.',
    updateAvailableTitle: 'Actualización disponible',
    updateAvailableBody: 'La versión {version} está lista para descargarse. Usa el botón Buscar actualizaciones.'
  },
  ar: {
    openTitle: 'فتح ملف PDF',
    saveAsTitle: 'حفظ PDF باسم',
    pdfFilter: 'ملفات PDF',
    noWindow: 'لم يتم العثور على النافذة',
    noPath: 'لم يتم تحديد مسار الملف',
    updateTitle: 'التحديث جاهز',
    updateBody: 'تم تنزيل {appName} {version} وسيتم تثبيته عند الإغلاق.',
    updateAvailableTitle: 'يتوفر تحديث',
    updateAvailableBody: 'الإصدار {version} جاهز للتنزيل. استخدم زر التحقق من التحديثات.'
  },
  zh: {
    openTitle: '打开 PDF 文件',
    saveAsTitle: 'PDF 另存为',
    pdfFilter: 'PDF 文件',
    noWindow: '未找到窗口',
    noPath: '未提供文件路径',
    updateTitle: '更新已就绪',
    updateBody: '{appName} {version} 已下载，将在退出时安装。',
    updateAvailableTitle: '有可用更新',
    updateAvailableBody: '版本 {version} 可供下载。请使用“检查更新”按钮获取。'
  }
};

/** 'tr-TR' / 'zh_CN' gibi etiketleri desteklenen dile indirger */
function normalizeLanguage(tag: string | null | undefined): SupportedLanguage {
  if (!tag) return 'en';
  const base = tag.toLowerCase().replace(/_/g, '-').split('-')[0];
  if (base === 'zh' || base === 'ar') return base;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : 'en';
}

/**
 * Bilgisayarın dilini algılar: önce işletim sisteminin tercih ettiği diller,
 * sonra Electron'un yerel ayarı, en son İngilizce.
 */
function detectSystemLanguage(): SupportedLanguage {
  try {
    for (const tag of app.getPreferredSystemLanguages() ?? []) {
      const normalized = normalizeLanguage(tag);
      if (normalized !== 'en' || tag.toLowerCase().startsWith('en')) return normalized;
    }
  } catch {}

  try {
    return normalizeLanguage(app.getLocale());
  } catch {}

  return 'en';
}

/** Renderer'dan gelen dil kodunu doğrular (geçersizse sistem dili) */
function resolveDialogLanguage(locale?: string): SupportedLanguage {
  if (locale && (SUPPORTED_LANGUAGES as readonly string[]).includes(locale)) {
    return locale as SupportedLanguage;
  }
  return detectSystemLanguage();
}

function dialogTexts(locale?: string) {
  return DIALOG_TEXTS[resolveDialogLanguage(locale)];
}

/**
 * Preload betiğini çözer.
 *
 * `preload.cjs` (CommonJS) tercih edilir: `package.json` "type": "module" olduğu
 * için `.js` uzantılı bir preload ESM olarak yorumlanır ve `require` kullanan
 * içerik yüklenemez. Bu yüzden tek geçerli çıktı `preload.cjs`'tir.
 */
function resolvePreloadPath(): string {
  const candidates = ['preload.cjs', 'preload.js'].map((file) => path.join(__dirname, file));
  const existing = candidates.find((candidate) => fs.existsSync(candidate));

  if (!existing) {
    console.error(
      `[GlossPDF] Preload betiği bulunamadı. Beklenen konum: ${candidates[0]}. ` +
        'Uygulamayı yeniden derleyin (npm run build). Bu dosya olmadan dosya açma/kaydetme gibi ' +
        'masaüstü özellikleri çalışmaz.'
    );
    return candidates[0];
  }

  return existing;
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../build/icon.ico'))
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../public/logo.png');

  const preloadPath = resolvePreloadPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'GlossPDF - Sleek Desktop PDF Workstation',
    icon: iconPath,
    backgroundColor: '#525659',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Preload yüklenemezse sessizce devam etme: nedeni konsola yaz
  mainWindow.webContents.on('preload-error', (_event, failedPath, error) => {
    console.error(`[GlossPDF] Preload yüklenemedi (${failedPath}):`, error);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // Geliştirme veya üretim ortamı yükleme yolu
  // Sistem dili pencereye ?lang=... olarak aktarılır: renderer, kullanıcı bir
  // tercih kaydetmemişse arayüzü bilgisayarın dilinde açar.
  const systemLanguage = detectSystemLanguage();

  if (process.env.VITE_DEV_SERVER_URL) {
    const url = new URL(process.env.VITE_DEV_SERVER_URL);
    url.searchParams.set('lang', systemLanguage);
    mainWindow.loadURL(url.toString());
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { lang: systemLanguage }
    });
  }

  // Windows Başlık Çubuğu Menüsü (Standart sade menü)
  mainWindow.removeMenu();
}

/**
 * GitHub Releases üzerinden güncelleme. Kullanıcı "otomatik indir" (varsayılan) ile
 * "sorarak indir" arasında seçim yapar; tercih userData/update-settings.json'da tutulur.
 * Geliştirme modunda ve portable sürümde (yerinde güncellenemez) devre dışıdır.
 */
const { autoUpdater } = updater;
const updatesSupported = () => app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR;
const updateSettingsPath = () => path.join(app.getPath('userData'), 'update-settings.json');

type UpdateState = {
  status: 'unsupported' | 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
};
let updateState: UpdateState = { status: 'idle' };

function setUpdateState(state: UpdateState) {
  updateState = state;
  mainWindow?.webContents.send('updater:state', state);
}

function readAutoDownload(): boolean {
  try {
    return JSON.parse(fs.readFileSync(updateSettingsPath(), 'utf8')).autoDownload !== false;
  } catch {
    return true;
  }
}

function setupUpdater() {
  if (!updatesSupported()) {
    updateState = { status: 'unsupported' };
    return;
  }

  autoUpdater.autoDownload = readAutoDownload();
  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking' }));
  autoUpdater.on('update-not-available', () => setUpdateState({ status: 'not-available' }));
  autoUpdater.on('update-available', (info) =>
    setUpdateState({ status: autoUpdater.autoDownload ? 'downloading' : 'available', version: info.version })
  );
  autoUpdater.on('download-progress', (progress) =>
    setUpdateState({ status: 'downloading', version: updateState.version, percent: Math.round(progress.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => setUpdateState({ status: 'downloaded', version: info.version }));
  // Dinleyicisiz 'error' olayı süreci çökertir; ağ yokken veya imzasız macOS'ta sadece logla
  autoUpdater.on('error', (error) => {
    console.error('[GlossPDF] Güncelleme hatası:', error);
    setUpdateState({ status: 'error' });
  });

  // Açılışta sessiz kontrol: otomatik modda indirip bildirir, sorarak modda yalnızca haber verir
  const texts = dialogTexts();
  autoUpdater
    .checkForUpdatesAndNotify({ title: texts.updateTitle, body: texts.updateBody })
    .then((result) => {
      if (result?.isUpdateAvailable && !autoUpdater.autoDownload && Notification.isSupported()) {
        new Notification({
          title: texts.updateAvailableTitle,
          body: texts.updateAvailableBody.replace('{version}', result.updateInfo.version)
        }).show();
      }
    })
    .catch((error) => console.error('[GlossPDF] Güncelleme kontrolü başarısız:', error));
}

ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('updater:getState', () => ({ ...updateState, autoDownload: readAutoDownload() }));
ipcMain.handle('updater:setAutoDownload', async (_event, autoDownload: boolean) => {
  await fs.promises.writeFile(updateSettingsPath(), JSON.stringify({ autoDownload: autoDownload === true }));
  autoUpdater.autoDownload = autoDownload === true;
});
ipcMain.handle('updater:check', async () => {
  if (!updatesSupported()) return;
  // Hata 'error' olayıyla duruma yansır; burada yutulur
  await autoUpdater.checkForUpdates().catch(() => {});
});
ipcMain.handle('updater:download', async () => {
  if (updateState.status !== 'available') return;
  setUpdateState({ status: 'downloading', version: updateState.version, percent: 0 });
  await autoUpdater.downloadUpdate().catch(() => {});
});
ipcMain.handle('updater:install', () => {
  if (updateState.status === 'downloaded') autoUpdater.quitAndInstall();
});
ipcMain.handle('updater:openReleases', () => shell.openExternal('https://github.com/mesubasi/glosspdf/releases/latest'));

// Uygulama hazır olduğunda pencere oluştur
app.whenReady().then(() => {
  createWindow();
  setupUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Dosya Açma Diyaloğu
ipcMain.handle('dialog:openPdf', async (_event, locale?: string) => {
  const texts = dialogTexts(locale);
  if (!mainWindow) return { success: false, error: texts.noWindow };

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: texts.openTitle,
    filters: [{ name: `${texts.pdfFilter} (*.pdf)`, extensions: ['pdf'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const targetPath = filePaths[0];
  try {
    const fileBuffer = await fs.promises.readFile(targetPath);
    const fileName = path.basename(targetPath);
    return {
      success: true,
      filePath: targetPath,
      fileName,
      data: fileBuffer.toString('base64')
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// IPC: Verilen Yoldaki Dosyayı Oku (Sürükle-bırak veya son açılanlar için)
ipcMain.handle('fs:readFile', async (_event, targetPath: string) => {
  try {
    if (!targetPath) {
      return { success: false, error: 'Dosya yolu belirtilmedi' };
    }

    let resolvedPath = targetPath;

    // file:// protokolü varsa temizle
    if (resolvedPath.startsWith('file://')) {
      try {
        resolvedPath = fileURLToPath(resolvedPath);
      } catch {}
    }

    // URL kodlamalı karakterleri (örn. %20 -> boşluk) çöz
    if (resolvedPath.includes('%')) {
      try {
        resolvedPath = decodeURIComponent(resolvedPath);
      } catch {}
    }

    // Tırnak işaretlerini ve slaşları standartlaştır
    resolvedPath = path.normalize(resolvedPath.trim().replace(/^["']|["']$/g, ''));

    // Eğer dosya belirtilen yolda doğrudan bulunamazsa kullanıcı dizinlerinde ara
    if (!fs.existsSync(resolvedPath)) {
      const base = path.basename(resolvedPath);
      const searchDirs = [
        app.getPath('desktop'),
        app.getPath('downloads'),
        app.getPath('documents'),
        app.getPath('home'),
        process.cwd()
      ];

      for (const dir of searchDirs) {
        const candidate = path.join(dir, base);
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
          break;
        }
      }
    }

    const fileBuffer = await fs.promises.readFile(resolvedPath);
    const fileName = path.basename(resolvedPath);
    return {
      success: true,
      filePath: resolvedPath,
      fileName,
      data: fileBuffer.toString('base64')
    };
  } catch (error: any) {
    console.error('fs:readFile failed:', error);
    return { success: false, error: error.message };
  }
});

// IPC: Dosyayı Kaydet (Mevcut dosya üzerine yaz)
ipcMain.handle('dialog:savePdf', async (_event, { filePath, base64Data }: { filePath: string; base64Data: string }) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    return { success: true, filePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// IPC: Farklı Kaydet Diyaloğu
ipcMain.handle(
  'dialog:savePdfAs',
  async (_event, { defaultName, base64Data, locale }: { defaultName: string; base64Data: string; locale?: string }) => {
    const texts = dialogTexts(locale);
    if (!mainWindow) return { success: false, error: texts.noWindow };

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: texts.saveAsTitle,
      defaultPath: defaultName || 'Document.pdf',
      filters: [{ name: `${texts.pdfFilter} (*.pdf)`, extensions: ['pdf'] }]
    });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    const fileName = path.basename(filePath);
    return { success: true, filePath, fileName };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// IPC: Yazdırma
ipcMain.handle('app:print', async () => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow!.webContents.print(
      { silent: false, printBackground: true },
      (success, failureReason) => {
        if (!success) {
          console.error('Print failed:', failureReason);
        }
        resolve(success);
      }
    );
  });
});
