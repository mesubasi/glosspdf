// @ts-ignore
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const electronAPI = {
  // PDF Dosyası Seçme ve Açma (locale: diyalog başlıklarının dili)
  openPdf: (locale?: string) => ipcRenderer.invoke('dialog:openPdf', locale),

  // Belirli Bir Yoldaki Dosyayı Okuma
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),

  // Sürüklenen dosyanın yerel tam yolunu alma (Electron 28+)
  getPathForFile: (file: File) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {
      console.warn('getPathForFile failed:', e);
    }
    return (file as any).path || file.name;
  },

  // Mevcut Dosya Üzerine Kaydetme
  savePdf: (filePath: string, base64Data: string) =>
    ipcRenderer.invoke('dialog:savePdf', { filePath, base64Data }),

  // Farklı Kaydetme (locale: diyalog başlıklarının dili, extension: pdf dışı çıktılar için)
  savePdfAs: (defaultName: string, base64Data: string, locale?: string, extension?: string) =>
    ipcRenderer.invoke('dialog:savePdfAs', { defaultName, base64Data, locale, extension }),

  // Araç çıktıları: varsayılan klasör, klasör seçme, yazma ve klasörde gösterme
  getDefaultSaveDir: (sourcePath?: string) => ipcRenderer.invoke('fs:getDefaultSaveDir', sourcePath),
  pickFolder: (defaultPath?: string, locale?: string) =>
    ipcRenderer.invoke('dialog:pickFolder', { defaultPath, locale }),
  writeFileTo: (dir: string, fileName: string, base64Data: string, onConflict?: 'overwrite' | 'rename') =>
    ipcRenderer.invoke('fs:writeFileTo', { dir, fileName, base64Data, onConflict }),
  showItemInFolder: (targetPath: string) => ipcRenderer.invoke('shell:showItemInFolder', targetPath),

  // Belgeyi Yazdırma
  print: () => ipcRenderer.invoke('app:print'),

  // Kaydedilmemiş değişiklik bildirimi ve pencere kapatma onayı
  setHasUnsaved: (hasUnsaved: boolean) => ipcRenderer.send('app:setHasUnsaved', hasUnsaved),
  confirmClose: () => ipcRenderer.send('app:confirmClose'),
  // Kullanıcı pencereyi kapatmak istediğinde (kaydedilmemiş değişiklik varken) tetiklenir
  onCloseRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:close-requested', listener);
    return () => ipcRenderer.removeListener('app:close-requested', listener);
  },

  // İşletim sisteminden açılması istenen PDF'ler (çift tıklama / Birlikte aç)
  takePendingFiles: () => ipcRenderer.invoke('app:takePendingFiles'),
  onOpenFile: (callback: (filePath: string) => void) => {
    const listener = (_event: unknown, filePath: string) => callback(filePath);
    ipcRenderer.on('app:open-file', listener);
    return () => ipcRenderer.removeListener('app:open-file', listener);
  },

  // Pencere yerel tam ekrana girip çıktığında (macOS yeşil düğme)
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => {
    const listener = (_event: unknown, isFullScreen: boolean) => callback(isFullScreen);
    ipcRenderer.on('window:fullscreen', listener);
    return () => ipcRenderer.removeListener('window:fullscreen', listener);
  },

  // Sürüm ve Güncellemeler
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getUpdateState: () => ipcRenderer.invoke('updater:getState'),
  setAutoDownload: (autoDownload: boolean) => ipcRenderer.invoke('updater:setAutoDownload', autoDownload),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  openReleases: () => ipcRenderer.invoke('updater:openReleases'),
  // Durum değişikliklerini dinler; aboneliği bırakan fonksiyon döner
  onUpdateState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on('updater:state', listener);
    return () => ipcRenderer.removeListener('updater:state', listener);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
