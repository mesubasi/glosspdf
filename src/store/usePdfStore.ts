import { create } from 'zustand';
import { ActiveTool, AnnotationItem, LeftSidebarTab, PdfTab, SearchMatch } from '../types/pdf';

// Acrobat standardı zoom kademeleri
export const ZOOM_LEVELS = [
  0.0833, 0.125, 0.25, 0.3333, 0.5, 0.6667, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0
];

interface PdfStoreState {
  tabs: PdfTab[];
  activeTabId: string | null;
  activeTool: ActiveTool;
  leftSidebarTab: LeftSidebarTab;
  rightPanelOpen: boolean;
  theme: 'light' | 'dark';
  language: 'tr' | 'en';
  searchBarOpen: boolean;
  searchQuery: string;
  searchResults: SearchMatch[];
  currentSearchIndex: number;
  isFullScreen: boolean;
  passwordModalOpen: boolean;
  passwordCallback: ((pw: string) => void) | null;

  // Faz 2: İşaretleme (Annotation) Durumu
  annotationModeOpen: boolean;
  annotationColor: string;
  annotationStrokeWidth: number;
  annotationFontSize: number;
  selectedAnnotationId: string | null;

  // Faz 3: Modallar (Organize, Merge, Split, Watermark, Signature)
  organizeModalOpen: boolean;
  mergeModalOpen: boolean;
  splitModalOpen: boolean;
  watermarkModalOpen: boolean;
  signatureModalOpen: boolean;

  // Eylemler (Actions)
  addTab: (tab: PdfTab) => void;
  closeTab: (tabId: string) => void;
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
  setSearchBarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchMatch[]) => void;
  nextSearchResult: () => void;
  prevSearchResult: () => void;
  setIsFullScreen: (full: boolean) => void;
  openPasswordModal: (callback: (pw: string) => void) => void;
  closePasswordModal: () => void;

  // Faz 2 Eylemleri
  setAnnotationModeOpen: (open: boolean) => void;
  setAnnotationColor: (color: string) => void;
  setAnnotationStrokeWidth: (width: number) => void;
  setAnnotationFontSize: (size: number) => void;
  setSelectedAnnotationId: (id: string | null) => void;
  addAnnotation: (annotation: AnnotationItem) => void;
  deleteAnnotation: (annotationId: string) => void;
  updateAnnotation: (annotationId: string, updates: Partial<AnnotationItem>) => void;
  undo: () => void;
  redo: () => void;

  // Faz 3 Eylemleri
  setOrganizeModalOpen: (open: boolean) => void;
  setMergeModalOpen: (open: boolean) => void;
  setSplitModalOpen: (open: boolean) => void;
  setWatermarkModalOpen: (open: boolean) => void;
  setSignatureModalOpen: (open: boolean) => void;
}

// Bilgisayar / İşletim sistemi dilini tespit etme fonksiyonu
function getInitialLanguage(): 'tr' | 'en' {
  try {
    const saved = localStorage.getItem('glosspdf_lang');
    if (saved === 'tr' || saved === 'en') return saved;

    const sysLang = (
      navigator.language ||
      (navigator as any).userLanguage ||
      ''
    ).toLowerCase();

    if (sysLang.startsWith('tr')) {
      return 'tr';
    }
  } catch {
    // SSR veya localStorage engeli durumunda fallback
  }
  return 'en';
}

export const usePdfStore = create<PdfStoreState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  activeTool: 'select',
  leftSidebarTab: 'thumbnails',
  rightPanelOpen: false,
  theme: 'dark',
  language: getInitialLanguage(),
  searchBarOpen: false,
  searchQuery: '',
  searchResults: [],
  currentSearchIndex: 0,
  isFullScreen: false,
  passwordModalOpen: false,
  passwordCallback: null,

  annotationModeOpen: false,
  annotationColor: '#ffeb3b', // Varsayılan fosforlu sarı
  annotationStrokeWidth: 2,
  annotationFontSize: 14,
  selectedAnnotationId: null,

  organizeModalOpen: false,
  mergeModalOpen: false,
  splitModalOpen: false,
  watermarkModalOpen: false,
  signatureModalOpen: false,

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
      return {
        tabs: remaining,
        activeTabId: newActiveId
      };
    });
  },

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
    // Min %8.33, Max %6400 (Acrobat standart sınırları)
    const clampedZoom = Math.max(0.0833, Math.min(64.0, zoom));
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
      setZoom(Math.min(64.0, currentZoom * 1.25));
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

  rotateClockwise: () => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const nextRotation = (tab.rotation + 90) % 360;
    updateTab(activeTabId, { rotation: nextRotation, isModified: true });
  },

  rotateCounterClockwise: () => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const nextRotation = (tab.rotation - 90 + 360) % 360;
    updateTab(activeTabId, { rotation: nextRotation, isModified: true });
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

  setLeftSidebarTab: (tab) => set({ leftSidebarTab: tab }),

  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: nextTheme };
    }),

  toggleLanguage: () =>
    set((state) => {
      const nextLang = state.language === 'tr' ? 'en' : 'tr';
      try {
        localStorage.setItem('glosspdf_lang', nextLang);
      } catch {}
      return { language: nextLang };
    }),

  setSearchBarOpen: (open) =>
    set({
      searchBarOpen: open,
      searchQuery: open ? get().searchQuery : '',
      searchResults: open ? get().searchResults : []
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

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

  openPasswordModal: (callback) =>
    set({ passwordModalOpen: true, passwordCallback: callback }),

  closePasswordModal: () => set({ passwordModalOpen: false, passwordCallback: null }),

  // Faz 2 Eylemleri
  setAnnotationModeOpen: (open) => set({ annotationModeOpen: open }),

  setAnnotationColor: (color) => set({ annotationColor: color }),

  setAnnotationStrokeWidth: (width) => set({ annotationStrokeWidth: width }),

  setAnnotationFontSize: (size) => set({ annotationFontSize: size }),

  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),

  addAnnotation: (annotation) => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const currentAnnots = tab.annotations || [];
    const newUndoStack = [...(tab.undoStack || []), currentAnnots];
    const newAnnotations = [...currentAnnots, annotation];

    updateTab(activeTabId, {
      annotations: newAnnotations,
      undoStack: newUndoStack,
      redoStack: [],
      isModified: true
    });
  },

  deleteAnnotation: (annotationId) => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const currentAnnots = tab.annotations || [];
    const newUndoStack = [...(tab.undoStack || []), currentAnnots];
    const newAnnotations = currentAnnots.filter((a) => a.id !== annotationId);

    updateTab(activeTabId, {
      annotations: newAnnotations,
      undoStack: newUndoStack,
      redoStack: [],
      isModified: true
    });
    set({ selectedAnnotationId: null });
  },

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

  undo: () => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.undoStack || tab.undoStack.length === 0) return;

    const previousAnnots = tab.undoStack[tab.undoStack.length - 1];
    const newUndoStack = tab.undoStack.slice(0, -1);
    const newRedoStack = [...(tab.redoStack || []), tab.annotations || []];

    updateTab(activeTabId, {
      annotations: previousAnnots,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      isModified: true
    });
    set({ selectedAnnotationId: null });
  },

  redo: () => {
    const { activeTabId, tabs, updateTab } = get();
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.redoStack || tab.redoStack.length === 0) return;

    const nextAnnots = tab.redoStack[tab.redoStack.length - 1];
    const newRedoStack = tab.redoStack.slice(0, -1);
    const newUndoStack = [...(tab.undoStack || []), tab.annotations || []];

    updateTab(activeTabId, {
      annotations: nextAnnots,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      isModified: true
    });
    set({ selectedAnnotationId: null });
  },

  // Faz 3 Eylemleri
  setOrganizeModalOpen: (open) => set({ organizeModalOpen: open }),
  setMergeModalOpen: (open) => set({ mergeModalOpen: open }),
  setSplitModalOpen: (open) => set({ splitModalOpen: open }),
  setWatermarkModalOpen: (open) => set({ watermarkModalOpen: open }),
  setSignatureModalOpen: (open: boolean) => set({ signatureModalOpen: open })
}));
