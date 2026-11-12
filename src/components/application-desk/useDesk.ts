import * as React from 'react';
import {
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
import { readResumeText } from '../../lib/career-bridge';
import {
  createDefaultData,
  type DecodedRole,
  STORAGE_KEY as GLOW_STORAGE_KEY,
  type GlowUpData,
  loadData,
  saveData,
} from '../../lib/glowup-store';

export type DeskState = {
  ready: boolean;
  applications: ApplicationsData;
  glow: GlowUpData;
  desks: ApplicationDeskData;
  resumeText: string;
  application: TrackedApplication | null;
  role: DecodedRole | null;
  desk: ApplicationDesk;
  select: (id: string) => void;
  changeApplications: (change: (data: ApplicationsData) => ApplicationsData) => ApplicationsData;
  changeGlow: (change: (data: GlowUpData) => GlowUpData) => GlowUpData;
  changeDesks: (change: (data: ApplicationDeskData) => ApplicationDeskData) => void;
  /** True when the last change could not be saved; the page still holds it. */
  unsaved: boolean;
};

/** True when `next` is what the store now holds. */
function stored(key: string, next: unknown): boolean {
  try {
    return window.localStorage.getItem(key) === JSON.stringify(next);
  } catch {
    return false;
  }
}

/**
 * The desk's view of three stores: applications, the decoded roles in the
 * Glow Up data, and the per-application desk state.
 *
 * It renders from empty state and reads storage in an effect. Loading never
 * writes. Every change re-reads the store first, so work saved in another tab
 * since this page loaded is built on, not overwritten.
 */
export function useDesk(): DeskState {
  const [ready, setReady] = React.useState(false);
  const [applications, setApplications] = React.useState(createDefaultApplications);
  const [glow, setGlow] = React.useState(createDefaultData);
  const [desks, setDesks] = React.useState(createDefaultDeskData);
  const [resumeText, setResumeText] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const apps = loadApplications();
    setApplications(apps);
    setGlow(loadData());
    setDesks(loadApplicationDesks());
    setResumeText(readResumeText());
    const wanted = new URLSearchParams(window.location.search).get('id');
    const known = (id: string | null) => apps.applications.some((a) => a.id === id);
    setSelectedId(
      known(wanted)
        ? wanted
        : known(apps.activeId)
          ? apps.activeId
          : (apps.applications[0]?.id ?? null)
    );
    setReady(true);
  }, []);

  const select = React.useCallback((id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('id', id);
    window.history.replaceState(null, '', url);
  }, []);

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

  const changeApplications = React.useCallback(
    (change: (data: ApplicationsData) => ApplicationsData) => {
      const next = change(held.current.applications ?? loadApplications());
      saveApplications(next);
      held.current.applications = stored(APPLICATIONS_KEY, next) ? null : next;
      settle();
      setApplications(next);
      return next;
    },
    [settle]
  );

  const changeGlow = React.useCallback(
    (change: (data: GlowUpData) => GlowUpData) => {
      const next = change(held.current.glow ?? loadData());
      saveData(next);
      held.current.glow = stored(GLOW_STORAGE_KEY, next) ? null : next;
      settle();
      setGlow(next);
      return next;
    },
    [settle]
  );

  const changeDesks = React.useCallback(
    (change: (data: ApplicationDeskData) => ApplicationDeskData) => {
      const next = change(held.current.desks ?? loadApplicationDesks());
      held.current.desks = saveApplicationDesks(next) ? null : next;
      settle();
      setDesks(next);
    },
    [settle]
  );

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
    application,
    role,
    desk,
    select,
    changeApplications,
    changeGlow,
    changeDesks,
    unsaved,
  };
}
