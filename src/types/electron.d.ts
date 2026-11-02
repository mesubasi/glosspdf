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

export interface PickFolderResult {
  success: boolean;
  canceled?: boolean;
  folderPath?: string;
  error?: string;
}

export interface IElectronAPI {
  /** locale: yerel diyalog başlıklarının dili (örn. 'tr', 'de') */
  openPdf: (locale?: string) => Promise<OpenPdfResult>;
  readFile: (filePath: string) => Promise<OpenPdfResult>;
  getPathForFile?: (file: File) => string;
  savePdf: (filePath: string, base64Data: string) => Promise<SavePdfResult>;
  /** extension: kayıt penceresinin dosya türü süzgeci (varsayılan "pdf"; ör. "docx") */
  savePdfAs: (defaultName: string, base64Data: string, locale?: string, extension?: string) => Promise<SavePdfResult>;
  /** Kaynak belgenin klasörü (gerçek bir yolsa), değilse Belgeler klasörü */
  getDefaultSaveDir: (sourcePath?: string) => Promise<string>;
  pickFolder: (defaultPath?: string, locale?: string) => Promise<PickFolderResult>;
  /** onConflict 'rename' ise mevcut dosyanın üzerine yazılmaz, "ad (2).pdf" kullanılır */
  writeFileTo: (
    dir: string,
    fileName: string,
    base64Data: string,
    onConflict?: 'overwrite' | 'rename'
  ) => Promise<SavePdfResult>;
  showItemInFolder: (targetPath: string) => Promise<boolean>;
  print: () => Promise<boolean>;
  setHasUnsaved: (hasUnsaved: boolean) => void;
  confirmClose: () => void;
  onCloseRequested: (callback: () => void) => () => void;
  takePendingFiles: () => Promise<string[]>;
  onOpenFile: (callback: (filePath: string) => void) => () => void;
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

