import { useEffect, useState, type FormEvent } from 'react';
import { PdfRenderService } from '@/services/pdfRenderService';
import type { BookmarkItem } from '@/types/pdf';
import type { OpenDoc } from '../store';
import { S } from '../strings';

interface Row {
  title: string;
  page: number;
  depth: number;
}

const flatten = (items: BookmarkItem[], depth = 0): Row[] =>
  items.flatMap((it) => [{ title: it.title, page: it.pageNumber, depth }, ...flatten(it.children ?? [], depth + 1)]);

/** Okuyucudaki "…" menüsünden: sayfa numarasına git ve belgenin içindekiler listesi. */
export function OutlineSheet({ doc, current, onGo, onClose }: { doc: OpenDoc; current: number; onGo: (page: number) => void; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [value, setValue] = useState(String(current));

  useEffect(() => {
    let alive = true;
    void PdfRenderService.getDocumentOutline(doc.pdf).then((items) => alive && setRows(flatten(items)));
    return () => {
      alive = false;
    };
  }, [doc.pdf]);

  const page = Number(value);
  const valid = Number.isInteger(page) && page >= 1 && page <= doc.pages;
  const go = (p: number) => {
    onGo(p);
    onClose();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) go(page);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={S.goToPage} className="fixed inset-0 z-40 flex items-end" style={{ background: 'rgba(14,14,17,0.4)' }}>
      <div className="glass m-3 flex max-h-[80%] w-full flex-col gap-3 rounded-[28px] p-5" style={{ marginBottom: 'calc(var(--sab) + 12px)' }}>
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">{S.goToPage}</h2>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="go"
            min={1}
            max={doc.pages}
            aria-label={S.pageNumber}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="mono h-12 min-w-0 flex-1 rounded-2xl border-0 bg-[var(--card)] px-4 text-[15px] outline-none"
          />
          <span className="mono flex items-center text-[13px]" style={{ color: 'var(--muted)' }}>
            / {doc.pages}
          </span>
          <button
            type="submit"
            disabled={!valid}
            className="h-12 rounded-3xl border-0 px-5 text-[15px] font-semibold text-white"
            style={{ background: 'var(--red)', opacity: valid ? 1 : 0.4 }}
          >
            {S.go}
          </button>
        </form>

        <h3 className="mt-1 text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>
          {S.contents}
        </h3>
        {rows === null ? (
          <p className="text-[14px]" style={{ color: 'var(--muted)' }}>…</p>
        ) : rows.length === 0 ? (
          <p className="text-[14px]" style={{ color: 'var(--muted)' }}>{S.noContents}</p>
        ) : (
          <ul className="flex flex-col overflow-y-auto rounded-2xl bg-[var(--card)] py-1">
            {rows.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => go(r.page)}
                  className="flex min-h-11 w-full items-center gap-3 border-0 bg-transparent py-2 pe-4 text-start active:bg-[var(--press)]"
                  style={{ paddingInlineStart: 16 + Math.min(r.depth, 3) * 16 }}
                >
                  <span className={`min-w-0 flex-1 text-[14.5px] ${r.depth ? '' : 'font-medium'}`}>{r.title}</span>
                  <span className="mono flex-none text-[12px]" style={{ color: 'var(--muted)' }}>
                    {r.page}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onClose} className="h-12 flex-none rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold">
          {S.close}
        </button>
      </div>
    </div>
  );
}
