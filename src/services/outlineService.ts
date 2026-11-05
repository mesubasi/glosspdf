import { PDFDict, PDFHexString, PDFName, PDFNumber, PDFRef } from 'pdf-lib';
import type { PDFDocument, PDFObject } from 'pdf-lib';
import type { BookmarkItem } from '../types/pdf';

// Yalnızca pdf-lib ve tiplere bağlı kalır: node --experimental-strip-types ile doğrudan test edilebilir.

/** Sayfaları yeniden numaralar; pageOf undefined dönerse öğe düşer, çocukları onun yerine geçer */
function mapOutline(items: BookmarkItem[], pageOf: (page: number) => number | undefined): BookmarkItem[] {
  return items.flatMap((item) => {
    const children = mapOutline(item.children ?? [], pageOf);
    const pageNumber = pageOf(item.pageNumber);
    return pageNumber === undefined ? children : [{ ...item, pageNumber, children }];
  });
}

/** Sayfa sırası değişince (düzenle, sil, boş sayfa ekle): pageOrder[yeniSıra] = eski sayfa no (yeni sayfa için 0) */
export function remapOutline(outline: BookmarkItem[], pageOrder: number[]): BookmarkItem[] {
  const newPage = new Map<number, number>();
  pageOrder.forEach((oldPage, i) => {
    if (!newPage.has(oldPage)) newPage.set(oldPage, i + 1);
  });
  return mapOutline(outline, (page) => newPage.get(page));
}

/** Birleştirme: belge öndeki sayfaların arkasına eklendiğinde yer imleri de kayar */
export const offsetOutline = (outline: BookmarkItem[], offset: number): BookmarkItem[] =>
  mapOutline(outline, (page) => page + offset);

/** Bölme: start..end aralığındaki yer imleri, parçanın kendi sayfa numaralarıyla */
export const sliceOutline = (outline: BookmarkItem[], start: number, end: number): BookmarkItem[] =>
  mapOutline(outline, (page) => (page >= start && page <= end ? page - start + 1 : undefined));

/** Yer imi ağacını (/Outlines) baştan yazar; boş liste dosyadaki yer imlerini kaldırır. */
export function writeOutline(doc: PDFDocument, outline: BookmarkItem[]): void {
  const { context, catalog } = doc;
  const name = PDFName.of;

  // Eski öğeler bağlamdan silinir; yoksa kayıtta sahipsiz nesne olarak dosyada kalırlar
  const seen = new Set<string>();
  const drop = (ref: PDFObject | undefined) => {
    while (ref instanceof PDFRef && !seen.has(ref.toString())) {
      seen.add(ref.toString());
      const item = context.lookup(ref);
      context.delete(ref);
      if (!(item instanceof PDFDict)) return;
      drop(item.get(name('First')));
      ref = item.get(name('Next'));
    }
  };
  const oldRoot = catalog.lookup(name('Outlines'));
  if (oldRoot instanceof PDFDict) drop(oldRoot.get(name('First')));
  const oldRef = catalog.get(name('Outlines'));
  if (oldRef instanceof PDFRef) context.delete(oldRef);
  catalog.delete(name('Outlines'));

  const pages = doc.getPages();
  const items = mapOutline(outline, (page) => (page >= 1 && page <= pages.length ? page : undefined));
  if (items.length === 0) return;

  /** Bir seviyeyi yazar; görünen (açık) alt öğe sayısını döner */
  const writeLevel = (level: BookmarkItem[], parentRef: PDFRef, parent: PDFDict): number => {
    const refs = level.map(() => context.nextRef());
    let count = 0;
    level.forEach((item, i) => {
      const pageRef = pages[item.pageNumber - 1].ref;
      const dict = context.obj({
        Title: PDFHexString.fromText(item.title),
        Parent: parentRef,
        Dest: item.top === undefined ? [pageRef, 'Fit'] : [pageRef, 'XYZ', null, item.top, null]
      });
      if (i > 0) dict.set(name('Prev'), refs[i - 1]);
      if (i < refs.length - 1) dict.set(name('Next'), refs[i + 1]);
      const open = writeLevel(item.children ?? [], refs[i], dict);
      if (open > 0) dict.set(name('Count'), PDFNumber.of(open));
      context.assign(refs[i], dict);
      count += 1 + open;
    });
    if (refs.length > 0) {
      parent.set(name('First'), refs[0]);
      parent.set(name('Last'), refs[refs.length - 1]);
    }
    return count;
  };

  const rootRef = context.nextRef();
  const root = context.obj({ Type: 'Outlines' });
  root.set(name('Count'), PDFNumber.of(writeLevel(items, rootRef, root)));
  context.assign(rootRef, root);
  catalog.set(name('Outlines'), rootRef);
}
