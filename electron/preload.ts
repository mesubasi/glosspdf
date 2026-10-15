// @ts-ignore
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const electronAPI = {
  // PDF Dosyası Seçme ve Açma
  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),

  // Belirli Bir Yoldaki Dosyayı Okuma
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),

  // Sürüklenen dosyanın yerel tam yolunu alma (Electron 28+)
  getPathForFile: (file: File) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {
      console.warn('getPathForFile hatası:', e);
    }
    return (file as any).path || file.name;
  },

  // Mevcut Dosya Üzerine Kaydetme
  savePdf: (filePath: string, base64Data: string) =>
    ipcRenderer.invoke('dialog:savePdf', { filePath, base64Data }),

  // Farklı Kaydetme
  savePdfAs: (defaultName: string, base64Data: string) =>
    ipcRenderer.invoke('dialog:savePdfAs', { defaultName, base64Data }),

  // Belgeyi Yazdırma
  print: () => ipcRenderer.invoke('app:print')
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
