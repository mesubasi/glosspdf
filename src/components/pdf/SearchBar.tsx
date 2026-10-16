import React, { useState, useEffect, useRef } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { SearchService } from '../../services/searchService';
import * as pdfjsLib from 'pdfjs-dist';
import { Search, ChevronUp, ChevronDown, X, CaseSensitive } from 'lucide-react';
import { t } from '@/i18n';

interface SearchBarProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onJumpToPage: (pageNumber: number) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ pdfDocument, onJumpToPage }) => {
  const {
    searchBarOpen,
    setSearchBarOpen,
    searchQuery,
    setSearchQuery,
    searchMatchCase: matchCase,
    setSearchMatchCase: setMatchCase,
    searchResults,
    setSearchResults,
    currentSearchIndex,
    nextSearchResult,
    prevSearchResult,
    language
  } = usePdfStore();

  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchBarOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [searchBarOpen]);

  const handleSearch = async () => {
    if (!pdfDocument || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await SearchService.searchDocument(pdfDocument, searchQuery, matchCase);
      setSearchResults(results);
      if (results.length > 0) {
        onJumpToPage(results[0].pageIndex);
      }
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, matchCase, pdfDocument]);

  // Aktif eşleşme değiştiğinde o sayfaya git
  useEffect(() => {
    if (searchResults.length > 0 && searchResults[currentSearchIndex]) {
      onJumpToPage(searchResults[currentSearchIndex].pageIndex);
    }
  }, [currentSearchIndex]);

  if (!searchBarOpen) return null;

  return (
    <div className="absolute top-3 right-5 z-30 flex items-center bg-white dark:bg-[#252526] border border-acrobat-border dark:border-acrobat-darkBorder rounded-md shadow-xl px-2.5 py-1.5 space-x-2 text-xs select-none">
      <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />

      {/* Arama Girişi */}
      <input
        ref={inputRef}
        type="text"
        placeholder={t('find_in_document_2')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) {
              prevSearchResult();
            } else {
              nextSearchResult();
            }
          }
          if (e.key === 'Escape') {
            setSearchBarOpen(false);
          }
        }}
        className="w-44 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
      />

      {/* Sonuç Sayısı */}
      <span className="text-slate-400 text-[11px] whitespace-nowrap">
        {isSearching
          ? '...'
          : searchResults.length > 0
          ? `${currentSearchIndex + 1} / ${searchResults.length}`
          : t('no_results')}
      </span>

      {/* Büyük/Küçük Harf Duyarlılığı */}
      <button
        onClick={() => setMatchCase(!matchCase)}
        className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
          matchCase ? 'bg-black/15 dark:bg-white/15 text-acrobat-red' : 'text-slate-400'
        }`}
        title={t('match_case')}
      >
        <CaseSensitive className="w-4 h-4" />
      </button>

      {/* Önceki Eşleşme */}
      <button
        onClick={prevSearchResult}
        disabled={searchResults.length === 0}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        title={t('previous_match_shift_enter')}
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      {/* Sonraki Eşleşme */}
      <button
        onClick={nextSearchResult}
        disabled={searchResults.length === 0}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        title={t('next_match_enter')}
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-600" />

      {/* Kapat */}
      <button
        onClick={() => setSearchBarOpen(false)}
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        title={t('close_esc')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
