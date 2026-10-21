import React, { useEffect, useRef, useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { drawWatermarkPreview, renderPreviewPage, type WatermarkPlacement } from '../../services/watermarkLayout';
import { t } from '@/i18n';
import {
  X,
  Stamp,
  Check,
  Droplet
} from 'lucide-react';

const WATERMARK_SIZE = 48;
const SPOTS = [0, 50, 100];

/** Geçerli sayfa üstünde, kayıttaki hesapla çizilen canlı önizleme */
const WatermarkPreview: React.FC<{
  data: Uint8Array;
  pageNumber: number;
  text: string;
  colorHex: string;
  opacity: number;
  placement: WatermarkPlacement;
}> = ({ data, pageNumber, text, colorHex, opacity, placement }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<Awaited<ReturnType<typeof renderPreviewPage>> | null>(null);

  useEffect(() => {
    let alive = true;
    const loading = PdfRenderService.loadDocument(data.slice());
    loading
      .then((pdf) => renderPreviewPage(pdf, pageNumber, 480))
      .then((p) => alive && setPage(p))
      .catch(() => undefined);
    return () => {
      alive = false;
      void loading.then((pdf) => pdf.loadingTask.destroy()).catch(() => undefined);
    };
  }, [data, pageNumber]);

  useEffect(() => {
    if (page && ref.current) drawWatermarkPreview(ref.current, page, text, { colorHex, opacity, size: WATERMARK_SIZE }, placement);
  });

  if (!page) return null;
  return <canvas ref={ref} aria-hidden="true" className="mx-auto max-h-64 max-w-full rounded-sm shadow-md" />;
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
  const [watermarkText, setWatermarkText] = useState(t('confidential_proprietary'));
  const [opacity, setOpacity] = useState(20);
  const [watermarkColor, setWatermarkColor] = useState('#d32f2f');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-md max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
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
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {tabType === 'watermark' ? (
            <>
              <WatermarkPreview
                data={activeTab.data}
                pageNumber={activeTab.currentPage}
                text={watermarkText.trim()}
                colorHex={watermarkColor}
                opacity={opacity / 100}
                placement={placement}
              />

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t('watermark_text')}
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-hidden focus:border-red-500 font-semibold"
                />
              </div>

              {/* Hızlı Şablonlar */}
              <div className="flex flex-wrap gap-1.5">
                {[t('confidential'), 'TASLAK', 'KOPYA', 'CONFIDENTIAL', 'DRAFT'].map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => setWatermarkText(txt)}
                    className="px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium transition-colors"
                  >
                    {txt}
                  </button>
                ))}
              </div>

              {/* Opaklık Ayarı */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>{t('opacity')}</span>
                  <span>%{opacity}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value, 10))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>

              {/* Renk */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t('color')}
                </label>
                <div className="flex items-center space-x-2">
                  {['#d32f2f', '#1976d2', '#388e3c', '#555555'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setWatermarkColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        watermarkColor === color ? 'ring-2 ring-slate-800 dark:ring-white scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Konum: 9 noktalı ızgara + ince ayar; ızgara sayfayı temsil eder, RTL'de aynalanmaz */}
              <div className="flex items-start gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                    {t('watermark_position')}
                  </label>
                  <div
                    role="radiogroup"
                    aria-label={t('watermark_position')}
                    dir="ltr"
                    className="grid grid-cols-3 gap-0.5 p-0.5 w-[72px] rounded-sm bg-slate-100 dark:bg-slate-800"
                  >
                    {SPOTS.flatMap((y) =>
                      SPOTS.map((x) => {
                        const on = posX === x && posY === y;
                        const v = y === 0 ? t('pos_top') : y === 100 ? t('pos_bottom') : '';
                        const h = x === 0 ? t('pos_left') : x === 100 ? t('pos_right') : '';
                        return (
                          <button
                            key={`${x}-${y}`}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-label={[v, h].filter(Boolean).join(', ') || t('center')}
                            onClick={() => {
                              setPosX(x);
                              setPosY(y);
                            }}
                            className={`h-[22px] flex items-center justify-center rounded-xs transition-colors ${
                              on ? 'bg-white dark:bg-slate-600 shadow-xs' : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-red-600' : 'bg-slate-400'}`} />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-2 pt-4">
                  {(
                    [
                      [t('horizontal'), posX, setPosX],
                      [t('vertical'), posY, setPosY]
                    ] as const
                  ).map(([label, value, setValue]) => (
                    <label key={label} className="block">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                        <span>{label}</span>
                        <span>%{value}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) => setValue(parseInt(e.target.value, 10))}
                        className="w-full accent-red-600 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Açı */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t('angle')}
                </label>
                <div className="flex gap-1.5">
                  {[0, 45, 90, -45].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAngle(a)}
                      aria-pressed={angle === a}
                      className={`px-2.5 py-0.5 rounded-sm text-[11px] font-medium transition-colors ${
                        angle === a
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

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
            disabled={isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Ekleniyor...' : (t('apply_to_document_2'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
