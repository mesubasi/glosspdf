import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';
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
  FolderSync,
  Image as ImageIcon,
  FileImage,
  Lock,
  Minimize2
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
    setSignatureModalOpen,
    setInsertImageModalOpen,
    setExportImagesModalOpen,
    setProtectModalOpen,
    setCompressModalOpen
  } = usePdfStore();

  if (!rightPanelOpen) return null;

  const selectAnnotationTool = (tool: any) => {
    setActiveTool(tool);
    setAnnotationModeOpen(true);
  };

  const tools = [
    {
      id: 'highlight',
      name: t('highlight_text'),
      icon: Highlighter,
      action: () => selectAnnotationTool('highlight')
    },
    {
      id: 'note',
      name: t('add_sticky_note'),
      icon: MessageSquare,
      action: () => selectAnnotationTool('note')
    },
    {
      id: 'draw',
      name: t('freehand_drawing'),
      icon: PenTool,
      action: () => selectAnnotationTool('draw')
    },
    {
      id: 'rect',
      name: t('draw_rectangle'),
      icon: Square,
      action: () => selectAnnotationTool('rect')
    },
    {
      id: 'text',
      name: t('add_text_box'),
      icon: Type,
      action: () => selectAnnotationTool('text')
    },
    {
      id: 'organize',
      name: t('organize_pages'),
      icon: Layers,
      action: () => setOrganizeModalOpen(true)
    },
    {
      id: 'merge',
      name: t('merge_pdfs'),
      icon: FolderSync,
      action: () => setMergeModalOpen(true)
    },
    {
      id: 'split',
      name: t('split_pdf'),
      icon: Scissors,
      action: () => setSplitModalOpen(true)
    },
    {
      id: 'watermark',
      name: t('stamp_watermark'),
      icon: Stamp,
      action: () => setWatermarkModalOpen(true)
    },
    {
      id: 'sign',
      name: t('handwritten_signature'),
      icon: FileCheck,
      action: () => setSignatureModalOpen(true)
    },
    {
      id: 'insertImage',
      name: t('insert_image'),
      icon: ImageIcon,
      action: () => setInsertImageModalOpen(true)
    },
    {
      id: 'exportImages',
      name: t('export_pages_to_images'),
      icon: FileImage,
      action: () => setExportImagesModalOpen(true)
    },
    {
      id: 'protect',
      name: t('protect_with_password'),
      icon: Lock,
      action: () => setProtectModalOpen(true)
    },
    {
      id: 'compress',
      name: t('compress_pdf'),
      icon: Minimize2,
      action: () => setCompressModalOpen(true)
    }
  ];

  return (
    <div className="w-56 bg-acrobat-panel dark:bg-acrobat-darkPanel border-l border-acrobat-border dark:border-acrobat-darkBorder flex flex-col h-full select-none z-10 shadow-md">
      {/* Başlık */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-acrobat-border dark:border-acrobat-darkBorder text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span>{t('quick_tools')}</span>
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
