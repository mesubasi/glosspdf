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
  setHasUnsaved: (hasUnsaved: boolean) => void;
  confirmClose: () => void;
  onCloseRequested: (callback: () => void) => () => void;
  getVersion: () => Promise<string>;
  getUpdateState: () => Promise<UpdateState & { autoDownload: boolean }>;
  setAutoDownload: (autoDownload: boolean) => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  openReleases: () => Promise<void>;
  onUpdateState: (callback: (state: UpdateState) => void) => () => void;
}

export interface UpdateState {
  status: 'unsupported' | 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

