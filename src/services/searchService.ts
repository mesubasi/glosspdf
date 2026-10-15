import * as pdfjsLib from 'pdfjs-dist';
import { SearchMatch } from '../types/pdf';

export class SearchService {
  /**
   * PDF belgesindeki tüm sayfaları arar ve eşleşmeleri listeler
   */
  static async searchDocument(
    doc: pdfjsLib.PDFDocumentProxy,
    query: string,
    matchCase: boolean = false
  ): Promise<SearchMatch[]> {
    if (!query || query.trim().length === 0) return [];

    const matches: SearchMatch[] = [];
    const normalizedQuery = matchCase
      ? query
      : query.toLocaleLowerCase('tr-TR');

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');

      const normalizedPageText = matchCase
        ? pageText
        : pageText.toLocaleLowerCase('tr-TR');

      let startIndex = 0;
      let matchIdx = 0;

      while ((startIndex = normalizedPageText.indexOf(normalizedQuery, startIndex)) !== -1) {
        matches.push({
          id: `match-${pageNum}-${matchIdx}`,
          pageIndex: pageNum,
          matchIndex: matchIdx,
          text: pageText.substring(
            Math.max(0, startIndex - 20),
            Math.min(pageText.length, startIndex + query.length + 20)
          )
        });
        startIndex += normalizedQuery.length;
        matchIdx++;
      }
    }

    return matches;
  }
}
