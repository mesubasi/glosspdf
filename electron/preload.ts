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

  // Farklı Kaydetme (locale: diyalog başlıklarının dili)
  savePdfAs: (defaultName: string, base64Data: string, locale?: string) =>
    ipcRenderer.invoke('dialog:savePdfAs', { defaultName, base64Data, locale }),

  // Belgeyi Yazdırma
  print: () => ipcRenderer.invoke('app:print'),

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
