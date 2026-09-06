import type * as React from 'react';
import { cn } from '../../lib/utils';
import { TabsList, TabsTrigger } from '../ui/tabs';
import { ArchiveIcon, ClipboardIcon, PencilIcon, SearchIcon, TargetIcon } from './icons';

export type Tab = 'decode' | 'stories' | 'packet' | 'vault';

type Props = {
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

/**
 * Radix drives the tab semantics: roving tabindex, arrow-key navigation, and
 * the aria-controls wiring to each panel. The hand-rolled version claimed
 * role="tablist" while doing none of that, so arrow keys did nothing and every
 * tab sat in the tab order.
 */
export default function WorkspaceTabs({ showHUD, onLaunchHUD, counts }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/30 pb-2">
      <TabsList
        variant="line"
        className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.id];
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'group/step flex flex-none items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold',
                'hover:bg-overlay/40 hover:text-foreground',
                'after:hidden'
              )}
            >
              {tab.step ? (
                <span
                  className="flex size-5 items-center justify-center rounded-full bg-overlay/50 text-xs group-data-[state=active]/step:bg-primary-foreground/20"
                  aria-hidden="true"
                >
                  {tab.step}
                </span>
              ) : (
                <Icon className="size-4" aria-hidden="true" />
              )}
              <span>{tab.label}</span>
              {count > 0 && (
                <span className="rounded-full bg-overlay/50 px-1.5 text-xs text-foreground group-data-[state=active]/step:bg-primary-foreground/20 group-data-[state=active]/step:text-primary-foreground">
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {showHUD && (
        <button
          type="button"
          onClick={onLaunchHUD}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-iris/40 sm:ml-auto sm:w-auto sm:justify-start bg-iris/10 px-4 py-2.5 text-sm font-semibold text-iris transition-colors hover:bg-iris/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2"
        >
          <TargetIcon className="size-4" />
          <span>Open the HUD</span>
        </button>
      )}
    </div>
  );
}
