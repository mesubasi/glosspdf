import React, { useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { t } from '@/i18n';
import {
  X,
  FilePlus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Check,
  UploadCloud,
  FileText
} from 'lucide-react';

interface FileToMerge {
  id: string;
  name: string;
  data: Uint8Array;
  numPages: number;
}

export const MergePdfModal: React.FC = () => {
  const { mergeModalOpen, setMergeModalOpen, addTab, language } = usePdfStore();
  const [files, setFiles] = useState<FileToMerge[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!mergeModalOpen) return null;

  // Dosya Ekleme
  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        try {
          const doc = await PdfRenderService.loadDocument(bytes.slice());
          setFiles((prev) => [
            ...prev,
            {
              id: `merge-${Date.now()}-${i}`,
              name: file.name,
              data: bytes,
              numPages: doc.numPages
            }
          ]);
        } catch (err) {
          console.error('Failed to load PDF:', err);
        }
      }
    }
    e.target.value = '';
  };

  // Sıralama Değiştir
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newFiles = [...files];
    const temp = newFiles[index - 1];
    newFiles[index - 1] = newFiles[index];
    newFiles[index] = temp;
    setFiles(newFiles);
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    const temp = newFiles[index + 1];
    newFiles[index + 1] = newFiles[index];
    newFiles[index] = temp;
    setFiles(newFiles);
  };

  // Listeden Sil
  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Birleştirme İşlemini Başlat
  const handleMerge = async () => {
    if (files.length < 2) {
      alert(t('please_add_at_least_2_pdf_files_to_merge'));
      return;
    }

    try {
      setIsProcessing(true);
      const buffers = files.map((f) => f.data.slice());
      const mergedBytes = await PdfEditService.mergePdfs(buffers);

      // Yeni oluşturulan PDF'i GlossPDF'te yeni sekmede aç
      const doc = await PdfRenderService.loadDocument(mergedBytes.slice());
      const dims = await PdfRenderService.getAllPageDimensions(doc);
      const outline = await PdfRenderService.getDocumentOutline(doc);

      const newTabId = `tab-merged-${Date.now()}`;
      addTab({
        id: newTabId,
        filePath: 'Birlestirilmis_Belge.pdf',
        fileName: 'Birlestirilmis_Belge.pdf',
        data: mergedBytes,
        numPages: doc.numPages,
        currentPage: 1,
        zoom: 1.0,
        rotation: 0,
        isModified: true,
        outline,
        annotations: [],
        undoStack: [],
        redoStack: [],
        pageDimensions: dims
      });

      setFiles([]);
      setMergeModalOpen(false);
    } catch (err: any) {
      console.error('Merge error:', err);
      alert(t('error_merge', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPages = files.reduce((acc, f) => acc + f.numPages, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-acrobat-darkBg border border-slate-300 dark:border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-sm">
              {t('merge_pdf_files')}
            </h2>
          </div>
          <button
            onClick={() => setMergeModalOpen(false)}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Dosya Yükleme Alanı */}
          <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-red-500 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-acrobat-darkPanel/50">
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('select_pdf_files_or_drag_drop')}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              {t('you_can_select_multiple_files')}
            </span>
            <input
              type="file"
              multiple
              accept="application/pdf,.pdf"
              onChange={handleAddFiles}
              className="hidden"
            />
          </label>

          {/* Dosya Listesi */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span>{t('order_top_to_bottom')}</span>
                <span>{files.length} dosya • {totalPages} sayfa</span>
              </div>

              <div className="space-y-1.5">
                {files.map((file, idx) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-acrobat-darkPanel rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-3">
                      <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({file.numPages} sayfa)
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-500"
                        title={t('move_up')}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === files.length - 1}
                        className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-500"
                        title={t('move_down')}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeFile(idx)}
                        className="p-1 rounded-sm hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition-colors ml-1"
                        title={t('remove_from_list_3')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-acrobat-darkPanel">
          <button
            onClick={() => setMergeModalOpen(false)}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isProcessing ? t('merging') : (t('merge_open'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
