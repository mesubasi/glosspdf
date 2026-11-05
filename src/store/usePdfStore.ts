import { create } from 'zustand';
import { PdfEditService, docEditsOf } from '../services/pdfEditService';
import { ActiveTool, AnnotationItem, BookmarkItem, DocMetadata, LeftSidebarTab, PdfTab, SearchMatch, UndoSnapshot } from '../types/pdf';
import { t } from '../i18n';
import {
  LANGUAGES,
  getLanguage,
  persistLanguagePreference,
  readLanguagePreference,
  resolveLanguage,
  setCurrentLanguage,
  type Language,
  type LanguagePreference
} from '../i18n/languages';

// Acrobat standardı zoom kademeleri
export const ZOOM_LEVELS = [
  0.0833, 0.125, 0.25, 0.3333, 0.5, 0.6667, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0
];

export const MAX_ZOOM = 8.0;

interface PdfStoreState {
  tabs: PdfTab[];
  activeTabId: string | null;
  activeTool: ActiveTool;
  leftSidebarTab: LeftSidebarTab;
  rightPanelOpen: boolean;
  theme: 'light' | 'dark';
  /** Etkin dil (sistem dili algılaması veya kullanıcı tercihi ile çözülür) */
  language: Language;
  /** Kullanıcı tercihi: 'system' = bilgisayarın dilini izle */
  languagePreference: LanguagePreference;
  searchBarOpen: boolean;
  searchQuery: string;
  searchMatchCase: boolean;
  setSearchMatchCase: (matchCase: boolean) => void;
  searchResults: SearchMatch[];
  currentSearchIndex: number;
  isFullScreen: boolean;
  /** Sayfa görünümü: tek sayfa ya da yan yana iki sayfa (kapak sayfası ayrı durabilir) */
  pageLayout: 'single' | 'two';
  showCoverPage: boolean;
  setPageLayout: (layout: 'single' | 'two') => void;
  setShowCoverPage: (show: boolean) => void;
  /** Yerleştirilmeyi bekleyen imza (Adobe "Fill & Sign" tarzı: önce oluştur, sonra sayfada tıkla) */
  pendingSignature: { dataUrl: string; aspect: number; isImage?: boolean } | null;
  setPendingSignature: (sig: { dataUrl: string; aspect: number; isImage?: boolean } | null) => void;
  /** Geri alınabilir bir değişiklik öncesi anlık görüntü al (sürükleme gibi sürekli düzenlemeler için) */
  pushUndoSnapshot: () => void;
  passwordModalOpen: boolean;
  passwordCallback: ((pw: string) => void) | null;

  // Faz 2: İşaretleme (Annotation) Durumu
  annotationModeOpen: boolean;
  annotationColor: string;
  annotationStrokeWidth: number;
  highlightOpacity: number;
  annotationFontSize: number;
  selectedAnnotationId: string | null;

  // Faz 3: Modallar (Organize, Merge, Split, Watermark, Signature)
  organizeModalOpen: boolean;
  mergeModalOpen: boolean;
  splitModalOpen: boolean;
  watermarkModalOpen: boolean;
  signatureModalOpen: boolean;

  // Faz 4: İleri Düzey Modallar (Protect, InsertImage, ExportImages, Compress)
  protectModalOpen: boolean;
  insertImageModalOpen: boolean;
  exportImagesModalOpen: boolean;
  compressModalOpen: boolean;
  convertModalOpen: boolean;
  documentPropertiesModalOpen: boolean;
  /** URL'lerden bağlantı oluştur / web bağlantılarını kaldır penceresi (null: kapalı) */
  webLinksModalOpen: 'create' | 'remove' | null;

  // Eylemler (Actions)
  addTab: (tab: PdfTab) => void;
  closeTab: (tabId: string) => void;
  /** Sekmeyi kapatır; kaydedilmemiş değişiklik varsa önce kullanıcıya sorar */
  requestCloseTab: (tabId: string) => void;
  /** Pencere kapanırken kaydedilmemiş sekmeleri sırayla sorar; hepsi bitince pencereyi kapatır */
  requestCloseWindow: () => void;
  /** Onay bekleyen sekmeler; closeWindow: sıra bitince pencere de kapanır */
  closeRequest: { tabIds: string[]; closeWindow: boolean } | null;
  setCloseRequest: (request: { tabIds: string[]; closeWindow: boolean } | null) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<PdfTab>) => void;
  setCurrentPage: (pageNumber: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
  setActiveTool: (tool: ActiveTool) => void;
  setLeftSidebarTab: (tab: LeftSidebarTab) => void;
  toggleRightPanel: () => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  setLanguagePreference: (preference: LanguagePreference) => void;
  setSearchBarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchMatch[]) => void;
  nextSearchResult: () => void;
  prevSearchResult: () => void;
  setIsFullScreen: (full: boolean) => void;
  toggleFullScreen: () => void;
  openPasswordModal: (callback: (pw: string) => void) => void;
  closePasswordModal: () => void;

  // Faz 2 Eylemleri
  setAnnotationModeOpen: (open: boolean) => void;
  setAnnotationColor: (color: string) => void;
  setAnnotationStrokeWidth: (width: number) => void;
  setHighlightOpacity: (opacity: number) => void;
  setAnnotationFontSize: (size: number) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  addAnnotation: (annotation: AnnotationItem) => void;
  /** Birden çok işaretlemeyi tek geri al adımıyla ekler/siler (ör. URL'lerden bağlantı oluşturma) */
  addAnnotations: (annotations: AnnotationItem[]) => void;
  deleteAnnotation: (annotationId: string) => void;
  deleteAnnotations: (annotationIds: string[]) => void;
  /** Etkin sekmenin yer imi ağacını değiştirir (geri alınabilir; kayıtta /Outlines baştan yazılır) */
  setOutline: (outline: BookmarkItem[]) => void;
  /** Etkin sekmenin metadata'sını değiştirir (geri alınabilir; kayıtta yazılır) */
  setMetadata: (metadata: DocMetadata) => void;
  updateAnnotation: (annotationId: string, updates: Partial<AnnotationItem>) => void;
  undo: () => void;
  redo: () => void;

  // Faz 3 Eylemleri
  setOrganizeModalOpen: (open: boolean) => void;
  setMergeModalOpen: (open: boolean) => void;
  setSplitModalOpen: (open: boolean) => void;
  setWatermarkModalOpen: (open: boolean) => void;
  setSignatureModalOpen: (open: boolean) => void;

  // Faz 4 Eylemleri
  setProtectModalOpen: (open: boolean) => void;
  setInsertImageModalOpen: (open: boolean) => void;
  setExportImagesModalOpen: (open: boolean) => void;
  setCompressModalOpen: (open: boolean) => void;
  setConvertModalOpen: (open: boolean) => void;
  setDocumentPropertiesModalOpen: (open: boolean) => void;
  setWebLinksModalOpen: (mode: 'create' | 'remove' | null) => void;

  // Son Açılan Belgeler (Recent Files) & Kısayol Yardım Modalı
  recentFiles: { filePath: string; fileName: string; lastOpened: number }[];
  addRecentFile: (file: { filePath: string; fileName: string }) => void;
  removeRecentFile: (filePath: string) => void;
  clearRecentFiles: () => void;
  shortcutHelpModalOpen: boolean;
  setShortcutHelpModalOpen: (open: boolean) => void;
  updateModalOpen: boolean;
  setUpdateModalOpen: (open: boolean) => void;
}

// Tema başlangıç durumunu tespit etme
function getInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('glosspdf_theme');
    if (saved === 'light' || saved === 'dark') {
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return saved;
    }
  } catch {}

  // Kayıtlı tercih yoksa sistem görünümü izlenir (HIG)
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', !!prefersDark);
  }
  return prefersDark ? 'dark' : 'light';
}

function getInitialRecentFiles(): { filePath: string; fileName: string; lastOpened: number }[] {
  try {
    const saved = localStorage.getItem('glosspdf_recent_files');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/** Geri al yığını için sekmenin geri alınabilir durumu */
const snapshotOf = (tab: PdfTab): UndoSnapshot => ({
  annotations: tab.annotations || [],
  outline: tab.outline,
  outlineModified: tab.outlineModified,
  metadata: tab.metadata
});

/** Etkin sekmede geri alınabilir bir değişiklik: önceki durum yığına girer, yinele yığını boşalır */
function commitEdit(updates: Partial<PdfTab>) {
  const { activeTabId, tabs, updateTab } = usePdfStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return;
  updateTab(tab.id, {
    ...updates,
    undoStack: [...(tab.undoStack || []), snapshotOf(tab)],
    redoStack: [],
    isModified: true
  });
}

/** Geri al / yinele: from yığınının son adımı uygulanır, mevcut durum to yığınına girer */
function stepHistory(from: 'undoStack' | 'redoStack', to: 'undoStack' | 'redoStack') {
  const { activeTabId, tabs, updateTab } = usePdfStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  const stack = tab?.[from];
  if (!tab || !stack || stack.length === 0) return;
  updateTab(tab.id, {
    ...stack[stack.length - 1],
    [from]: stack.slice(0, -1),
    [to]: [...(tab[to] || []), snapshotOf(tab)],
    isModified: true
  });
  usePdfStore.setState({ selectedAnnotationId: null });
}

let isRotating = false;

/**
 * Döndürme gerçek bir belge düzenlemesidir: bekleyen işaretlemeler önce sayfaya yazılır,
 * sonra tüm sayfaların /Rotate değeri değişir. (Eskiden yalnızca görünüm döndürülüyor ve
 * kayıtta kayboluyordu; işaretlemeler de döndürülmüş görünümde yanlış yere biniyordu.)
 */
async function rotateActiveDocument(clockwise: boolean) {
  const { activeTabId, tabs, updateTab } = usePdfStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab || isRotating) return;
  isRotating = true;
  try {
    const baked = await PdfEditService.savePdfWithAnnotations(tab.data.slice(), tab.annotations || [], tab.importedAnnotations, docEditsOf(tab));
    const data = await PdfEditService.rotateAllPages(baked, clockwise);
    updateTab(tab.id, {
      data,
      rotation: 0,
      annotations: [],
      importedAnnotations: undefined,
      undoStack: [],
      redoStack: [],
      isModified: true,
      pageDimensions: tab.pageDimensions.map((d) => ({
        ...d,
        width: d.height,
        height: d.width,
        originalWidth: d.originalHeight,
        originalHeight: d.originalWidth
      }))
    });
  } catch (err: any) {
    console.error('Rotate failed:', err);
    alert(t('error_generic', { message: err?.message || String(err) }));
  } finally {
    isRotating = false;
  }
}

export const usePdfStore = create<PdfStoreState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  activeTool: 'select',
  leftSidebarTab: 'thumbnails',
  rightPanelOpen: false,
  theme: getInitialTheme(),
  language: getLanguage(),
  languagePreference: readLanguagePreference(),
  searchBarOpen: false,
  searchQuery: '',
  searchMatchCase: false,
  searchResults: [],
  currentSearchIndex: 0,
  isFullScreen: false,
  pageLayout: 'single',
  showCoverPage: false,
  pendingSignature: null,
  passwordModalOpen: false,
  passwordCallback: null,

  recentFiles: getInitialRecentFiles(),
  shortcutHelpModalOpen: false,
  updateModalOpen: false,
  closeRequest: null,

  annotationModeOpen: false,
  annotationColor: '#ffeb3b', // Varsayılan fosforlu sarı
  annotationStrokeWidth: 2,
  highlightOpacity: 0.35,
  annotationFontSize: 14,
  selectedAnnotationId: null,

  organizeModalOpen: false,
  mergeModalOpen: false,
  splitModalOpen: false,
  watermarkModalOpen: false,
  signatureModalOpen: false,

  protectModalOpen: false,
  insertImageModalOpen: false,
  exportImagesModalOpen: false,
  compressModalOpen: false,
  convertModalOpen: false,
  documentPropertiesModalOpen: false,
  webLinksModalOpen: null,

  addTab: (newTab) => {
    set((state) => {
      const existing = state.tabs.find((t) => t.filePath === newTab.filePath);
      if (existing) {
        return { activeTabId: existing.id };
      }
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id
      };
    });
  },

  closeTab: (tabId) => {
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        newActiveId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      // Son belge kapanınca düzenleme modları da kapanır; araç düğmeleri belge yokken devre dışıdır
      const resetEditing = remaining.length === 0
        ? { annotationModeOpen: false, activeTool: 'select' as const, pendingSignature: null, selectedAnnotationId: null }
        : {};
      return {
        tabs: remaining,
        activeTabId: newActiveId,
        ...resetEditing
      };
    });
  },

  // Soru sırasındaki sekme etkin yapılır: kaydet işlemleri etkin sekme üzerinde çalışır
  requestCloseTab: (tabId) => {
    const tab = get().tabs.find((tab) => tab.id === tabId);
    if (tab?.isModified) set({ closeRequest: { tabIds: [tabId], closeWindow: false }, activeTabId: tabId });
    else get().closeTab(tabId);
  },

  requestCloseWindow: () => {
    const tabIds = get().tabs.filter((tab) => tab.isModified).map((tab) => tab.id);
    if (tabIds.length === 0) {
      window.electronAPI?.confirmClose();
      return;
    }
    set({ closeRequest: { tabIds, closeWindow: true }, activeTabId: tabIds[0] });
  },

  setCloseRequest: (request) => set({ closeRequest: request }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTab: (tabId, updates) => {
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))
    }));
  },

  setCurrentPage: (pageNumber) => {
    const { activeTabId, updateTab, tabs } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const validPage = Math.max(1, Math.min(pageNumber, tab.numPages));
    updateTab(activeTabId, { currentPage: validPage });
  },

  setZoom: (zoom) => {
    const { activeTabId, updateTab } = get();
    if (!activeTabId) return;
    // Min %8.33, Max %800 (daha büyüğünde canvas bellek sınırını aşar ve sayfa boş kalır)
    const clampedZoom = Math.max(0.0833, Math.min(MAX_ZOOM, zoom));
    updateTab(activeTabId, { zoom: clampedZoom });
  },

  zoomIn: () => {
    const { activeTabId, tabs, setZoom } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const currentZoom = tab.zoom;
    const nextLevel = ZOOM_LEVELS.find((lvl) => lvl > currentZoom + 0.01);
    if (nextLevel) {
      setZoom(nextLevel);
    } else {
      setZoom(Math.min(MAX_ZOOM, currentZoom * 1.25));
    }
  },

  zoomOut: () => {
    const { activeTabId, tabs, setZoom } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const currentZoom = tab.zoom;
    const prevLevels = ZOOM_LEVELS.filter((lvl) => lvl < currentZoom - 0.01);
    if (prevLevels.length > 0) {
      setZoom(prevLevels[prevLevels.length - 1]);
    } else {
      setZoom(Math.max(0.0833, currentZoom / 1.25));
    }
  },

  rotateClockwise: () => void rotateActiveDocument(true),

  rotateCounterClockwise: () => void rotateActiveDocument(false),

  setActiveTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      pendingSignature: tool === 'signature' ? state.pendingSignature : null
    })),

  setPendingSignature: (sig) => set({ pendingSignature: sig }),

  pushUndoSnapshot: () => {
    const { activeTabId, tabs, updateTab } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    updateTab(tab.id, {
      undoStack: [...(tab.undoStack || []), snapshotOf(tab)],
      redoStack: []
    });
  },

  setLeftSidebarTab: (tab) => set({ leftSidebarTab: tab }),

  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  toggleTheme: () =>
    set(() => {
      const isCurrentlyDark = document.documentElement.classList.contains('dark');
      const nextTheme = isCurrentlyDark ? 'light' : 'dark';
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      try {
        localStorage.setItem('glosspdf_theme', nextTheme);
      } catch {}
      return { theme: nextTheme };
    }),

  // Sıradaki dile geç (kısayol / hızlı değiştirme için)
  toggleLanguage: () =>
    set((state) => {
      const currentIndex = LANGUAGES.findIndex((l) => l.code === state.language);
      const nextLang = LANGUAGES[(currentIndex + 1) % LANGUAGES.length].code;
      persistLanguagePreference(nextLang);
      setCurrentLanguage(nextLang);
      return { language: nextLang, languagePreference: nextLang };
    }),

  // Dil tercihini ayarla ('system' = bilgisayarın dilini izle)
  setLanguagePreference: (preference) =>
    set(() => {
      const resolved = resolveLanguage(preference);
      persistLanguagePreference(preference);
      setCurrentLanguage(resolved);
      return { language: resolved, languagePreference: preference };
    }),

  setSearchBarOpen: (open) =>
    set({
      searchBarOpen: open,
      searchQuery: open ? get().searchQuery : '',
      searchResults: open ? get().searchResults : []
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchMatchCase: (matchCase) => set({ searchMatchCase: matchCase }),

  setSearchResults: (results) => set({ searchResults: results, currentSearchIndex: 0 }),

  nextSearchResult: () => {
    const { searchResults, currentSearchIndex } = get();
    if (searchResults.length === 0) return;
    const nextIdx = (currentSearchIndex + 1) % searchResults.length;
    set({ currentSearchIndex: nextIdx });
  },

  prevSearchResult: () => {
    const { searchResults, currentSearchIndex } = get();
    if (searchResults.length === 0) return;
    const prevIdx =
      (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    set({ currentSearchIndex: prevIdx });
  },

  setIsFullScreen: (full) => set({ isFullScreen: full }),
  // isFullScreen aşağıdaki dinleyicilerden güncellenir
  toggleFullScreen: () => {
    // macOS masaüstü: gerçek tam ekran yerine ekranı doldur (trafik ışıkları görünür kalır)
    const fillScreen = window.electronAPI?.toggleFillScreen;
    if (fillScreen) {
      fillScreen();
    } else if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  },
  setPageLayout: (layout) => set({ pageLayout: layout }),
  setShowCoverPage: (show) => set({ showCoverPage: show }),

  openPasswordModal: (callback) =>
    set({ passwordModalOpen: true, passwordCallback: callback }),

  closePasswordModal: () => set({ passwordModalOpen: false, passwordCallback: null }),

  // Faz 2 Eylemleri
  setAnnotationModeOpen: (open) => set({ annotationModeOpen: open }),

  setAnnotationColor: (color) => set({ annotationColor: color }),

  setAnnotationStrokeWidth: (width) => set({ annotationStrokeWidth: width }),
  setHighlightOpacity: (opacity) => set({ highlightOpacity: opacity }),

  setAnnotationFontSize: (size) => set({ annotationFontSize: size }),

  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),

  addAnnotation: (annotation) => get().addAnnotations([annotation]),

  addAnnotations: (annotations) => {
    const tab = get().tabs.find((t) => t.id === get().activeTabId);
    if (tab && annotations.length > 0) commitEdit({ annotations: [...(tab.annotations || []), ...annotations] });
  },

  deleteAnnotation: (annotationId) => get().deleteAnnotations([annotationId]),

  deleteAnnotations: (annotationIds) => {
    const tab = get().tabs.find((t) => t.id === get().activeTabId);
    if (!tab || annotationIds.length === 0) return;
    const ids = new Set(annotationIds);
    commitEdit({ annotations: (tab.annotations || []).filter((a) => !ids.has(a.id)) });
    set({ selectedAnnotationId: null });
  },

  setOutline: (outline) => commitEdit({ outline, outlineModified: true }),

  setMetadata: (metadata) => commitEdit({ metadata }),

  updateAnnotation: (annotationId, updates) => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const newAnnotations = (tab.annotations || []).map((a) =>
      a.id === annotationId ? { ...a, ...updates } : a
    );

    updateTab(activeTabId, {
      annotations: newAnnotations,
      isModified: true
    });
  },

  undo: () => stepHistory('undoStack', 'redoStack'),

  redo: () => stepHistory('redoStack', 'undoStack'),

  // Faz 3 Eylemleri
  setOrganizeModalOpen: (open) => set({ organizeModalOpen: open }),
  setMergeModalOpen: (open) => set({ mergeModalOpen: open }),
  setSplitModalOpen: (open) => set({ splitModalOpen: open }),
  setWatermarkModalOpen: (open) => set({ watermarkModalOpen: open }),
  setSignatureModalOpen: (open: boolean) => set({ signatureModalOpen: open }),

  // Faz 4 Eylemleri
  setProtectModalOpen: (open) => set({ protectModalOpen: open }),
  setInsertImageModalOpen: (open) => set({ insertImageModalOpen: open }),
  setExportImagesModalOpen: (open) => set({ exportImagesModalOpen: open }),
  setCompressModalOpen: (open) => set({ compressModalOpen: open }),
  setConvertModalOpen: (open) => set({ convertModalOpen: open }),
  setDocumentPropertiesModalOpen: (open) => set({ documentPropertiesModalOpen: open }),
  setWebLinksModalOpen: (mode) => set({ webLinksModalOpen: mode }),

  // Son Açılan Belgeler & Kısayol Yardım Eylemleri
  addRecentFile: (file) => {
    set((state) => {
      const filtered = state.recentFiles.filter((f) => f.filePath !== file.filePath);
      const updated = [{ ...file, lastOpened: Date.now() }, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('glosspdf_recent_files', JSON.stringify(updated));
      } catch {}
      return { recentFiles: updated };
    });
  },

  removeRecentFile: (filePath) => {
    set((state) => {
      const updated = state.recentFiles.filter((f) => f.filePath !== filePath);
      try {
        localStorage.setItem('glosspdf_recent_files', JSON.stringify(updated));
      } catch {}
      return { recentFiles: updated };
    });
  },

  clearRecentFiles: () => {
    try {
      localStorage.removeItem('glosspdf_recent_files');
    } catch {}
    set({ recentFiles: [] });
  },

  setShortcutHelpModalOpen: (open) => set({ shortcutHelpModalOpen: open }),
  setUpdateModalOpen: (open) => set({ updateModalOpen: open })
}));

// Tam ekrandan Esc, yeşil düğme ya da ⌃⌘F ile de çıkılır; durum yalnızca uygulamanın düğmesine bağlı kalırsa
// macOS'ta üst çubuk trafik ışıklarına yer açmaz ve menü onların altında kalır
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () =>
    usePdfStore.getState().setIsFullScreen(!!document.fullscreenElement)
  );
  window.electronAPI?.onFillScreenChange?.((filled) => usePdfStore.getState().setIsFullScreen(filled));
}
