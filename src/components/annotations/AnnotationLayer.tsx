import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { AnnotationItem, AnnotationType } from '../../types/pdf';
import { NotePopover } from './NotePopover';
import { MessageSquare, X } from 'lucide-react';
import { t } from '@/i18n';
import { BASELINE_RATIO } from '../../services/pdfEditService';
import { sampleTextColors } from '../../services/textEditUtils';

/** Düzenleme sırasındaki metin: yeni bir span'dan ya da var olan bir 'textedit'ten gelir */
interface TextEditSession {
  annotationId?: string;
  rect: [number, number, number, number]; // 72 DPI PDF noktası
  original: string;
  text: string;
  fontSize: number;
  color: string;
  bgColor: string;
}

const textEditPad = (fontSize: number) => Math.max(1, fontSize * 0.1);

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
    pendingSignature,
    setPendingSignature,
    setActiveTool,
    pushUndoSnapshot,
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

  // Mevcut PDF metnini düzenleme oturumu
  const [textEdit, setTextEdit] = useState<TextEditSession | null>(null);
  const textEditDoneRef = useRef(false);

  // İmza yerleştirme sırasında imleci izleyen hayalet önizleme (container'a bağıl piksel)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

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
          author: t('annotation_author_default')
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

  // Metin Düzenleme Aracı: metin katmanındaki bir parçaya (span) tıklanınca düzenleyiciyi aç
  useEffect(() => {
    if (activeTool !== 'edittext') return;
    const pageEl = containerRef.current?.closest(`#pdf-page-${pageNumber}`);
    const layer = pageEl?.querySelector('.textLayer');
    if (!pageEl || !layer) return;

    const onClick = (e: Event) => {
      const me = e as MouseEvent;
      const pageRect = pageEl.getBoundingClientRect();
      const clickX = pxToPt(me.clientX - pageRect.left);
      const clickY = pxToPt(me.clientY - pageRect.top);

      // Önceden düzenlenmiş bir metne tıklandıysa onu yeniden düzenle
      const existing = (usePdfStore.getState().tabs.find((tb) => tb.id === activeTabId)?.annotations || []).find(
        (a) =>
          a.type === 'textedit' &&
          a.pageNumber === pageNumber &&
          a.rect &&
          clickX >= a.rect[0] &&
          clickX <= a.rect[0] + a.rect[2] &&
          clickY >= a.rect[1] &&
          clickY <= a.rect[1] + a.rect[3]
      );
      if (existing?.rect) {
        textEditDoneRef.current = false;
        setTextEdit({
          annotationId: existing.id,
          rect: existing.rect,
          original: existing.originalText || '',
          text: existing.contents || '',
          fontSize: existing.fontSize || 12,
          color: existing.color,
          bgColor: existing.bgColor || '#ffffff'
        });
        return;
      }

      const span = (me.target as HTMLElement).closest('span');
      const original = span?.textContent || '';
      if (!span || !layer.contains(span) || !original.trim()) return;

      const r = span.getBoundingClientRect();
      const cssRect = { x: r.left - pageRect.left, y: r.top - pageRect.top, w: r.width, h: r.height };
      const canvas = pageEl.querySelector('canvas');
      const { bg, fg } = canvas
        ? sampleTextColors(canvas, cssRect)
        : { bg: '#ffffff', fg: '#000000' };
      const fontSize = parseFloat(getComputedStyle(span).fontSize) / scale || 12;

      textEditDoneRef.current = false;
      setTextEdit({
        rect: [pxToPt(cssRect.x), pxToPt(cssRect.y), pxToPt(cssRect.w), pxToPt(cssRect.h)],
        original,
        text: original,
        fontSize: Math.round(fontSize * 10) / 10,
        color: fg,
        bgColor: bg
      });
    };

    layer.addEventListener('click', onClick);
    return () => layer.removeEventListener('click', onClick);
  }, [activeTool, pageNumber, pxToPt, scale, activeTabId]);

  // Düzenlemeyi bitir: değişiklik varsa 'textedit' ekle/güncelle, eski haline dönmüşse kaldır
  const commitTextEdit = () => {
    if (!textEdit || textEditDoneRef.current) return;
    textEditDoneRef.current = true;
    const { annotationId, rect, original, text, fontSize, color, bgColor } = textEdit;
    setTextEdit(null);

    if (annotationId) {
      if (text === original) {
        deleteAnnotation(annotationId);
      } else {
        pushUndoSnapshot();
        updateAnnotation(annotationId, { contents: text });
      }
      return;
    }
    if (text === original) return;

    addAnnotation({
      id: `annot-textedit-${Date.now()}`,
      pageNumber,
      type: 'textedit',
      color,
      bgColor,
      fontSize,
      rect,
      originalText: original,
      contents: text,
      createdAt: new Date().toISOString(),
      author: t('annotation_author_default')
    });
  };

  // İmza ve metin düzenleme nesnelerini taşıma / boyutlandırma (Seç aracındayken)
  const startObjectDrag = (
    e: React.PointerEvent,
    annot: AnnotationItem,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    setSelectedAnnotationId(annot.id);
    if (activeTool !== 'select' || !annot.rect) return;
    e.preventDefault();

    const [x, y, w, h] = annot.rect;
    const startX = e.clientX;
    const startY = e.clientY;
    const maxX = pageWidth / scale;
    const maxY = pageHeight / scale;
    let snapshotTaken = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (!snapshotTaken && Math.abs(dx) + Math.abs(dy) > 1 / scale) {
        pushUndoSnapshot();
        snapshotTaken = true;
      }
      if (mode === 'move') {
        // Nesne tamamen kaybolmasın: en az 20 pt sayfa içinde kalır
        const nx = Math.min(maxX - 20, Math.max(20 - w, x + dx));
        const ny = Math.min(maxY - 20, Math.max(20 - h, y + dy));
        updateAnnotation(annot.id, { rect: [nx, ny, w, h] });
      } else {
        const nw = Math.max(24, w + dx);
        updateAnnotation(annot.id, { rect: [x, y, nw, (nw * h) / w] });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startTextReEdit = (annot: AnnotationItem) => {
    if (!annot.rect) return;
    textEditDoneRef.current = false;
    setTextEdit({
      annotationId: annot.id,
      rect: annot.rect,
      original: annot.originalText || '',
      text: annot.contents || '',
      fontSize: annot.fontSize || 12,
      color: annot.color,
      bgColor: annot.bgColor || '#ffffff'
    });
  };

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
        author: t('annotation_author_default')
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
    } else if (activeTool === 'signature' && pendingSignature) {
      // İmzayı tıklanan noktaya ortalayarak yerleştir; sonra seçili hale getir (taşı/boyutlandır)
      const wPt = Math.min(180, pageWidth / scale / 2);
      const hPt = wPt / pendingSignature.aspect;
      const newSig: AnnotationItem = {
        id: `annot-sig-${Date.now()}`,
        pageNumber,
        type: 'signature',
        color: '#000000',
        imageData: pendingSignature.dataUrl,
        rect: [pxToPt(coords.x) - wPt / 2, pxToPt(coords.y) - hPt / 2, wPt, hPt],
        createdAt: new Date().toISOString(),
        author: t('annotation_author_default')
      };
      addAnnotation(newSig);
      setSelectedAnnotationId(newSig.id);
      setPendingSignature(null);
      setGhost(null);
      setActiveTool('select');
    }
  };

  // Fare Hareketi (Çizim sürerken)
  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getRelativeCoords(e);

    if (activeTool === 'signature') {
      setGhost(coords);
    } else if (isDrawing && activeTool === 'draw') {
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
        author: t('annotation_author_default')
      };

      addAnnotation(newAnnot);
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
        author: t('annotation_author_default')
      };

      addAnnotation(newAnnot);
    }

    // Çizim her durumda sonlanır (tek tıklama ya da sayfa dışına çıkış çizimi takılı bırakmasın)
    setIsDrawing(false);
    setCurrentStroke([]);
    setIsRectDrawing(false);
    setRectStart(null);
    setCurrentRect(null);
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
      author: t('annotation_author_default')
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
    activeTool === 'text' ||
    (activeTool === 'signature' && !!pendingSignature);

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
      onMouseLeave={
        isDrawingTool
          ? () => {
              handleMouseUp();
              setGhost(null);
            }
          : undefined
      }
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
                  y={pxY + fontSize * BASELINE_RATIO}
                  fill={annot.color}
                  fontSize={fontSize}
                  fontFamily="GlossSans, sans-serif"
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

      {/* İmzalar ve düzenlenmiş metinler (HTML katmanı) */}
      {pageAnnotations
        .filter((a) => (a.type === 'signature' || a.type === 'textedit') && a.rect)
        .map((obj) => {
          const [x, y, w, h] = obj.rect!;
          const isSelected = selectedAnnotationId === obj.id;
          const interactive = activeTool === 'select';

          if (obj.type === 'signature') {
            return (
              <div
                key={obj.id}
                data-annot
                onPointerDown={(e) => startObjectDrag(e, obj, 'move')}
                style={{
                  left: ptToPx(x),
                  top: ptToPx(y),
                  width: ptToPx(w),
                  height: ptToPx(h),
                  touchAction: 'none'
                }}
                className={`absolute ${
                  interactive ? 'pointer-events-auto cursor-move' : 'pointer-events-none'
                } ${isSelected ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-400/70'}`}
              >
                <img
                  src={obj.imageData}
                  alt=""
                  draggable={false}
                  className="w-full h-full select-none pointer-events-none"
                />
                {isSelected && interactive && (
                  <>
                    <button
                      type="button"
                      data-annot
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => deleteAnnotation(obj.id)}
                      className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                      title={t('delete')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div
                      data-annot
                      onPointerDown={(e) => startObjectDrag(e, obj, 'resize')}
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nwse-resize"
                    />
                  </>
                )}
              </div>
            );
          }

          // 'textedit': eski metni örten kutu + yeni metin
          const pad = textEditPad(obj.fontSize || 12);
          return (
            <div
              key={obj.id}
              data-annot
              onPointerDown={(e) => startObjectDrag(e, obj, 'move')}
              onDoubleClick={() => startTextReEdit(obj)}
              style={{
                left: ptToPx(x - pad),
                top: ptToPx(y - pad),
                width: ptToPx(w + pad * 2),
                height: ptToPx(h + pad * 2),
                backgroundColor: obj.bgColor || '#ffffff',
                color: obj.color,
                fontFamily: 'GlossSans, sans-serif',
                fontSize: ptToPx(obj.fontSize || 12),
                lineHeight: 1,
                touchAction: 'none'
              }}
              className={`absolute ${
                interactive ? 'pointer-events-auto cursor-move' : 'pointer-events-none'
              } ${isSelected ? 'outline outline-2 outline-blue-500' : 'hover:outline hover:outline-1 hover:outline-blue-400/70'}`}
            >
              <span
                className="absolute whitespace-pre select-none"
                style={{ left: ptToPx(pad), top: ptToPx(pad) }}
              >
                {obj.contents}
              </span>
            </div>
          );
        })}

      {/* İmza yerleştirme: imleci izleyen hayalet önizleme */}
      {activeTool === 'signature' && pendingSignature && ghost && (
        <img
          src={pendingSignature.dataUrl}
          alt=""
          draggable={false}
          style={{
            left: ghost.x - ptToPx(Math.min(180, pageWidth / scale / 2)) / 2,
            top:
              ghost.y -
              ptToPx(Math.min(180, pageWidth / scale / 2) / pendingSignature.aspect) / 2,
            width: ptToPx(Math.min(180, pageWidth / scale / 2))
          }}
          className="absolute opacity-60 pointer-events-none outline outline-1 outline-dashed outline-blue-500"
        />
      )}

      {/* Metin düzenleme alanı */}
      {textEdit && (
        <input
          autoFocus
          value={textEdit.text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setTextEdit({ ...textEdit, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTextEdit();
            if (e.key === 'Escape') {
              e.stopPropagation();
              textEditDoneRef.current = true;
              setTextEdit(null);
            }
          }}
          onBlur={commitTextEdit}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            left: ptToPx(textEdit.rect[0] - textEditPad(textEdit.fontSize)),
            top: ptToPx(textEdit.rect[1] - textEditPad(textEdit.fontSize)),
            minWidth: ptToPx(textEdit.rect[2] + textEditPad(textEdit.fontSize) * 2),
            width: `${Math.max(textEdit.text.length + 1, 4)}ch`,
            height: ptToPx(textEdit.rect[3] + textEditPad(textEdit.fontSize) * 2),
            padding: `0 0 0 ${ptToPx(textEditPad(textEdit.fontSize))}px`,
            backgroundColor: textEdit.bgColor,
            color: textEdit.color,
            fontFamily: 'GlossSans, sans-serif',
            fontSize: ptToPx(textEdit.fontSize),
            lineHeight: 1
          }}
          className="absolute z-40 pointer-events-auto outline outline-2 outline-blue-500 shadow-lg"
        />
      )}

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
              title={note.contents || t('note')}
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
            placeholder={t('text_input_placeholder')}
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
