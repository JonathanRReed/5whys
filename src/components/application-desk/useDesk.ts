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
};

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

  const changeApplications = React.useCallback(
    (change: (data: ApplicationsData) => ApplicationsData) => {
      const next = change(loadApplications());
      saveApplications(next);
      setApplications(next);
      return next;
    },
    []
  );

  const changeGlow = React.useCallback((change: (data: GlowUpData) => GlowUpData) => {
    const next = change(loadData());
    saveData(next);
    setGlow(next);
    return next;
  }, []);

  const changeDesks = React.useCallback(
    (change: (data: ApplicationDeskData) => ApplicationDeskData) => {
      const next = change(loadApplicationDesks());
      saveApplicationDesks(next);
      setDesks(next);
    },
    []
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
  };
}
