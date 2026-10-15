import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../build/icon.ico'))
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../public/logo.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    title: 'GlossPDF - Sleek Desktop PDF Workstation',
    icon: iconPath,
    backgroundColor: '#525659',
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, 'preload.cjs'))
        ? path.join(__dirname, 'preload.cjs')
        : path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // Geliştirme veya üretim ortamı yükleme yolu
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Windows Başlık Çubuğu Menüsü (Standart sade menü)
  mainWindow.removeMenu();
}

// Uygulama hazır olduğunda pencere oluştur
app.whenReady().then(() => {
  createWindow();

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
ipcMain.handle('dialog:openPdf', async () => {
  if (!mainWindow) return { success: false, error: 'Pencere bulunamadı' };

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'PDF Dosyası Aç',
    filters: [{ name: 'PDF Dosyaları (*.pdf)', extensions: ['pdf'] }],
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
    let resolvedPath = targetPath;

    // Eğer dosya belirtilen yolda doğrudan bulunamazsa kullanıcı dizinlerinde ara
    if (!fs.existsSync(resolvedPath)) {
      const base = path.basename(targetPath);
      const searchDirs = [
        app.getPath('desktop'),
        app.getPath('downloads'),
        app.getPath('documents'),
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
ipcMain.handle('dialog:savePdfAs', async (_event, { defaultName, base64Data }: { defaultName: string; base64Data: string }) => {
  if (!mainWindow) return { success: false, error: 'Pencere bulunamadı' };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'PDF Dosyasını Farklı Kaydet',
    defaultPath: defaultName || 'Belge.pdf',
    filters: [{ name: 'PDF Dosyaları (*.pdf)', extensions: ['pdf'] }]
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
          console.error('Yazdırma hatası:', failureReason);
        }
        resolve(success);
      }
    );
  });
});
