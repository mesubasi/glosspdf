import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { drawWatermarkPreview, previewPlacementAt, renderPreviewPage, type WatermarkPlacement } from '../../services/watermarkLayout';
import { t } from '@/i18n';
import { X, Stamp, Check, Droplet, ChevronLeft, ChevronRight, Move } from 'lucide-react';

const WATERMARK_SIZE = 48;
const SPOTS = [0, 50, 100];

const WATERMARK_COLORS = [
  { hex: '#D81E24', name: () => t('color_red') },
  { hex: '#2A2C33', name: () => t('color_black') },
  { hex: '#1E3A8A', name: () => t('color_blue') },
  { hex: '#0B7A5C', name: () => t('color_green') },
  { hex: '#B07A12', name: () => t('color_mustard') },
  { hex: '#8A8A96', name: () => t('color_gray') }
];

const spotName = (x: number, y: number) =>
  [y === 0 ? t('pos_top') : y === 100 ? t('pos_bottom') : '', x === 0 ? t('pos_left') : x === 100 ? t('pos_right') : '']
    .filter(Boolean)
    .join(', ') || t('center');

/** Sürüklerken orta ve kenarlara bu kadar (yüzde) yaklaşınca oraya oturur */
const SNAP = 6;
const snap = (f: number) => {
  const v = Math.round(f * 100);
  return SPOTS.find((s) => Math.abs(s - v) <= SNAP) ?? v;
};

/** Hazır düzenler: klavye ve ekran okuyucu için sürüklemenin karşılığı */
const layouts = () => [
  { name: t('wm_diagonal'), x: 50, y: 50, angle: 45 },
  { name: t('horizontal'), x: 50, y: 50, angle: 0 },
  { name: t('wm_header'), x: 50, y: 0, angle: 0 },
  { name: t('wm_footer'), x: 50, y: 100, angle: 0 },
  ...[0, 100].flatMap((y) => [0, 100].map((x) => ({ name: spotName(x, y), x, y, angle: 0 })))
];

const chip = (on: boolean) =>
  on
    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800';

/** Sayfa önizlemesi, kayıttaki hesapla çizilir; tıklayıp sürükleyince filigranın yeri değişir */
const WatermarkStage: React.FC<{
  data: Uint8Array;
  pages: number;
  startPage: number;
  text: string;
  colorHex: string;
  opacity: number;
  placement: WatermarkPlacement;
  onMove: (x: number, y: number) => void;
}> = ({ data, pages, startPage, text, colorHex, opacity, placement, onMove }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNo, setPageNo] = useState(startPage);
  const [page, setPage] = useState<Awaited<ReturnType<typeof renderPreviewPage>> | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    const loading = PdfRenderService.loadDocument(data.slice());
    loading.then((d) => alive && setPdf(d)).catch(() => undefined);
    return () => {
      alive = false;
      void loading.then((d) => d.loadingTask.destroy()).catch(() => undefined);
    };
  }, [data]);

  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    renderPreviewPage(pdf, pageNo, 640)
      .then((p) => alive && setPage(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf, pageNo]);

  useEffect(() => {
    if (page && ref.current) drawWatermarkPreview(ref.current, page, text, { colorHex, opacity, size: WATERMARK_SIZE }, placement);
  });

  const moveTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    if (!page) return;
    const r = c.getBoundingClientRect();
    const p = previewPlacementAt(c, page, text, WATERMARK_SIZE, placement.angle, {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height
    });
    onMove(snap(p.x), snap(p.y));
  };
  const stop = () => setDragging(false);

  const x = Math.round(placement.x * 100);
  const y = Math.round(placement.y * 100);
  const onSpot = SPOTS.includes(x) && SPOTS.includes(y);

  return (
    <div className="flex min-h-0 flex-col items-center justify-center gap-3 bg-slate-800 p-5 dark:bg-black/40">
      <div className="relative" dir="ltr">
        {page ? (
          // Klavye ve ekran okuyucu için aynı ayarlar "Hazır düzenler"de düğme olarak var
          <canvas
            ref={ref}
            aria-hidden="true"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              moveTo(e);
            }}
            onPointerMove={(e) => dragging && moveTo(e)}
            onPointerUp={stop}
            onPointerCancel={stop}
            className="block max-h-[56vh] max-w-full touch-none rounded-xs shadow-2xl"
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          />
        ) : (
          <span className="block h-[56vh] max-h-[460px] w-[40vh] max-w-[325px] rounded-xs bg-white/10" />
        )}
        {dragging && x === 50 && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-red-500" />}
        {dragging && y === 50 && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-red-500" />}
      </div>
      <div className="flex w-full items-center justify-between gap-2 text-xs text-white/85">
        <span className="flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-white/10 px-3">
          <Move className="h-3.5 w-3.5 flex-none" />
          <span className="truncate">{dragging ? (onSpot ? spotName(x, y) : t('wm_free')) : t('wm_drag_hint')}</span>
        </span>
        {pages > 1 && (
          <div className="flex h-8 flex-none items-center rounded-full bg-white/10">
            <button
              type="button"
              aria-label={t('previous_page')}
              disabled={pageNo === 1}
              onClick={() => setPageNo(pageNo - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center font-mono">
              {pageNo} / {pages}
            </span>
            <button
              type="button"
              aria-label={t('next_page')}
              disabled={pageNo === pages}
              onClick={() => setPageNo(pageNo + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-35"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const WatermarkModal: React.FC = () => {
  const {
    watermarkModalOpen,
    setWatermarkModalOpen,
    tabs,
    activeTabId,
    updateTab,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [tabType, setTabType] = useState<'watermark' | 'stamp'>('watermark');

  // Filigran Ayarları
  const [watermarkText, setWatermarkText] = useState(t('confidential'));
  const [opacity, setOpacity] = useState(25);
  const [watermarkColor, setWatermarkColor] = useState(WATERMARK_COLORS[0].hex);
  /** Konum yüzdesi: 0 = sol / üst, 100 = sağ / alt */
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [angle, setAngle] = useState(45);
  const placement: WatermarkPlacement = { x: posX / 100, y: posY / 100, angle };

  // Damga Ayarları
  const [stampText, setStampText] = useState(t('approved'));
  const [stampColor, setStampColor] = useState('#2e7d32');

  const [isProcessing, setIsProcessing] = useState(false);

  if (!watermarkModalOpen || !activeTab) return null;

  const handleApply = async () => {
    try {
      setIsProcessing(true);
      let updatedBytes: Uint8Array;

      if (tabType === 'watermark') {
        if (!watermarkText.trim()) return;
        updatedBytes = await PdfEditService.addWatermark(
          activeTab.data.slice(),
          watermarkText.trim(),
          {
            colorHex: watermarkColor,
            opacity: opacity / 100,
            size: WATERMARK_SIZE,
            placement
          }
        );
      } else {
        // Damga
        updatedBytes = await PdfEditService.addStamp(
          activeTab.data.slice(),
          activeTab.currentPage,
          stampText,
          stampColor
        );
      }

      const doc = await PdfRenderService.loadDocument(updatedBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(doc);

      updateTab(activeTab.id, {
        data: updatedBytes,
        pageDimensions: dims,
        isModified: true
      });

      setWatermarkModalOpen(false);
    } catch (err: any) {
      console.error('Watermark/stamp error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  const quickStamps = [
    { text: 'ONAYLANDI', color: '#2e7d32' },
    { text: t('confidential'), color: '#d32f2f' },
    { text: 'TASLAK', color: '#f57c00' },
    { text: t('cancelled'), color: '#7b1fa2' },
    { text: 'APPROVED', color: '#2e7d32' },
    { text: 'CONFIDENTIAL', color: '#d32f2f' }
  ];

  const quickTexts = [t('confidential'), t('wm_draft'), t('wm_copy'), t('wm_sample'), t('approved'), t('wm_void')];
  const label = 'block text-slate-600 dark:text-slate-300 font-medium mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className={`bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 ${
          tabType === 'watermark' ? 'max-w-4xl' : 'max-w-md'
        }`}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Stamp className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('add_stamp_watermark')}
            </h2>
          </div>
          <button
            onClick={() => setWatermarkModalOpen(false)}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setTabType('watermark')}
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              tabType === 'watermark'
                ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            <span>{t('diagonal_watermark')}</span>
          </button>
          <button
            onClick={() => setTabType('stamp')}
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              tabType === 'stamp'
                ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>{t('official_stamp')}</span>
          </button>
        </div>

        {/* Gövde */}
        {tabType === 'watermark' ? (
          // Önizleme solda hep görünür; ayarlar sağda kendi içinde kayar
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_300px]">
            <WatermarkStage
              key={activeTab.id}
              data={activeTab.data}
              pages={activeTab.numPages}
              startPage={activeTab.currentPage}
              text={watermarkText.trim() || t('confidential')}
              colorHex={watermarkColor}
              opacity={opacity / 100}
              placement={placement}
              onMove={(x, y) => {
                setPosX(x);
                setPosY(y);
              }}
            />

            <div className="p-5 space-y-5 text-xs md:overflow-y-auto">
              <div>
                <label className={label} htmlFor="wm-text">
                  {t('watermark_text')}
                </label>
                <input
                  id="wm-text"
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-hidden focus:border-red-500 font-semibold"
                />
                <div role="group" aria-label={t('wm_quick_texts')} className="mt-2 flex flex-wrap gap-1.5">
                  {quickTexts.map((txt) => (
                    <button
                      key={txt}
                      type="button"
                      aria-pressed={watermarkText === txt}
                      onClick={() => setWatermarkText(txt)}
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide transition-colors ${chip(watermarkText === txt)}`}
                    >
                      {txt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Renk ve opaklık */}
              <div>
                <span className={label}>{t('color')}</span>
                <div role="radiogroup" aria-label={t('color')} className="flex items-center gap-2">
                  {WATERMARK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      role="radio"
                      aria-checked={watermarkColor === c.hex}
                      aria-label={c.name()}
                      title={c.name()}
                      onClick={() => setWatermarkColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        watermarkColor === c.hex ? 'ring-2 ring-offset-2 ring-slate-800 dark:ring-white dark:ring-offset-acrobat-darkBg scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
              <label className="block">
                <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
                  <span>{t('opacity')}</span>
                  <span className="font-mono text-slate-500">%{opacity}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value, 10))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </label>

              {/* Hazır düzenler: küçük sayfa belgenin kendisini temsil eder, Arapça arayüzde aynalanmaz */}
              <div>
                <span className={label}>{t('wm_layouts')}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {layouts().map((l) => {
                    const on = l.x === posX && l.y === posY && l.angle === angle;
                    return (
                      <button
                        key={l.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setPosX(l.x);
                          setPosY(l.y);
                          setAngle(l.angle);
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] font-medium transition-colors ${chip(on)}`}
                      >
                        <span aria-hidden="true" dir="ltr" className="relative h-[34px] w-[25px] rounded-[2px] bg-white shadow-sm ring-1 ring-black/5">
                          <span
                            className="absolute h-[3px] w-4 rounded-sm"
                            style={{
                              left: `${32 + 0.36 * l.x}%`,
                              top: `${14 + 0.72 * l.y}%`,
                              transform: `translate(-50%, -50%) rotate(${-l.angle}deg)`,
                              background: watermarkColor
                            }}
                          />
                        </span>
                        <span className="max-w-full truncate px-0.5">{l.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Açı */}
              <div>
                <span className={label}>{t('angle')}</span>
                <div role="radiogroup" aria-label={t('angle')} className="grid grid-cols-4 gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
                  {[0, 45, 90, -45].map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={angle === a}
                      onClick={() => setAngle(a)}
                      className={`flex items-center justify-center gap-1.5 rounded-[5px] py-1 font-mono text-[11px] font-medium transition-colors ${
                        angle === a ? 'bg-white text-red-600 shadow-xs dark:bg-slate-600 dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span aria-hidden="true" className="h-[2px] w-3 rounded-sm bg-current" style={{ transform: `rotate(${-a}deg)` }} />
                      {a}°
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
            {/* Damga Seçimi */}
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1.5">
                {t('select_predefined_stamp')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {quickStamps.map((st) => (
                  <button
                    key={st.text}
                    type="button"
                    onClick={() => {
                      setStampText(st.text);
                      setStampColor(st.color);
                    }}
                    style={{
                      borderColor: stampText === st.text ? st.color : undefined,
                      color: st.color
                    }}
                    className={`p-2.5 rounded-lg border-2 font-bold tracking-wider text-center transition-all ${
                      stampText === st.text
                        ? 'bg-black/5 dark:bg-white/5 shadow-xs scale-102'
                        : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {st.text}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 rounded-sm bg-slate-50 dark:bg-acrobat-darkPanel border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
              {t('stamp_will_be_placed_on_the_top_right_of_the_current_pag', [activeTab.currentPage])}
            </div>
          </div>
        )}

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <button
            onClick={() => setWatermarkModalOpen(false)}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={isProcessing || (tabType === 'watermark' && !watermarkText.trim())}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? t('processing') : tabType === 'watermark' ? t('apply_all_pages') : t('apply_to_document_2')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
