import { create } from 'zustand';

export type FieldValue = string | boolean;

/** Sayfa üzerindeki konum, sayfa boyutuna oran olarak: [sol, üst, genişlik, yükseklik] */
export type FieldRect = [number, number, number, number];

interface Base {
  name: string;
  rect: FieldRect;
  readOnly: boolean;
}

export type Field =
  | (Base & { kind: 'text'; value: string; multiline: boolean; maxLen?: number })
  | (Base & { kind: 'check'; value: boolean })
  | (Base & { kind: 'radio'; on: string; value: string })
  | (Base & { kind: 'choice'; options: string[]; value: string });

// PDF annotation bayrakları: Hidden (2), NoView (32)
const INVISIBLE = 2 | 32;

/**
 * pdf.js getAnnotations() çıktısından doldurulabilir alanları çıkarır.
 * toRect: PDF dikdörtgenini sayfaya oranlı ekran dikdörtgenine çevirir (döndürme dahil).
 * İmza alanları ve düğmeler atlanır.
 */
export function parseWidgets(annots: any[], toRect: (rect: number[]) => FieldRect): Field[] {
  const fields: Field[] = [];
  for (const a of annots) {
    if (a.subtype !== 'Widget' || !a.rect || !a.fieldName || a.annotationFlags & INVISIBLE) continue;
    const base: Base = { name: a.fieldName, rect: toRect(a.rect), readOnly: !!a.readOnly };
    const fv = a.fieldValue;
    if (a.fieldType === 'Tx') {
      fields.push({ ...base, kind: 'text', value: typeof fv === 'string' ? fv : '', multiline: !!a.multiLine, maxLen: a.maxLen || undefined });
    } else if (a.fieldType === 'Btn' && a.checkBox) {
      fields.push({ ...base, kind: 'check', value: !!fv && fv !== 'Off' });
    } else if (a.fieldType === 'Btn' && a.radioButton && a.buttonValue) {
      fields.push({ ...base, kind: 'radio', on: String(a.buttonValue), value: typeof fv === 'string' ? fv : '' });
    } else if (a.fieldType === 'Ch' && Array.isArray(a.options)) {
      const options: { exportValue?: string; displayValue?: string }[] = a.options;
      // pdf-lib seçenekleri görünen adla seçer; dışa aktarım değeri görünen ada çevrilir
      const current = Array.isArray(fv) ? fv[0] : fv;
      const hit = options.find((o) => o.exportValue === current || o.displayValue === current);
      fields.push({
        ...base,
        kind: 'choice',
        options: options.map((o) => o.displayValue ?? o.exportValue ?? ''),
        value: hit ? (hit.displayValue ?? hit.exportValue ?? '') : ''
      });
    }
  }
  return fields;
}

interface FormState {
  /** Yalnızca kullanıcının değiştirdiği alanlar (tam alan adı → değer) */
  values: Record<string, FieldValue>;
  /** Metin yazma penceresi açık olan alan */
  editing: Field | null;
  set: (name: string, value: FieldValue) => void;
  setEditing: (field: Field | null) => void;
  reset: () => void;
}

export const useForm = create<FormState>((set) => ({
  values: {},
  editing: null,
  set: (name, value) => set((s) => ({ values: { ...s.values, [name]: value } })),
  setEditing: (editing) => set({ editing }),
  reset: () => set({ values: {}, editing: null })
}));

export const formDirty = () => Object.keys(useForm.getState().values).length > 0;
