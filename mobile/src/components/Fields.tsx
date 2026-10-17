import { useId, type ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--muted)' }}>
        {title}
      </h2>
      <div className="flex flex-col gap-3 rounded-[22px] bg-[var(--card)] p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        {children}
      </div>
    </section>
  );
}

export function Help({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className="text-[13px] leading-snug"
      style={{ color: tone === 'error' ? 'var(--red-ink)' : 'var(--muted)' }}
    >
      {children}
    </p>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password' | 'number';
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {props.label}
      </label>
      <input
        id={id}
        type={props.type ?? 'text'}
        inputMode={props.inputMode}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-12 rounded-2xl border-0 px-4 text-[15px] outline-none"
        style={{ background: 'var(--bg)' }}
        autoComplete="off"
      />
    </div>
  );
}

export function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold">{props.label}</span>
      <div role="radiogroup" aria-label={props.label} className="flex gap-1 rounded-2xl p-1" style={{ background: 'var(--bg)' }}>
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <button
              key={String(o.value)}
              role="radio"
              aria-checked={on}
              onClick={() => props.onChange(o.value)}
              className="h-11 flex-1 rounded-xl border-0 text-[14px] font-semibold"
              style={{
                background: on ? 'var(--raised)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--muted)',
                boxShadow: on ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {props.label}
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="h-11 flex-1"
        style={{ accentColor: 'var(--ink)' }}
      />
      <span className="mono w-12 text-end text-[12.5px]" style={{ color: 'var(--muted)' }}>
        {props.format(props.value)}
      </span>
    </div>
  );
}

export function ColorRow(props: { label: string; value: string; colors: { hex: string; name: string }[]; onChange: (hex: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold">{props.label}</span>
      <div role="radiogroup" aria-label={props.label} className="flex justify-between">
        {props.colors.map((c) => {
          const on = c.hex === props.value;
          return (
            <button
              key={c.hex}
              role="radio"
              aria-checked={on}
              aria-label={c.name}
              onClick={() => props.onChange(c.hex)}
              className="flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0"
            >
              <span
                className="h-7 w-7 rounded-full"
                style={{ background: c.hex, boxShadow: on ? '0 0 0 3px var(--card), 0 0 0 5px var(--ink)' : 'inset 0 0 0 1px var(--line)' }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
