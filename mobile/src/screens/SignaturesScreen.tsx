import { useState } from 'react';
import { Dock } from '../components/Dock';
import { Help } from '../components/Fields';
import { Icon } from '../components/Icon';
import { loadSignatures, removeSignature } from '../lib/signatures';
import { useMobile } from '../store';
import { S } from '../strings';

/** Alt çubuktaki "İmzalar": kayıtlı imzaları yönet, yenisini oluştur ya da bir PDF'e yerleştir. */
export function SignaturesScreen() {
  const openSignCreate = useMobile((s) => s.openSignCreate);
  const signWithSaved = useMobile((s) => s.signWithSaved);
  const [saved, setSaved] = useState(loadSignatures);

  return (
    <div className="h-full overflow-y-auto" style={{ padding: 'calc(var(--sat) + 20px) 20px calc(var(--sab) + 112px)' }}>
      <h1 className="text-[42px] font-bold leading-[1.05] tracking-[-0.045em]">{S.signatures}</h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>
        {S.signaturesHint}
      </p>

      <div className="mt-[18px] grid grid-cols-2 gap-2.5">
        {saved.map((s) => (
          <div key={s.id} className="relative">
            <button
              aria-label={S.useSavedSignature}
              onClick={() => signWithSaved(s.dataUrl, s.aspect)}
              className="flex h-24 w-full items-center justify-center rounded-[20px] border-0 bg-white p-3"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <img src={s.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
            </button>
            <button
              aria-label={S.removeSignature}
              onClick={() => setSaved(removeSignature(s.id))}
              className="absolute -end-2 -top-2 flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: 'var(--solid)' }}>
                <Icon name="close" size={12} strokeWidth={2.6} />
              </span>
            </button>
          </div>
        ))}
        <button
          onClick={openSignCreate}
          className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-[20px] bg-transparent p-2 text-[13px] font-semibold"
          style={{ border: '1.5px dashed var(--dash)', color: 'var(--muted)' }}
        >
          <Icon name="plus" size={20} strokeWidth={2} />
          {S.newSignature}
        </button>
      </div>

      <div className="mt-3">
        <Help>{saved.length ? S.signaturesTapHint : S.noSignatures}</Help>
      </div>
      <Dock active="signatures" />
    </div>
  );
}
