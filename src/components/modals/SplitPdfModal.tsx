import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { t } from '@/i18n';
import {
  X,
  Scissors,
  Check,
  FileText,
  Download
} from 'lucide-react';

export const SplitPdfModal: React.FC = () => {
  const { splitModalOpen, setSplitModalOpen, tabs, activeTabId, language } = usePdfStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [splitMode, setSplitMode] = useState<'all' | 'ranges'>('all');
  const [rangeInput, setRangeInput] = useState('1-2, 3-3');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!splitModalOpen || !activeTab) return null;

  const handleSplit = async () => {
    try {
      setIsProcessing(true);
      let ranges: { start: number; end: number }[] = [];

      if (splitMode === 'all') {
        for (let i = 1; i <= activeTab.numPages; i++) {
          ranges.push({ start: i, end: i });
        }
      } else {
        // "1-2, 3-5" formatını parse et
        const parts = rangeInput.split(',').map((p) => p.trim());
        for (const p of parts) {
          if (p.includes('-')) {
            const [s, e] = p.split('-').map((n) => parseInt(n.trim(), 10));
            if (!isNaN(s) && !isNaN(e) && s <= e) {
              ranges.push({ start: s, end: e });
            }
          } else {
            const n = parseInt(p, 10);
            if (!isNaN(n)) {
              ranges.push({ start: n, end: n });
            }
          }
        }
      }

      if (ranges.length === 0) {
        alert(t('please_enter_valid_page_ranges_e_g_1_2_3_5'));
        return;
      }

      const results = await PdfEditService.splitPdf(activeTab.data.slice(), ranges);

      // İndir veya Electron ile kaydet
      for (let i = 0; i < results.length; i++) {
        const chunk = results[i];
        const range = ranges[i];
        const fileName = `${activeTab.fileName.replace('.pdf', '')}_sayfa_${range.start}-${range.end}.pdf`;

        const blob = new Blob([chunk.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      setSplitModalOpen(false);
    } catch (err: any) {
      console.error('Split error:', err);
      alert(t('error_generic', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Scissors className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('split_pdf_document')}
            </h2>
          </div>
          <button
            onClick={() => setSplitModalOpen(false)}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-acrobat-darkPanel rounded-lg border border-slate-200 dark:border-slate-700 flex items-center space-x-2 text-slate-600 dark:text-slate-300">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>
              <strong>{activeTab.fileName}</strong> ({activeTab.numPages} sayfa)
            </span>
          </div>

          {/* Seçenek 1: Her sayfayı ayrı PDF yap */}
          <label className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            splitMode === 'all'
              ? 'border-red-500 bg-red-50/20 dark:bg-red-950/10'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-acrobat-darkPanel'
          }`}>
            <input
              type="radio"
              name="splitMode"
              checked={splitMode === 'all'}
              onChange={() => setSplitMode('all')}
              className="mt-0.5 text-red-600 focus:ring-red-500"
            />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {t('extract_every_page_into_a_separate_pdf')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {t('will_create_individual_1_page_pdf_files', [activeTab.numPages])}
              </div>
            </div>
          </label>

          {/* Seçenek 2: Belirtilen Sayfa Aralıklarına Göre Böl */}
          <label className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            splitMode === 'ranges'
              ? 'border-red-500 bg-red-50/20 dark:bg-red-950/10'
              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-acrobat-darkPanel'
          }`}>
            <input
              type="radio"
              name="splitMode"
              checked={splitMode === 'ranges'}
              onChange={() => setSplitMode('ranges')}
              className="mt-0.5 text-red-600 focus:ring-red-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {t('custom_page_ranges')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 mb-2">
                {t('comma_separated_page_ranges_e_g_1_2_3_5')}
              </div>
              {splitMode === 'ranges' && (
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="1-2, 3-5"
                  className="w-full px-2.5 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1a1a1a] text-xs outline-hidden focus:border-red-500 font-mono"
                />
              )}
            </div>
          </label>
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <button
            onClick={() => setSplitModalOpen(false)}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSplit}
            disabled={isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isProcessing ? t('splitting') : (t('split_download'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
