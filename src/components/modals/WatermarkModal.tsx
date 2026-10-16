import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import {
  X,
  Stamp,
  Check,
  Droplet
} from 'lucide-react';

export const WatermarkModal: React.FC = () => {
  const {
    watermarkModalOpen,
    setWatermarkModalOpen,
    tabs,
    activeTabId,
    updateTab,
    language
  } = usePdfStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [tabType, setTabType] = useState<'watermark' | 'stamp'>('watermark');

  // Filigran Ayarları
  const [watermarkText, setWatermarkText] = useState(t('confidential_proprietary'));
  const [opacity, setOpacity] = useState(20);
  const [watermarkColor, setWatermarkColor] = useState('#d32f2f');

  // Damga Ayarları
  const [stampText, setStampText] = useState(t('approved'));
  const [stampColor, setStampColor] = useState('#2e7d32');

  const [isProcessing, setIsProcessing] = useState(false);

  if (!watermarkModalOpen || !activeTab) return null;

  const handleApply = async () => {
    try {
      setIsProcessing(true);
      let updatedBytes: Uint8Array;

      if (tabType === 'watermark') {
        if (!watermarkText.trim()) return;
        updatedBytes = await PdfEditService.addWatermark(
          activeTab.data.slice(),
          watermarkText.trim(),
          {
            colorHex: watermarkColor,
            opacity: opacity / 100,
            size: 48
          }
        );
      } else {
        // Damga
        updatedBytes = await PdfEditService.addStamp(
          activeTab.data.slice(),
          activeTab.currentPage,
          stampText,
          stampColor
        );
      }

      const doc = await PdfRenderService.loadDocument(updatedBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(doc);

      updateTab(activeTab.id, {
        data: updatedBytes,
        pageDimensions: dims,
        isModified: true
      });

      setWatermarkModalOpen(false);
    } catch (err: any) {
      console.error('Watermark/stamp error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  const quickStamps = [
    { text: 'ONAYLANDI', color: '#2e7d32' },
    { text: t('confidential'), color: '#d32f2f' },
    { text: 'TASLAK', color: '#f57c00' },
    { text: t('cancelled'), color: '#7b1fa2' },
    { text: 'APPROVED', color: '#2e7d32' },
    { text: 'CONFIDENTIAL', color: '#d32f2f' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-700 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <div className="flex items-center space-x-2">
            <Stamp className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('add_stamp_watermark')}
            </h2>
          </div>
          <button
            onClick={() => setWatermarkModalOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setTabType('watermark')}
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              tabType === 'watermark'
                ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            <span>{t('diagonal_watermark')}</span>
          </button>
          <button
            onClick={() => setTabType('stamp')}
            className={`flex-1 py-2.5 flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
              tabType === 'stamp'
                ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>{t('official_stamp')}</span>
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 space-y-4 text-xs">
          {tabType === 'watermark' ? (
            <>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t('watermark_text')}
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] outline-none focus:border-red-500 font-semibold"
                />
              </div>

              {/* Hızlı Şablonlar */}
              <div className="flex flex-wrap gap-1.5">
                {[t('confidential'), 'TASLAK', 'KOPYA', 'CONFIDENTIAL', 'DRAFT'].map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => setWatermarkText(txt)}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium transition-colors"
                  >
                    {txt}
                  </button>
                ))}
              </div>

              {/* Opaklık Ayarı */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>{t('opacity')}</span>
                  <span>%{opacity}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={opacity}
                  onChange={(e) => setOpacity(parseInt(e.target.value, 10))}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>

              {/* Renk */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {t('color')}
                </label>
                <div className="flex items-center space-x-2">
                  {['#d32f2f', '#1976d2', '#388e3c', '#555555'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setWatermarkColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        watermarkColor === color ? 'ring-2 ring-slate-800 dark:ring-white scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Damga Seçimi */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1.5">
                  {t('select_predefined_stamp')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {quickStamps.map((st) => (
                    <button
                      key={st.text}
                      type="button"
                      onClick={() => {
                        setStampText(st.text);
                        setStampColor(st.color);
                      }}
                      style={{
                        borderColor: stampText === st.text ? st.color : undefined,
                        color: st.color
                      }}
                      className={`p-2.5 rounded-lg border-2 font-bold tracking-wider text-center transition-all ${
                        stampText === st.text
                          ? 'bg-black/5 dark:bg-white/5 shadow-sm scale-102'
                          : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {st.text}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-50 dark:bg-[#252526] border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                {t('stamp_will_be_placed_on_the_top_right_of_the_current_pag', [activeTab.currentPage])}
              </div>
            </>
          )}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#252526]">
          <button
            onClick={() => setWatermarkModalOpen(false)}
            className="px-4 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Ekleniyor...' : (t('apply_to_document_2'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
