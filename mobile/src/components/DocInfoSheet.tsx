import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/share';
import type { OpenDoc } from '../store';
import { S } from '../strings';

interface Meta {
  title?: string;
  author?: string;
  creator?: string;
  version?: string;
}

/** Okuyucudaki "…" menüsünden: dosya adı, boyut ve PDF'in kendi bilgileri. */
export function DocInfoSheet({ doc, onClose }: { doc: OpenDoc; onClose: () => void }) {
  const [meta, setMeta] = useState<Meta>({});

  useEffect(() => {
    let alive = true;
    doc.pdf
      .getMetadata()
      .then(({ info }) => {
        const i = info as Record<string, string | undefined>;
        if (alive) setMeta({ title: i.Title, author: i.Author, creator: i.Creator || i.Producer, version: i.PDFFormatVersion });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [doc.pdf]);

  const rows: [string, string | undefined][] = [
    [S.infoName, doc.name],
    [S.infoPages, String(doc.pages)],
    [S.infoSize, formatBytes(doc.data.length)],
    [S.infoTitle, meta.title],
    [S.infoAuthor, meta.author],
    [S.infoCreator, meta.creator],
    [S.infoVersion, meta.version]
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label={S.docInfo} className="fixed inset-0 z-40 flex items-end" style={{ background: 'rgba(14,14,17,0.4)' }}>
      <div className="glass m-3 flex max-h-[80%] w-full flex-col gap-3 rounded-[28px] p-5" style={{ marginBottom: 'calc(var(--sab) + 12px)' }}>
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">{S.docInfo}</h2>
        <dl className="flex flex-col overflow-y-auto rounded-2xl bg-[var(--card)] px-4">
          {rows
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b py-3 last:border-0" style={{ borderColor: 'var(--line)' }}>
                <dt className="flex-none text-[13px]" style={{ color: 'var(--muted)' }}>
                  {k}
                </dt>
                <dd className="min-w-0 break-words text-end text-[14px] font-medium">{v}</dd>
              </div>
            ))}
        </dl>
        <button onClick={onClose} className="h-12 rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold">
          {S.close}
        </button>
      </div>
    </div>
  );
}
