import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfRenderService } from '@/services/pdfRenderService';
import {
  NotAPdfError,
  assertPdf,
  docId,
  forgetDocument,
  loadRecents,
  makeThumbnail,
  pickPdf,
  readStoredBytes,
  rememberDocument,
  touchRecent,
  type PickedFile,
  type RecentDoc
} from './lib/documents';
import type { OutputFile } from './lib/share';
import { EncryptedPdfError, inspectPdf } from './lib/tools';
import { newGroup, useAnnot } from './annot/state';
import type { InputFile, ToolId } from './tools/registry';
import { S } from './strings';

export interface OpenDoc {
  id: string;
  name: string;
  pdf: PDFDocumentProxy;
  pages: number;
  /** Araçlara girdi olarak verilebilsin diye özgün baytlar */
  data: Uint8Array;
}

interface PasswordRequest {
  /** 0 = ilk soru, 1+ = önceki parola yanlıştı */
  attempt: number;
  submit: (password: string) => void;
  cancel: () => void;
}

export type Screen = 'home' | 'viewer' | 'tools' | 'tool' | 'organize' | 'sign';

interface MobileState {
  screen: Screen;
  doc: OpenDoc | null;
  recents: RecentDoc[];
  busy: boolean;
  error: string | null;
  password: PasswordRequest | null;
  /** Araçlar ekranından çıkınca dönülecek yer */
  toolsReturnTo: 'home' | 'viewer';
  toolId: ToolId | null;
  /** Okuyucudan gelindiyse araçlara hazır verilen belge */
  toolPreset: PickedFile | null;
  /** Sayfa düzeni ekranındaki belge (sayfa sayısı denetlenmiş) */
  organizeSource: InputFile | null;
  /** Sayfa düzeninde kaydedilmemiş değişiklik var mı */
  organizeDirty: boolean;
  organizeReturnTo: 'tools' | 'viewer';
  /** Okuyucuda en çok görünen sayfa (imza bu sayfaya yerleşir) */
  viewerPage: number;

  pickAndOpen: () => Promise<void>;
  openRecent: (id: string) => Promise<void>;
  openOutput: (file: OutputFile) => Promise<void>;
  removeRecent: (id: string) => Promise<void>;
  closeDoc: () => void;
  dismissError: () => void;
  goHome: () => void;
  openTools: (from: 'home' | 'viewer') => void;
  leaveTools: () => void;
  openTool: (id: ToolId) => void;
  leaveTool: () => void;
  openOrganize: (from?: 'tools' | 'viewer') => Promise<void>;
  setViewerPage: (page: number) => void;
  showError: (message: string) => void;
  openSign: () => void;
  leaveSign: () => void;
  /** İmzayı geçerli sayfanın ortasına koyar ve işaretleme modunda seçili bırakır */
  placeSignature: (dataUrl: string, aspect: number) => Promise<void>;
  /** Açık belgeyi yeni baytlarla değiştirir (işaretlemeler yazıldıktan sonra); son açılanlar güncellenir */
  replaceDoc: (bytes: Uint8Array) => Promise<void>;
  setOrganizeDirty: (dirty: boolean) => void;
  /** Kaydedilmemiş değişiklik varsa onay ister; vazgeçilirse false döner */
  leaveOrganize: () => boolean;
}

export const useMobile = create<MobileState>((set, get) => {
  /** PDF'i yükler; parola gerekirse diyalog açar. Kullanıcı vazgeçerse null döner. */
  async function load(data: Uint8Array): Promise<PDFDocumentProxy | null> {
    let attempt = 0;
    let cancel!: () => void;
    const cancelled = new Promise<null>((resolve) => (cancel = () => resolve(null)));

    // pdf.js verilen tamponu worker'a devreder; özgün baytlar saklama için kopyayla korunur
    const loading = PdfRenderService.loadDocument(data.slice(), (submit) => {
      set({
        password: {
          attempt: attempt++,
          submit: (pw) => {
            set({ password: null });
            submit(pw);
          },
          cancel: () => {
            set({ password: null });
            cancel();
          }
        }
      });
    });
    loading.catch(() => undefined); // vazgeçildikten sonra gelen hata yutulur

    return Promise.race([loading, cancelled]);
  }

  function show(id: string, name: string, pdf: PDFDocumentProxy, data: Uint8Array) {
    get().doc?.pdf.destroy();
    set({ doc: { id, name, pdf, pages: pdf.numPages, data }, screen: 'viewer' });
  }

  /** Baytları açar, okuyucuya geçer ve arka planda son açılanlara ekler. */
  async function openBytes(name: string, data: Uint8Array) {
    const pdf = await load(data);
    if (!pdf) return;
    const id = docId(name, data.length);
    show(id, name, pdf, data);
    // Önizleme + depolama arka planda; görüntüleyici beklemez
    void makeThumbnail(pdf)
      .then((thumb) => rememberDocument({ id, name, pages: pdf.numPages, size: data.length, thumb }, data))
      .then((recents) => set({ recents }))
      .catch((e) => console.warn('Could not save to recents:', e));
  }

  /** busy/hata yönetimiyle bir açma işlemi yürütür; aynı anda tek işlem. */
  async function guarded(task: () => Promise<void>) {
    if (get().busy) return;
    set({ busy: true, error: null });
    try {
      await task();
    } catch (e) {
      console.error('Open failed:', e);
      set({
        error:
          e instanceof NotAPdfError ? S.errorNotPdf : e instanceof EncryptedPdfError ? S.errorEncrypted : S.errorOpen
      });
    } finally {
      set({ busy: false });
    }
  }

  return {
    screen: 'home',
    doc: null,
    recents: loadRecents(),
    busy: false,
    error: null,
    password: null,
    toolsReturnTo: 'home',
    toolId: null,
    toolPreset: null,
    organizeSource: null,
    organizeDirty: false,
    organizeReturnTo: 'tools',
    viewerPage: 1,

    pickAndOpen: () =>
      guarded(async () => {
        const picked = await pickPdf();
        if (picked) await openBytes(picked.name, picked.data);
      }),

    openRecent: (id) =>
      guarded(async () => {
        const data = await readStoredBytes(id);
        if (!data) {
          set({ recents: await forgetDocument(id), error: S.errorMissing });
          return;
        }
        assertPdf(data);
        const pdf = await load(data);
        if (!pdf) return;
        const name = get().recents.find((r) => r.id === id)?.name ?? id.split('|')[0];
        show(id, name, pdf, data);
        set({ recents: touchRecent(id) });
      }),

    openOutput: (file) => guarded(() => openBytes(file.name, file.bytes)),

    removeRecent: async (id) => set({ recents: await forgetDocument(id) }),

    closeDoc: () => {
      get().doc?.pdf.destroy();
      set({ doc: null, screen: 'home' });
    },

    dismissError: () => set({ error: null }),

    goHome: () => set({ screen: 'home' }),

    openTools: (from) => {
      const doc = get().doc;
      set({
        screen: 'tools',
        toolsReturnTo: from,
        toolPreset: from === 'viewer' && doc ? { name: doc.name, data: doc.data } : null
      });
    },

    leaveTools: () => {
      const { toolsReturnTo, doc } = get();
      set({ screen: toolsReturnTo === 'viewer' && doc ? 'viewer' : 'home', toolPreset: null });
    },

    openTool: (id) => set({ screen: 'tool', toolId: id }),

    leaveTool: () => set({ screen: 'tools', toolId: null }),

    openOrganize: (from = 'tools') =>
      guarded(async () => {
        const doc = get().doc;
        const file = from === 'viewer' && doc ? { name: doc.name, data: doc.data } : get().toolPreset ?? (await pickPdf());
        if (!file) return;
        const pages = await inspectPdf(file.data);
        set({ screen: 'organize', organizeSource: { ...file, pages }, organizeDirty: false, organizeReturnTo: from });
      }),

    setOrganizeDirty: (dirty) => set({ organizeDirty: dirty }),

    leaveOrganize: () => {
      if (get().organizeDirty && !window.confirm(S.discardChanges)) return false;
      const back = get().organizeReturnTo === 'viewer' && get().doc ? 'viewer' : 'tools';
      set({ screen: back, organizeSource: null, organizeDirty: false });
      return true;
    },

    setViewerPage: (viewerPage) => set({ viewerPage }),

    showError: (error) => set({ error }),

    openSign: () => set({ screen: 'sign' }),

    leaveSign: () => set({ screen: get().doc ? 'viewer' : 'home' }),

    placeSignature: async (dataUrl, aspect) => {
      const { doc, viewerPage } = get();
      if (!doc) return;
      const page = Math.min(Math.max(1, viewerPage), doc.pages);
      const { width: W, height: H } = (await doc.pdf.getPage(page)).getViewport({ scale: 1 });
      let w = Math.min(W * 0.4, 200);
      let h = w * aspect;
      if (h > H * 0.3) {
        h = H * 0.3;
        w = h / aspect;
      }
      const annot = useAnnot.getState();
      if (!annot.active) annot.begin(null);
      const group = newGroup();
      useAnnot.getState().commit([
        ...useAnnot.getState().items,
        {
          id: `${group}#0`,
          pageNumber: page,
          type: 'signature',
          color: '#000000',
          imageData: dataUrl,
          rect: [(W - w) / 2, (H - h) / 2, w, h],
          createdAt: new Date().toISOString()
        }
      ]);
      useAnnot.getState().setTool(null);
      useAnnot.getState().select(group);
      set({ screen: 'viewer' });
    },

    replaceDoc: async (bytes) => {
      const old = get().doc;
      if (!old) return;
      const pdf = await PdfRenderService.loadDocument(bytes.slice());
      const id = docId(old.name, bytes.length);
      show(id, old.name, pdf, bytes);
      // Eski kopya yerine güncel olanı hatırla
      void forgetDocument(old.id)
        .then(() => makeThumbnail(pdf))
        .then((thumb) => rememberDocument({ id, name: old.name, pages: pdf.numPages, size: bytes.length, thumb }, bytes))
        .then((recents) => set({ recents }))
        .catch((e) => console.warn('Could not update recents:', e));
    }
  };
});
