import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type ReadAloudStatus = 'idle' | 'playing' | 'paused';

export const readAloudSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Cümle cümle okunur: Chromium uzun konuşmaları yarıda kesebiliyor, duraklatma da hemen yanıt verir
const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?…:;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const speak = (text: string, lang?: string) =>
  new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    utterance.onend = utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });

/** Belgeyi verilen sayfadan sona kadar sesli okur; okunan sayfaya onPage ile geçilir */
export const useReadAloud = (doc: PDFDocumentProxy | null, onPage: (page: number) => void) => {
  const [status, setStatus] = useState<ReadAloudStatus>('idle');
  // Her başlatma/durdurma yeni bir tur açar; eski turun bekleyen döngüsü kendiliğinden sonlanır
  const runRef = useRef(0);

  const stop = () => {
    runRef.current++;
    if (readAloudSupported) speechSynthesis.cancel();
    setStatus('idle');
  };

  // Belge değişince ya da kapanınca okuma durur
  useEffect(() => stop, [doc]);

  const start = async (fromPage: number): Promise<boolean> => {
    if (!doc || !readAloudSupported) return false;
    const run = ++runRef.current;
    speechSynthesis.cancel();
    // Duraklatılmışken durdurulduysa Chromium yeni konuşmaları da duraklatılmış tutar
    speechSynthesis.resume();
    setStatus('playing');

    // Belgenin dili biliniyorsa ona uygun ses seçilir; yoksa sistemin varsayılan sesi okur
    const { info } = await doc.getMetadata().catch(() => ({ info: {} }));
    const lang = (info as { Language?: string }).Language || undefined;

    let spokeAnything = false;
    for (let pageNum = fromPage; pageNum <= doc.numPages; pageNum++) {
      const { items } = await (await doc.getPage(pageNum)).getTextContent();
      if (run !== runRef.current) return true;
      const sentences = splitSentences(items.map((item) => ('str' in item ? item.str : '')).join(' '));
      if (sentences.length === 0) continue;

      onPage(pageNum);
      for (const sentence of sentences) {
        await speak(sentence, lang);
        if (run !== runRef.current) return true;
        spokeAnything = true;
      }
    }

    if (run === runRef.current) setStatus('idle');
    return spokeAnything;
  };

  const pause = () => {
    speechSynthesis.pause();
    setStatus('paused');
  };

  const resume = () => {
    speechSynthesis.resume();
    setStatus('playing');
  };

  return { status, start, pause, resume, stop };
};
