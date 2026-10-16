import React, { useRef, useState, useEffect } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { X, FileSignature, RotateCcw, Check, Pen, Type, ImageUp } from 'lucide-react';

type SignatureResult = { dataUrl: string; aspect: number };
type SavedSignature = SignatureResult & { id: string };
type SignatureTab = 'draw' | 'type' | 'image';

const STORAGE_KEY = 'glosspdf_signatures';
const MAX_SAVED = 6;

const PEN_COLORS: { labelKey: MessageKey; hex: string }[] = [
  { labelKey: 'color_blue', hex: '#0d47a1' },
  { labelKey: 'color_black', hex: '#111827' },
  { labelKey: 'color_red', hex: '#b91c1c' }
];

// Elle yazılmış hissi veren, işletim sistemlerinde yaygın yazı tipi yığınları
const SCRIPT_FONTS = [
  "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive",
  "'Lucida Handwriting', 'Apple Chancery', 'URW Chancery L', cursive",
  "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive"
];

function loadSaved(): SavedSignature[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSaved(list: SavedSignature[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

/** Şeffaf kenar boşluklarını kırpar; imza sayfaya sıkı sınırlarla yerleşsin */
function trimToContent(src: HTMLCanvasElement, pad = 6): SignatureResult | null {
  const ctx = src.getContext('2d');
  if (!ctx) return null;
  const { width, height } = src;
  const px = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  out.getContext('2d')!.drawImage(src, minX, minY, w, h, pad, pad, w, h);
  return { dataUrl: out.toDataURL('image/png'), aspect: out.width / out.height };
}

export const SignatureModal: React.FC = () => {
  const {
    signatureModalOpen,
    setSignatureModalOpen,
    setPendingSignature,
    setActiveTool,
    activeTabId,
    language
  } = usePdfStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<SignatureTab>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].hex);
  const [typedName, setTypedName] = useState('');
  const [fontIndex, setFontIndex] = useState(0);
  const [imageResult, setImageResult] = useState<SignatureResult | null>(null);
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [saveForLater, setSaveForLater] = useState(true);
  const [saved, setSaved] = useState<SavedSignature[]>([]);

  // Modal her açıldığında temiz başla
  useEffect(() => {
    if (!signatureModalOpen) return;
    setSaved(loadSaved());
    setTab('draw');
    setHasDrawn(false);
    setTypedName('');
    setImageResult(null);
    setRawImage(null);
  }, [signatureModalOpen]);

  // Yüklenen görseli (isteğe bağlı beyaz arka plan temizleme ile) imzaya dönüştür
  useEffect(() => {
    if (!rawImage) return;
    const scale = Math.min(1, 800 / Math.max(rawImage.width, rawImage.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rawImage.width * scale));
    canvas.height = Math.max(1, Math.round(rawImage.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(rawImage, 0, 0, canvas.width, canvas.height);
    if (removeWhite) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < img.data.length; i += 4) {
        // Parlaklığa göre yumuşak geçişli alfa: beyaza yakın = saydam
        const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        img.data[i + 3] = Math.min(img.data[i + 3], Math.max(0, Math.min(255, ((235 - lum) / 60) * 255)));
      }
      ctx.putImageData(img, 0, 0);
    }
    setImageResult(trimToContent(canvas));
  }, [rawImage, removeWhite]);

  if (!signatureModalOpen || !activeTabId) return null;

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {}
    const { x, y } = pointerPos(e);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y); // tek tıklamada nokta bırak
    ctx.stroke();
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const renderTyped = (name: string, font: string, color: string): SignatureResult | null => {
    if (!name.trim()) return null;
    const size = 96;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${size}px ${font}`;
    canvas.width = Math.ceil(ctx.measureText(name).width) + 60;
    canvas.height = Math.ceil(size * 1.8);
    ctx.font = `${size}px ${font}`; // canvas boyutu değişince bağlam sıfırlanır
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(name, 30, size * 1.2);
    return trimToContent(canvas);
  };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setRawImage(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const currentResult = (): SignatureResult | null => {
    if (tab === 'draw') return hasDrawn && canvasRef.current ? trimToContent(canvasRef.current) : null;
    if (tab === 'type') return renderTyped(typedName, SCRIPT_FONTS[fontIndex], penColor);
    return imageResult;
  };

  const canApply =
    (tab === 'draw' && hasDrawn) || (tab === 'type' && typedName.trim().length > 0) || (tab === 'image' && !!imageResult);

  const beginPlacing = (sig: SignatureResult) => {
    setPendingSignature(sig);
    setActiveTool('signature');
    setSignatureModalOpen(false);
  };

  const handleApply = () => {
    const sig = currentResult();
    if (!sig) return;
    if (saveForLater) {
      const next = [{ ...sig, id: `sig-${Date.now()}` }, ...saved].slice(0, MAX_SAVED);
      persistSaved(next);
    }
    beginPlacing(sig);
  };

  const removeSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    persistSaved(next);
    setSaved(next);
  };

  const tabs: { id: SignatureTab; label: MessageKey; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'draw', label: 'signature_tab_draw', icon: Pen },
    { id: 'type', label: 'signature_tab_type', icon: Type },
    { id: 'image', label: 'signature_tab_image', icon: ImageUp }
  ];

  const penPicker = (
    <div className="flex items-center space-x-1.5">
      {PEN_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          onClick={() => setPenColor(c.hex)}
          style={{ backgroundColor: c.hex }}
          className={`w-5 h-5 rounded-full border-2 transition-transform ${
            penColor === c.hex ? 'border-white scale-110 shadow-sm ring-2 ring-red-500' : 'border-transparent'
          }`}
          title={t(c.labelKey)}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <FileSignature className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">{t('create_signature')}</h2>
          </div>
          <button
            onClick={() => setSignatureModalOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col space-y-4 text-xs">
          {/* Kayıtlı imzalar: tek tıkla kullan */}
          {saved.length > 0 && (
            <div>
              <div className="text-slate-500 font-medium mb-1.5">{t('saved_signatures')}</div>
              <div className="flex flex-wrap gap-2">
                {saved.map((s) => (
                  <div
                    key={s.id}
                    className="group relative h-12 px-3 flex items-center rounded border border-slate-300 dark:border-slate-600 bg-white hover:border-red-500 cursor-pointer"
                    onClick={() => beginPlacing(s)}
                    title={t('place_signature')}
                  >
                    <img src={s.dataUrl} alt="" className="max-h-9 max-w-[120px] object-contain" draggable={false} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSaved(s.id);
                      }}
                      className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-slate-600 hover:bg-red-500 text-white items-center justify-center hidden group-hover:flex"
                      title={t('delete')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sekmeler */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {tabs.map((tb) => {
              const Icon = tb.icon;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={`flex items-center space-x-1.5 px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
                    tab === tb.id
                      ? 'border-red-500 text-red-600 dark:text-red-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t(tb.label)}</span>
                </button>
              );
            })}
          </div>

          {/* Çizim sekmesi gizlenir ama bağlı kalır; sekme değişince çizim kaybolmasın */}
          {
            <div className={`space-y-2 ${tab === 'draw' ? '' : 'hidden'}`}>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{t('draw_your_signature_in_the_box_below')}</span>
                {penPicker}
              </div>
              <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={450}
                  height={180}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className="cursor-crosshair block w-full touch-none select-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs">
                    <Pen className="w-4 h-4 mr-1.5 opacity-40" />
                    <span>{t('sign_here_mouse_or_touch')}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearCanvas}
                  disabled={!hasDrawn}
                  className="flex items-center space-x-1 px-3 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('clear_drawing')}</span>
                </button>
              </div>
            </div>
          }

          {tab === 'type' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{t('type_your_name')}</span>
                {penPicker}
              </div>
              <input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none focus:border-red-500 text-sm"
              />
              <div className="grid gap-2">
                {SCRIPT_FONTS.map((font, i) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => setFontIndex(i)}
                    style={{ fontFamily: font, color: penColor }}
                    className={`h-14 px-4 rounded border text-2xl text-left truncate bg-white ${
                      fontIndex === i ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {typedName.trim() || t('signature')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'image' && (
            <div className="space-y-3">
              <label className="flex items-center justify-center h-28 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:border-red-500 bg-white overflow-hidden">
                {imageResult ? (
                  <img src={imageResult.dataUrl} alt="" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <span className="flex items-center text-slate-400">
                    <ImageUp className="w-4 h-4 mr-1.5" />
                    {t('choose_image')}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
              </label>
              <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={removeWhite} onChange={(e) => setRemoveWhite(e.target.checked)} />
                <span>{t('remove_white_background')}</span>
              </label>
            </div>
          )}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={saveForLater} onChange={(e) => setSaveForLater(e.target.checked)} />
            <span>{t('save_signature_for_later')}</span>
          </label>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSignatureModalOpen(false)}
              className="px-4 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="flex items-center space-x-1.5 px-5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('place_signature')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
