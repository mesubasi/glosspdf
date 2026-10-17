import { NotAPdfError } from './lib/documents';
import { EncryptedPdfError, UnsupportedImageError } from './lib/tools';
import { S } from './strings';

/** Bilinen hataları kullanıcı metnine çevirir; bilinmeyenleri günlüğe yazar. */
export function messageFor(e: unknown): string {
  if (e instanceof NotAPdfError) return S.errorNotPdf;
  if (e instanceof EncryptedPdfError) return S.errorEncrypted;
  if (e instanceof UnsupportedImageError) return S.errorImage;
  console.error('Tool failed:', e);
  return S.errorTool;
}
