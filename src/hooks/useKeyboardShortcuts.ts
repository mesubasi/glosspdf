import { useEffect } from 'react';
import { usePdfStore } from '../store/usePdfStore';

interface ShortcutOptions {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onPrint: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
}

export function useKeyboardShortcuts({
  onOpenFile,
  onSaveFile,
  onSaveFileAs,
  onPrint,
  onFitPage,
  onFitWidth
}: ShortcutOptions) {
  const {
    activeTabId,
    requestCloseTab,
    zoomIn,
    zoomOut,
    setZoom,
    rotateClockwise,
    rotateCounterClockwise,
    setSearchBarOpen,
    searchBarOpen,
    nextSearchResult,
    prevSearchResult,
    isFullScreen,
    setIsFullScreen,
    undo,
    redo,
    selectedAnnotationId,
    deleteAnnotation,
    shortcutHelpModalOpen,
    setShortcutHelpModalOpen,
    activeTool,
    setActiveTool
  } = usePdfStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isInputActive =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Ctrl + O: Dosya Aç
      if (isCtrl && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        onOpenFile();
        return;
      }

      // Ctrl + S: Kaydet / Ctrl + Shift + S: Farklı Kaydet
      if (isCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (e.shiftKey) {
          onSaveFileAs();
        } else {
          onSaveFile();
        }
        return;
      }

      // Ctrl + P: Yazdır
      if (isCtrl && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        onPrint();
        return;
      }

      // Ctrl + W: Sekmeyi Kapat
      if (isCtrl && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault();
        if (activeTabId) {
          requestCloseTab(activeTabId);
        }
        return;
      }

      // Ctrl + F: Ara
      if (isCtrl && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchBarOpen(!searchBarOpen);
        return;
      }

      // Ctrl + Z: Geri Al (Undo)
      if (isCtrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (!isInputActive) {
          e.preventDefault();
          undo();
          return;
        }
      }

      // Ctrl + Y veya Ctrl + Shift + Z: İleri Al (Redo)
      if (
        (isCtrl && (e.key === 'y' || e.key === 'Y')) ||
        (isCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        if (!isInputActive) {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Delete: Seçili Annotation'ı sil
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedAnnotationId) {
          e.preventDefault();
          deleteAnnotation(selectedAnnotationId);
          return;
        }
      }

      // F3 veya Enter: Arama Sonraki / Shift+F3: Arama Önceki
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          prevSearchResult();
        } else {
          nextSearchResult();
        }
        return;
      }

      // Zoom Kısayolları
      if (isCtrl) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          zoomIn();
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          zoomOut();
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          onFitPage();
          return;
        }
        if (e.key === '1') {
          e.preventDefault();
          setZoom(1.0); // %100 Gerçek boyut
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          onFitWidth();
          return;
        }
      }

      // Döndürme Kısayolları
      if (isCtrl && e.shiftKey) {
        if (e.key === 'r' || e.key === 'R' || e.key === '+') {
          e.preventDefault();
          rotateClockwise();
          return;
        }
        if (e.key === 'l' || e.key === 'L' || e.key === '-') {
          e.preventDefault();
          rotateCounterClockwise();
          return;
        }
      }

      // Tam Ekran
      if ((isCtrl && (e.key === 'l' || e.key === 'L')) || e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => setIsFullScreen(true));
        } else {
          document.exitFullscreen().then(() => setIsFullScreen(false));
        }
        return;
      }

      // F1: Kısayol Yardım Penceresi
      if (e.key === 'F1') {
        e.preventDefault();
        setShortcutHelpModalOpen(!shortcutHelpModalOpen);
        return;
      }

      // Escape: imza yerleştirme / metin düzenleme aracından çık
      if (e.key === 'Escape' && (activeTool === 'signature' || activeTool === 'edittext')) {
        e.preventDefault();
        setActiveTool('select');
        return;
      }

      // Escape: Kısayol Yardımını Kapat
      if (e.key === 'Escape' && shortcutHelpModalOpen) {
        e.preventDefault();
        setShortcutHelpModalOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTabId,
    requestCloseTab,
    zoomIn,
    zoomOut,
    setZoom,
    rotateClockwise,
    rotateCounterClockwise,
    searchBarOpen,
    setSearchBarOpen,
    nextSearchResult,
    prevSearchResult,
    onOpenFile,
    onSaveFile,
    onSaveFileAs,
    onPrint,
    onFitPage,
    onFitWidth,
    isFullScreen,
    setIsFullScreen,
    undo,
    redo,
    selectedAnnotationId,
    deleteAnnotation,
    activeTool,
    setActiveTool,
    shortcutHelpModalOpen,
    setShortcutHelpModalOpen
  ]);
}
