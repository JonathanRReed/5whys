import type * as React from 'react';
import { cn } from '../../lib/utils';
import { ArchiveIcon, ClipboardIcon, PencilIcon, SearchIcon, TargetIcon } from './icons';

export type Tab = 'decode' | 'stories' | 'packet' | 'vault';

type Props = {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  showHUD: boolean;
  onLaunchHUD: () => void;
  counts: Record<Tab, number>;
};

// The three steps in the order a student does them, plus the library of every
// story ever written. The step count never lies: it is the number of things
// that exist at that stage.
const tabs: {
  id: Tab;
  label: string;
  step?: number;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'decode', label: 'Decode the job', step: 1, icon: SearchIcon },
  { id: 'stories', label: 'Build stories', step: 2, icon: PencilIcon },
  { id: 'packet', label: 'Pack the proof', step: 3, icon: ClipboardIcon },
  { id: 'vault', label: 'Library', icon: ArchiveIcon },
];

export default function WorkspaceTabs({
  activeTab,
  onChange,
  showHUD,
  onLaunchHUD,
  counts,
}: Props) {
  return (
    <div className="border-b border-border/30 pb-2">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Workspace steps">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
                isActive
                  ? 'bg-foam text-background shadow-lg shadow-foam/25'
                  : 'text-muted-foreground hover:bg-overlay/40 hover:text-foreground',
                tab.id === 'vault' && 'sm:ml-auto'
              )}
            >
              {tab.step ? (
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                    isActive ? 'bg-background/20' : 'bg-overlay/50'
                  )}
                  aria-hidden="true"
                >
                  {tab.step}
                </span>
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs',
                    isActive ? 'bg-background/20' : 'bg-overlay/50 text-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {showHUD && (
          <button
            type="button"
            onClick={onLaunchHUD}
            className="flex items-center gap-2 rounded-xl border border-iris/40 bg-iris/10 px-4 py-2.5 text-sm font-semibold text-iris transition-all hover:bg-iris/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2"
          >
            <TargetIcon className="h-4 w-4" />
            <span>Open the HUD</span>
          </button>
        )}
      </div>
    </div>
  );
}
