export interface BookmarkItem {
  title: string;
  pageNumber: number;
  children?: BookmarkItem[];
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
  | 'textedit'; // Mevcut PDF metninin üzerine yazılan düzenleme

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
  annotations: AnnotationItem[];
  undoStack: AnnotationItem[][];
  redoStack: AnnotationItem[][];
  pageDimensions: PageDimension[];
}

export type LeftSidebarTab = 'thumbnails' | 'bookmarks' | 'annotations' | 'search' | null;
