import * as React from 'react';
import { flushSync } from 'react-dom';
import { type Audience, audienceForProfile } from '../../lib/glowup-banks';
import {
  createDefaultData,
  ensurePacketForRole,
  exportJSON,
  type GlowUpData,
  loadData,
  mergeGlowUp,
  readStoredJson,
  STORAGE_KEY,
  saveData,
  switchRole,
} from '../../lib/glowup-store';
import { readProfile } from '../../lib/profile';
import { Button } from '../ui/button';
import { Tabs, TabsContent } from '../ui/tabs';
import DecodeSection, { type SaveState } from './DecodeSection';
import InterviewHUD from './InterviewHUD';
import PacketPrint from './PacketPrint';
import PacketSection from './PacketSection';
import StoriesSection, {
  CLOSED_EDITOR,
  newStoryEditor,
  type StoryEditor,
  storyEditorFromAnswer,
} from './StoriesSection';
import TrackApplication from './TrackApplication';
import VaultSection from './VaultSection';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceTabs, { type Tab } from './WorkspaceTabs';

const SAVE_DEBOUNCE_MS = 300;
const TABS: Tab[] = ['decode', 'stories', 'packet', 'vault'];

/**
 * The role a link asked for ("?role=r1"), when it is one of the saved roles.
 * An unknown id is ignored.
 */
function readRoleFromUrl(data: GlowUpData): string | null {
  if (typeof window === 'undefined') return null;
  const wanted = new URLSearchParams(window.location.search).get('role');
  return wanted && data.roles.some((r) => r.id === wanted) ? wanted : null;
}

/**
 * Take the role back out of the address once it is current, so a reload
 * after switching to another role opens on that one.
 */
function forgetRoleInUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // The address keeps the role; it still names a saved role.
  }
}

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
  const touchedRef = React.useRef(false);
  // What storage held when this tab last read or wrote it: the raw text, to
  // notice another tab's write, and the data, to merge against.
  const baseRef = React.useRef<{ raw: string | null; data: GlowUpData } | null>(null);

  /**
   * Write this tab's data. When another tab wrote since we last read, merge
   * record by record instead of overwriting: what this tab changed wins,
   * everything else keeps the newer copy. Returns what was written, or null
   * when the browser refused.
   */
  const commit = React.useCallback((ours: GlowUpData): GlowUpData | null => {
    const base = baseRef.current;
    const raw = readStoredJson();
    const toWrite = base && raw !== base.raw ? mergeGlowUp(base.data, ours, loadData()) : ours;
    if (!saveData(toWrite)) return null;
    baseRef.current = { raw: readStoredJson(), data: toWrite };
    return toWrite;
  }, []);

  React.useEffect(() => {
    const raw = readStoredJson();
    const stored = loadData();
    baseRef.current = { raw, data: stored };
    const opened = stored.currentRoleId
      ? ensurePacketForRole(stored, stored.currentRoleId)
      : stored;
    loadedJsonRef.current = JSON.stringify(opened);
    // A link that names a role ("?role=r1", from the dashboard or the desk)
    // opens on it, even in a new tab. That is the change the role switcher
    // makes, so it is saved like one. With no role named, nothing is written.
    const asked = readRoleFromUrl(stored);
    const loaded = asked && asked !== opened.currentRoleId ? switchRole(opened, asked) : opened;
    if (asked) forgetRoleInUrl();
    setData(loaded);
    setAudience(audienceForProfile(readProfile()));
    setHydrated(true);
    const fromUrl = readTabFromUrl();
    const role = loaded.roles.find((r) => r.id === loaded.currentRoleId);
    // Go straight to stories only once the posting is decoded; before that
    // the next step (parsing) is on Decode the job.
    const decoded = Boolean(role?.bullets.some((b) => b.status === 'active'));
    // "Use as a story draft" in the rehearsal room opens the editor here on
    // a kept answer. Nothing is saved until the visitor presses Save.
    const draftId = new URLSearchParams(window.location.search).get('draft');
    const answer = draftId ? (loaded.answers ?? []).find((a) => a.id === draftId) : undefined;
    if (answer) {
      setStoryEditor(storyEditorFromAnswer(answer));
      setActiveTab('stories');
    } else if (fromUrl) setActiveTab(fromUrl);
    else if (decoded && loaded.stories.length === 0) setActiveTab('stories');
  }, []);

  // Debounced save, flushed when the page is hidden or the island unmounts so
  // a quick tab switch or a closed laptop never drops the last edit.
  React.useEffect(() => {
    if (!hydrated) return;
    if (!touchedRef.current) {
      if (JSON.stringify(data) === loadedJsonRef.current) return;
      touchedRef.current = true;
    }
    // Nothing new since the last write (or since another tab's change was read in).
    if (baseRef.current && JSON.stringify(data) === JSON.stringify(baseRef.current.data)) return;
    latestRef.current = data;
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const written = commit(data);
      latestRef.current = null;
      // "Saved" only when the browser kept it.
      setSaveState(written ? 'saved' : 'failed');
      // Another tab's newer work was merged in: show it.
      if (written && written !== data) setData(written);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [data, hydrated, commit]);

  React.useEffect(() => {
    // Only an edit that has not reached storage yet is written; a saved tab
    // writes nothing on its way out.
    const flush = () => {
      if (!latestRef.current) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      commit(latestRef.current);
      latestRef.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    // Another tab saved (the desk, an import, a second workspace). With no
    // edit waiting here, show its version; with one waiting, the next save
    // merges the two.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      if (latestRef.current) return;
      const raw = readStoredJson();
      if (raw === baseRef.current?.raw) return;
      const fresh = loadData();
      baseRef.current = { raw, data: fresh };
      if (!touchedRef.current) loadedJsonRef.current = JSON.stringify(fresh);
      setData(fresh);
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [commit]);

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
              href={`/interview-glow-up/rehearse/?role=${encodeURIComponent(currentRole.id)}`}
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
          // Pack the proof has its own button at the bottom; one is enough there.
          showHUD={packetStoryCount > 0 && activeTab !== 'packet'}
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
