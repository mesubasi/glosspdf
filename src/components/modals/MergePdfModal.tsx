import React, { useEffect, useState } from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { PdfEditService, docEditsOf } from '../../services/pdfEditService';
import { PdfRenderService } from '../../services/pdfRenderService';
import { saveFileAs, stripExtension, type SavedFile } from '../../services/fileSaveService';
import { SavedFilesNotice } from '../common/SaveDestination';
import { t } from '@/i18n';
import type { BookmarkItem, PdfTab } from '../../types/pdf';
import {
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  UploadCloud,
  FileText,
  Plus,
  Save,
  PanelTop
} from 'lucide-react';

type MergeSource = { kind: 'tab'; tabId: string } | { kind: 'file'; data: Uint8Array; outline: BookmarkItem[] };

interface MergeItem {
  id: string;
  name: string;
  /** Diskteki yol (biliniyorsa); kayıt klasörü önerisi ve ipucu için */
  path?: string;
  numPages: number;
  source: MergeSource;
}

type OutputMode = 'save' | 'tab';

let itemCounter = 0;
const nextId = () => `merge-${Date.now()}-${itemCounter++}`;

const tabToItem = (tab: PdfTab): MergeItem => ({
  id: nextId(),
  name: tab.fileName,
  path: tab.filePath,
  numPages: tab.numPages,
  source: { kind: 'tab', tabId: tab.id }
});

export const MergePdfModal: React.FC = () => {
  const { mergeModalOpen, setMergeModalOpen, addTab, updateTab, setActiveTab, addRecentFile, tabs, activeTabId } =
    usePdfStore();
  const [items, setItems] = useState<MergeItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>('save');
  const [openAfterSave, setOpenAfterSave] = useState(true);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);

  // Pencere açıldığında aktif belge listeye kendiliğinden eklenir (yeniden seçmeye gerek yok)
  useEffect(() => {
    if (!mergeModalOpen) return;
    const { tabs: currentTabs, activeTabId: currentId } = usePdfStore.getState();
    const active = currentTabs.find((tab) => tab.id === currentId);
    setItems(active ? [tabToItem(active)] : []);
    setSavedFiles([]);
    setOutputMode('save');
  }, [mergeModalOpen]);

  const first = items[0];
  const mergedName = first ? `${stripExtension(first.name)}_merged.pdf` : 'merged.pdf';

  if (!mergeModalOpen) return null;

  const handleClose = () => {
    if (isProcessing) return;
    setItems([]);
    setSavedFiles([]);
    setMergeModalOpen(false);
  };

  // Listede olmayan açık belgeler (tek tıkla eklenebilir)
  const otherOpenTabs = tabs.filter(
    (tab) => !items.some((item) => item.source.kind === 'tab' && item.source.tabId === tab.id)
  );

  const addOpenTab = (tab: PdfTab) => setItems((prev) => [...prev, tabToItem(tab)]);

  // Diskten dosya ekleme (seçici veya sürükle-bırak)
  const addFiles = async (fileList: FileList | File[]) => {
    for (const file of Array.from(fileList)) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PdfRenderService.loadDocument(bytes.slice());
        const path = window.electronAPI?.getPathForFile?.(file);
        const outline = await PdfRenderService.getDocumentOutline(doc);
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            name: file.name,
            path: path && path !== file.name ? path : undefined,
            numPages: doc.numPages,
            source: { kind: 'file', data: bytes, outline }
          }
        ]);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        alert(t('error_opening_pdf', { message: (err as Error)?.message || String(err) }));
      }
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (input.files?.length) await addFiles(input.files);
    input.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) await addFiles(e.dataTransfer.files);
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  /** Açık sekmelerde bekleyen işaretlemeler de birleştirilen belgeye yazılır */
  const resolveBytes = async (item: MergeItem): Promise<Uint8Array> => {
    if (item.source.kind === 'file') return item.source.data.slice();
    const tabId = item.source.tabId;
    const tab = usePdfStore.getState().tabs.find((tb) => tb.id === tabId);
    if (!tab) throw new Error(item.name);
    return PdfEditService.savePdfWithAnnotations(tab.data.slice(), tab.annotations, tab.importedAnnotations, docEditsOf(tab));
  };

  /** Birleştirilen belgeyi sekmede açar; aynı yolda açık sekme varsa onu günceller */
  const openMerged = async (bytes: Uint8Array, filePath: string, fileName: string, saved: boolean) => {
    const doc = await PdfRenderService.loadDocument(bytes.slice());
    const pageDimensions = await PdfRenderService.getAllPageDimensions(doc);
    const outline = await PdfRenderService.getDocumentOutline(doc);
    const content = {
      data: bytes,
      numPages: doc.numPages,
      pageDimensions,
      outline,
      currentPage: 1,
      isModified: !saved,
      annotations: [],
      importedAnnotations: undefined,
      undoStack: [],
      redoStack: []
    };

    const existing = usePdfStore.getState().tabs.find((tab) => tab.filePath === filePath);
    if (existing) {
      updateTab(existing.id, content);
      setActiveTab(existing.id);
    } else {
      addTab({ id: `tab-merged-${Date.now()}`, filePath, fileName, zoom: 1.0, rotation: 0, ...content });
    }
    if (saved) addRecentFile({ filePath, fileName });
  };

  /** Kaydedilmemiş sekme adı açık sekmelerle çakışmasın ("ad (2).pdf") */
  const uniqueTabName = (fileName: string) => {
    const taken = new Set(usePdfStore.getState().tabs.map((tab) => tab.filePath));
    if (!taken.has(fileName)) return fileName;
    const base = stripExtension(fileName);
    let n = 2;
    while (taken.has(`${base} (${n}).pdf`)) n++;
    return `${base} (${n}).pdf`;
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      alert(t('please_add_at_least_2_pdf_files_to_merge'));
      return;
    }
    try {
      setIsProcessing(true);
      const buffers: Uint8Array[] = [];
      for (const item of items) buffers.push(await resolveBytes(item));
      // Açık sekmede güncel (düzenlenmiş olabilir) ağaç, dosyada okunan ağaç kullanılır
      const openTabs = usePdfStore.getState().tabs;
      const outlines = items.map(({ source }) =>
        source.kind === 'file' ? source.outline : (openTabs.find((tab) => tab.id === source.tabId)?.outline ?? [])
      );
      const mergedBytes = await PdfEditService.mergePdfs(buffers, outlines);

      if (outputMode === 'tab') {
        const name = uniqueTabName(mergedName);
        // Yol = ad: Kaydet komutu bu sekme için "Farklı Kaydet" diyaloğunu açar
        await openMerged(mergedBytes, name, name, false);
        handleClose();
        return;
      }

      const saved = await saveFileAs(mergedBytes, mergedName, { sourcePath: first?.path });
      if (!saved) return;
      if (openAfterSave) await openMerged(mergedBytes, saved.filePath, saved.fileName, true);
      setSavedFiles([saved]);
    } catch (err: any) {
      console.error('Merge error:', err);
      alert(t('error_merge', { message: err.message }));
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPages = items.reduce((acc, f) => acc + f.numPages, 0);
  const done = savedFiles.length > 0;

  const optionClass = (selected: boolean) =>
    `flex items-start space-x-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
      selected
        ? 'border-accent bg-accent/10'
        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-acrobat-darkPanel'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 animate-in fade-in duration-150">
      <div className="bg-sheet w-full max-w-2xl max-h-[90vh] rounded-[14px] shadow-sheet flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-group-sep bg-sheet">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-accent-text" />
            <h2 className="font-semibold text-sm">{t('merge_pdf_files')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde */}
        <div className="p-5 flex-1 flex flex-col space-y-4 overflow-y-auto text-xs">
          {done ? (
            <SavedFilesNotice files={savedFiles} message={t('merge_complete_saved_to')} />
          ) : (
            <>
              {/* Dosya Listesi */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-500 font-medium px-1">
                    <span>{t('order_top_to_bottom')}</span>
                    <span>{t('merge_summary', [items.length, totalPages])}</span>
                  </div>

                  <div className="space-y-1.5">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 bg-sheet rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-3" title={item.path || item.name}>
                          <span className="w-5 h-5 rounded-full bg-accent/10 text-accent-text flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                          {item.source.kind === 'tab' && item.source.tabId === activeTabId && (
                            <span className="px-1.5 py-px rounded-sm bg-accent/10 text-accent-text text-[10px] font-semibold shrink-0">
                              {t('merge_current_document')}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {t('merge_page_count', [item.numPages])}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => move(idx, -1)}
                            disabled={idx === 0 || isProcessing}
                            className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-500"
                            title={t('move_up')}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => move(idx, 1)}
                            disabled={idx === items.length - 1 || isProcessing}
                            className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-500"
                            title={t('move_down')}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeItem(idx)}
                            disabled={isProcessing}
                            className="p-1 rounded-sm hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition-colors ml-1 disabled:opacity-20"
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

              {/* Açık belgelerden ekle */}
              {otherOpenTabs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-slate-500 font-medium px-1">{t('merge_add_open_documents')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {otherOpenTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => addOpenTab(tab)}
                        disabled={isProcessing}
                        title={tab.filePath}
                        className="flex items-center space-x-1 max-w-[240px] px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:border-accent hover:bg-accent/10 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Plus className="w-3 h-3 text-accent-text shrink-0" />
                        <span className="truncate">{tab.fileName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dosya Yükleme Alanı */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-sheet/50 ${
                  isDragging ? 'border-red-500' : 'border-slate-300 dark:border-slate-700 hover:border-accent'
                }`}
              >
                <UploadCloud className="w-7 h-7 text-slate-400 mb-1.5" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {t('select_pdf_files_or_drag_drop')}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">{t('you_can_select_multiple_files')}</span>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,.pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </label>

              {/* Çıktı: yeni dosyaya kaydet veya yalnızca yeni sekmede aç */}
              <div className="space-y-2">
                <div className="text-slate-500 font-medium px-1">{t('merge_output')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={optionClass(outputMode === 'save')}>
                    <input
                      type="radio"
                      name="mergeOutput"
                      checked={outputMode === 'save'}
                      onChange={() => setOutputMode('save')}
                      disabled={isProcessing}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{t('merge_output_save')}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{t('merge_output_save_desc')}</div>
                    </div>
                  </label>
                  <label className={optionClass(outputMode === 'tab')}>
                    <input
                      type="radio"
                      name="mergeOutput"
                      checked={outputMode === 'tab'}
                      onChange={() => setOutputMode('tab')}
                      disabled={isProcessing}
                      className="mt-0.5 accent-accent"
                    />
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{t('merge_output_tab')}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{t('merge_output_tab_desc')}</div>
                    </div>
                  </label>
                </div>
              </div>

              {outputMode === 'save' && (
                <label className="flex items-center space-x-2 px-1 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={openAfterSave}
                    onChange={(e) => setOpenAfterSave(e.target.checked)}
                    disabled={isProcessing}
                    className="rounded-sm accent-accent"
                  />
                  <span>{t('merge_open_after_save')}</span>
                </label>
              )}
            </>
          )}
        </div>

        {/* Alt Çubuk */}
        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-group-sep bg-sheet">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
          >
            {done ? t('close') : t('cancel')}
          </button>
          {!done && (
            <button
              onClick={handleMerge}
              disabled={items.length < 2 || isProcessing}
              className="flex items-center space-x-1.5 px-5 py-1.5 rounded-sm bg-accent hover:bg-accent-hover text-white text-xs font-medium shadow-md transition-colors disabled:opacity-40"
            >
              {outputMode === 'save' ? <Save className="w-3.5 h-3.5" /> : <PanelTop className="w-3.5 h-3.5" />}
              <span>
                {isProcessing ? t('merging') : outputMode === 'save' ? t('merge_save') : t('merge_open')}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
