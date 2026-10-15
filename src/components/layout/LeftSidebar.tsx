import React, { useEffect, useRef } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { BookmarkItem, LeftSidebarTab, AnnotationItem } from '../../types/pdf';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Image,
  Bookmark,
  Search,
  MessageSquare,
  Highlighter,
  Underline,
  Strikethrough,
  PenTool,
  Square,
  Type,
  ChevronRight,
  ChevronDown,
  Trash2,
  X
} from 'lucide-react';

interface LeftSidebarProps {
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onPageClick: (pageNumber: number) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ pdfDocument, onPageClick }) => {
  const {
    leftSidebarTab,
    setLeftSidebarTab,
    tabs,
    activeTabId,
    language,
    searchResults,
    currentSearchIndex,
    nextSearchResult,
    selectedAnnotationId,
    setSelectedAnnotationId,
    deleteAnnotation
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!leftSidebarTab || !activeTab) return null;

  const annotations = activeTab.annotations || [];

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'highlight':
        return Highlighter;
      case 'underline':
        return Underline;
      case 'strikeout':
        return Strikethrough;
      case 'note':
        return MessageSquare;
      case 'draw':
        return PenTool;
      case 'rect':
        return Square;
      case 'text':
        return Type;
      default:
        return MessageSquare;
    }
  };

  const getAnnotationTypeName = (type: string) => {
    switch (type) {
      case 'highlight':
        return language === 'tr' ? 'Vurgu' : 'Highlight';
      case 'underline':
        return language === 'tr' ? 'Altı Çizili' : 'Underline';
      case 'strikeout':
        return language === 'tr' ? 'Üstü Çizili' : 'Strikeout';
      case 'note':
        return language === 'tr' ? 'Not' : 'Note';
      case 'draw':
        return language === 'tr' ? 'Çizim' : 'Drawing';
      case 'rect':
        return language === 'tr' ? 'Dikdörtgen' : 'Rectangle';
      case 'text':
        return language === 'tr' ? 'Metin' : 'Text Box';
      default:
        return type;
    }
  };

  return (
    <div className="flex h-full bg-[#f8f8f8] dark:bg-acrobat-darkPanel border-r border-acrobat-border dark:border-acrobat-darkBorder text-slate-800 dark:text-slate-200 select-none z-10 transition-all shadow-md">
      {/* İkon Çubuğu */}
      <div className="flex flex-col items-center py-2 px-1 bg-[#ebebeb] dark:bg-[#1f1f1f] border-r border-acrobat-border dark:border-acrobat-darkBorder space-y-2">
        <button
          onClick={() => setLeftSidebarTab('thumbnails')}
          className={`p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            leftSidebarTab === 'thumbnails' ? 'bg-acrobat-red text-white' : 'text-slate-500'
          }`}
          title={language === 'tr' ? 'Sayfa Küçük Resimleri' : 'Page Thumbnails'}
        >
          <Image className="w-4 h-4" />
        </button>

        <button
          onClick={() => setLeftSidebarTab('bookmarks')}
          className={`p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            leftSidebarTab === 'bookmarks' ? 'bg-acrobat-red text-white' : 'text-slate-500'
          }`}
          title={language === 'tr' ? 'Yer İmleri / İçindekiler' : 'Bookmarks'}
        >
          <Bookmark className="w-4 h-4" />
        </button>

        <button
          onClick={() => setLeftSidebarTab('annotations')}
          className={`p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            leftSidebarTab === 'annotations' ? 'bg-acrobat-red text-white' : 'text-slate-500'
          }`}
          title={language === 'tr' ? 'İşaretlemeler ve Notlar' : 'Annotations & Comments'}
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={() => setLeftSidebarTab('search')}
          className={`p-2 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            leftSidebarTab === 'search' ? 'bg-acrobat-red text-white' : 'text-slate-500'
          }`}
          title={language === 'tr' ? 'Arama Sonuçları' : 'Search Results'}
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* İçerik Paneli */}
      <div className="w-72 flex flex-col h-full overflow-hidden">
        {/* Başlık ve Kapat Butonu */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-acrobat-border dark:border-acrobat-darkBorder text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span>
            {leftSidebarTab === 'thumbnails' && (language === 'tr' ? 'Sayfalar' : 'Thumbnails')}
            {leftSidebarTab === 'bookmarks' && (language === 'tr' ? 'İçindekiler' : 'Bookmarks')}
            {leftSidebarTab === 'annotations' &&
              (language === 'tr'
                ? `İşaretlemeler (${annotations.length})`
                : `Annotations (${annotations.length})`)}
            {leftSidebarTab === 'search' && (language === 'tr' ? 'Arama Sonuçları' : 'Search Results')}
          </span>
          <button
            onClick={() => setLeftSidebarTab(null)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Küçük Resimler (Thumbnails) */}
        {leftSidebarTab === 'thumbnails' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {Array.from({ length: activeTab.numPages }, (_, i) => i + 1).map((pageNum) => (
              <ThumbnailItem
                key={pageNum}
                pageNumber={pageNum}
                isCurrent={activeTab.currentPage === pageNum}
                pdfDocument={pdfDocument}
                onClick={() => onPageClick(pageNum)}
              />
            ))}
          </div>
        )}

        {/* Yer İmleri (Bookmarks) */}
        {leftSidebarTab === 'bookmarks' && (
          <div className="flex-1 overflow-y-auto p-2 text-xs">
            {activeTab.outline.length === 0 ? (
              <div className="text-center text-slate-400 py-6">
                {language === 'tr' ? 'Belgede içindekiler tablosu yok.' : 'No bookmarks in document.'}
              </div>
            ) : (
              activeTab.outline.map((item, idx) => (
                <BookmarkNode key={idx} item={item} onPageClick={onPageClick} />
              ))
            )}
          </div>
        )}

        {/* Faz 2: İşaretlemeler (Annotations / Comments) */}
        {leftSidebarTab === 'annotations' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
            {annotations.length === 0 ? (
              <div className="text-center text-slate-400 py-8 px-4">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">
                  {language === 'tr'
                    ? 'Henüz işaretleme eklenmedi.'
                    : 'No annotations yet.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {language === 'tr'
                    ? 'Üstteki "İşaretle" butonuna basarak metin vurgulayabilir veya not ekleyebilirsiniz.'
                    : 'Click "Annotate" above to highlight text or add notes.'}
                </p>
              </div>
            ) : (
              annotations.map((annot) => {
                const IconComponent = getAnnotationIcon(annot.type);
                const isSelected = selectedAnnotationId === annot.id;

                return (
                  <div
                    key={annot.id}
                    onClick={() => {
                      setSelectedAnnotationId(annot.id);
                      onPageClick(annot.pageNumber);
                    }}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#202020] hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: annot.color }}
                        />
                        <IconComponent className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {getAnnotationTypeName(annot.type)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-mono">
                          Sayfa {annot.pageNumber}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnnotation(annot.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {annot.contents && (
                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2 bg-slate-50 dark:bg-[#1a1a1a] p-1.5 rounded border border-slate-100 dark:border-slate-800 text-[11px]">
                        "{annot.contents}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                      <span>{annot.author || 'Kullanıcı'}</span>
                      <span>
                        {new Date(annot.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Arama Sonuçları */}
        {leftSidebarTab === 'search' && (
          <div className="flex-1 overflow-y-auto p-2 text-xs">
            {searchResults.length === 0 ? (
              <div className="text-center text-slate-400 py-6">
                {language === 'tr' ? 'Eşleşen sonuç bulunamadı.' : 'No matches found.'}
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((match, idx) => (
                  <div
                    key={match.id}
                    onClick={() => {
                      onPageClick(match.pageIndex + 1);
                      nextSearchResult();
                    }}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      idx === currentSearchIndex
                        ? 'bg-acrobat-red/10 border-l-2 border-acrobat-red font-medium text-acrobat-red'
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400 mb-0.5">
                      {language === 'tr' ? `Sayfa ${match.pageIndex + 1}` : `Page ${match.pageIndex + 1}`}
                    </div>
                    <div className="truncate">{match.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Tekil Küçük Resim Bileşeni
const ThumbnailItem: React.FC<{
  pageNumber: number;
  isCurrent: boolean;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  onClick: () => void;
}> = ({ pageNumber, isCurrent, pdfDocument, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isRenderedRef = useRef(false);

  useEffect(() => {
    if (!pdfDocument || isRenderedRef.current || !canvasRef.current) return;

    let isCancelled = false;

    pdfDocument.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: 0.2 });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        page.render({ canvasContext: ctx, viewport }).promise.then(() => {
          isRenderedRef.current = true;
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [pdfDocument, pageNumber]);

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center cursor-pointer p-1.5 rounded transition-all ${
        isCurrent
          ? 'bg-acrobat-red/10 border-2 border-acrobat-red shadow-sm'
          : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
      }`}
    >
      <div className="bg-white shadow-sm border border-slate-300 dark:border-slate-700 rounded-sm overflow-hidden flex items-center justify-center min-h-[100px] w-full">
        <canvas ref={canvasRef} className="max-w-full max-h-[140px] object-contain" />
      </div>
      <span className={`text-[11px] mt-1 ${isCurrent ? 'font-bold text-acrobat-red' : 'text-slate-500'}`}>
        {pageNumber}
      </span>
    </div>
  );
};

// İçindekiler Düğümü (Bookmark Node)
const BookmarkNode: React.FC<{
  item: BookmarkItem;
  onPageClick: (pageNumber: number) => void;
}> = ({ item, onPageClick }) => {
  const [open, setOpen] = React.useState(true);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="pl-1">
      <div
        onClick={() => onPageClick(item.pageNumber)}
        className="flex items-center space-x-1 py-1 px-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-slate-700 dark:text-slate-300"
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600"
          >
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <span className="truncate flex-1 hover:text-acrobat-red">{item.title}</span>
        <span className="text-[10px] text-slate-400">{item.pageNumber}</span>
      </div>

      {hasChildren && open && (
        <div className="pl-3 border-l border-slate-200 dark:border-slate-700 ml-2 space-y-0.5">
          {item.children!.map((child, idx) => (
            <BookmarkNode key={idx} item={child} onPageClick={onPageClick} />
          ))}
        </div>
      )}
    </div>
  );
};
