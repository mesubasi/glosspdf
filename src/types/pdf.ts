export interface BookmarkItem {
  title: string;
  pageNumber: number;
  /** Sayfa içi hedef: /XYZ hedefindeki üst kenar (PDF kullanıcı uzayı, alttan yukarı nokta). Yoksa sayfanın başı. */
  top?: number;
  children?: BookmarkItem[];
}

/** Belge Özellikleri'nde düzenlenebilen metadata alanları (Info sözlüğü + varsa XMP) */
export interface DocMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

/** Geri al/yinele adımı: işaretlemeler, yer imleri ve metadata birlikte geri döner */
export interface UndoSnapshot {
  annotations: AnnotationItem[];
  outline: BookmarkItem[];
  outlineModified?: boolean;
  metadata?: DocMetadata;
}

export interface SearchMatch {
  id: string;
  pageIndex: number;
  matchIndex: number;
  text: string;
}

export interface PageDimension {
  pageNumber: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'note'
  | 'draw'
  | 'rect'
  | 'text'
  | 'signature' // Yerleştirilmiş imza görseli (Adobe "Fill & Sign" tarzı)
  | 'redact' // Karartma: kaydederken altındaki içerik dosyadan kalıcı olarak silinir
  | 'textedit' // Mevcut PDF metninin üzerine yazılan düzenleme
  | 'link'; // Bağlantı alanı: linkUrl (dış adres) ya da linkPage (belge içi sayfa)

export type ActiveTool =
  | 'select'
  | 'hand'
  | 'edittext' // Mevcut PDF metnini düzenleme aracı
  | AnnotationType;

export interface AnnotationItem {
  id: string;
  pageNumber: number;
  type: AnnotationType;
  color: string; // Hex renk (#ffeb3b, #4caf50 vb.)
  opacity?: number;
  strokeWidth?: number; // Çizgi ve kenarlık kalınlığı
  fontSize?: number; // Metin boyutu
  contents?: string; // Not/yorum veya metin kutusu içeriği
  imageData?: string; // İmza PNG'si (data URL)
  originalText?: string; // 'textedit': düzenlenmeden önceki metin
  bgColor?: string; // 'textedit': eski metni örten arka plan rengi
  linkUrl?: string; // 'link': dış adres (yalnızca http, https, mailto)
  linkPage?: number; // 'link': belge içi hedef sayfa (1 tabanlı)
  sourceRef?: string; // Dosyada zaten olan işaretlemenin pdf.js kimliği (ör. "12R"); kayıtta değişmediyse yerinde kalır
  rect?: [number, number, number, number]; // [x, y, width, height] (72 DPI PDF noktası cinsinden)
  points?: { x: number; y: number }[]; // Serbest çizim için nokta koordinatları (72 DPI)
  createdAt: string;
  author?: string;
}

export interface PdfTab {
  id: string;
  filePath: string;
  fileName: string;
  data: Uint8Array;
  numPages: number;
  currentPage: number;
  zoom: number; // 1.0 = %100
  rotation: number; // 0, 90, 180, 270
  isModified: boolean;
  outline: BookmarkItem[];
  /** Yer imleri dosyadakinden farklı: kayıtta /Outlines baştan yazılır */
  outlineModified?: boolean;
  /** Bekleyen metadata düzenlemesi; undefined ise dosyadakine dokunulmaz */
  metadata?: DocMetadata;
  annotations: AnnotationItem[];
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];
  importedAnnotations?: AnnotationItem[]; // Dosyadan içe alınan işaretlemelerin ilk hâli (değişeni/sileneni bulmak için)
  pageDimensions: PageDimension[];
}

export type LeftSidebarTab = 'thumbnails' | 'bookmarks' | 'annotations' | 'search' | null;
