import * as React from 'react';
import { flushSync } from 'react-dom';
import { type Audience, audienceForProfile } from '../../lib/glowup-banks';
import {
  createDefaultData,
  ensurePacketForRole,
  exportJSON,
  type GlowUpData,
  loadData,
  saveData,
} from '../../lib/glowup-store';
import { readProfile } from '../../lib/profile';
import { Button } from '../ui/button';
import { Tabs, TabsContent } from '../ui/tabs';
import DecodeSection, { type SaveState } from './DecodeSection';
import InterviewHUD from './InterviewHUD';
import PacketPrint from './PacketPrint';
import PacketSection from './PacketSection';
import StoriesSection, { CLOSED_EDITOR, newStoryEditor, type StoryEditor } from './StoriesSection';
import TrackApplication from './TrackApplication';
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
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  // A story being written lives here, not in the Build stories tab, so
  // switching tabs does not drop it.
  const [storyEditor, setStoryEditor] = React.useState<StoryEditor>(CLOSED_EDITOR);
  // What is being printed: the packet as a review sheet, or the open cheat
  // sheet. `fromDialog` is true when the browser's own print was started
  // (Ctrl+P) and the sheet must not open a second dialog.
  const [printing, setPrinting] = React.useState<{
    from: 'packet' | 'cheat-sheet';
    fromDialog: boolean;
  } | null>(null);
  const donePrinting = React.useCallback(() => setPrinting(null), []);
  // Who is preparing, from the career review. Read after mount, like the data.
  const [audience, setAudience] = React.useState<Audience>('student');
  // The HUD opens from two different buttons, so Radix cannot restore focus on
  // its own. Remember what was focused and hand it back when the HUD closes.
  const hudOpenerRef = React.useRef<HTMLElement | null>(null);
  const openHUD = React.useCallback(() => {
    hudOpenerRef.current = document.activeElement as HTMLElement | null;
    setShowHUD(true);
  }, []);
  const closeHUD = React.useCallback(() => {
    setShowHUD(false);
    // Wait for the dialog to unmount before moving focus back.
    requestAnimationFrame(() => hudOpenerRef.current?.focus());
  }, []);
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
    setAudience(audienceForProfile(readProfile()));
    setHydrated(true);
    const fromUrl = readTabFromUrl();
    const role = loaded.roles.find((r) => r.id === loaded.currentRoleId);
    // Go straight to stories only once the posting is decoded; before that
    // the next step (parsing) is on Decode the job.
    const decoded = Boolean(role?.bullets.some((b) => b.status === 'active'));
    if (fromUrl) setActiveTab(fromUrl);
    else if (decoded && loaded.stories.length === 0) setActiveTab('stories');
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
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      // "Saved" only when the browser kept it.
      setSaveState(saveData(data) ? 'saved' : 'failed');
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

  // The browser's own print (Ctrl+P) with the cheat sheet open would print a
  // blank page: print the cheat sheet as a plain sheet instead.
  React.useEffect(() => {
    if (!showHUD) return undefined;
    const beforePrint = () => {
      if (printing) return;
      flushSync(() => setPrinting({ from: 'cheat-sheet', fromDialog: true }));
    };
    window.addEventListener('beforeprint', beforePrint);
    return () => window.removeEventListener('beforeprint', beforePrint);
  }, [showHUD, printing]);

  const currentRole = data.roles.find((r) => r.id === data.currentRoleId);
  const staleRequirements =
    currentRole &&
    currentRole.bullets.length > 0 &&
    currentRole.parsedJdText !== currentRole.rawJdText;
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
    setStoryEditor(CLOSED_EDITOR);
    setActiveTab('decode');
  };

  const postingState = !currentRole
    ? 'none'
    : currentRole.bullets.some((b) => b.status === 'active')
      ? 'decoded'
      : currentRole.rawJdText.trim().length >= 80
        ? 'pasted'
        : 'none';

  return (
    <div
      className="space-y-6"
      // What the guide reads to know where the visitor is, on any tab.
      data-guide="workspace"
      data-guide-posting={postingState}
      data-guide-packet={packetStoryCount > 0 ? 'stories' : 'empty'}
    >
      <WorkspaceHeader onClearData={handleClearData} data={data} />

      {saveState === 'failed' && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/8 p-4"
        >
          <p className="text-sm text-foreground">
            This browser would not save your last change. It is still on this page, but it will be
            gone when the page closes. Download a backup file now, or free some space in the storage
            panel on the dashboard.
          </p>
          <Button type="button" variant="outline" onClick={() => exportJSON(data)}>
            Download a backup file
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-foam/25 bg-foam/5 px-4 py-2 text-sm text-muted-foreground print:hidden">
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
          <strong>Nothing you write leaves this browser.</strong> The posting and packet save here
          as you type; a story saves when you press Save.
        </span>
      </div>

      {staleRequirements && (
        <div role="status" className="space-y-3 rounded-xl border border-gold/40 bg-gold/8 p-4">
          <p className="text-sm text-foreground">
            Saved requirements may not match this job posting. Parse the posting again to refresh
            skill tags and story gaps. Your saved stories and packet are kept.
          </p>
          <Button type="button" variant="outline" onClick={() => setActiveTab('decode')}>
            Review job posting
          </Button>
        </div>
      )}

      {/* Which role the workspace is pointed at, on every tab. */}
      {currentRole && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/30 bg-overlay/15 px-4 py-2 text-sm print:hidden">
          <span className="text-muted-foreground">Prepping for</span>
          <span className="min-w-0 max-w-full font-medium wrap-anywhere text-foreground">
            {currentRole.jobTitle || 'Untitled role'}
            {currentRole.company ? ` at ${currentRole.company}` : ''}
          </span>
          <span className="ml-auto flex flex-wrap items-center">
            <a
              href="/interview-glow-up/rehearse/"
              className="mr-3 inline-flex min-h-6 items-center underline underline-offset-4 hover:text-foam focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
            >
              Rehearse out loud
            </a>
            <TrackApplication role={currentRole} />
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
        <WorkspaceTabs
          showHUD={packetStoryCount > 0}
          onLaunchHUD={openHUD}
          counts={{
            decode: currentRole
              ? currentRole.bullets.filter((b) => b.status === 'active').length
              : 0,
            stories: data.stories.length,
            packet: packetStoryCount,
            vault: data.stories.length,
          }}
        />

        <div className="rounded-2xl border border-border/35 bg-overlay/20 p-4 sm:p-6">
          <TabsContent value="decode">
            <DecodeSection
              data={data}
              setData={setData}
              currentRole={currentRole}
              audience={audience}
              saveState={saveState}
            />
          </TabsContent>
          <TabsContent value="stories">
            <StoriesSection
              data={data}
              setData={setData}
              currentRole={currentRole}
              currentPacket={currentPacket}
              onGoToDecode={() => setActiveTab('decode')}
              audience={audience}
              editor={storyEditor}
              onEditorChange={setStoryEditor}
            />
          </TabsContent>
          <TabsContent value="vault">
            <VaultSection
              data={data}
              setData={setData}
              currentPacket={currentPacket}
              onGoToStories={() => {
                setStoryEditor(newStoryEditor());
                setActiveTab('stories');
              }}
            />
          </TabsContent>
          <TabsContent value="packet">
            <PacketSection
              data={data}
              setData={setData}
              currentRole={currentRole}
              currentPacket={currentPacket}
              onLaunchHUD={openHUD}
              onPrint={() => setPrinting({ from: 'packet', fromDialog: false })}
              onGoToStories={() => setActiveTab('stories')}
              onGoToDecode={() => setActiveTab('decode')}
              audience={audience}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* While the cheat sheet prints, the dialog steps aside: an open dialog
          hides everything else on paper, including the sheet. */}
      {showHUD && currentPacket && !printing && (
        <InterviewHUD
          packet={currentPacket}
          stories={data.stories}
          role={currentRole}
          onClose={closeHUD}
          onPrint={() => setPrinting({ from: 'cheat-sheet', fromDialog: false })}
        />
      )}
      {printing && currentPacket && (
        <PacketPrint
          packet={currentPacket}
          stories={data.stories}
          role={currentRole}
          from={printing.from}
          autoPrint={!printing.fromDialog}
          onDone={donePrinting}
        />
      )}
    </div>
  );
}
