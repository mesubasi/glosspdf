import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import {
  X,
  Image as ImageIcon,
  Check,
  UploadCloud
} from 'lucide-react';

export const InsertImageModal: React.FC = () => {
  const {
    insertImageModalOpen,
    setInsertImageModalOpen,
    tabs,
    activeTabId,
    updateTab,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isJpg, setIsJpg] = useState(false);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [position, setPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('center');
  const [imgWidth, setImgWidth] = useState(200);
  const [imgHeight, setImgHeight] = useState(150);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!insertImageModalOpen || !activeTab) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJpeg = file.type === 'image/jpeg' || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg');
    setIsJpg(isJpeg);

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    setImageBytes(bytes);

    // Önizleme ve doğal boyutları hesaplama
    const url = URL.createObjectURL(file);
    setImagePreview(url);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      // Sayfaya uygun makul bir başlangıç boyutu (max 250pt)
      const ratio = img.width / img.height;
      const maxDim = 200;
      if (ratio >= 1) {
        setImgWidth(maxDim);
        setImgHeight(Math.round(maxDim / ratio));
      } else {
        setImgHeight(maxDim);
        setImgWidth(Math.round(maxDim * ratio));
      }
    };
  };

  const handleInsert = async () => {
    if (!imageBytes) return;

    try {
      setIsProcessing(true);
      const currentDim = activeTab.pageDimensions[targetPage - 1] || activeTab.pageDimensions[0];
      const pageW = currentDim.originalWidth;
      const pageH = currentDim.originalHeight;

      let posX = 40;
      let posY = 40;

      switch (position) {
        case 'center':
          posX = (pageW - imgWidth) / 2;
          posY = (pageH - imgHeight) / 2;
          break;
        case 'top-left':
          posX = 40;
          posY = 40;
          break;
        case 'top-right':
          posX = pageW - imgWidth - 40;
          posY = 40;
          break;
        case 'bottom-left':
          posX = 40;
          posY = pageH - imgHeight - 40;
          break;
        case 'bottom-right':
          posX = pageW - imgWidth - 40;
          posY = pageH - imgHeight - 40;
          break;
      }

      const updatedBytes = await PdfEditService.insertImage(
        activeTab.data.slice(),
        targetPage,
        imageBytes,
        isJpg,
        posX,
        posY,
        imgWidth,
        imgHeight
      );

      const doc = await PdfRenderService.loadDocument(updatedBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(doc);

      updateTab(activeTab.id, {
        data: updatedBytes,
        pageDimensions: dims,
        isModified: true
      });

      setInsertImageModalOpen(false);
      setImageBytes(null);
      setImagePreview(null);
    } catch (err: any) {
      console.error('Image insert error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 text-xs">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('insert_image_logo')}
            </h2>
          </div>
          <button
            onClick={() => setInsertImageModalOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Resim Seçme Alanı */}
          {!imagePreview ? (
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-red-500 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-[#252526]/50">
              <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {t('select_image_png_or_jpg')}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                {t('company_logo_stamp_or_photo')}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50 dark:bg-[#252526] flex flex-col items-center">
              <img
                src={imagePreview}
                alt={t('preview')}
                className="max-h-40 max-w-full object-contain rounded"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageBytes(null);
                }}
                className="mt-2 text-[11px] text-red-500 hover:underline"
              >
                {t('choose_another_image')}
              </button>
            </div>
          )}

          {/* Hedef Sayfa */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {t('target_page')}
            </span>
            <select
              value={targetPage}
              onChange={(e) => setTargetPage(parseInt(e.target.value, 10))}
              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none"
            >
              {Array.from({ length: activeTab.numPages }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  {t('page_2', [p])}
                </option>
              ))}
            </select>
          </div>

          {/* Konum */}
          <div>
            <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('position_on_page')}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'top-left', label: t('top_left') },
                { id: 'center', label: t('center') },
                { id: 'top-right', label: t('top_right') },
                { id: 'bottom-left', label: t('bottom_left') },
                { id: 'bottom-right', label: t('bottom_right') }
              ].map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setPosition(pos.id as any)}
                  className={`py-1.5 px-2 rounded border font-medium transition-colors ${
                    position === pos.id
                      ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Boyutlar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 mb-1">{t('width_pt')}</label>
              <input
                type="number"
                value={imgWidth}
                onChange={(e) => setImgWidth(parseInt(e.target.value, 10) || 100)}
                className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{t('height_pt')}</label>
              <input
                type="number"
                value={imgHeight}
                onChange={(e) => setImgHeight(parseInt(e.target.value, 10) || 100)}
                className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button
            onClick={() => setInsertImageModalOpen(false)}
            className="px-4 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleInsert}
            disabled={!imageBytes || isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Ekleniyor...' : (t('insert_image_2'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
