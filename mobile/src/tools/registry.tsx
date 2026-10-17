import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ColorRow, Help, Segmented, Slider, TextField } from '../components/Fields';
import type { IconName } from '../components/Icon';
import { pickImage, type PickedFile } from '../lib/documents';
import { expandRanges, parseRanges } from '../lib/ranges';
import { toBlob, type OutputFile } from '../lib/share';
import * as ops from '../lib/tools';
import { S, fill } from '../strings';

export type ToolId = 'merge' | 'split' | 'compress' | 'protect' | 'unlock' | 'watermark' | 'images' | 'insertImage' | 'photos';

export interface InputFile extends PickedFile {
  pages: number;
}

export interface ToolContext {
  files: InputFile[];
  /** İlk dosyanın sayfa sayısı (tek dosyalı araçlar için) */
  pages: number;
}

interface OptionsProps<St> {
  state: St;
  set: (patch: Partial<St>) => void;
  ctx: ToolContext;
  onError: (e: unknown) => void;
}

export interface ToolDef<St = any> {
  id: ToolId;
  icon: IconName;
  title: string;
  hint: string;
  multi: boolean;
  /** Seçilecek girdi: PDF (varsayılan), parolalı PDF ya da görseller */
  input?: 'pdf' | 'locked' | 'images';
  initial: () => St;
  Options?: (p: OptionsProps<St>) => ReactElement | null;
  /** null = çalıştırılabilir; '' = henüz eksik (mesajsız); metin = kullanıcıya gösterilecek hata */
  validate: (state: St, ctx: ToolContext) => string | null;
  run: (state: St, ctx: ToolContext, onProgress: (done: number, total: number) => void) => Promise<OutputFile[]>;
}

const define = <St,>(def: ToolDef<St>): ToolDef => def;

const MAX_IMAGE_PAGES = 30;

const WATERMARK_COLORS = [
  { hex: '#E5262C', name: S.colorRed },
  { hex: '#1E2129', name: S.colorBlack },
  { hex: '#2F7BEA', name: S.colorBlue },
  { hex: '#34C759', name: S.colorGreen },
  { hex: '#8E8E99', name: S.colorGray }
];

// ---------- Birleştir ----------
const merge = define<Record<string, never>>({
  id: 'merge',
  icon: 'merge',
  title: S.mergeTitle,
  hint: S.mergeHint,
  multi: true,
  initial: () => ({}),
  validate: (_, { files }) => (files.length < 2 ? S.mergeNeedTwo : null),
  run: (_, { files }) => ops.mergePdfs(files)
});

// ---------- Böl ----------
interface SplitState {
  mode: 'each' | 'ranges';
  ranges: string;
}
const split = define<SplitState>({
  id: 'split',
  icon: 'split',
  title: S.splitTitle,
  hint: S.splitHint,
  multi: false,
  initial: () => ({ mode: 'each', ranges: '' }),
  Options: ({ state, set }) => (
    <>
      <Segmented
        label={S.splitTitle}
        value={state.mode}
        options={[
          { value: 'each', label: S.splitEach },
          { value: 'ranges', label: S.splitByRanges }
        ]}
        onChange={(mode) => set({ mode })}
      />
      {state.mode === 'ranges' && (
        <>
          <TextField
            label={S.rangesLabel}
            value={state.ranges}
            placeholder={S.rangesPlaceholder}
            onChange={(ranges) => set({ ranges })}
          />
          <Help>{S.rangesHelp}</Help>
        </>
      )}
    </>
  ),
  validate: (st, { pages }) => {
    if (st.mode === 'each') return null;
    if (!st.ranges.trim()) return '';
    return parseRanges(st.ranges, pages) ? null : fill(S.rangesInvalid, { n: pages });
  },
  run: (st, { files, pages }) =>
    ops.splitPdf(
      files[0],
      st.mode === 'each'
        ? Array.from({ length: pages }, (_, i) => ({ start: i + 1, end: i + 1 }))
        : parseRanges(st.ranges, pages)!
    )
});

// ---------- Sıkıştır ----------
const compress = define<Record<string, never>>({
  id: 'compress',
  icon: 'compress',
  title: S.compressTitle,
  hint: S.compressHint,
  multi: false,
  initial: () => ({}),
  Options: () => <Help>{S.compressInfo}</Help>,
  validate: () => null,
  run: (_, { files }) => ops.compressPdf(files[0], S.compressNoSavings)
});

// ---------- Parola koru ----------
interface ProtectState {
  password: string;
  confirm: string;
}
const protect = define<ProtectState>({
  id: 'protect',
  icon: 'lock',
  title: S.protectTitle,
  hint: S.protectHint,
  multi: false,
  initial: () => ({ password: '', confirm: '' }),
  Options: ({ state, set }) => (
    <>
      <TextField type="password" label={S.newPassword} value={state.password} onChange={(password) => set({ password })} />
      <TextField type="password" label={S.confirmPassword} value={state.confirm} onChange={(confirm) => set({ confirm })} />
      <Help>{S.protectInfo}</Help>
    </>
  ),
  validate: ({ password, confirm }) => {
    if (!password) return '';
    if (password.length < 4) return S.passwordTooShort;
    if (!confirm) return '';
    return password === confirm ? null : S.passwordMismatch;
  },
  run: (st, { files }) => ops.protectPdf(files[0], st.password)
});

// ---------- Parolayı kaldır ----------
const unlock = define<{ password: string }>({
  id: 'unlock',
  icon: 'unlock',
  title: S.unlockTitle,
  hint: S.unlockHint,
  multi: false,
  input: 'locked',
  initial: () => ({ password: '' }),
  Options: ({ state, set }) => (
    <>
      <TextField type="password" label={S.currentPassword} value={state.password} onChange={(password) => set({ password })} />
      <Help>{S.unlockInfo}</Help>
    </>
  ),
  validate: ({ password }) => (password ? null : ''),
  run: (st, { files }) => ops.unlockPdf(files[0], st.password)
});

// ---------- Fotoğraflardan PDF ----------
const MAX_PHOTOS = 50;
const photos = define<{ size: 'a4' | 'fit' }>({
  id: 'photos',
  icon: 'camera',
  title: S.photosTitle,
  hint: S.photosHint,
  multi: true,
  input: 'images',
  initial: () => ({ size: 'a4' }),
  Options: ({ state, set }) => (
    <Segmented
      label={S.pageSize}
      value={state.size}
      options={[
        { value: 'a4', label: S.pageSizeA4 },
        { value: 'fit', label: S.pageSizeFit }
      ]}
      onChange={(size) => set({ size })}
    />
  ),
  validate: (_, { files }) => (files.length > MAX_PHOTOS ? fill(S.photosTooMany, { n: MAX_PHOTOS }) : null),
  run: (st, { files }, onProgress) => ops.imagesToPdf(files, st.size, onProgress)
});

// ---------- Filigran ----------
interface WatermarkState {
  text: string;
  color: string;
  opacity: number;
}
const watermark = define<WatermarkState>({
  id: 'watermark',
  icon: 'drop',
  title: S.watermarkTitle,
  hint: S.watermarkHint,
  multi: false,
  initial: () => ({ text: '', color: WATERMARK_COLORS[0].hex, opacity: 25 }),
  Options: ({ state, set }) => (
    <>
      <TextField
        label={S.watermarkText}
        value={state.text}
        placeholder={S.watermarkPlaceholder}
        onChange={(text) => set({ text })}
      />
      <ColorRow label={S.color} value={state.color} colors={WATERMARK_COLORS} onChange={(color) => set({ color })} />
      <Slider
        label={S.opacity}
        value={state.opacity}
        min={5}
        max={80}
        format={(v) => fill(S.percent, { v })}
        onChange={(opacity) => set({ opacity })}
      />
    </>
  ),
  validate: ({ text }) => (text.trim() ? null : ''),
  run: (st, { files }) => ops.watermarkPdf(files[0], st.text.trim(), st.color, st.opacity / 100)
});

// ---------- Görsele aktar ----------
interface ImagesState {
  pages: string;
  format: 'png' | 'jpeg';
  scale: number;
}
const images = define<ImagesState>({
  id: 'images',
  icon: 'image',
  title: S.imagesTitle,
  hint: S.imagesHint,
  multi: false,
  initial: () => ({ pages: '1', format: 'png', scale: 2 }),
  Options: ({ state, set }) => (
    <>
      <TextField label={S.imagePages} value={state.pages} placeholder={S.rangesPlaceholder} onChange={(pages) => set({ pages })} />
      <Help>{S.imagePagesHelp}</Help>
      <Segmented
        label={S.format}
        value={state.format}
        options={[
          { value: 'png', label: 'PNG' },
          { value: 'jpeg', label: 'JPEG' }
        ]}
        onChange={(format) => set({ format })}
      />
      <Segmented
        label={S.resolution}
        value={state.scale}
        options={[
          { value: 1, label: '1×' },
          { value: 2, label: '2×' },
          { value: 3, label: '3×' }
        ]}
        onChange={(scale) => set({ scale })}
      />
    </>
  ),
  validate: (st, { pages }) => {
    if (!st.pages.trim()) return '';
    const ranges = parseRanges(st.pages, pages);
    if (!ranges) return fill(S.rangesInvalid, { n: pages });
    return expandRanges(ranges).length > MAX_IMAGE_PAGES ? S.imagePagesTooMany : null;
  },
  run: (st, { files, pages }, onProgress) =>
    ops.exportImages(files[0], expandRanges(parseRanges(st.pages, pages)!), st.format, st.scale, onProgress)
});

// ---------- Görsel ekle ----------
interface InsertImageState {
  image: PickedFile | null;
  page: string;
  width: number;
}

function ImagePreview({ image }: { image: PickedFile }) {
  const url = useMemo(() => URL.createObjectURL(toBlob(image.data)), [image]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="max-h-40 w-full rounded-xl object-contain" style={{ background: 'var(--bg)' }} />;
}

function InsertImageOptions({ state, set, onError }: OptionsProps<InsertImageState>) {
  const [picking, setPicking] = useState(false);
  const choose = async () => {
    setPicking(true);
    try {
      const image = await pickImage();
      if (image) set({ image });
    } catch (e) {
      onError(e);
    } finally {
      setPicking(false);
    }
  };
  return (
    <>
      <span className="text-[14px] font-semibold">{S.image}</span>
      {state.image && <ImagePreview image={state.image} />}
      <button
        onClick={choose}
        disabled={picking}
        className="h-12 rounded-2xl border-0 text-[15px] font-semibold"
        style={{ background: 'var(--red-tint)', color: 'var(--red-ink)' }}
      >
        {state.image ? S.change : S.chooseImage}
      </button>
      <TextField
        label={S.targetPage}
        type="number"
        inputMode="numeric"
        value={state.page}
        onChange={(page) => set({ page })}
      />
      <Slider
        label={S.imageWidth}
        value={state.width}
        min={10}
        max={100}
        step={5}
        format={(v) => fill(S.percent, { v })}
        onChange={(width) => set({ width })}
      />
      <Help>{S.insertImageInfo}</Help>
    </>
  );
}

const insertImage = define<InsertImageState>({
  id: 'insertImage',
  icon: 'imageAdd',
  title: S.insertImageTitle,
  hint: S.insertImageHint,
  multi: false,
  initial: () => ({ image: null, page: '1', width: 50 }),
  Options: InsertImageOptions,
  validate: (st, { pages }) => {
    if (!st.image) return '';
    const p = Number(st.page);
    return Number.isInteger(p) && p >= 1 && p <= pages ? null : fill(S.rangesInvalid, { n: pages });
  },
  run: (st, { files }) => ops.insertImage(files[0], st.image!, Number(st.page), st.width)
});

export const TOOLS: Record<ToolId, ToolDef> = { merge, split, compress, protect, unlock, watermark, images, insertImage, photos };
