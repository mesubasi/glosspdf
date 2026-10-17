import { useState } from 'react';
import { saveFiles, shareFiles, formatBytes, type OutputFile } from '../lib/share';
import { useMobile } from '../store';
import { S, fill } from '../strings';
import { Help } from './Fields';
import { Icon } from './Icon';

/** İşlem sonucu: dosyaları kaydet, paylaş ya da (tek PDF ise) okuyucuda aç. */
export function ResultSheet(props: {
  title: string;
  outputs: OutputFile[];
  onClose: () => void;
  /** Dosyalar kaydedildi ya da paylaşıldı (iptal edilmedi) */
  onDelivered?: () => void;
  /** "Belgeyi aç" gösterilsin mi (varsayılan: tek PDF çıktıda) */
  canOpen?: boolean;
}) {
  const { title, outputs, onClose, onDelivered } = props;
  const openOutput = useMobile((s) => s.openOutput);
  const [status, setStatus] = useState<{ tone: 'muted' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const canOpen = props.canOpen ?? (outputs.length === 1 && outputs[0].mime === 'application/pdf');

  const share = async () => {
    setStatus(null);
    try {
      if (await shareFiles(outputs, title)) onDelivered?.();
    } catch (e) {
      console.error('Share failed:', e);
      setStatus({ tone: 'error', text: S.errorShare });
    }
  };

  const save = async () => {
    setStatus(null);
    setSaving(true);
    try {
      const saved = await saveFiles(outputs);
      if (saved > 0) {
        setStatus({ tone: 'muted', text: saved === 1 ? S.savedOne : fill(S.savedMany, { n: saved }) });
        onDelivered?.();
      }
    } catch (e) {
      console.error('Save failed:', e);
      setStatus({ tone: 'error', text: S.errorSave });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={S.resultTitle}
      className="fixed inset-0 z-40 flex items-end"
      style={{ background: 'rgba(14,14,17,0.4)' }}
    >
      <div
        className="glass m-3 flex max-h-[80%] w-full flex-col gap-3 rounded-[28px] p-5"
        style={{ marginBottom: 'calc(var(--sab) + 12px)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: '#1E8E3E' }}>
            <Icon name="check" size={18} strokeWidth={2.4} />
          </span>
          <h2 className="text-[19px] font-bold tracking-[-0.02em]">{S.resultTitle}</h2>
        </div>
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {outputs.map((o) => (
            <li key={o.name} className="rounded-2xl bg-[var(--card)] px-4 py-3">
              <div className="truncate text-[14px] font-semibold">{o.name}</div>
              <div className="mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                {o.note ?? formatBytes(o.bytes.length)}
              </div>
            </li>
          ))}
        </ul>
        {status && (
          <div aria-live="polite">
            <Help tone={status.tone}>{status.text}</Help>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-3xl border-0 text-[15px] font-semibold text-white"
            style={{ background: 'var(--red)', opacity: saving ? 0.6 : 1 }}
          >
            <Icon name="download" size={18} />
            {S.save}
          </button>
          <button
            onClick={share}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-3xl border-0 text-[15px] font-semibold text-white"
            style={{ background: 'var(--solid)' }}
          >
            <Icon name="share" size={18} />
            {S.share}
          </button>
        </div>
        <div className="flex gap-2">
          {canOpen && (
            <button
              onClick={() => openOutput(outputs[0])}
              className="h-12 flex-1 rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold"
            >
              {S.openResult}
            </button>
          )}
          <button onClick={onClose} className="h-12 flex-1 rounded-3xl border-0 bg-[var(--card)] text-[15px] font-semibold">
            {S.close}
          </button>
        </div>
      </div>
    </div>
  );
}
