export interface OpenPdfResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  data?: string; // Base64
  error?: string;
}

export interface SavePdfResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface IElectronAPI {
  /** locale: yerel diyalog başlıklarının dili (örn. 'tr', 'de') */
  openPdf: (locale?: string) => Promise<OpenPdfResult>;
  readFile: (filePath: string) => Promise<OpenPdfResult>;
  getPathForFile?: (file: File) => string;
  savePdf: (filePath: string, base64Data: string) => Promise<SavePdfResult>;
  savePdfAs: (defaultName: string, base64Data: string, locale?: string) => Promise<SavePdfResult>;
  print: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

