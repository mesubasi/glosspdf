import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { parseWidgets, useForm, type Field } from '../lib/form';
import { S } from '../strings';

interface Props {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  /** Sayfa biriminden CSS pikseline ölçek */
  scale: number;
  pageH: number;
}

/**
 * Sayfadaki form alanlarının üstüne dokunulabilir kutular koyar. Dokunulmamış alan şeffaftır
 * (PDF'in kendi çizimi görünür); değiştirilen alan beyaz zeminle yeni değeri gösterir.
 */
export function FormLayer({ pdf, pageNumber, scale, pageH }: Props) {
  const [fields, setFields] = useState<Field[]>([]);
  const values = useForm((s) => s.values);

  useEffect(() => {
    let alive = true;
    void pdf
      .getPage(pageNumber)
      .then(async (page) => {
        const vp = page.getViewport({ scale: 1 });
        const annots = await page.getAnnotations({ intent: 'display' });
        const found = parseWidgets(annots, (rect) => {
          const [x1, y1, x2, y2] = vp.convertToViewportRectangle(rect);
          return [Math.min(x1, x2) / vp.width, Math.min(y1, y2) / vp.height, Math.abs(x2 - x1) / vp.width, Math.abs(y2 - y1) / vp.height];
        });
        if (alive) setFields(found);
      })
      .catch((e) => console.warn('Form fields could not be read:', e));
    return () => {
      alive = false;
    };
  }, [pdf, pageNumber]);

  if (!fields.length) return null;
  const { set, setEditing } = useForm.getState();

  return (
    <>
      {fields.map((f, i) => {
        const value = values[f.name] ?? f.value;
        const edited = f.name in values;
        const hPt = f.rect[3] * pageH;
        const style: CSSProperties = {
          left: `${f.rect[0] * 100}%`,
          top: `${f.rect[1] * 100}%`,
          width: `${f.rect[2] * 100}%`,
          height: `${f.rect[3] * 100}%`,
          fontSize: Math.min(hPt * 0.7, f.kind === 'text' && f.multiline ? 10 : 12) * scale,
          background: edited ? '#FFFFFF' : 'rgba(47,123,234,0.10)',
          boxShadow: 'inset 0 0 0 1px rgba(47,123,234,0.55)',
          color: '#0E0E11',
          fontFamily: 'GlossSans, sans-serif'
        };
        const cls = 'absolute z-[5] flex overflow-hidden rounded-[2px] border-0 p-0';
        const label = `${f.name}: ${typeof value === 'boolean' ? '' : value}`;

        if (f.kind === 'check' || f.kind === 'radio') {
          const on = f.kind === 'check' ? !!value : value === f.on;
          return (
            <button
              key={i}
              role={f.kind === 'check' ? 'checkbox' : 'radio'}
              aria-checked={on}
              aria-label={f.name}
              disabled={f.readOnly}
              onClick={() => set(f.name, f.kind === 'check' ? !on : f.on)}
              className={`${cls} items-center justify-center`}
              style={{ ...style, fontSize: hPt * 0.8 * scale, borderRadius: f.kind === 'radio' ? '50%' : 2 }}
            >
              {edited && on ? (f.kind === 'check' ? '✓' : '●') : ''}
            </button>
          );
        }

        if (f.kind === 'choice') {
          return (
            <label key={i} className={`${cls} items-center px-[0.2em]`} style={style}>
              <span className="truncate">{edited ? String(value) : ''}</span>
              <select
                aria-label={f.name}
                disabled={f.readOnly}
                value={String(value)}
                onChange={(e) => set(f.name, e.target.value)}
                className="absolute inset-0 opacity-0"
              >
                {!f.options.includes(String(value)) && <option value="" />}
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <button
            key={i}
            aria-label={label}
            disabled={f.readOnly}
            onClick={() => setEditing(f)}
            className={`${cls} px-[0.2em] text-start ${f.multiline ? 'items-start whitespace-pre-wrap break-words' : 'items-center whitespace-pre'}`}
            style={style}
          >
            {edited ? String(value) : ''}
          </button>
        );
      })}
    </>
  );
}

/** Metin alanına yazma penceresi: küçük kutuya parmakla yazmak yerine tam genişlikte giriş */
export function FieldSheet() {
  const field = useForm((s) => s.editing);
  const values = useForm((s) => s.values);
  const [text, setText] = useState('');
  useEffect(() => {
    if (field?.kind === 'text') setText(String(values[field.name] ?? field.value));
    // Yalnızca pencere açılırken doldurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);
  if (field?.kind !== 'text') return null;

  const { set, setEditing } = useForm.getState();
  const close = () => setEditing(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    set(field.name, text);
    close();
  };
  const common = {
    autoFocus: true,
    'aria-label': field.name,
    value: text,
    maxLength: field.maxLen,
    onChange: (e: { target: { value: string } }) => setText(e.target.value)
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={S.fillField} className="fixed inset-0 z-50 flex items-end p-3" style={{ background: 'rgba(14,14,17,0.35)' }}>
      <form onSubmit={save} className="glass flex w-full flex-col gap-3 rounded-[26px] p-4" style={{ marginBottom: 'var(--sab)' }}>
        <div>
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">{S.fillField}</h2>
          <p className="mono mt-0.5 truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {field.name}
          </p>
        </div>
        {field.multiline ? (
          <textarea {...common} rows={4} className="resize-none rounded-2xl border-0 bg-[var(--card)] p-3 text-[15px] outline-none" />
        ) : (
          <input {...common} enterKeyHint="done" className="h-12 rounded-2xl border-0 bg-[var(--card)] px-4 text-[15px] outline-none" />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={close} className="h-12 flex-1 rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold">
            {S.cancel}
          </button>
          <button type="submit" className="h-12 flex-1 rounded-3xl border-0 text-[15px] font-semibold text-white" style={{ background: 'var(--red)' }}>
            {S.done}
          </button>
        </div>
      </form>
    </div>
  );
}
