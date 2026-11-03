import React, { useEffect, useRef } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { BookmarkItem, LeftSidebarTab, AnnotationItem } from '../../types/pdf';
import * as pdfjsLib from 'pdfjs-dist';
import { viewportFor } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import {
  LayoutGrid,
  Bookmark,
  Search,
  MessageSquare,
  Highlighter,
  Underline,
  Strikethrough,
  PenTool,
  Square,
  Type,
  FileSignature,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Trash2
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
      case 'textedit':
        return Type;
      case 'signature':
        return FileSignature;
      case 'redact':
        return EyeOff;
      default:
        return MessageSquare;
    }
  };

  const getAnnotationTypeName = (type: string) => {
    switch (type) {
      case 'highlight':
        return t('highlight_2');
      case 'underline':
        return t('underline_2');
      case 'strikeout':
        return t('strikeout_2');
      case 'note':
        return t('note');
      case 'draw':
        return t('drawing');
      case 'rect':
        return t('rectangle');
      case 'text':
        return t('text_box');
      case 'textedit':
        return t('text_edit');
      case 'signature':
        return t('signature');
      case 'redact':
        return t('redaction');
      default:
        return type;
    }
  };

  const sideTabs: { id: Exclude<LeftSidebarTab, null>; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'thumbnails', label: t('page_thumbnails'), icon: LayoutGrid },
    { id: 'bookmarks', label: t('bookmarks'), icon: Bookmark },
    { id: 'annotations', label: t('annotations_comments'), icon: MessageSquare },
    { id: 'search', label: t('search_results'), icon: Search }
  ];
  const title =
    leftSidebarTab === 'thumbnails'
      ? t('thumbnails')
      : leftSidebarTab === 'bookmarks'
        ? t('bookmarks_2')
        : leftSidebarTab === 'annotations'
          ? t('annotations', [annotations.length])
          : t('search_results');

  return (
    <aside className="flex flex-col w-60 shrink-0 h-full bg-sidebar border-r border-separator text-label select-none">
      {/* Görünüm seçici (segment) */}
      <div className="p-3 pb-0">
        <div role="group" aria-label={t('navigation_panel')} className="flex gap-0.5 p-0.5 rounded-[7px] bg-fill">
          {sideTabs.map((tab) => {
            const Icon = tab.icon;
            const on = leftSidebarTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setLeftSidebarTab(tab.id)}
                title={tab.label}
                aria-label={tab.label}
                aria-pressed={on}
                className={`flex-1 grid place-items-center h-6 rounded-[5px] transition-colors ${
                  on ? 'bg-seg-on text-label shadow-seg' : 'text-secondary hover:text-label'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[11px] font-semibold tracking-wide text-secondary">{title}</h2>
        {leftSidebarTab === 'thumbnails' && <span className="text-[11px] text-secondary">{activeTab.numPages}</span>}
      </div>

      {/* Küçük Resimler (Thumbnails) */}
      {leftSidebarTab === 'thumbnails' && (
        <div className="flex-1 overflow-y-auto px-3 pt-1 pb-4 space-y-4">
          {Array.from({ length: activeTab.numPages }, (_, i) => i + 1).map((pageNum) => (
            <ThumbnailItem
              key={`${pageNum}-${activeTab.rotation}`}
              pageNumber={pageNum}
              isCurrent={activeTab.currentPage === pageNum}
              pdfDocument={pdfDocument}
              rotation={activeTab.rotation}
              onClick={() => onPageClick(pageNum)}
            />
          ))}
        </div>
      )}

      {/* Yer İmleri (Bookmarks) */}
      {leftSidebarTab === 'bookmarks' && (
        <div className="flex-1 overflow-y-auto px-2 pb-3 text-[13px]">
          {activeTab.outline.length === 0 ? (
            <EmptyState icon={Bookmark} title={t('no_bookmarks_in_document')} />
          ) : (
            activeTab.outline.map((item, idx) => <BookmarkNode key={idx} item={item} onPageClick={onPageClick} />)
          )}
        </div>
      )}

      {/* İşaretlemeler (Annotations / Comments) */}
      {leftSidebarTab === 'annotations' && (
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {annotations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t('no_annotations_yet')}
              text={t('click_annotate_above_to_highlight_text_or_add_notes')}
            />
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
                  className={`group p-2.5 rounded-[10px] bg-group cursor-pointer transition-shadow ${
                    isSelected ? 'ring-2 ring-accent' : 'ring-1 ring-group-sep hover:ring-separator'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: annot.color }} />
                    <IconComponent className="w-3.5 h-3.5 text-secondary shrink-0" />
                    <span className="flex-1 font-semibold truncate">{getAnnotationTypeName(annot.type)}</span>
                    <span className="text-[11px] text-secondary">{t('page_2', [annot.pageNumber])}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnnotation(annot.id);
                      }}
                      className="p-0.5 rounded text-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                      title={t('delete')}
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {annot.contents && <p className="mt-1.5 text-xs text-secondary line-clamp-2">{annot.contents}</p>}

                  <div className="flex items-center justify-between mt-1.5 text-[11px] text-secondary">
                    <span>{annot.author || t('annotation_author_default')}</span>
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
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {searchResults.length === 0 ? (
            <EmptyState icon={Search} title={t('no_matches_found')} />
          ) : (
            <div className="space-y-0.5">
              {searchResults.map((match, idx) => (
                <button
                  key={match.id}
                  onClick={() => {
                    onPageClick(match.pageIndex);
                    nextSearchResult();
                  }}
                  className={`block w-full text-left px-2.5 py-1.5 rounded-md transition-colors ${
                    idx === currentSearchIndex ? 'bg-accent text-white' : 'hover:bg-hover'
                  }`}
                >
                  <span className={`block text-[11px] ${idx === currentSearchIndex ? 'text-white/80' : 'text-secondary'}`}>
                    {t('page', [match.pageIndex])}
                  </span>
                  <span className="block truncate text-[13px]">{match.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

const EmptyState: React.FC<{ icon: React.ComponentType<any>; title: string; text?: string }> = ({ icon: Icon, title, text }) => (
  <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center text-secondary">
    <Icon className="w-7 h-7 mb-1" strokeWidth={1.5} />
    <p className="text-[13px] font-semibold text-label">{title}</p>
    {text && <p className="text-xs">{text}</p>}
  </div>
);

// Tekil Küçük Resim Bileşeni
const ThumbnailItem: React.FC<{
  pageNumber: number;
  isCurrent: boolean;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  rotation?: number;
  onClick: () => void;
}> = ({ pageNumber, isCurrent, pdfDocument, rotation = 0, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    let isCancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    pdfDocument.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const viewport = viewportFor(page, 0.2, rotation);
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        renderTask = page.render({ canvas, viewport });
        renderTask.promise.catch((err) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.error('Thumbnail render error:', err);
          }
        });
      }
    });

    // Belge/sayfa değişince eski çizim iptal edilir; aksi halde iki çizim aynı canvas'a karışır
    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDocument, pageNumber, rotation]);

  return (
    <button
      onClick={onClick}
      aria-label={t('page', [pageNumber])}
      aria-current={isCurrent ? 'page' : undefined}
      className="flex flex-col items-center gap-2 w-full"
    >
      <div
        className={`bg-white rounded-[3px] overflow-hidden flex items-center justify-center min-h-[100px] transition-shadow ${
          isCurrent ? 'ring-[3px] ring-accent' : 'ring-1 ring-black/15 shadow-sm'
        }`}
      >
        <canvas ref={canvasRef} className="block max-w-[150px] max-h-[200px] object-contain" />
      </div>
      <span
        className={`min-w-[22px] px-1.5 rounded-full text-[11px] font-semibold ${
          isCurrent ? 'bg-accent text-white' : 'text-secondary'
        }`}
      >
        {pageNumber}
      </span>
    </button>
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
        className="flex items-center gap-1 h-7 px-1.5 rounded-md hover:bg-hover cursor-pointer text-label"
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
        <span className="truncate flex-1">{item.title}</span>
        <span className="text-[11px] text-secondary">{item.pageNumber}</span>
      </div>

      {hasChildren && open && (
        <div className="pl-3 ml-2 space-y-0.5">
          {item.children!.map((child, idx) => (
            <BookmarkNode key={idx} item={child} onPageClick={onPageClick} />
          ))}
        </div>
      )}
    </div>
  );
};
