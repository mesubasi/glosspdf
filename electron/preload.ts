// @ts-ignore
const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // PDF Dosyası Seçme ve Açma
  openPdf: () => ipcRenderer.invoke('dialog:openPdf'),

  // Belirli Bir Yoldaki Dosyayı Okuma
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),

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
