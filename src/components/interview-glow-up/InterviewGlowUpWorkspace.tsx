import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  createDefaultData,
  ensurePacketForRole,
  type GlowUpData,
  loadData,
  saveData,
} from '../../lib/glowup-store';
import DecodeSection from './DecodeSection';
import InterviewHUD from './InterviewHUD';
import PacketSection from './PacketSection';
import StoriesSection from './StoriesSection';
import VaultSection from './VaultSection';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceTabs, { type Tab } from './WorkspaceTabs';

const SAVE_DEBOUNCE_MS = 300;
const TABS: Tab[] = ['decode', 'stories', 'packet', 'vault'];

function readTabFromUrl(): Tab | null {
  if (typeof window === 'undefined') return null;
  const wanted = new URLSearchParams(window.location.search).get('tab');
  return TABS.includes(wanted as Tab) ? (wanted as Tab) : null;
}

export default function InterviewGlowUpWorkspace() {
  // Start from empty data on both server and client so hydration matches,
  // then load the saved workspace once mounted (this used to throw React #418).
  const [data, setData] = React.useState<GlowUpData>(() => createDefaultData());
  const [hydrated, setHydrated] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>('decode');
  const [showHUD, setShowHUD] = React.useState(false);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = React.useRef<GlowUpData | null>(null);
  // What we loaded, and whether the visitor has changed anything since. A
  // workspace that only read storage must never write to it: another tab, or
  // an import on the dashboard, may have saved newer work in the meantime,
  // and an unload flush would silently overwrite it.
  const loadedJsonRef = React.useRef<string | null>(null);
  const dirtyRef = React.useRef(false);

  React.useEffect(() => {
    let loaded = loadData();
    if (loaded.currentRoleId) loaded = ensurePacketForRole(loaded, loaded.currentRoleId);
    loadedJsonRef.current = JSON.stringify(loaded);
    setData(loaded);
    setHydrated(true);
    const fromUrl = readTabFromUrl();
    if (fromUrl) setActiveTab(fromUrl);
    else if (loaded.currentRoleId && loaded.stories.length === 0) setActiveTab('stories');
  }, []);

  // Debounced save, flushed when the page is hidden or the island unmounts so
  // a quick tab switch or a closed laptop never drops the last edit.
  React.useEffect(() => {
    if (!hydrated) return;
    if (!dirtyRef.current) {
      if (JSON.stringify(data) === loadedJsonRef.current) return;
      dirtyRef.current = true;
    }
    latestRef.current = data;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveData(data);
      saveTimeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [data, hydrated]);

  React.useEffect(() => {
    const flush = () => {
      if (dirtyRef.current && latestRef.current) saveData(latestRef.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

  const currentRole = data.roles.find((r) => r.id === data.currentRoleId);
  const currentPacket = data.packets.find((p) => p.id === data.currentPacketId);
  const packetStoryCount = currentPacket
    ? currentPacket.topStoryIds.filter((id) => data.stories.some((s) => s.id === id)).length
    : 0;

  if (!hydrated) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-overlay/40" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-overlay/30" />
        <div className="h-72 w-full animate-pulse rounded-2xl bg-overlay/25" />
      </div>
    );
  }

  const handleClearData = () => {
    setData(createDefaultData());
    setActiveTab('decode');
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader onClearData={handleClearData} />

      <div className="flex items-center gap-2 rounded-lg border border-foam/25 bg-foam/5 px-4 py-2 text-sm text-muted-foreground">
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-foam"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>
          <strong>No data leaves your browser.</strong> Everything saves here as you type.
        </span>
      </div>

      <WorkspaceTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        showHUD={packetStoryCount > 0}
        onLaunchHUD={() => setShowHUD(true)}
        counts={{
          decode: currentRole ? currentRole.bullets.filter((b) => b.status === 'active').length : 0,
          stories: data.stories.length,
          packet: packetStoryCount,
          vault: data.stories.length,
        }}
      />

      <div className="rounded-2xl border border-border/35 bg-overlay/20 p-4 sm:p-6">
        {activeTab === 'decode' && (
          <DecodeSection data={data} setData={setData} currentRole={currentRole} />
        )}
        {activeTab === 'stories' && (
          <StoriesSection
            data={data}
            setData={setData}
            currentRole={currentRole}
            currentPacket={currentPacket}
            onGoToDecode={() => setActiveTab('decode')}
          />
        )}
        {activeTab === 'vault' && (
          <VaultSection data={data} setData={setData} currentPacket={currentPacket} />
        )}
        {activeTab === 'packet' && (
          <PacketSection
            data={data}
            setData={setData}
            currentRole={currentRole}
            currentPacket={currentPacket}
            onLaunchHUD={() => setShowHUD(true)}
            onGoToStories={() => setActiveTab('stories')}
            onGoToDecode={() => setActiveTab('decode')}
          />
        )}
      </div>

      {showHUD &&
        currentPacket &&
        createPortal(
          <InterviewHUD
            packet={currentPacket}
            stories={data.stories}
            role={currentRole}
            onClose={() => setShowHUD(false)}
          />,
          document.body
        )}
    </div>
  );
}
