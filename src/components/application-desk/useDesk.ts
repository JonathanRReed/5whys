import * as React from 'react';
import {
  APPLICATION_DESK_KEY,
  type ApplicationDesk,
  type ApplicationDeskData,
  createDefaultDeskData,
  getDesk,
  loadApplicationDesks,
  saveApplicationDesks,
} from '../../lib/application-desk';
import {
  APPLICATIONS_KEY,
  type ApplicationsData,
  createDefaultApplications,
  loadApplications,
  saveApplications,
  type TrackedApplication,
} from '../../lib/applications';
import { RESUME_SESSION_KEY, readResumeRewrites, readResumeText } from '../../lib/career-bridge';
import { onDeviceCleared } from '../../lib/device-events';
import {
  createDefaultData,
  type DecodedRole,
  STORAGE_KEY as GLOW_STORAGE_KEY,
  type GlowUpData,
  loadData,
  saveData,
} from '../../lib/glowup-store';

export type ResumeRewrite = { original: string; improved: string };

/**
 * The application this page had open is gone: removed in another tab, or
 * everything on the device was cleared. The editors are empty and nothing is
 * saved under its id any more.
 */
export type DeskLoss = {
  reason: 'removed' | 'cleared';
  /** Its role, as this page last showed it. */
  title: string;
  /** Text that was in its fields when it went, for the visitor to copy. Empty after a clear. */
  text: string;
};

export type DeskState = {
  ready: boolean;
  applications: ApplicationsData;
  glow: GlowUpData;
  desks: ApplicationDeskData;
  resumeText: string;
  /** Lines rewritten in the Resume Game, as saved now. */
  rewrites: ResumeRewrite[];
  application: TrackedApplication | null;
  role: DecodedRole | null;
  desk: ApplicationDesk;
  select: (id: string) => void;
  changeApplications: (change: (data: ApplicationsData) => ApplicationsData) => ApplicationsData;
  changeGlow: (change: (data: GlowUpData) => GlowUpData) => GlowUpData;
  changeDesks: (change: (data: ApplicationDeskData) => ApplicationDeskData) => void;
  /** Read every store again, for work saved in another tab. */
  refresh: () => void;
  /** True when the last change could not be saved; the page still holds it. */
  unsaved: boolean;
  /** Set when the open application disappeared from storage. */
  lost: DeskLoss | null;
  dismissLost: () => void;
};

/** True when `next` is what the store now holds. */
function stored(key: string, next: unknown): boolean {
  try {
    return window.localStorage.getItem(key) === JSON.stringify(next);
  } catch {
    return false;
  }
}

/** True when the key is not in storage at all, as after a clear. */
function missing(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === null;
  } catch {
    return false;
  }
}

const sameRewrites = (a: ResumeRewrite[], b: ResumeRewrite[]) =>
  a.length === b.length &&
  a.every((r, i) => r.original === b[i].original && r.improved === b[i].improved);

/** The stores the desk shows. A change to any of them in another tab is read again. */
const WATCHED = new Set([
  APPLICATIONS_KEY,
  GLOW_STORAGE_KEY,
  APPLICATION_DESK_KEY,
  RESUME_SESSION_KEY,
]);

/**
 * The desk's view of three stores: applications, the decoded roles in the
 * Glow Up data, and the per-application desk state, plus the master resume.
 *
 * It renders from empty state and reads storage in an effect. Loading never
 * writes. Every change re-reads the store first, so work saved in another tab
 * since this page loaded is built on, not overwritten. The stores are read
 * again when another tab changes them and when this tab comes back into view.
 *
 * If the open application stops existing (removed on the dashboard, or the
 * device cleared), the desk stops saving: nothing is written under an id that
 * no application has, so an old tab cannot bring cleared work back.
 */
export function useDesk(options: { snapshot?: () => string } = {}): DeskState {
  const [ready, setReady] = React.useState(false);
  const [applications, setApplications] = React.useState(createDefaultApplications);
  const [glow, setGlow] = React.useState(createDefaultData);
  const [desks, setDesks] = React.useState(createDefaultDeskData);
  const [resumeText, setResumeText] = React.useState('');
  const [rewrites, setRewrites] = React.useState<ResumeRewrite[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [lost, setLost] = React.useState<DeskLoss | null>(null);
  // Set from the moment the open application is found gone until the visitor
  // opens or starts another one. While set, editors that were on screen
  // cannot save.
  const gone = React.useRef(false);

  // Read inside callbacks that must see the latest values, not a render's.
  const selected = React.useRef<string | null>(null);
  const shown = React.useRef(applications);
  shown.current = applications;
  const snapshot = React.useRef(options.snapshot);
  snapshot.current = options.snapshot;

  // Each change builds on the store as it is now, so work saved in another
  // tab is kept. If a save fails (storage full or blocked), the change is held
  // here and the next one builds on it instead, so nothing typed in this visit
  // is undone by the next keystroke.
  const held = React.useRef<{
    applications: ApplicationsData | null;
    glow: GlowUpData | null;
    desks: ApplicationDeskData | null;
  }>({ applications: null, glow: null, desks: null });
  const [unsaved, setUnsaved] = React.useState(false);
  const settle = React.useCallback(() => {
    const h = held.current;
    setUnsaved(Boolean(h.applications || h.glow || h.desks));
  }, []);

  const choose = React.useCallback((id: string | null) => {
    selected.current = id;
    setSelectedId(id);
  }, []);

  const readResume = React.useCallback(() => {
    setResumeText(readResumeText());
    const next = readResumeRewrites();
    setRewrites((current) => (sameRewrites(current, next) ? current : next));
  }, []);

  const refresh = React.useCallback(
    (cause?: 'cleared') => {
      const apps = held.current.applications ?? loadApplications();
      const id = selected.current;
      if (id && !apps.applications.some((a) => a.id === id)) {
        const cleared = cause === 'cleared' || missing(APPLICATIONS_KEY);
        const title = shown.current.applications.find((a) => a.id === id)?.title ?? '';
        // After a clear the visitor asked for everything to go, so nothing is
        // kept to copy. After a removal, whatever was typed can be copied out.
        const text = cleared ? '' : (snapshot.current?.() ?? '');
        gone.current = true;
        setLost({ reason: cleared ? 'cleared' : 'removed', title, text });
        held.current = { applications: null, glow: null, desks: null };
        settle();
        choose(null);
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('id');
          window.history.replaceState(null, '', url);
        } catch {
          // The address keeps the old id; it no longer matches anything.
        }
      }
      if (!held.current.applications) setApplications(apps);
      if (!held.current.glow) setGlow(loadData());
      if (!held.current.desks) setDesks(loadApplicationDesks());
      readResume();
    },
    [choose, readResume, settle]
  );

  React.useEffect(() => {
    const apps = loadApplications();
    setApplications(apps);
    setGlow(loadData());
    setDesks(loadApplicationDesks());
    readResume();
    const wanted = new URLSearchParams(window.location.search).get('id');
    const known = (id: string | null) => apps.applications.some((a) => a.id === id);
    choose(
      known(wanted)
        ? wanted
        : known(apps.activeId)
          ? apps.activeId
          : (apps.applications[0]?.id ?? null)
    );
    setReady(true);
  }, [choose, readResume]);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // A null key is a clear of the whole store.
      if (event.key === null) refresh('cleared');
      else if (WATCHED.has(event.key)) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onFocus = () => refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const stop = onDeviceCleared(() => refresh('cleared'));
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      stop();
    };
  }, [refresh]);

  const select = React.useCallback(
    (id: string) => {
      choose(id);
      gone.current = false;
      setLost(null);
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      window.history.replaceState(null, '', url);
    },
    [choose]
  );

  /**
   * Whether the open application still exists, so a change may be saved.
   * When it does not, the page is told and nothing is written.
   */
  const alive = React.useCallback((): boolean => {
    if (gone.current) return false;
    const id = selected.current;
    if (!id) return true;
    const apps = held.current.applications ?? loadApplications();
    if (apps.applications.some((a) => a.id === id)) return true;
    refresh();
    return false;
  }, [refresh]);

  const changeApplications = React.useCallback(
    (change: (data: ApplicationsData) => ApplicationsData) => {
      // Starting a new application is allowed after a loss; changing the
      // one that went is not (its change finds nothing to change).
      if (!gone.current && !alive()) return shown.current;
      const current = held.current.applications ?? loadApplications();
      const next = change(current);
      if (next !== current) {
        saveApplications(next);
        held.current.applications = stored(APPLICATIONS_KEY, next) ? null : next;
        settle();
      }
      setApplications(next);
      return next;
    },
    [alive, settle]
  );

  const changeGlow = React.useCallback(
    (change: (data: GlowUpData) => GlowUpData) => {
      const current = held.current.glow ?? loadData();
      if (!alive()) return current;
      const next = change(current);
      if (next !== current) {
        saveData(next);
        held.current.glow = stored(GLOW_STORAGE_KEY, next) ? null : next;
        settle();
      }
      setGlow(next);
      return next;
    },
    [alive, settle]
  );

  const changeDesks = React.useCallback(
    (change: (data: ApplicationDeskData) => ApplicationDeskData) => {
      if (!alive()) return;
      const current = held.current.desks ?? loadApplicationDesks();
      const next = change(current);
      // Never write a desk for an application that does not exist: an editor
      // left open for one that was removed would leave unreachable work.
      const known = new Set(
        (held.current.applications ?? loadApplications()).applications.map((a) => a.id)
      );
      const orphan = Object.keys(next.desks).some(
        (id) => next.desks[id] !== current.desks[id] && !known.has(id)
      );
      if (orphan) {
        refresh();
        return;
      }
      if (next !== current) {
        held.current.desks = saveApplicationDesks(next) ? null : next;
        settle();
      }
      setDesks(next);
    },
    [alive, refresh, settle]
  );

  const dismissLost = React.useCallback(() => setLost(null), []);
  const plainRefresh = React.useCallback(() => refresh(), [refresh]);

  const application = applications.applications.find((a) => a.id === selectedId) ?? null;
  const role = application?.roleId
    ? (glow.roles.find((r) => r.id === application.roleId) ?? null)
    : null;
  const desk = React.useMemo(() => getDesk(desks, application?.id ?? ''), [desks, application?.id]);

  return {
    ready,
    applications,
    glow,
    desks,
    resumeText,
    rewrites,
    application,
    role,
    desk,
    select,
    changeApplications,
    changeGlow,
    changeDesks,
    refresh: plainRefresh,
    unsaved,
    lost,
    dismissLost,
  };
}
