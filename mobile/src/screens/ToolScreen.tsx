import { useEffect, useMemo, useState } from 'react';
import { Help, Section } from '../components/Fields';
import { Icon } from '../components/Icon';
import { ResultSheet } from '../components/ResultSheet';
import { messageFor } from '../errors';
import { pickImages, pickPdfs, type PickedFile } from '../lib/documents';
import { formatBytes, toBlob, type OutputFile } from '../lib/share';
import { inspectLockedPdf, inspectPdf } from '../lib/tools';
import { useMobile } from '../store';
import { S, fill } from '../strings';
import { TOOLS, type InputFile, type ToolContext } from '../tools/registry';

function Thumb({ data }: { data: Uint8Array }) {
  const url = useMemo(() => URL.createObjectURL(toBlob(data)), [data]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="h-10 w-10 flex-none rounded-lg object-cover" />;
}

export function ToolScreen() {
  const toolId = useMobile((s) => s.toolId)!;
  const preset = useMobile((s) => s.toolPreset);
  const leaveTool = useMobile((s) => s.leaveTool);
  const tool = TOOLS[toolId];

  const [files, setFiles] = useState<InputFile[]>([]);
  const [options, setOptions] = useState(() => tool.initial());
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctx: ToolContext = { files, pages: files[0]?.pages ?? 0 };
  const validation = files.length === 0 ? '' : tool.validate(options, ctx);

  const input = tool.input ?? 'pdf';

  /** Seçilen dosyaları denetler (şifreli mi, kaç sayfa) ve listeye ekler. Görseller olduğu gibi eklenir. */
  const addFiles = async (picked: PickedFile[]) => {
    const inspect = input === 'images' ? async () => 0 : input === 'locked' ? inspectLockedPdf : inspectPdf;
    const inspected = await Promise.all(picked.map(async (f) => ({ ...f, pages: await inspect(f.data) })));
    setFiles((prev) => (tool.multi ? [...prev, ...inspected] : inspected.slice(0, 1)));
  };

  const busyRun = async (task: () => Promise<void>) => {
    setWorking(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setWorking(false);
      setProgress(null);
    }
  };

  useEffect(() => {
    // Okuyucudaki belge yalnızca PDF alan araçlara hazır gelir
    if (preset && input !== 'images') void busyRun(() => addFiles([preset]));
    // Yalnızca ekran açılırken: hazır belge bir kez eklenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = () =>
    busyRun(async () => {
      const picked = input === 'images' ? await pickImages() : await pickPdfs(tool.multi);
      if (picked.length) await addFiles(picked);
    });

  const run = () =>
    busyRun(async () => {
      setOutputs(await tool.run(options, ctx, (done, total) => setProgress([done, total])));
    });

  const move = (i: number, delta: number) =>
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(i + delta, 0, item);
      return next;
    });

  const Options = tool.Options;

  return (
    <div className="relative h-full" style={{ background: 'var(--bg)' }}>
      <div
        className="h-full overflow-y-auto px-5"
        style={{ paddingTop: 'calc(var(--sat) + 84px)', paddingBottom: 'calc(var(--sab) + 104px)' }}
      >
        <Section title={tool.multi ? S.files : S.file}>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2">
              {input === 'images' ? (
                <Thumb data={f.data} />
              ) : (
                <span
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
                  style={{ background: 'var(--red-tint)', color: 'var(--red-ink)' }}
                >
                  <Icon name={input === 'locked' ? 'lock' : 'doc'} size={19} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold">{f.name}</div>
                <div className="mono text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  {f.pages > 0 && `${f.pages} ${S.pages} · `}
                  {formatBytes(f.data.length)}
                </div>
              </div>
              {tool.multi && (
                <>
                  <button
                    className="round-btn"
                    aria-label={`${S.moveUp}: ${f.name}`}
                    disabled={i === 0}
                    style={{ opacity: i === 0 ? 0.3 : 1 }}
                    onClick={() => move(i, -1)}
                  >
                    <Icon name="up" />
                  </button>
                  <button
                    className="round-btn"
                    aria-label={`${S.moveDown}: ${f.name}`}
                    disabled={i === files.length - 1}
                    style={{ opacity: i === files.length - 1 ? 0.3 : 1 }}
                    onClick={() => move(i, 1)}
                  >
                    <Icon name="down" />
                  </button>
                  <button
                    className="round-btn"
                    aria-label={`${S.removeFile}: ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </>
              )}
            </div>
          ))}
          <button
            onClick={pick}
            disabled={working}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border-0 text-[15px] font-semibold"
            style={{ background: 'var(--red-tint)', color: 'var(--red-ink)' }}
          >
            <Icon name="plus" size={18} strokeWidth={2.2} />
            {input === 'images' ? S.addPhotos : tool.multi ? S.addPdfs : files.length ? S.change : S.choosePdf}
          </button>
        </Section>

        {Options && files.length > 0 && (
          <Section title={S.options}>
            <Options
              state={options}
              set={(patch) => setOptions((prev: object) => ({ ...prev, ...patch }))}
              ctx={ctx}
              onError={(e) => setError(messageFor(e))}
            />
          </Section>
        )}

        {(error || validation) && (
          <div className="mt-4 px-1">
            <Help tone="error">{error || validation}</Help>
          </div>
        )}
      </div>

      <header
        className="glass absolute flex items-center gap-0.5 rounded-[28px] px-1.5"
        style={{ top: 'calc(var(--sat) + 8px)', left: 12, right: 12, height: 56 }}
      >
        <button className="round-btn" aria-label={S.back} onClick={leaveTool}>
          <Icon name="back" size={22} strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{tool.title}</div>
      </header>

      <div className="absolute left-4 right-4" style={{ bottom: 'calc(var(--sab) + 24px)' }}>
        <button
          onClick={run}
          disabled={validation !== null || working}
          className="h-14 w-full rounded-[28px] border-0 text-[16px] font-semibold text-white"
          style={{
            background: 'var(--red)',
            opacity: validation !== null || working ? 0.45 : 1,
            boxShadow: '0 12px 28px rgba(216,30,36,0.28)'
          }}
        >
          {working ? (progress ? `${S.working} ${fill(S.progress, { done: progress[0], total: progress[1] })}` : S.working) : S.apply}
        </button>
      </div>

      {outputs && <ResultSheet title={tool.title} outputs={outputs} onClose={() => setOutputs(null)} />}
    </div>
  );
}
