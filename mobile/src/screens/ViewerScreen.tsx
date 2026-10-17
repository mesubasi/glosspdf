import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnnotHeader, EditorSheet, ToolDock } from '../annot/AnnotChrome';
import { useAnnot, type AnnotTool } from '../annot/state';
import { Icon } from '../components/Icon';
import { PageView } from '../components/PageView';
import { DocInfoSheet } from '../components/DocInfoSheet';
import { OutlineSheet } from '../components/OutlineSheet';
import { FieldSheet } from '../components/FormLayer';
import { formDirty, useForm } from '../lib/form';
import { ResultSheet } from '../components/ResultSheet';
import { searchDocument, useSearch, type SearchHit } from '../lib/search';
import { printFile, type OutputFile } from '../lib/share';
import { EncryptedPdfError, inspectPdf } from '../lib/tools';
import { useMobile } from '../store';
import { LANG, S } from '../strings';

const TWO_FINGER_HINT_KEY = 'glosspdf_mobile_two_finger_hint';

const SIDE_GUTTER = 12;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;

/** Yakınlaştırma sonrası ekranın (x, y) noktasına gelmesi gereken sayfa noktası (sayfa içi oran) */
interface Anchor {
  index: number;
  fx: number;
  fy: number;
  x: number;
  y: number;
}

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
  const formChanged = useForm((s) => Object.keys(s.values).length > 0);

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
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const contentRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<Anchor | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  // Belge son açılanlara (cihaza) yazıldıysa başlıkta "kaydedildi"
  const stored = useMobile((s) => s.recents.some((r) => r.id === doc.id));

  // ----- Belgede arama -----
  const searchOpen = useSearch((s) => s.open);
  const hits = useSearch((s) => s.hits);
  const hitIndex = useSearch((s) => s.index);
  const searchDone = useSearch((s) => s.done);
  const [query, setQuery] = useState('');

  /** Sonucu görünür yapar: ekranın üçte birine, yakınlaştırılmışsa yatayda ortaya */
  const revealHit = (hit: SearchHit) => {
    const el = scrollerRef.current;
    const page = contentRef.current?.children[hit.page - 1];
    if (!el || !page) return;
    const r = page.getBoundingClientRect();
    const s = el.getBoundingClientRect();
    const [x, y, w] = hit.rects[0];
    el.scrollTop += r.top + (y / hit.ph) * r.height - (s.top + s.height / 3);
    if (zoomRef.current > 1) el.scrollLeft += r.left + ((x + w / 2) / hit.pw) * r.width - (s.left + s.width / 2);
  };

  /** Sayfanın üstünü başlık çubuğunun altına getirir */
  const goToPage = (n: number) => {
    const el = scrollerRef.current;
    const page = contentRef.current?.children[n - 1];
    if (!el || !page) return;
    el.scrollTop += page.getBoundingClientRect().top - el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).paddingTop);
  };

  const asOutput = (): OutputFile => {
    const d = useMobile.getState().doc!;
    return { name: d.name, bytes: d.data, mime: 'application/pdf' };
  };

  const print = async () => {
    if (!(await flushForm())) return;
    printFile(asOutput()).catch((e) => {
      console.error('Print failed:', e);
      showError(S.errorTool);
    });
  };

  const goToHit = (i: number) => {
    const { hits: all, setIndex } = useSearch.getState();
    if (!all.length) return;
    const next = (i + all.length) % all.length;
    setIndex(next);
    revealHit(all[next]);
  };

  useEffect(() => {
    const { setHits, setIndex } = useSearch.getState();
    setHits([], false);
    setIndex(0);
    const q = query.trim();
    if (!searchOpen || !q) return;
    let cancelled = false;
    let first = true;
    // Yazarken her harfte değil, durunca ara
    const timer = window.setTimeout(() => {
      void searchDocument(
        doc.pdf,
        q,
        LANG,
        (found) => {
          setHits(found, false);
          if (first) revealHit(found[0]);
          first = false;
        },
        () => cancelled
      )
        .then(() => !cancelled && setHits(useSearch.getState().hits, true))
        .catch((e) => console.warn('Search failed:', e));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // revealHit yalnızca ref okur
  }, [query, searchOpen, doc.pdf]);

  // Okuyucudan çıkınca arama kapanır
  useEffect(() => () => useSearch.getState().setOpen(false), []);

  const closeSearch = () => {
    setQuery('');
    useSearch.getState().setOpen(false);
  };

  /** Ekrandaki (x, y) noktasının altındaki sayfa ve o sayfadaki oranı */
  const anchorAt = (x: number, y: number): Anchor | null => {
    const pages = contentRef.current?.children;
    if (!pages?.length) return null;
    let index = pages.length - 1;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].getBoundingClientRect().bottom >= y) {
        index = i;
        break;
      }
    }
    const r = pages[index].getBoundingClientRect();
    return { index, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height, x, y };
  };

  /** Canlı ölçeği kaldırır ve kaydırmayı, çapadaki sayfa noktası parmakların altına gelecek şekilde ayarlar */
  const applyAnchor = () => {
    const el = scrollerRef.current;
    const content = contentRef.current;
    const a = anchor.current;
    anchor.current = null;
    if (content) content.style.transform = '';
    const page = a && (content?.children[a.index] as HTMLElement | undefined);
    if (!el || !a || !page) return;
    const r = page.getBoundingClientRect();
    el.scrollLeft += r.left + a.fx * r.width - a.x;
    el.scrollTop += r.top + a.fy * r.height - a.y;
  };

  // Sayfalar yeni genişlikte yerleşince, boyanmadan önce
  useLayoutEffect(applyAnchor, [zoom]);

  // İki parmak: canlıyken CSS ölçeği, bırakınca sayfalar yeni genişlikte yeniden çizilir
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let pinch: { d0: number; x0: number; y0: number; a: Anchor; s: number; x: number; y: number } | null = null;
    const two = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
      d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    });
    const stop = () => {
      pinch = null;
      useAnnot.getState().setPinching(false);
    };
    const start = (e: TouchEvent) => {
      const content = contentRef.current;
      if (e.touches.length !== 2 || !content) return;
      const { x, y, d } = two(e.touches);
      const a = anchorAt(x, y);
      if (!a) return;
      const r = content.getBoundingClientRect();
      content.style.transformOrigin = `${x - r.left}px ${y - r.top}px`;
      pinch = { d0: Math.max(d, 1), x0: x, y0: y, a, s: 1, x, y };
      useAnnot.getState().setPinching(true);
    };
    const move = (e: TouchEvent) => {
      const content = contentRef.current;
      if (!pinch || e.touches.length !== 2 || !content) return;
      // Tarayıcı tek parmak kaydırmasını başlattıysa olay iptal edilemez; karışmadan bırak
      if (!e.cancelable) {
        content.style.transform = '';
        return stop();
      }
      e.preventDefault();
      const { x, y, d } = two(e.touches);
      const z0 = zoomRef.current;
      pinch.s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (z0 * d) / pinch.d0)) / z0;
      pinch.x = x;
      pinch.y = y;
      content.style.transform = `translate(${x - pinch.x0}px, ${y - pinch.y0}px) scale(${pinch.s})`;
    };
    const end = (e: TouchEvent) => {
      if (!pinch || e.touches.length >= 2) return;
      const p = pinch;
      stop();
      anchor.current = { ...p.a, x: p.x, y: p.y };
      const next = zoomRef.current * p.s;
      if (Math.abs(next - zoomRef.current) < 0.01) applyAnchor();
      else setZoom(next);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
    // anchorAt/applyAnchor yalnızca ref okur; bir kez bağlamak yeterli
  }, []);

  /** Çift dokunuş: normal boyut ↔ yakın; dokunulan nokta yerinde kalır */
  const onDoubleClick = (e: React.MouseEvent) => {
    if (useAnnot.getState().tool) return;
    anchor.current = anchorAt(e.clientX, e.clientY);
    setZoom(zoom > 1.05 ? 1 : DOUBLE_TAP_ZOOM);
  };

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

  /**
   * Doldurulan form değerlerini belgeye yazar. Paylaş, yazdır, işaretle, imzala, sayfalar ve
   * araçlar önce bunu çağırır; böylece hepsi güncel belgeyle çalışır ve değerler kaybolmaz.
   */
  const flushForm = async (): Promise<boolean> => {
    if (!formDirty()) return true;
    if (!(await ensureEditable())) return false;
    setFinishing(true);
    try {
      const { PdfEditService } = await import('@/services/pdfEditService');
      await replaceDoc(await PdfEditService.fillForm(useMobile.getState().doc!.data.slice(), useForm.getState().values));
      return true;
    } catch (e) {
      console.error('Form save failed:', e);
      showError(S.errorTool);
      return false;
    } finally {
      setFinishing(false);
    }
  };

  const exportDoc = async () => {
    if (await flushForm()) setExported([asOutput()]);
  };
  const toOrganize = async () => (await flushForm()) && openOrganize('viewer');
  const toTools = async () => (await flushForm()) && openTools('viewer');

  const startAnnotate = async (tool: AnnotTool) => {
    if (!(await flushForm()) || !(await ensureEditable())) return;
    closeSearch();
    useAnnot.getState().begin(tool);
    // Tasarımda araç panelinde ipucu yok: iki parmak hareketi ilk seferde bir kez anlatılır
    try {
      if (!localStorage.getItem(TWO_FINGER_HINT_KEY)) {
        localStorage.setItem(TWO_FINGER_HINT_KEY, '1');
        showError(S.twoFingerScroll);
      }
    } catch {
      // Depolama kapalı: ipucu gösterilmez
    }
  };

  const startSign = async () => {
    if ((await flushForm()) && (await ensureEditable())) openSign();
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
        onDoubleClick={onDoubleClick}
        // z-0: sayfa katmanlarının z-index'i bu alanda kalsın, üstteki çubukları örtmesin.
        // ltr: sayfa geometrisi arayüz dilinden (Arapça) bağımsız
        dir="ltr"
        className="absolute inset-0 z-0 overflow-auto"
        style={{
          padding: `calc(var(--sat) + 76px) ${SIDE_GUTTER}px calc(var(--sab) + ${bottomSpace}px)`,
          touchAction: 'pan-x pan-y'
        }}
      >
        <div ref={contentRef} className="mx-auto flex flex-col gap-3" style={{ width: width * zoom }}>
          {width > 0 &&
            Array.from({ length: doc.pages }, (_, i) => (
              <PageView
                key={i + 1}
                pdf={doc.pdf}
                pageNumber={i + 1}
                width={width * zoom}
                fallbackAspect={fallbackAspect}
                scrollRoot={scrollerRef}
                onVisibleRatio={onVisibleRatio}
              />
            ))}
        </div>
      </div>

      {annotating ? (
        <AnnotHeader onExit={() => useAnnot.getState().exit()} onDone={finish} busy={finishing} />
      ) : searchOpen ? (
        <header
          className="glass absolute flex items-center gap-0.5 rounded-[28px] px-1.5"
          style={{ top: 'calc(var(--sat) + 8px)', left: 12, right: 12, height: 56 }}
        >
          <button className="round-btn" aria-label={S.close} onClick={closeSearch}>
            <Icon name="back" size={22} strokeWidth={2} />
          </button>
          <input
            autoFocus
            type="search"
            enterKeyHint="search"
            aria-label={S.searchDoc}
            placeholder={S.searchDoc}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToHit(hitIndex + 1)}
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none"
          />
          <span className="mono whitespace-nowrap px-1 text-[11.5px]" style={{ color: 'var(--muted)' }} aria-live="polite">
            {!query.trim() ? '' : hits.length ? `${hitIndex + 1}/${hits.length}${searchDone ? '' : '…'}` : searchDone ? S.searchNone : '…'}
          </span>
          <button className="round-btn" aria-label={S.searchPrev} disabled={!hits.length} onClick={() => goToHit(hitIndex - 1)}>
            <Icon name="up" size={20} />
          </button>
          <button className="round-btn" aria-label={S.searchNext} disabled={!hits.length} onClick={() => goToHit(hitIndex + 1)}>
            <Icon name="down" size={20} />
          </button>
        </header>
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
              {stored && ` · ${S.savedState}`}
            </div>
          </div>
          <button className="round-btn" aria-label={S.searchDoc} onClick={() => useSearch.getState().setOpen(true)}>
            <Icon name="search" size={20} />
          </button>
          {formChanged ? (
            <button
              onClick={exportDoc}
              disabled={finishing}
              className="mx-1 h-9 flex-none rounded-[18px] border-0 px-3.5 text-[13.5px] font-semibold text-white"
              style={{ background: 'var(--red)', opacity: finishing ? 0.6 : 1 }}
            >
              {finishing ? S.working : S.save}
            </button>
          ) : (
            <button className="round-btn" aria-label={S.exportDoc} onClick={exportDoc}>
              <Icon name="share" size={20} />
            </button>
          )}
          <button className="round-btn" aria-label={S.moreOptions} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="more" size={20} strokeWidth={3.6} />
          </button>
        </header>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden="true" onClick={() => setMenuOpen(false)} />
          <div
            role="menu"
            aria-label={S.moreOptions}
            className="glass absolute z-40 flex w-60 flex-col rounded-[22px] p-1.5"
            style={{ top: 'calc(var(--sat) + 70px)', insetInlineEnd: 12 }}
          >
            {(
              [
                ['list', S.goToPage, () => setOutlineOpen(true)],
                ['pages', S.dockPages, toOrganize],
                ['print', S.print, print],
                ['grid', S.tools, toTools],
                ['info', S.docInfo, () => setInfoOpen(true)]
              ] as const
            ).map(([icon, label, run]) => (
              <button
                key={icon}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  run();
                }}
                className="flex h-12 items-center gap-3 rounded-2xl border-0 bg-transparent px-3 text-start text-[15px] font-medium active:bg-[var(--press)]"
              >
                <Icon name={icon} size={20} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {infoOpen && <DocInfoSheet doc={doc} onClose={() => setInfoOpen(false)} />}
      {outlineOpen && <OutlineSheet doc={doc} current={current} onGo={goToPage} onClose={() => setOutlineOpen(false)} />}

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
          <div className="absolute bottom-0 right-1 top-0 w-1 rounded-sm" style={{ background: 'var(--line)' }} />
          <div
            className="absolute right-1 w-1 rounded-sm"
            style={{ background: 'var(--ink)', height: 40, top: `calc((100% - 40px) * ${progress})` }}
          />
          <div
            className="mono absolute right-3.5 flex h-[26px] items-center whitespace-nowrap rounded-[13px] px-2.5 text-[11.5px] text-white transition-opacity"
            style={{
              background: 'var(--solid)',
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
            background: 'var(--dock)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            backdropFilter: 'blur(20px) saturate(160%)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
          }}
        >
          <DockItem icon="annotate" label={S.dockAnnotate} onClick={() => startAnnotate('highlight')} />
          <DockItem icon="text" label={S.dockText} onClick={() => startAnnotate('text')} />
          <DockItem icon="sign" label={S.dockSign} onClick={startSign} />
          <DockItem icon="pages" label={S.dockPages} onClick={toOrganize} />
          <DockItem icon="tools" label={S.tools} onClick={toTools} />
        </nav>
      )}

      <EditorSheet />
      <FieldSheet />

      {exported && (
        <ResultSheet title={doc.name} outputs={exported} canOpen={false} onClose={() => setExported(null)} />
      )}
    </div>
  );
}
