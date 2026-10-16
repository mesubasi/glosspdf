import React, { useRef, useState, useEffect } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import type { MessageKey } from '@/i18n';
import {
  X,
  FileCheck,
  RotateCcw,
  Check,
  Pen
} from 'lucide-react';

export const SignatureModal: React.FC = () => {
  const {
    signatureModalOpen,
    setSignatureModalOpen,
    tabs,
    activeTabId,
    updateTab,
    setCurrentPage,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState('#0d47a1'); // Klasik mavi tükenmez kalem rengi
  const [targetPage, setTargetPage] = useState<number>(1);
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'bottom-center' | 'center'>('bottom-right');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!signatureModalOpen || !activeTab) return;
    setTargetPage(activeTab.currentPage);
    setHasDrawn(false);

    // Canvas'ı temizle ve hazırla
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 2.5;
        }
      }
    }, 50);
  }, [signatureModalOpen, activeTab?.id]);

  if (!signatureModalOpen || !activeTab) return null;

  // Çizim Başlangıcı (Fare, Dokunmatik ve Kalem Desteği)
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  // Çizim Hareketi
  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  // Çizim Bitişi
  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      setIsDrawing(false);
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Canvas'ı Temizle
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  // İmzayı Belgeye Ekle
  const handleApplySignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    try {
      setIsProcessing(true);

      // Canvas'tan PNG data URL al
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const pngBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        pngBytes[i] = binaryString.charCodeAt(i);
      }

      const currentDim = activeTab.pageDimensions[targetPage - 1] || activeTab.pageDimensions[0];
      const pageW = currentDim.originalWidth;
      const pageH = currentDim.originalHeight;
      const sigWidth = 160;
      const sigHeight = 70;

      // Konum koordinatları hesaplama (PDF koordinat dönüşümü ile)
      let posX = pageW - sigWidth - 40;
      let posY = pageH - sigHeight - 50; // Alttan 50pt pay

      if (position === 'bottom-left') {
        posX = 40;
        posY = pageH - sigHeight - 50;
      } else if (position === 'bottom-center') {
        posX = (pageW - sigWidth) / 2;
        posY = pageH - sigHeight - 50;
      } else if (position === 'center') {
        posX = (pageW - sigWidth) / 2;
        posY = (pageH - sigHeight) / 2;
      }

      const updatedBytes = await PdfEditService.addSignature(
        activeTab.data.slice(),
        targetPage,
        pngBytes,
        posX,
        posY,
        sigWidth,
        sigHeight
      );

      const doc = await PdfRenderService.loadDocument(updatedBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(doc);

      updateTab(activeTab.id, {
        data: updatedBytes,
        pageDimensions: dims,
        currentPage: targetPage,
        isModified: true
      });

      setCurrentPage(targetPage);
      setSignatureModalOpen(false);
    } catch (err: any) {
      console.error('Signature error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('add_hand_drawn_signature')}
            </h2>
          </div>
          <button
            onClick={() => setSignatureModalOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">
              {t('draw_your_signature_in_the_box_below')}
            </span>

            {/* Kalem Renkleri */}
            <div className="flex items-center space-x-1.5">
              {[
                { labelKey: 'color_blue' as MessageKey, hex: '#0d47a1' },
                { labelKey: 'color_black' as MessageKey, hex: '#111827' },
                { labelKey: 'color_red' as MessageKey, hex: '#b91c1c' }
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPenColor(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    penColor === c.hex ? 'border-white scale-110 shadow-sm ring-2 ring-red-500' : 'border-transparent'
                  }`}
                  title={t(c.labelKey)}
                />
              ))}
            </div>
          </div>

          {/* İmza Çizim Alanı (Pointer Events) */}
          <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white rounded-lg overflow-hidden flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              width={450}
              height={180}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              className="cursor-crosshair block w-full touch-none select-none"
            />

            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 dark:text-slate-400 text-xs">
                <Pen className="w-4 h-4 mr-1.5 opacity-40" />
                <span>{t('sign_here_mouse_or_touch')}</span>
              </div>
            )}
          </div>

          {/* Konum ve Sayfa Seçimi */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Hedef Sayfa */}
            <div>
              <label className="block text-slate-500 mb-1 font-medium">
                {t('target_page')}
              </label>
              <select
                value={targetPage}
                onChange={(e) => setTargetPage(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none text-xs"
              >
                {Array.from({ length: activeTab.numPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {t('page_2', [p])}
                  </option>
                ))}
              </select>
            </div>

            {/* İmza Konumu */}
            <div>
              <label className="block text-slate-500 mb-1 font-medium">
                {t('placement_position')}
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none text-xs"
              >
                <option value="bottom-right">{t('bottom_right_default')}</option>
                <option value="bottom-left">{t('bottom_left_2')}</option>
                <option value="bottom-center">{t('bottom_center')}</option>
                <option value="center">{t('page_center')}</option>
              </select>
            </div>
          </div>

          {/* Temizle Butonu */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!hasDrawn}
              className="flex items-center space-x-1 px-3 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('clear_drawing')}</span>
            </button>
          </div>
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button
            onClick={() => setSignatureModalOpen(false)}
            className="px-4 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleApplySignature}
            disabled={!hasDrawn || isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Ekleniyor...' : (t('apply_signature'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
