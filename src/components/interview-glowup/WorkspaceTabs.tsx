import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  SearchIcon,
  PencilIcon,
  ArchiveIcon,
  ClipboardIcon,
  TargetIcon,
} from './icons';

export type Tab = 'decode' | 'stories' | 'vault' | 'packet';

type Props = {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  showHUD: boolean;
  onLaunchHUD: () => void;
};

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'decode', label: 'Decode JD', icon: <SearchIcon className="h-4 w-4" /> },
  { id: 'stories', label: 'Build Stories', icon: <PencilIcon className="h-4 w-4" /> },
  { id: 'vault', label: 'Vault', icon: <ArchiveIcon className="h-4 w-4" /> },
  { id: 'packet', label: 'Packet', icon: <ClipboardIcon className="h-4 w-4" /> },
];

export default function WorkspaceTabs({ activeTab, onChange, showHUD, onLaunchHUD }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border)/0.3)] pb-2">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            activeTab === tab.id
              ? 'bg-[hsl(var(--foam)/0.15)] text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-[hsl(var(--overlay)/0.3)] hover:text-foreground'
          )}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
      {showHUD && (
        <button
          type="button"
          onClick={onLaunchHUD}
          className="ml-auto flex items-center gap-2 rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <TargetIcon className="h-4 w-4" />
          <span>Launch HUD</span>
        </button>
      )}
    </div>
  );
}
