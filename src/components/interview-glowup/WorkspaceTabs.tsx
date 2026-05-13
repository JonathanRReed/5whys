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

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'decode', label: 'Decode JD', icon: SearchIcon },
  { id: 'stories', label: 'Build Stories', icon: PencilIcon },
  { id: 'vault', label: 'Vault', icon: ArchiveIcon },
  { id: 'packet', label: 'Packet', icon: ClipboardIcon },
];

export default function WorkspaceTabs({ activeTab, onChange, showHUD, onLaunchHUD }: Props) {
  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  const stepLabel = `Step ${activeIndex + 1} of ${tabs.length}`;

  return (
    <div className="space-y-2 border-b border-[hsl(var(--border)/0.3)] pb-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2',
                isActive
                  ? 'bg-[hsl(var(--foam))] text-[hsl(var(--background))] shadow-lg shadow-[hsl(var(--foam)/0.25)]'
                  : 'text-muted-foreground hover:bg-[hsl(var(--overlay)/0.4)] hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        {showHUD && (
          <button
            type="button"
            onClick={onLaunchHUD}
            className="ml-auto flex items-center gap-2 rounded-xl bg-[hsl(var(--foam))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--background))] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          >
            <TargetIcon className="h-4 w-4" />
            <span>Launch HUD</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2" aria-label="Progress">
        <span className="text-xs font-medium text-muted-foreground">{stepLabel}</span>
        <div className="flex gap-1">
          {tabs.map((tab, i) => (
            <span
              key={tab.id}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors',
                i === activeIndex ? 'bg-[hsl(var(--foam))]' : 'bg-[hsl(var(--border)/0.5)]'
              )}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
