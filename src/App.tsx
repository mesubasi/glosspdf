import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePdfStore } from './store/usePdfStore';
import { PdfRenderService } from './services/pdfRenderService';
import { PdfEditService } from './services/pdfEditService';
import { TabBar } from './components/layout/TabBar';
import { HeaderToolbar } from './components/layout/HeaderToolbar';
import { AnnotationToolbar } from './components/annotations/AnnotationToolbar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightToolsPanel } from './components/layout/RightToolsPanel';
import { StatusBar } from './components/layout/StatusBar';
import { PdfDocumentViewer } from './components/pdf/PdfDocumentViewer';
import { PasswordModal } from './components/modals/PasswordModal';
import { OrganizePagesModal } from './components/modals/OrganizePagesModal';
import { MergePdfModal } from './components/modals/MergePdfModal';
import { SplitPdfModal } from './components/modals/SplitPdfModal';
import { WatermarkModal } from './components/modals/WatermarkModal';
import { SignatureModal } from './components/modals/SignatureModal';
import { InsertImageModal } from './components/modals/InsertImageModal';
import { ExportImagesModal } from './components/modals/ExportImagesModal';
import { ProtectPdfModal } from './components/modals/ProtectPdfModal';
import { CompressPdfModal } from './components/modals/CompressPdfModal';
import { ShortcutHelpModal } from './components/modals/ShortcutHelpModal';
import { UpdateModal } from './components/modals/UpdateModal';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import * as pdfjsLib from 'pdfjs-dist';
import type { PdfTab } from './types/pdf';
import { t } from '@/i18n';

/**
 * Oturum boyunca açılan belgelerin baytlarını bellekte tutar.
 *
 * "Son Açılan Belgeler" listesine tıklandığında dosya diskten okunamazsa
 * (dosya taşınmış/silinmiş ya da masaüstü köprüsü kullanılamıyor) belgeyi
 * yine de açabilmek için kullanılır. Böylece kullanıcıya istemediği halde
 * dosya seçici gösterilmez.
 */
type CachedFileBytes = { bytes: Uint8Array; fileName: string };

const sessionFileBytes = new Map<string, CachedFileBytes>();

function cacheFileBytes(filePath: string, fileName: string, bytes: Uint8Array) {
  const entry: CachedFileBytes = { bytes, fileName };
  if (filePath) sessionFileBytes.set(filePath, entry);
  if (fileName) sessionFileBytes.set(fileName, entry);
}

function getCachedFileBytes(filePath: string, fileName: string): CachedFileBytes | undefined {
  return sessionFileBytes.get(filePath) ?? sessionFileBytes.get(fileName);
}

/** IPC'den gelen base64 gövdesini baytlara çevirir. */
function base64ToBytes(base64Data: string): Uint8Array {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Kaydedilen baytlar işaretlemeleri zaten içerir. Bekleyen listeyi temizlemezsek bir sonraki
 * kayıtta aynı işaretlemeler dosyaya ikinci kez yazılır ve ekranda çift görünür.
 */
const SAVED_STATE: Partial<PdfTab> = { annotations: [], undoStack: [], redoStack: [] };

export function App() {
  const {
    tabs,
    activeTabId,
    addTab,
    setActiveTab,
    updateTab,
    setZoom,
    setCurrentPage,
    openPasswordModal,
    annotationModeOpen,
    addRecentFile,
    removeRecentFile,
    requestCloseWindow,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasUnsaved = tabs.some((tab) => tab.isModified);

  // Pencere kapatılırken kaydedilmemiş değişiklikleri sormak için ana sürece durumu bildir
  useEffect(() => {
    window.electronAPI?.setHasUnsaved(hasUnsaved);
  }, [hasUnsaved]);
  useEffect(() => window.electronAPI?.onCloseRequested(requestCloseWindow), [requestCloseWindow]);
  const [activePdfDoc, setActivePdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Masaüstü kabuğunda preload yüklenemediyse sessizce devam etme: konsola açıkça yaz.
  // (Preload yüklenmezse window.electronAPI oluşmaz ve dosya açma/kaydetme ile
  //  "Son Açılan Belgeler" tarayıcı davranışına düşer.)
  useEffect(() => {
    const isElectronShell = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
    if (isElectronShell && !window.electronAPI) {
      console.error(
        '[GlossPDF] window.electronAPI bulunamadı: preload betiği yüklenemedi. ' +
          'Dosya açma/kaydetme ve son açılan belgeler masaüstü yerine tarayıcı davranışına düşecek. ' +
          'Çözüm: dist-electron/preload.cjs dosyasını yeniden derleyin (npm run build).'
      );
    }
  }, []);

  // Sekme değiştiğinde aktif PDF belgesini yükle
  useEffect(() => {
    if (!activeTab) {
      setActivePdfDoc(null);
      return;
    }

    let isCancelled = false;

    // Her zaman slice() ile kopya gönder (ArrayBuffer detached olmasını önler)
    PdfRenderService.loadDocument(
      activeTab.data.slice(),
      (passwordCallback) => {
        openPasswordModal(passwordCallback);
      }
    )
      .then((doc) => {
        if (!isCancelled) {
          setActivePdfDoc(doc);
        }
      })
      .catch((err) => {
        console.error('Failed to load the PDF document:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTab?.id, activeTab?.data]);

  // Sayfaya Sığdır (Fit Page) Hesaplama Fonksiyonu
  const handleFitPage = useCallback(() => {
    if (!containerRef.current || !activeTab || activeTab.pageDimensions.length === 0) return;
    const container = containerRef.current;
    const padding = 64; // Kenar boşlukları ve kaydırma çubuğu payı
    const availableWidth = container.clientWidth - padding;
    const availableHeight = container.clientHeight - padding;

    const currentDim =
      activeTab.pageDimensions[activeTab.currentPage - 1] || activeTab.pageDimensions[0];
    const isRotated = activeTab.rotation === 90 || activeTab.rotation === 270;
    const pageWidth = isRotated ? currentDim.originalHeight : currentDim.originalWidth;
    const pageHeight = isRotated ? currentDim.originalWidth : currentDim.originalHeight;

    const scaleX = availableWidth / pageWidth;
    const scaleY = availableHeight / pageHeight;
    const optimalScale = Math.min(scaleX, scaleY);

    setZoom(parseFloat(optimalScale.toFixed(2)));
  }, [activeTab, setZoom]);

  // Genişliğe Sığdır (Fit Width) Hesaplama Fonksiyonu
  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !activeTab || activeTab.pageDimensions.length === 0) return;
    const container = containerRef.current;
    const padding = 48; // Kenar boşlukları
    const availableWidth = container.clientWidth - padding;

    const currentDim =
      activeTab.pageDimensions[activeTab.currentPage - 1] || activeTab.pageDimensions[0];
    const isRotated = activeTab.rotation === 90 || activeTab.rotation === 270;
    const pageWidth = isRotated ? currentDim.originalHeight : currentDim.originalWidth;

    const optimalScale = availableWidth / pageWidth;
    setZoom(parseFloat(optimalScale.toFixed(2)));
  }, [activeTab, setZoom]);

  // Yeni PDF Belgesini Açma ve State'e Aktarma
  const openNewPdf = async (filePath: string, fileName: string, rawBytes: Uint8Array) => {
    try {
      // Eğer bu dosya zaten sekmelerde açıksa doğrudan o sekmeye geç
      const existingTab = tabs.find(
        (t) => t.filePath === filePath || (t.fileName === fileName && t.filePath === filePath)
      );
      if (existingTab) {
        setActiveTab(existingTab.id);
        addRecentFile({ filePath: existingTab.filePath, fileName: existingTab.fileName });
        return;
      }

      // Store için bağımsız temiz kopya sakla
      const storeData = rawBytes.slice();
      // Yükleme için ayrı bir kopya ile belgeyi hazırla
      const doc = await PdfRenderService.loadDocument(rawBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(doc);
      const outline = await PdfRenderService.getDocumentOutline(doc);

      const tabId = `tab-${Date.now()}`;
      addTab({
        id: tabId,
        filePath,
        fileName,
        data: storeData,
        numPages: doc.numPages,
        currentPage: 1,
        zoom: 1.0,
        rotation: 0,
        isModified: false,
        outline,
        annotations: [],
        undoStack: [],
        redoStack: [],
        pageDimensions: dims
      });

      // Doğrudan açılan belgeyi aktif kıl
      setActivePdfDoc(doc);

      // Baytları oturum önbelleğine al (son açılanlar için yedek kaynak)
      cacheFileBytes(filePath, fileName, storeData);

      // Son açılanlar geçmişine kaydet
      addRecentFile({ filePath, fileName });
    } catch (err: any) {
      console.error('Failed to open PDF:', err);
      alert(t('error_opening_pdf', { message: err?.message || err }));
    }
  };

  // Son Açılan Belgeyi Açma
  // Önemli: Bu işlev HİÇBİR durumda "Dosya Aç" seçicisini kendiliğinden açmaz.
  // Sıra: açık sekme -> diskten doğrudan okuma -> oturum önbelleği -> bilgilendirme.
  const handleOpenRecentFile = async (filePath: string, fileName: string) => {
    // 1) Belge zaten bir sekmede açıksa doğrudan o sekmeye geç
    const existingTab = tabs.find((t) => t.filePath === filePath);
    if (existingTab) {
      setActiveTab(existingTab.id);
      addRecentFile({ filePath: existingTab.filePath, fileName: existingTab.fileName });
      return;
    }

    // 2) Masaüstü köprüsü varsa dosyayı yoldan doğrudan oku (kullanıcıya seçici gösterme)
    let desktopReadAttempted = false;
    let readError: string | null = null;

    const readFile = window.electronAPI?.readFile;
    if (typeof readFile === 'function') {
      desktopReadAttempted = true;
      try {
        const res = await readFile(filePath);
        if (res?.success && res.data) {
          await openNewPdf(
            res.filePath || filePath,
            res.fileName || fileName,
            base64ToBytes(res.data)
          );
          return;
        }
        readError = res?.error || 'Could not read the file';
      } catch (err: any) {
        readError = err?.message || String(err);
      }
    } else {
      readError = 'Desktop bridge (electronAPI) is unavailable';
    }

    // 3) Diskten okunamadıysa oturum önbelleğindeki baytlarla aç
    const cached = getCachedFileBytes(filePath, fileName);
    if (cached) {
      console.warn(
        `[GlossPDF] Could not read "${fileName}" from disk (${readError}); opening from the session cache.`
      );
      await openNewPdf(filePath, cached.fileName || fileName, cached.bytes.slice());
      return;
    }

    console.error(`[GlossPDF] Could not open the recent file (${filePath}):`, readError);

    // 4) Gerçekten erişilemiyor: seçici açmak yerine net bir mesaj göster
    //    (masaüstünde dosya gerçekten yoksa kaydı listeden temizle)
    if (desktopReadAttempted) {
      removeRecentFile(filePath);
    }

    alert(
      t(desktopReadAttempted ? 'recent_file_missing' : 'recent_file_bridge_missing', {
        fileName
      })
    );
  };

  // Dosya Aç (Electron veya Web fallback)
  const handleOpenFile = async () => {
    if (window.electronAPI) {
      const res = await window.electronAPI.openPdf(language);
      if (res.success && res.data && res.filePath && res.fileName) {
        await openNewPdf(res.filePath, res.fileName, base64ToBytes(res.data));
      }
      return;
    }

    // Tarayıcı / Web Fallback (HTML5 File Input)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf,.pdf';
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await handleFileDrop(file);
      }
    };
    fileInput.click();
  };

  // Sürükle - Bırak ile Dosya Yükleme
  const handleFileDrop = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const resolvedPath =
      (window.electronAPI?.getPathForFile ? window.electronAPI.getPathForFile(file) : (file as any).path) ||
      file.name;
    await openNewPdf(resolvedPath, file.name, bytes);
  };

  // Mevcut Dosyayı Kaydet (Ctrl+S) - ISO 32000 Annotation'ları ile Birlikte
  const handleSaveFile = async () => {
    if (!activeTab) return;

    // Eğer geçerli bir disk dosya yolu yoksa (sürükle-bırak veya isimsiz belge), güvenle Farklı Kaydet'e yönlendir
    if (!activeTab.filePath || activeTab.filePath === activeTab.fileName || !window.electronAPI) {
      await handleSaveFileAs();
      return;
    }

    try {
      // pdf-lib ile annotation'ları (Highlight, Text, Ink, Square vb.) PDF'e yaz
      const savedBytes = await PdfEditService.savePdfWithAnnotations(
        activeTab.data.slice(),
        activeTab.annotations || []
      );

      if (window.electronAPI) {
        let binary = '';
        const len = savedBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(savedBytes[i]);
        }
        const base64Data = btoa(binary);

        const res = await window.electronAPI.savePdf(activeTab.filePath, base64Data);
        if (res.success) {
          updateTab(activeTab.id, { isModified: false, data: savedBytes, ...SAVED_STATE });
        } else {
          // İzin veya kilitlenme hatası durumunda kullanıcı mağdur olmasın diye Farklı Kaydet'e yönlendir
          console.warn('Direct save failed, opening Save As:', res.error);
          await handleSaveFileAs();
        }
      } else {
        // Tarayıcı Fallback (İndirme)
        const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeTab.fileName || 'belge.pdf';
        a.click();
        URL.revokeObjectURL(url);
        updateTab(activeTab.id, { isModified: false, data: savedBytes, ...SAVED_STATE });
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      alert(t('error_generic', { message: err.message }));
    }
  };

  // Farklı Kaydet (Ctrl+Shift+S) - ISO 32000 Annotation'ları ile Birlikte
  const handleSaveFileAs = async () => {
    if (!activeTab) return;

    try {
      const savedBytes = await PdfEditService.savePdfWithAnnotations(
        activeTab.data.slice(),
        activeTab.annotations || []
      );

      if (window.electronAPI) {
        let binary = '';
        const len = savedBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(savedBytes[i]);
        }
        const base64Data = btoa(binary);

        const res = await window.electronAPI.savePdfAs(activeTab.fileName, base64Data, language);
        if (res.success && res.filePath && res.fileName) {
          updateTab(activeTab.id, {
            filePath: res.filePath,
            fileName: res.fileName,
            isModified: false,
            data: savedBytes,
            ...SAVED_STATE
          });
        }
      } else {
        const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeTab.fileName || 'belge.pdf';
        a.click();
        URL.revokeObjectURL(url);
        updateTab(activeTab.id, { isModified: false, data: savedBytes, ...SAVED_STATE });
      }
    } catch (err: any) {
      console.error('Save As failed:', err);
      alert(t('error_generic', { message: err.message }));
    }
  };

  // Yazdır (Ctrl+P)
  const handlePrint = async () => {
    if (window.electronAPI) {
      await window.electronAPI.print();
    } else {
      window.print();
    }
  };

  // Sayfaya Kaydır / Git
  const handlePageClick = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    const pageEl = document.getElementById(`pdf-page-${pageNumber}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Klavye Kısayolları Entegrasyonu
  useKeyboardShortcuts({
    onOpenFile: handleOpenFile,
    onSaveFile: handleSaveFile,
    onSaveFileAs: handleSaveFileAs,
    onPrint: handlePrint,
    onFitPage: handleFitPage,
    onFitWidth: handleFitWidth
  });

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-acrobat-canvas dark:bg-acrobat-darkCanvas text-slate-800 dark:text-slate-100 font-sans"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/pdf') {
          handleFileDrop(file);
        }
      }}
    >
      {/* 1. Üst Sekme Çubuğu */}
      <TabBar onOpenFile={handleOpenFile} />

      {/* 2. Ana Araç Çubuğu */}
      <HeaderToolbar
        onOpenFile={handleOpenFile}
        onSaveFile={handleSaveFile}
        onSaveFileAs={handleSaveFileAs}
        onPrint={handlePrint}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
      />

      {/* 2.1 Faz 2: İşaretleme (Annotation) Araç Çubuğu */}
      {annotationModeOpen && <AnnotationToolbar />}

      {/* 3. Ana Çalışma Alanı (Sol Panel + PDF Görüntüleyici + Sağ Panel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sol Gezinme Paneli */}
        <LeftSidebar
          pdfDocument={activePdfDoc}
          onPageClick={handlePageClick}
        />

        {/* PDF Sayfaları Sanallaştırılmış Görüntüleme Alanı */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <PdfDocumentViewer
            pdfDocument={activePdfDoc}
            onOpenFile={handleOpenFile}
            onFileDrop={handleFileDrop}
            onOpenRecentFile={handleOpenRecentFile}
            containerRef={containerRef}
          />
        </div>

        {/* Sağ Hızlı Araçlar Paneli */}
        <RightToolsPanel />
      </div>

      {/* 4. Alt Durum Çubuğu */}
      <StatusBar
        onPageChange={handlePageClick}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
      />

      {/* Modallar */}
      <PasswordModal />
      <OrganizePagesModal />
      <MergePdfModal />
      <SplitPdfModal />
      <WatermarkModal />
      <SignatureModal />
      <InsertImageModal />
      <ExportImagesModal />
      <ProtectPdfModal />
      <CompressPdfModal />
      <ShortcutHelpModal />
      <UpdateModal />
      <UnsavedChangesModal onSave={handleSaveFile} />
    </div>
  );
}
