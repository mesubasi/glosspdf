import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import {
  Highlighter,
  MessageSquare,
  PenTool,
  Square,
  Type,
  Layers,
  Scissors,
  X,
  FileCheck,
  Stamp,
  FolderSync
} from 'lucide-react';

export const RightToolsPanel: React.FC = () => {
  const {
    rightPanelOpen,
    toggleRightPanel,
    language,
    setActiveTool,
    setAnnotationModeOpen,
    setOrganizeModalOpen,
    setMergeModalOpen,
    setSplitModalOpen,
    setWatermarkModalOpen,
    setSignatureModalOpen
  } = usePdfStore();

  if (!rightPanelOpen) return null;

  const selectAnnotationTool = (tool: any) => {
    setActiveTool(tool);
    setAnnotationModeOpen(true);
  };

  const tools = [
    {
      id: 'highlight',
      name: language === 'tr' ? 'Vurgula (Highlight)' : 'Highlight Text',
      icon: Highlighter,
      action: () => selectAnnotationTool('highlight')
    },
    {
      id: 'note',
      name: language === 'tr' ? 'Not Ekle (Comment)' : 'Add Sticky Note',
      icon: MessageSquare,
      action: () => selectAnnotationTool('note')
    },
    {
      id: 'draw',
      name: language === 'tr' ? 'Serbest Çizim (Ink)' : 'Freehand Drawing',
      icon: PenTool,
      action: () => selectAnnotationTool('draw')
    },
    {
      id: 'rect',
      name: language === 'tr' ? 'Dikdörtgen Şekli' : 'Draw Rectangle',
      icon: Square,
      action: () => selectAnnotationTool('rect')
    },
    {
      id: 'text',
      name: language === 'tr' ? 'Metin Kutusu Ekle' : 'Add Text Box',
      icon: Type,
      action: () => selectAnnotationTool('text')
    },
    {
      id: 'organize',
      name: language === 'tr' ? 'Sayfaları Yönet (Organize)' : 'Organize Pages',
      icon: Layers,
      action: () => setOrganizeModalOpen(true)
    },
    {
      id: 'merge',
      name: language === 'tr' ? 'PDF Birleştir (Merge)' : 'Merge PDFs',
      icon: FolderSync,
      action: () => setMergeModalOpen(true)
    },
    {
      id: 'split',
      name: language === 'tr' ? 'PDF Böl (Split)' : 'Split PDF',
      icon: Scissors,
      action: () => setSplitModalOpen(true)
    },
    {
      id: 'watermark',
      name: language === 'tr' ? 'Damga & Filigran' : 'Stamp & Watermark',
      icon: Stamp,
      action: () => setWatermarkModalOpen(true)
    },
    {
      id: 'sign',
      name: language === 'tr' ? 'Islak İmza Ekle (Sign)' : 'Handwritten Signature',
      icon: FileCheck,
      action: () => setSignatureModalOpen(true)
    }
  ];

  return (
    <div className="w-56 bg-acrobat-panel dark:bg-acrobat-darkPanel border-l border-acrobat-border dark:border-acrobat-darkBorder flex flex-col h-full select-none z-10 shadow-md">
      {/* Başlık */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-acrobat-border dark:border-acrobat-darkBorder text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span>{language === 'tr' ? 'Hızlı Araçlar' : 'Quick Tools'}</span>
        <button
          onClick={toggleRightPanel}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Araç Listesi */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tools.map((t) => {
          const IconComponent = t.icon;
          return (
            <button
              key={t.id}
              onClick={t.action}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-left text-xs text-slate-700 dark:text-slate-200 transition-colors"
            >
              <IconComponent className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="truncate">{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
