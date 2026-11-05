import React from 'react';
import { usePdfStore } from '../../store/usePdfStore';
import { t } from '@/i18n';
import { formatBytes } from '../../services/fileSaveService';
import {
  LayoutGrid,
  Merge,
  Scissors,
  ImagePlus,
  Stamp,
  ImageDown,
  Lock,
  Shrink,
  Link,
  Unlink,
  ChevronRight
} from 'lucide-react';

interface InspectorTool {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  /** System Settings tarzı renkli simge kutusu; anlamı etiket taşır */
  tint: string;
  action: () => void;
}

/** Sağ inceleyici: belge bilgisi ve gruplu araçlar (işaretleme araçları yüzen çubukta) */
export const RightToolsPanel: React.FC = () => {
  const {
    rightPanelOpen,
    tabs,
    activeTabId,
    setOrganizeModalOpen,
    setMergeModalOpen,
    setSplitModalOpen,
    setWatermarkModalOpen,
    setInsertImageModalOpen,
    setExportImagesModalOpen,
    setProtectModalOpen,
    setCompressModalOpen,
    setWebLinksModalOpen
  } = usePdfStore();

  if (!rightPanelOpen) return null;

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const groups: { title: string; tools: InspectorTool[] }[] = [
    {
      title: t('section_pages'),
      tools: [
        { id: 'organize', name: t('organize_pages'), icon: LayoutGrid, tint: 'bg-[#007AFF]', action: () => setOrganizeModalOpen(true) },
        { id: 'merge', name: t('merge_pdfs'), icon: Merge, tint: 'bg-[#5856D6]', action: () => setMergeModalOpen(true) },
        { id: 'split', name: t('split_pdf'), icon: Scissors, tint: 'bg-[#FF9500]', action: () => setSplitModalOpen(true) }
      ]
    },
    {
      title: t('section_content'),
      tools: [
        { id: 'insertImage', name: t('insert_image'), icon: ImagePlus, tint: 'bg-[#34C759]', action: () => setInsertImageModalOpen(true) },
        { id: 'watermark', name: t('stamp_watermark'), icon: Stamp, tint: 'bg-[#AF52DE]', action: () => setWatermarkModalOpen(true) },
        { id: 'exportImages', name: t('export_pages_to_images'), icon: ImageDown, tint: 'bg-[#30B0C7]', action: () => setExportImagesModalOpen(true) },
        { id: 'createLinks', name: t('create_links_from_urls'), icon: Link, tint: 'bg-[#5AC8FA]', action: () => setWebLinksModalOpen('create') },
        { id: 'removeLinks', name: t('remove_web_links'), icon: Unlink, tint: 'bg-[#FF2D55]', action: () => setWebLinksModalOpen('remove') }
      ]
    },
    {
      title: t('section_protection_size'),
      tools: [
        { id: 'protect', name: t('protect_with_password'), icon: Lock, tint: 'bg-[#8E8E93]', action: () => setProtectModalOpen(true) },
        { id: 'compress', name: t('compress_pdf'), icon: Shrink, tint: 'bg-[#FF3B30]', action: () => setCompressModalOpen(true) }
      ]
    }
  ];

  return (
    <aside
      aria-label={t('inspector')}
      className="w-[272px] shrink-0 h-full overflow-y-auto bg-inspector border-l border-separator text-label text-[13px] select-none"
    >
      <div className="flex flex-col gap-2 p-4">
        {activeTab && (
          <>
            <SectionTitle>{t('section_document')}</SectionTitle>
            <div className="rounded-[10px] bg-group ring-1 ring-group-sep overflow-hidden">
              <InfoRow label={t('section_pages')} value={String(activeTab.numPages)} />
              <InfoRow label={t('file_size')} value={formatBytes(activeTab.data.byteLength)} divider />
            </div>
          </>
        )}

        {groups.map((group, gi) => (
          <React.Fragment key={group.title}>
            <SectionTitle spaced={gi > 0 || !!activeTab}>{group.title}</SectionTitle>
            <div className="rounded-[10px] bg-group ring-1 ring-group-sep overflow-hidden">
              {group.tools.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={tool.action}
                    // Modallar belge yokken de bağlı kalır; tıklamalar belge açılınca hepsini açardı. Birleştir belge istemez.
                    disabled={!activeTabId && tool.id !== 'merge'}
                    className={`flex items-center gap-2.5 w-full h-[38px] px-2.5 text-left hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent ${
                      i > 0 ? 'border-t border-group-sep' : ''
                    }`}
                  >
                    <span className={`grid place-items-center w-[22px] h-[22px] rounded-md text-white shrink-0 ${tool.tint}`}>
                      <Icon className="w-[13px] h-[13px]" strokeWidth={2.2} />
                    </span>
                    <span className="flex-1 truncate">{tool.name}</span>
                    <ChevronRight className="w-3 h-3 text-secondary shrink-0" strokeWidth={2.4} />
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </aside>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode; spaced?: boolean }> = ({ children, spaced }) => (
  <h2 className={`mx-1 text-[11px] font-semibold tracking-wide text-secondary ${spaced ? 'mt-3' : ''}`}>{children}</h2>
);

const InfoRow: React.FC<{ label: string; value: string; divider?: boolean }> = ({ label, value, divider }) => (
  <div className={`flex items-center justify-between h-8 px-3 ${divider ? 'border-t border-group-sep' : ''}`}>
    <span className="text-secondary">{label}</span>
    <span>{value}</span>
  </div>
);
