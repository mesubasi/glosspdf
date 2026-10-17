import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnotHeader, EditorSheet, ToolDock } from '../annot/AnnotChrome';
import { useAnnot, type AnnotTool } from '../annot/state';
import { Icon } from '../components/Icon';
import { PageView } from '../components/PageView';
import { ResultSheet } from '../components/ResultSheet';
import type { OutputFile } from '../lib/share';
import { EncryptedPdfError, inspectPdf } from '../lib/tools';
import { useMobile } from '../store';
import { S } from '../strings';

const SIDE_GUTTER = 12;

const DOCK_ICONS = {
  annotate: 'M9 11l-5 5v4h4l5-5M13 6l5 5-5 5-5-5zM17 3l4 4',
  text: 'M4 7V5h12v2M10 5v14M7 19h6M18 10v10M16 10h4M16 20h4',
  sign: 'M3 17c2.5-6 4.5-7 5.5-4s2.5 3.5 4.5-.5 3-3 4.5.5 2 2 3.5 0M3 21h18',
  pages: 'M6 3h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM6 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM15 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z',
  tools: 'M6 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM15 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z'
};

function DockItem({ icon, label, onClick }: { icon: keyof typeof DOCK_ICONS; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-11 flex-col items-center gap-1 border-0 bg-transparent px-0 py-1.5 text-[10.5px] font-medium text-white"
    >
      <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={DOCK_ICONS[icon]} />
      </svg>
      {label}
    </button>
  );
}

export function ViewerScreen() {
  const doc = useMobile((s) => s.doc)!;
  const closeDoc = useMobile((s) => s.closeDoc);
  const openTools = useMobile((s) => s.openTools);
  const openOrganize = useMobile((s) => s.openOrganize);
  const openSign = useMobile((s) => s.openSign);
  const setViewerPage = useMobile((s) => s.setViewerPage);
  const showError = useMobile((s) => s.showError);
  const replaceDoc = useMobile((s) => s.replaceDoc);
  const annotating = useAnnot((s) => s.active);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fallbackAspect, setFallbackAspect] = useState(1.414);
  const [current, setCurrent] = useState(1);
  const [progress, setProgress] = useState(0);
  const [showCounter, setShowCounter] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [exported, setExported] = useState<OutputFile[] | null>(null);
  const ratios = useRef(new Map<number, number>());
  const hideTimer = useRef<number>();
  const dragging = useRef(false);

  // Sayfa genişliği = ekran genişliği − kenar boşlukları
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(0, el.clientWidth - SIDE_GUTTER * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Henüz çizilmemiş sayfalar için birinci sayfanın oranı yer tutucu olur
  useEffect(() => {
    let alive = true;
    doc.pdf
      .getPage(1)
      .then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (alive) setFallbackAspect(v.height / v.width);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [doc.pdf]);

  useEffect(() => setViewerPage(current), [current, setViewerPage]);

  const onVisibleRatio = useCallback((page: number, ratio: number) => {
    ratios.current.set(page, ratio);
    let best = 0;
    let bestRatio = -1;
    ratios.current.forEach((r, p) => {
      if (r > bestRatio || (r === bestRatio && p < best)) {
        best = p;
        bestRatio = r;
      }
    });
    if (best > 0 && bestRatio > 0) setCurrent(best);
  }, []);

  const flashCounter = () => {
    setShowCounter(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowCounter(false), 1400);
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
    flashCounter();
  };

  // Sağdaki kaydırma çubuğu: sürükleyerek belgede hızlı gezinme
  const scrubTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    el.scrollTop = frac * (el.scrollHeight - el.clientHeight);
  };

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  /** Şifreli belge düzenlenemez: pdf-lib çözemez, yazılan dosya bozulur. */
  const ensureEditable = async () => {
    try {
      await inspectPdf(doc.data);
      return true;
    } catch (e) {
      showError(e instanceof EncryptedPdfError ? S.errorEncryptedEdit : S.errorOpen);
      return false;
    }
  };

  const startAnnotate = async (tool: AnnotTool) => {
    if (await ensureEditable()) useAnnot.getState().begin(tool);
  };

  const startSign = async () => {
    if (await ensureEditable()) openSign();
  };

  /** İşaretlemeleri PDF'e yazar, belgeyi günceller ve kaydet/paylaş penceresini açar. */
  const finish = async () => {
    const { items, reset } = useAnnot.getState();
    if (!items.length) return reset();
    setFinishing(true);
    try {
      const { PdfEditService } = await import('@/services/pdfEditService');
      const bytes = await PdfEditService.savePdfWithAnnotations(doc.data.slice(), items);
      await replaceDoc(bytes);
      reset();
      setExported([{ name: doc.name, bytes, mime: 'application/pdf' }]);
    } catch (e) {
      console.error('Annotation save failed:', e);
      showError(S.errorTool);
    } finally {
      setFinishing(false);
    }
  };

  const bottomSpace = annotating ? 220 : 110;

  return (
    <div className="relative h-full overflow-hidden" style={{ background: 'var(--bg-reading)' }}>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        // z-0: sayfa katmanlarının z-index'i bu alanda kalsın, üstteki çubukları örtmesin
        className="absolute inset-0 z-0 flex flex-col gap-3 overflow-y-auto"
        style={{
          padding: `calc(var(--sat) + 76px) ${SIDE_GUTTER}px calc(var(--sab) + ${bottomSpace}px)`
        }}
      >
        {width > 0 &&
          Array.from({ length: doc.pages }, (_, i) => (
            <PageView
              key={i + 1}
              pdf={doc.pdf}
              pageNumber={i + 1}
              width={width}
              fallbackAspect={fallbackAspect}
              scrollRoot={scrollerRef}
              onVisibleRatio={onVisibleRatio}
            />
          ))}
      </div>

      {annotating ? (
        <AnnotHeader onExit={() => useAnnot.getState().exit()} onDone={finish} busy={finishing} />
      ) : (
        <header
          className="glass absolute flex items-center gap-0.5 rounded-[28px] px-1.5"
          style={{ top: 'calc(var(--sat) + 8px)', left: 12, right: 12, height: 56 }}
        >
          <button className="round-btn" aria-label={S.back} onClick={closeDoc}>
            <Icon name="back" size={22} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold">{doc.name}</div>
            <div className="mono mt-px text-[11px]" style={{ color: 'var(--muted)' }}>
              {doc.pages} {S.pages}
            </div>
          </div>
          <button
            className="round-btn"
            aria-label={S.exportDoc}
            onClick={() => setExported([{ name: doc.name, bytes: doc.data, mime: 'application/pdf' }])}
          >
            <Icon name="share" size={20} />
          </button>
        </header>
      )}

      {doc.pages > 1 && (
        <div
          role="presentation"
          className="absolute right-0 z-20 w-8 touch-none"
          style={{ top: 'calc(var(--sat) + 84px)', bottom: `calc(var(--sab) + ${bottomSpace - 10}px)` }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubTo(e);
          }}
          onPointerMove={(e) => dragging.current && scrubTo(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <div className="absolute bottom-0 right-1 top-0 w-1 rounded-sm" style={{ background: 'rgba(14,14,17,0.10)' }} />
          <div
            className="absolute right-1 w-1 rounded-sm"
            style={{ background: 'var(--ink)', height: 40, top: `calc((100% - 40px) * ${progress})` }}
          />
          <div
            className="mono absolute right-3.5 flex h-[26px] items-center whitespace-nowrap rounded-[13px] px-2.5 text-[11.5px] text-white transition-opacity"
            style={{
              background: 'var(--ink)',
              opacity: showCounter ? 1 : 0,
              top: `calc((100% - 40px) * ${progress} + 7px)`
            }}
            aria-live="polite"
          >
            {current} / {doc.pages}
          </div>
        </div>
      )}

      {annotating ? (
        <ToolDock />
      ) : (
        <nav
          aria-label={S.editTools}
          className="absolute left-4 right-4 grid h-[70px] grid-cols-5 items-center rounded-[35px] px-1.5"
          style={{
            bottom: 'calc(var(--sab) + 24px)',
            background: 'rgba(16,16,20,0.88)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            backdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
          }}
        >
          <DockItem icon="annotate" label={S.dockAnnotate} onClick={() => startAnnotate('highlight')} />
          <DockItem icon="text" label={S.dockText} onClick={() => startAnnotate('text')} />
          <DockItem icon="sign" label={S.dockSign} onClick={startSign} />
          <DockItem icon="pages" label={S.dockPages} onClick={() => openOrganize('viewer')} />
          <DockItem icon="tools" label={S.tools} onClick={() => openTools('viewer')} />
        </nav>
      )}

      <EditorSheet />

      {exported && (
        <ResultSheet title={doc.name} outputs={exported} canOpen={false} onClose={() => setExported(null)} />
      )}
    </div>
  );
}
