import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { AnnotationItem, AnnotationType } from '../../types/pdf';
import { NotePopover } from './NotePopover';
import { MessageSquare } from 'lucide-react';

interface AnnotationLayerProps {
  pageNumber: number;
  scale: number;
  rotation: number;
  pageWidth: number;
  pageHeight: number;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNumber,
  scale,
  rotation,
  pageWidth,
  pageHeight
}) => {
  const {
    activeTool,
    annotationColor,
    annotationStrokeWidth,
    annotationFontSize,
    selectedAnnotationId,
    setSelectedAnnotationId,
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    tabs,
    activeTabId
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const pageAnnotations = (activeTab?.annotations || []).filter(
    (a) => a.pageNumber === pageNumber
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Kalem çizimi için geçici durum
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  // Dikdörtgen çizimi için geçici durum
  const [isRectDrawing, setIsRectDrawing] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // İnline Metin Kutusu yazma durumu
  const [activeTextInput, setActiveTextInput] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Not Popover durumu
  const [activeNotePopover, setActiveNotePopover] = useState<{
    annotation: AnnotationItem;
    position: { x: number; y: number };
  } | null>(null);

  // Ekran pikselini 72 DPI PDF noktasına dönüştürme
  const pxToPt = useCallback(
    (px: number) => px / scale,
    [scale]
  );

  // 72 DPI PDF noktasını ekran pikseline dönüştürme
  const ptToPx = useCallback(
    (pt: number) => pt * scale,
    [scale]
  );

  // Fare koordinatını container'a bağıl piksel olarak alma
  const getRelativeCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Metin Seçimi ile Vurgu, Altını Çizme ve Üstünü Çizme
  useEffect(() => {
    const handleTextSelectionMouseUp = () => {
      if (
        activeTool !== 'highlight' &&
        activeTool !== 'underline' &&
        activeTool !== 'strikeout'
      ) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) return;

      const selectedText = selection.toString().trim();
      if (!selectedText) return;

      // Seçimin bu sayfada olup olmadığını kontrol et
      const pageEl = containerRef.current.closest(`#pdf-page-${pageNumber}`);
      if (!pageEl) return;

      const range = selection.getRangeAt(0);

      // Range'in bu sayfada olup olmadığını güvenli kontrol et
      try {
        if (!range.intersectsNode(pageEl)) return;
      } catch (err) {
        if (!pageEl.contains(range.commonAncestorContainer)) return;
      }

      const clientRects = Array.from(range.getClientRects());
      if (clientRects.length === 0) return;

      const pageRect = pageEl.getBoundingClientRect();
      const validBoxes: { x: number; y: number; w: number; h: number }[] = [];

      for (const r of clientRects) {
        if (r.width <= 1 || r.height <= 1) continue;

        // Sayfaya bağıl piksel koordinatları
        const relX = r.left - pageRect.left;
        const relY = r.top - pageRect.top;
        const relW = r.width;
        const relH = r.height;

        // Sayfa sınırları dışındaysa atla
        if (
          relX + relW <= 0 ||
          relX >= pageRect.width ||
          relY + relH <= 0 ||
          relY >= pageRect.height
        ) {
          continue;
        }

        // Sınırları sayfaya kırp (clamping)
        const clampedX = Math.max(0, relX);
        const clampedY = Math.max(0, relY);
        const clampedW = Math.min(pageRect.width - clampedX, relW - (clampedX - relX));
        const clampedH = Math.min(pageRect.height - clampedY, relH - (clampedY - relY));

        if (clampedW > 2 && clampedH > 2) {
          validBoxes.push({
            x: pxToPt(clampedX),
            y: pxToPt(clampedY),
            w: pxToPt(clampedW),
            h: pxToPt(clampedH)
          });
        }
      }

      if (validBoxes.length === 0) return;

      // Aynı satırdaki parçaları birleştir
      validBoxes.sort((a, b) => a.y - b.y || a.x - b.x);
      const mergedBoxes: { x: number; y: number; w: number; h: number }[] = [];

      for (const box of validBoxes) {
        const last = mergedBoxes[mergedBoxes.length - 1];
        if (
          last &&
          Math.abs(last.y - box.y) < 4 &&
          Math.abs(last.h - box.h) < 4 &&
          box.x <= last.x + last.w + 8
        ) {
          const newRight = Math.max(last.x + last.w, box.x + box.w);
          last.w = newRight - last.x;
          last.h = Math.max(last.h, box.h);
        } else {
          mergedBoxes.push({ ...box });
        }
      }

      // Her satır için annotation ekle
      for (const box of mergedBoxes) {
        const newAnnot: AnnotationItem = {
          id: `annot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          pageNumber,
          type: activeTool,
          color: annotationColor,
          opacity: activeTool === 'highlight' ? 0.35 : 1.0,
          strokeWidth: activeTool === 'highlight' ? 0 : 2,
          rect: [box.x, box.y, box.w, box.h],
          contents: selectedText,
          createdAt: new Date().toISOString(),
          author: 'Kullanıcı'
        };

        addAnnotation(newAnnot);
      }

      // Metin seçimini sıfırla
      selection.removeAllRanges();
    };

    document.addEventListener('mouseup', handleTextSelectionMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleTextSelectionMouseUp);
    };
  }, [activeTool, pageNumber, pxToPt, annotationColor, addAnnotation]);

  // Fare Tıklaması ve Çizim Başlangıcı
  const handleMouseDown = (e: React.MouseEvent) => {
    // Eğer bir not popover açıksa, dışarı tıklandığında popover'ı kapat ve içi boşsa sil
    if (activeNotePopover) {
      const noteId = activeNotePopover.annotation.id;
      const currentNote = (activeTab?.annotations || []).find((a) => a.id === noteId);
      if (!currentNote || !currentNote.contents?.trim()) {
        deleteAnnotation(noteId);
      }
      setActiveNotePopover(null);
      setSelectedAnnotationId(null);
      return;
    }

    const coords = getRelativeCoords(e);

    if (activeTool === 'draw') {
      setIsDrawing(true);
      setCurrentStroke([coords]);
    } else if (activeTool === 'rect') {
      setIsRectDrawing(true);
      setRectStart(coords);
      setCurrentRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
    } else if (activeTool === 'note') {
      // Tıklanan yere hemen yeni not ekle ve popover aç
      const ptX = pxToPt(coords.x - 12);
      const ptY = pxToPt(coords.y - 12);

      const newNote: AnnotationItem = {
        id: `annot-note-${Date.now()}`,
        pageNumber,
        type: 'note',
        color: annotationColor,
        rect: [ptX, ptY, 24, 24],
        contents: '',
        createdAt: new Date().toISOString(),
        author: 'Kullanıcı'
      };

      addAnnotation(newNote);
      const popoverX = coords.x + 300 > pageWidth ? Math.max(10, coords.x - 290) : coords.x + 12;
      const popoverY = coords.y + 200 > pageHeight ? Math.max(10, coords.y - 120) : coords.y;
      setActiveNotePopover({
        annotation: newNote,
        position: { x: popoverX, y: popoverY }
      });
    } else if (activeTool === 'text') {
      setActiveTextInput({
        x: coords.x,
        y: coords.y,
        text: ''
      });
    }
  };

  // Fare Hareketi (Çizim sürerken)
  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getRelativeCoords(e);

    if (isDrawing && activeTool === 'draw') {
      setCurrentStroke((prev) => [...prev, coords]);
    } else if (isRectDrawing && rectStart && activeTool === 'rect') {
      const minX = Math.min(rectStart.x, coords.x);
      const minY = Math.min(rectStart.y, coords.y);
      const w = Math.abs(coords.x - rectStart.x);
      const h = Math.abs(coords.y - rectStart.y);
      setCurrentRect({ x: minX, y: minY, w, h });
    }
  };

  // Fare Bırakma (Çizim Tamamlama)
  const handleMouseUp = () => {
    if (isDrawing && activeTool === 'draw' && currentStroke.length > 1) {
      // 72 DPI PDF noktalarına dönüştür
      const ptPoints = currentStroke.map((p) => ({
        x: pxToPt(p.x),
        y: pxToPt(p.y)
      }));

      const newAnnot: AnnotationItem = {
        id: `annot-draw-${Date.now()}`,
        pageNumber,
        type: 'draw',
        color: annotationColor,
        strokeWidth: annotationStrokeWidth,
        points: ptPoints,
        createdAt: new Date().toISOString(),
        author: 'Kullanıcı'
      };

      addAnnotation(newAnnot);
      setIsDrawing(false);
      setCurrentStroke([]);
    }

    if (isRectDrawing && currentRect && currentRect.w > 4 && currentRect.h > 4) {
      const newAnnot: AnnotationItem = {
        id: `annot-rect-${Date.now()}`,
        pageNumber,
        type: 'rect',
        color: annotationColor,
        strokeWidth: annotationStrokeWidth,
        rect: [
          pxToPt(currentRect.x),
          pxToPt(currentRect.y),
          pxToPt(currentRect.w),
          pxToPt(currentRect.h)
        ],
        createdAt: new Date().toISOString(),
        author: 'Kullanıcı'
      };

      addAnnotation(newAnnot);
      setIsRectDrawing(false);
      setRectStart(null);
      setCurrentRect(null);
    }
  };

  // Metin Kutusu Kaydetme
  const handleFinishText = () => {
    if (!activeTextInput || !activeTextInput.text.trim()) {
      setActiveTextInput(null);
      return;
    }

    const newAnnot: AnnotationItem = {
      id: `annot-text-${Date.now()}`,
      pageNumber,
      type: 'text',
      color: annotationColor,
      fontSize: annotationFontSize,
      contents: activeTextInput.text,
      rect: [
        pxToPt(activeTextInput.x),
        pxToPt(activeTextInput.y),
        pxToPt(200),
        pxToPt(40)
      ],
      createdAt: new Date().toISOString(),
      author: 'Kullanıcı'
    };

    addAnnotation(newAnnot);
    setActiveTextInput(null);
  };

  // Serbest çizim SVG path dizesini üretir
  const renderPathData = (points: { x: number; y: number }[], isPt = false) => {
    if (points.length === 0) return '';
    const getX = (p: { x: number; y: number }) => (isPt ? ptToPx(p.x) : p.x);
    const getY = (p: { x: number; y: number }) => (isPt ? ptToPx(p.y) : p.y);

    let d = `M ${getX(points[0])} ${getY(points[0])}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${getX(points[i])} ${getY(points[i])}`;
    }
    return d;
  };

  const isDrawingTool =
    activeTool === 'draw' ||
    activeTool === 'rect' ||
    activeTool === 'note' ||
    activeTool === 'text';

  const isTextMarkupTool =
    activeTool === 'highlight' ||
    activeTool === 'underline' ||
    activeTool === 'strikeout';

  const itemPointerClass =
    activeTool === 'select'
      ? 'pointer-events-auto cursor-pointer'
      : 'pointer-events-none';

  return (
    <div
      ref={containerRef}
      onMouseDown={isDrawingTool ? handleMouseDown : undefined}
      onMouseMove={isDrawingTool ? handleMouseMove : undefined}
      onMouseUp={isDrawingTool ? handleMouseUp : undefined}
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`
      }}
      className={`absolute inset-0 z-20 ${
        isDrawingTool ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* SVG Katmanı - İşaretlemelerin Render Edilmesi */}
      <svg
        style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
        className="w-full h-full overflow-visible pointer-events-none"
      >
        {pageAnnotations.map((annot) => {
          const isSelected = selectedAnnotationId === annot.id;

          switch (annot.type) {
            case 'highlight': {
              if (!annot.rect) return null;
              const [x, y, w, h] = annot.rect;
              const pxX = ptToPx(x);
              const pxY = ptToPx(y);
              const pxW = ptToPx(w);
              const pxH = ptToPx(h);

              return (
                <rect
                  key={annot.id}
                  x={pxX}
                  y={pxY}
                  width={pxW}
                  height={pxH}
                  fill={annot.color}
                  opacity={annot.opacity ?? 0.35}
                  className={`${itemPointerClass} hover:opacity-60 transition-opacity`}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                    setSelectedAnnotationId(annot.id);
                  }}
                  stroke={isSelected ? '#2563eb' : 'none'}
                  strokeWidth={isSelected ? 1.5 : 0}
                  strokeDasharray={isSelected ? '3,3' : 'none'}
                />
              );
            }

            case 'underline': {
              if (!annot.rect) return null;
              const [x, y, w, h] = annot.rect;
              const pxX = ptToPx(x);
              const pxY = ptToPx(y + h); // Alt kısım
              const pxW = ptToPx(w);

              return (
                <line
                  key={annot.id}
                  x1={pxX}
                  y1={pxY}
                  x2={pxX + pxW}
                  y2={pxY}
                  stroke={annot.color}
                  strokeWidth={annot.strokeWidth || 2}
                  className={`${itemPointerClass} hover:opacity-80`}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                    setSelectedAnnotationId(annot.id);
                  }}
                />
              );
            }

            case 'strikeout': {
              if (!annot.rect) return null;
              const [x, y, w, h] = annot.rect;
              const pxX = ptToPx(x);
              const pxY = ptToPx(y + h / 2); // Orta çizgi
              const pxW = ptToPx(w);

              return (
                <line
                  key={annot.id}
                  x1={pxX}
                  y1={pxY}
                  x2={pxX + pxW}
                  y2={pxY}
                  stroke={annot.color}
                  strokeWidth={annot.strokeWidth || 2}
                  className={`${itemPointerClass} hover:opacity-80`}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                    setSelectedAnnotationId(annot.id);
                  }}
                />
              );
            }

            case 'draw': {
              if (!annot.points || annot.points.length === 0) return null;
              const d = renderPathData(annot.points, true);
              const strokeW = (annot.strokeWidth || 2) * scale;

              return (
                <path
                  key={annot.id}
                  d={d}
                  fill="none"
                  stroke={annot.color}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`${itemPointerClass} hover:opacity-80`}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                    setSelectedAnnotationId(annot.id);
                  }}
                />
              );
            }

            case 'rect': {
              if (!annot.rect) return null;
              const [x, y, w, h] = annot.rect;
              const pxX = ptToPx(x);
              const pxY = ptToPx(y);
              const pxW = ptToPx(w);
              const pxH = ptToPx(h);
              const strokeW = (annot.strokeWidth || 2) * scale;

              return (
                <rect
                  key={annot.id}
                  x={pxX}
                  y={pxY}
                  width={pxW}
                  height={pxH}
                  fill="none"
                  stroke={annot.color}
                  strokeWidth={strokeW}
                  className={`${itemPointerClass} hover:opacity-80`}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                    setSelectedAnnotationId(annot.id);
                  }}
                />
              );
            }

            case 'text': {
              if (!annot.rect || !annot.contents) return null;
              const [x, y] = annot.rect;
              const pxX = ptToPx(x);
              const pxY = ptToPx(y);
              const fontSize = (annot.fontSize || 14) * scale;

              return (
                <text
                  key={annot.id}
                  x={pxX}
                  y={pxY + fontSize}
                  fill={annot.color}
                  fontSize={fontSize}
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  className={`${itemPointerClass} select-none`}
                  onClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                    setSelectedAnnotationId(annot.id);
                  }}
                >
                  {annot.contents}
                </text>
              );
            }

            default:
              return null;
          }
        })}

        {/* Canlı Kalem Çizimi Önizlemesi */}
        {isDrawing && currentStroke.length > 1 && (
          <path
            d={renderPathData(currentStroke, false)}
            fill="none"
            stroke={annotationColor}
            strokeWidth={annotationStrokeWidth * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Canlı Dikdörtgen Çizimi Önizlemesi */}
        {isRectDrawing && currentRect && (
          <rect
            x={currentRect.x}
            y={currentRect.y}
            width={currentRect.w}
            height={currentRect.h}
            fill="none"
            stroke={annotationColor}
            strokeWidth={annotationStrokeWidth * scale}
            strokeDasharray="4,4"
          />
        )}
      </svg>

      {/* Not / Yorum İkonları (HTML Katmanı) */}
      {pageAnnotations
        .filter((a) => a.type === 'note' && a.rect)
        .map((note) => {
          const [x, y] = note.rect!;
          const pxX = ptToPx(x);
          const pxY = ptToPx(y);
          const isSelected = selectedAnnotationId === note.id;

          return (
            <div
              key={note.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnotationId(note.id);
                const popoverX = pxX + 300 > pageWidth ? Math.max(10, pxX - 290) : pxX + 28;
                const popoverY = pxY + 200 > pageHeight ? Math.max(10, pxY - 120) : pxY;
                setActiveNotePopover({
                  annotation: note,
                  position: { x: popoverX, y: popoverY }
                });
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`absolute pointer-events-auto cursor-pointer p-1 rounded-full shadow-md transition-transform hover:scale-125 ${
                isSelected ? 'ring-2 ring-blue-500 scale-110' : ''
              }`}
              style={{
                left: `${pxX}px`,
                top: `${pxY}px`,
                backgroundColor: note.color || '#ffeb3b'
              }}
              title={note.contents || 'Not'}
            >
              <MessageSquare className="w-4 h-4 text-slate-900" />
            </div>
          );
        })}

      {/* İnline Metin Kutusu Girişi */}
      {activeTextInput && (
        <div
          style={{
            left: `${activeTextInput.x}px`,
            top: `${activeTextInput.y}px`
          }}
          className="absolute pointer-events-auto z-40 bg-white dark:bg-[#202020] border-2 border-dashed border-blue-500 shadow-lg rounded p-1"
        >
          <input
            type="text"
            autoFocus
            value={activeTextInput.text}
            onChange={(e) =>
              setActiveTextInput({ ...activeTextInput, text: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishText();
              if (e.key === 'Escape') setActiveTextInput(null);
            }}
            onBlur={handleFinishText}
            placeholder="Metin yazın..."
            style={{
              color: annotationColor,
              fontSize: `${annotationFontSize * scale}px`
            }}
            className="outline-none bg-transparent font-bold px-1"
          />
        </div>
      )}

      {/* Aktif Not Popover'ı */}
      {activeNotePopover && (
        <div className="pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
          <NotePopover
            annotation={activeNotePopover.annotation}
            position={activeNotePopover.position}
            onSave={(contents) => {
              const noteId = activeNotePopover.annotation.id;
              const trimmed = contents.trim();
              if (!trimmed) {
                deleteAnnotation(noteId);
              } else {
                updateAnnotation(noteId, { contents: trimmed });
              }
              setActiveNotePopover(null);
              setSelectedAnnotationId(null);
            }}
            onDelete={() => {
              deleteAnnotation(activeNotePopover.annotation.id);
              setActiveNotePopover(null);
              setSelectedAnnotationId(null);
            }}
            onClose={() => {
              const noteId = activeNotePopover.annotation.id;
              const currentNote = (activeTab?.annotations || []).find((a) => a.id === noteId);
              if (!currentNote || !currentNote.contents?.trim()) {
                deleteAnnotation(noteId);
              }
              setActiveNotePopover(null);
              setSelectedAnnotationId(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
