import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Help } from '../components/Fields';
import { Icon } from '../components/Icon';
import { messageFor } from '../errors';
import { pickImage } from '../lib/documents';
import { loadSignatures, removeSignature, saveSignature, trimCanvas, type SavedSignature } from '../lib/signatures';
import { toBlob } from '../lib/share';
import { useMobile } from '../store';
import { S } from '../strings';

type Mode = 'draw' | 'type' | 'image';

const INKS = [
  { hex: '#0E0E11', name: S.colorBlack },
  { hex: '#1F3FA8', name: S.colorNavy },
  { hex: '#C4161C', name: S.colorRed }
];

const PAD_HEIGHT = 260;
const TYPE_FONT = "'Caveat', cursive";

export function SignScreen() {
  const doc = useMobile((s) => s.doc)!;
  const page = useMobile((s) => s.viewerPage);
  const leaveSign = useMobile((s) => s.leaveSign);
  const placeSignature = useMobile((s) => s.placeSignature);

  const [mode, setMode] = useState<Mode>('draw');
  const [ink, setInk] = useState(INKS[0].hex);
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState<SavedSignature[]>(loadSignatures);
  const [typed, setTyped] = useState('');
  const [image, setImage] = useState<{ dataUrl: string; aspect: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number; id: number } | null>(null);
  // Mürekkep rengi tüm imzaya uygulanır; çizgiler yalnızca noktaları tutar
  const strokes = useRef<{ x: number; y: number }[][]>([]);

  // Çizim alanı: cihaz piksel oranında, saydam zemin
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || mode === 'image') return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(PAD_HEIGHT * dpr);
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /** Çizgileri ya da yazılı imzayı yeniden çizer (mürekkep değişince tümü güncellenir). */
  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (mode === 'type') {
      if (!typed.trim()) return;
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      let size = 64;
      ctx.font = `${size}px ${TYPE_FONT}`;
      const maxW = c.clientWidth - 48;
      while (size > 20 && ctx.measureText(typed).width > maxW) ctx.font = `${(size -= 4)}px ${TYPE_FONT}`;
      ctx.fillText(typed, c.clientWidth / 2, PAD_HEIGHT - 70);
      return;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = ink;
    for (const pts of strokes.current) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (pts.length === 1) ctx.lineTo(pts[0].x + 0.1, pts[0].y);
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (mode === 'type') void document.fonts.load(`64px ${TYPE_FONT}`).then(redraw);
    else redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ink, typed, mode]);

  const point = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || last.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    last.current = { ...p, id: e.pointerId };
    strokes.current.push([p]);
    setHasInk(true);
    redraw();
  };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!last.current || last.current.id !== e.pointerId) return;
    const p = point(e);
    strokes.current[strokes.current.length - 1].push(p);
    last.current = { ...p, id: e.pointerId };
    redraw();
  };
  const up = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (last.current?.id === e.pointerId) last.current = null;
  };

  const clear = () => {
    strokes.current = [];
    setHasInk(false);
    setTyped('');
    setImage(null);
    redraw();
  };

  const chooseImage = async () => {
    setError(null);
    try {
      const picked = await pickImage();
      if (!picked) return;
      const bitmap = await createImageBitmap(toBlob(picked.data));
      const ratio = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bitmap.width * ratio);
      c.height = Math.round(bitmap.height * ratio);
      c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      setImage({ dataUrl: c.toDataURL('image/png'), aspect: c.height / c.width });
    } catch (e) {
      setError(e instanceof DOMException ? S.errorImage : messageFor(e));
    }
  };

  const ready = mode === 'draw' ? hasInk : mode === 'type' ? !!typed.trim() : !!image;

  const place = () => {
    const sig = mode === 'image' ? image : canvasRef.current && trimCanvas(canvasRef.current);
    if (!sig) return;
    if (remember) saveSignature(sig);
    placeSignature(sig.dataUrl, sig.aspect);
  };

  const tab = (m: Mode, label: string) => (
    <button
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      className="h-10 rounded-[20px] border-0 text-[14px]"
      style={{
        background: mode === m ? '#FFFFFF' : 'transparent',
        color: mode === m ? 'var(--ink)' : '#4A4A54',
        fontWeight: mode === m ? 600 : 500,
        boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="relative h-full" style={{ background: 'var(--bg)' }}>
      <div className="h-full overflow-y-auto px-5" style={{ paddingTop: 'calc(var(--sat) + 8px)', paddingBottom: 'calc(var(--sab) + 110px)' }}>
        <div className="flex items-center justify-between gap-3">
          <button
            aria-label={S.close}
            onClick={leaveSign}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-0 bg-white p-0"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
          >
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
          <span className="mono min-w-0 truncate text-[12px]" style={{ color: 'var(--muted)' }}>
            {doc.name} · {S.pageShort} {page}
          </span>
        </div>

        <h1 className="mt-4 text-[34px] font-bold leading-[1.1] tracking-[-0.04em]">{S.signTitle}</h1>

        <div role="tablist" aria-label={S.signMethod} className="mt-4 grid grid-cols-3 gap-1 rounded-3xl p-1" style={{ background: '#E3E3E8' }}>
          {tab('draw', S.signDraw)}
          {tab('type', S.signType)}
          {tab('image', S.signImage)}
        </div>

        {mode === 'type' && (
          <input
            aria-label={S.signTypeLabel}
            placeholder={S.signTypeLabel}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-3 h-12 w-full rounded-2xl border-0 bg-white px-4 text-[15px] outline-none"
          />
        )}

        <div
          className="relative mt-4 overflow-hidden rounded-[28px] bg-white"
          style={{
            height: PAD_HEIGHT,
            backgroundImage: 'radial-gradient(#DADAE1 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            boxShadow: '0 8px 24px rgba(17,17,26,0.06)'
          }}
        >
          {mode === 'image' ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
              {image && <img src={image.dataUrl} alt="" className="max-h-40 max-w-full object-contain" />}
              <button
                onClick={chooseImage}
                className="h-12 rounded-2xl border-0 px-5 text-[15px] font-semibold"
                style={{ background: 'var(--red-tint)', color: 'var(--red-ink)' }}
              >
                {image ? S.change : S.chooseImage}
              </button>
            </div>
          ) : (
            <>
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={S.signPad}
                className="absolute inset-0 h-full w-full"
                style={{ touchAction: 'none' }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              />
              <div aria-hidden="true" className="pointer-events-none absolute left-7 right-7 border-b-[1.5px]" style={{ bottom: 52, borderColor: 'rgba(14,14,17,0.18)' }} />
              <div aria-hidden="true" className="pointer-events-none absolute left-7 text-[18px] font-semibold" style={{ bottom: 58, color: '#9B9BA6' }}>
                ×
              </div>
              {mode === 'draw' && (
                <div className="pointer-events-none absolute bottom-5 left-7 text-[12px]" style={{ color: 'var(--muted)' }}>
                  {S.signHint}
                </div>
              )}
            </>
          )}
          <button
            aria-label={S.signClear}
            onClick={clear}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border-0 p-0"
            style={{ background: 'var(--bg)' }}
          >
            <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
        </div>

        {mode !== 'image' && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[14px] font-semibold">{S.ink}</span>
            <div role="radiogroup" aria-label={S.ink} className="flex gap-0.5">
              {INKS.map((c) => (
                <button
                  key={c.hex}
                  role="radio"
                  aria-checked={ink === c.hex}
                  aria-label={c.name}
                  onClick={() => setInk(c.hex)}
                  className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0"
                >
                  <span className="h-[26px] w-[26px] rounded-full" style={{ background: c.hex, boxShadow: ink === c.hex ? '0 0 0 3px var(--bg), 0 0 0 5px #0E0E11' : 'none' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mt-2.5 flex min-h-16 items-center gap-3 rounded-[22px] bg-white px-4">
          <span className="flex flex-1 flex-col gap-0.5 py-2.5">
            <span className="text-[15px] font-semibold">{S.rememberSignature}</span>
            <span className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
              {S.rememberSignatureHint}
            </span>
          </span>
          <input type="checkbox" role="switch" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden="true"
            className="relative h-[30px] w-[50px] flex-none rounded-[15px] transition-colors peer-focus-visible:outline peer-focus-visible:outline-2"
            style={{ background: remember ? 'var(--red)' : '#C9C9D1' }}
          >
            <span
              className="absolute top-[3px] h-6 w-6 rounded-full bg-white transition-all"
              style={{ left: remember ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
            />
          </span>
        </label>

        {saved.length > 0 && (
          <>
            <h2 className="mb-2 mt-4 text-[14px] font-semibold" style={{ color: '#3E3E47' }}>
              {S.savedSignatures}
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {saved.map((s) => (
                <div key={s.id} className="relative">
                  <button
                    aria-label={S.useSavedSignature}
                    onClick={() => placeSignature(s.dataUrl, s.aspect)}
                    className="flex h-16 w-[150px] items-center justify-center rounded-[20px] border-0 bg-white p-2"
                  >
                    <img src={s.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
                  </button>
                  <button
                    aria-label={S.removeSignature}
                    onClick={() => setSaved(removeSignature(s.id))}
                    className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: 'var(--ink)' }}>
                      <Icon name="close" size={12} strokeWidth={2.6} />
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="mt-3">
            <Help tone="error">{error}</Help>
          </div>
        )}
      </div>

      <button
        onClick={place}
        disabled={!ready}
        className="absolute left-5 right-5 flex h-[58px] items-center justify-center gap-2.5 rounded-[29px] border-0 text-[16px] font-semibold text-white"
        style={{ bottom: 'calc(var(--sab) + 28px)', background: 'var(--ink)', opacity: ready ? 1 : 0.4 }}
      >
        {S.placeOnPage}
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
