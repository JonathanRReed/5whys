import * as React from 'react';
import { deleteApplication } from '../lib/application-desk';
import {
  addApplication,
  deadlineLabel,
  loadApplications,
  localDate,
  markSent,
  saveApplications,
  setActiveApplication,
  setAsideApplication,
  shortDate,
  updateApplication,
} from '../lib/applications';
import {
  type ApplicationSummary,
  nextDeskStep,
  readSendInputs,
  withRole,
} from '../lib/career-bridge';
import { loadData, openRole, saveData, updateRole } from '../lib/glowup-store';
import { cn } from '../lib/utils';
import { MarkSent, sendState } from './application-desk/SendStation';
import SentControl from './application-desk/SentControl';
import Announcer, { useAnnouncer } from './shared/Announcer';
import ConfirmButton from './shared/ConfirmButton';

type Readiness = {
  resumeScored: boolean;
  practiceRounds: number;
  storyCount: number;
};

type Props = {
  applications: ApplicationSummary[];
  readiness: Readiness;
  /** Storage changed; the parent re-reads the bridge. */
  onChanged: () => void;
};

const inputClass =
  'w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

const deadlineTone = (days: number | null) =>
  days === null
    ? 'text-muted-foreground'
    : days <= 0
      ? 'text-love'
      : days <= 7
        ? 'text-gold'
        : 'text-muted-foreground';

function Chip({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs',
        on ? 'bg-foam/15 text-foam' : 'bg-overlay/40 text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

/**
 * Focus the first of `ids` on the page once the change has rendered, so a
 * removed row hands focus to its neighbor instead of dropping it.
 */
function focusFirstOf(ids: string[], frames = 30) {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target) {
        target.focus();
        return;
      }
    }
    if (frames > 0) focusFirstOf(ids, frames - 1);
  });
}

/** ", in 3 days", ", today", or "" once the date has passed. */
function daysPhrase(days: number | null | undefined): string {
  if (days === null || days === undefined || days < 0) return '';
  if (days === 0) return ', today';
  if (days === 1) return ', tomorrow';
  return `, in ${days} days`;
}

const linkClass = 'text-foreground underline underline-offset-4 hover:text-foam';

const SAVE_FAILED =
  'This browser would not save it. What you typed is still here. Free some space in the storage panel below, then try again.';

/**
 * The next piece of interview work this application is missing, once its
 * posting is decoded. Before that, the desk's posting station is the next
 * step and is named in the line above the buttons.
 */
function workLink(
  app: ApplicationSummary,
  storyCount: number
): { href: string; label: string } | null {
  if (!app.decoded) return null;
  if (storyCount === 0) {
    return {
      href: withRole('/interview-glow-up/workspace/?tab=stories', app.roleId),
      label: 'Build a story',
    };
  }
  return {
    href: withRole('/interview-glow-up/workspace/?tab=packet', app.roleId),
    label: app.packetStories === 0 ? 'Pack the packet' : 'Open the packet',
  };
}

export function NewApplicationForm({
  onCreated,
  idPrefix,
}: {
  onCreated: () => void;
  idPrefix: string;
}) {
  const [title, setTitle] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [deadline, setDeadline] = React.useState('');
  const [failed, setFailed] = React.useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const { data } = addApplication(loadApplications(), {
      title,
      company,
      deadline: deadline || null,
    });
    // Storage full or blocked: keep the form as typed and say so.
    if (!saveApplications(data)) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setTitle('');
    setCompany('');
    setDeadline('');
    onCreated();
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${idPrefix}-title`}
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Role
          </label>
          <input
            id={`${idPrefix}-title`}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Marketing Intern"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-company`}
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Company (optional)
          </label>
          <input
            id={`${idPrefix}-company`}
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g., City Parks Department"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-deadline`}
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Deadline (optional)
          </label>
          <input
            id={`${idPrefix}-deadline`}
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={!title.trim()}
        aria-describedby={title.trim() ? undefined : `${idPrefix}-needs`}
        className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
      >
        Track this application
      </button>
      {!title.trim() && (
        <p id={`${idPrefix}-needs`} className="text-xs text-muted-foreground">
          Type the role to track it.
        </p>
      )}
      {failed && (
        <p role="alert" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
          {SAVE_FAILED}
        </p>
      )}
    </form>
  );
}

/**
 * The spine of the dashboard: what you are applying to and when it is due.
 * Status chips are derived, never stored — a linked role supplies the
 * decode/packet facts, resume and practice readiness stay global.
 */
export default function ApplicationsPanel({ applications, readiness, onChanged }: Props) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [message, announce] = useAnnouncer();
  // What still stands between each application and sending it, by the same
  // rule the desk's "Mark as sent" uses ("The letter still has [your proof]").
  // The list is read from storage after mount, so this reads no earlier.
  const blockers = React.useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const app of applications) {
      const inputs = app.sentOn || app.offer ? null : readSendInputs(app.id);
      out[app.id] = inputs
        ? sendState(inputs.letter, inputs.title, inputs.company, inputs.requirements, inputs.rows)
            .blocker
        : null;
    }
    return out;
  }, [applications]);
  const showForm = formOpen || applications.length === 0;
  // The row whose role and company are being edited, with the text so far.
  const [editing, setEditing] = React.useState<{
    id: string;
    title: string;
    company: string;
    failed: boolean;
  } | null>(null);

  const patch = (id: string, updates: Parameters<typeof updateApplication>[2]) => {
    const saved = saveApplications(updateApplication(loadApplications(), id, updates));
    onChanged();
    return saved;
  };
  const remove = (id: string) => {
    const index = applications.findIndex((app) => app.id === id);
    const gone = applications[index];
    // Focus goes to the row that takes its place, the one above, or the list.
    const neighbor = applications[index + 1] ?? applications[index - 1];
    deleteApplication(id);
    onChanged();
    announce(gone ? `Removed ${gone.title}.` : 'Removed.');
    focusFirstOf([
      ...(neighbor ? [`app-row-${neighbor.id}`] : []),
      'applications-heading',
      'dashboard-empty-heading',
    ]);
  };
  const saveDetails = (event: React.FormEvent, app: ApplicationSummary) => {
    event.preventDefault();
    if (!editing?.title.trim()) return;
    const title = editing.title.trim();
    const company = editing.company.trim();
    if (!patch(app.id, { title, company })) {
      setEditing({ ...editing, failed: true });
      return;
    }
    // The decoded role carries the names to the interview tools and to this
    // list. Its posting, and everything on the desk, stay as they are.
    if (app.roleId) {
      const glow = loadData();
      const role = glow.roles.find((r) => r.id === app.roleId);
      if (role && (role.jobTitle !== title || role.company !== company)) {
        saveData(updateRole(glow, role.id, { jobTitle: title, company }));
        onChanged();
      }
    }
    setEditing(null);
    announce(`Saved ${title}.`);
    focusFirstOf([`app-edit-${app.id}`]);
  };
  // The application in focus here is the one the desk, Pay and the interview
  // tools open on: its decoded role becomes the current one too.
  const focus = (app: ApplicationSummary) => {
    saveApplications(setActiveApplication(loadApplications(), app.id));
    openRole(app.roleId);
    onChanged();
    announce(`${app.title} is in focus.`);
  };
  const sent = (app: ApplicationSummary, sentOn: string | null) => {
    if (!saveApplications(markSent(loadApplications(), app.id, sentOn))) return;
    onChanged();
    announce(sentOn ? `Marked ${app.title} as sent.` : `${app.title} is not sent yet.`);
  };
  // The row being set aside as "not applying", with the reason typed so far.
  const [asideFor, setAsideFor] = React.useState<{ id: string; reason: string } | null>(null);
  const setAside = (app: ApplicationSummary, reason: string | null) => {
    const next = setAsideApplication(
      loadApplications(),
      app.id,
      reason === null ? null : { on: localDate(), reason }
    );
    if (!saveApplications(next)) return;
    setAsideFor(null);
    onChanged();
    announce(
      reason === null
        ? `${app.title} is back in play.`
        : `${app.title} is set aside. Its work is kept.`
    );
    focusFirstOf([`app-row-${app.id}`]);
  };

  return (
    <section aria-labelledby="applications-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow text-muted-foreground">Applications</p>
          <h2
            id="applications-heading"
            tabIndex={-1}
            className="mt-1 text-lg font-semibold text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
          >
            {applications.length === 0
              ? 'Track what you are applying to'
              : `${applications.length === 1 ? 'One application' : `${applications.length} applications`} in motion`}
          </h2>
        </div>
        {applications.length > 0 && !formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            Add an application
          </button>
        )}
      </div>

      {applications.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add the role and its deadline. The tools fill in the prep.
        </p>
      )}

      {applications.length > 0 && (
        // Resume and practice belong to the visitor, not to one application:
        // said once here, not repeated as a chip on every row.
        <p className="text-sm text-muted-foreground" data-testid="shared-readiness">
          {readiness.resumeScored ? 'Your resume is scored' : 'No resume is scored yet'}
          {readiness.practiceRounds === 0
            ? ', and there are no networking practice reps yet'
            : `, and you have ${readiness.practiceRounds} networking practice ${readiness.practiceRounds === 1 ? 'rep' : 'reps'}`}
          . These count for every application.
        </p>
      )}

      {applications.length > 0 && (
        <ul className="space-y-3">
          {applications.map((app) => {
            const link = workLink(app, readiness.storyCount);
            return (
              <li
                key={app.id}
                id={`app-row-${app.id}`}
                tabIndex={-1}
                className="rounded-2xl border border-border/35 bg-overlay/20 p-4 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 max-w-full font-medium wrap-anywhere text-foreground">
                    {app.title}
                    {app.company && (
                      <span className="text-muted-foreground"> at {app.company}</span>
                    )}
                    {app.isActive && !app.setAside && (
                      <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-gold/15 px-2 py-0.5 align-middle text-xs font-medium text-foreground">
                        In focus
                      </span>
                    )}
                  </p>
                  {app.setAside ? (
                    <span className="text-sm text-muted-foreground">Not applying</span>
                  ) : app.sentOn ? (
                    <span className="text-sm text-foam">Sent {shortDate(app.sentOn)}</span>
                  ) : app.offer?.answerBy && app.daysUntil === null ? (
                    <span className={cn('text-sm', deadlineTone(app.offer.daysToAnswer))}>
                      Answer by {shortDate(app.offer.answerBy)}
                    </span>
                  ) : (
                    <span className={cn('text-sm', deadlineTone(app.daysUntil))}>
                      {app.daysUntil === null ? 'No deadline set' : deadlineLabel(app.daysUntil)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {/* An offer in hand needs no posting to be weighed. */}
                  {!(app.offer && !app.decoded) && (
                    <Chip on={app.decoded}>
                      {app.decoded ? 'Posting decoded' : 'No decoded posting'}
                    </Chip>
                  )}
                  {app.decoded && (
                    <Chip on={app.packetStories > 0}>
                      {app.packetStories === 0
                        ? 'No interview stories packed'
                        : `Interview stories packed: ${app.packetStories}`}
                    </Chip>
                  )}
                  {(app.keptAnswers ?? 0) > 0 && (
                    <Chip on>Interview answers kept: {app.keptAnswers}</Chip>
                  )}
                  {app.offer && <Chip on>Offer in hand</Chip>}
                  {app.stations.qualifications && <Chip on>Qualifications marked</Chip>}
                  {app.stations.bullets && <Chip on>Bullets drafted</Chip>}
                  {app.stations.letter && <Chip on>Letter drafted</Chip>}
                </div>

                {(() => {
                  const desk = (station: string) =>
                    `/application/?id=${encodeURIComponent(app.id)}&station=${station}`;
                  // Rehearsal asks about the current role: only offered once
                  // this application has one, and made current on the way.
                  const rehearse = app.roleId ? (
                    <a
                      className={linkClass}
                      href={withRole('/interview-glow-up/rehearse/', app.roleId)}
                      onClick={() => openRole(app.roleId)}
                    >
                      Rehearse the interview
                    </a>
                  ) : (
                    <a className={linkClass} href={desk('posting')}>
                      Paste the posting so practice is about this job
                    </a>
                  );
                  if (app.setAside) {
                    return (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Set aside on {shortDate(app.setAside.on)}
                        {app.setAside.reason ? `: ${app.setAside.reason}` : ''}. Its work is kept.
                      </p>
                    );
                  }
                  if (app.offer) {
                    const pay = `/pay/?id=${encodeURIComponent(app.id)}`;
                    return (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {app.offer.answerBy ? (
                          <>
                            {/* The date is already beside the title unless a deadline is there. */}
                            {app.daysUntil === null
                              ? daysPhrase(app.offer.daysToAnswer)
                                  .replace(/^, /, '')
                                  .replace(/^./, (c) => c.toUpperCase())
                              : `Answer by ${shortDate(app.offer.answerBy)}${daysPhrase(app.offer.daysToAnswer)}`}
                            {app.daysUntil === null && (app.offer.daysToAnswer ?? -1) < 0
                              ? ''
                              : '.'}{' '}
                            <a className={linkClass} href={pay}>
                              Weigh it in Pay
                            </a>
                          </>
                        ) : (
                          <>
                            Next:{' '}
                            <a className={linkClass} href={pay}>
                              Set the date you have to answer by
                            </a>
                          </>
                        )}
                      </p>
                    );
                  }
                  if (app.sentOn) {
                    // Sent: the useful next things are the interview and the thank-you.
                    return (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Sent on {shortDate(app.sentOn)}. Next: {rehearse}, then{' '}
                        <a className={linkClass} href={`${desk('send')}#after-interview`}>
                          the thank-you note
                        </a>{' '}
                        after it.
                      </p>
                    );
                  }
                  // The next station on this application's desk that is still empty.
                  const next = nextDeskStep(app);
                  return next ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Next on the desk:{' '}
                      <a className={linkClass} href={desk(next.station)}>
                        {next.text}
                      </a>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      The desk is filled in. {rehearse}
                    </p>
                  );
                })()}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {link && !app.setAside && (
                    <a
                      href={link.href}
                      onClick={() => openRole(app.roleId)}
                      className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-1.5 text-sm font-medium text-foam transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      {link.label}
                    </a>
                  )}
                  {!app.isActive && !app.setAside && (
                    <button
                      type="button"
                      onClick={() => focus(app)}
                      className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-overlay/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      Make active
                    </button>
                  )}
                  {app.setAside ? (
                    <button
                      type="button"
                      onClick={() => setAside(app, null)}
                      className="rounded-lg border border-border/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-overlay/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                    >
                      Back in play
                      <span className="sr-only">: {app.title}</span>
                    </button>
                  ) : (
                    <>
                      {!app.offer &&
                        (app.sentOn ? (
                          <SentControl
                            showDate={false}
                            sentOn={app.sentOn}
                            title={app.title}
                            onChange={(sentOn) => sent(app, sentOn)}
                          />
                        ) : (
                          // Arms in place first when the letter is not ready, as on the desk.
                          <MarkSent
                            sentOn={app.sentOn}
                            title={app.title}
                            blocker={blockers[app.id] ?? null}
                            onChange={(sentOn) => sent(app, sentOn)}
                          />
                        ))}
                      {!app.sentOn && (
                        <button
                          type="button"
                          id={`app-aside-${app.id}`}
                          aria-expanded={asideFor?.id === app.id}
                          onClick={() => {
                            if (asideFor?.id === app.id) {
                              setAsideFor(null);
                              return;
                            }
                            setAsideFor({ id: app.id, reason: '' });
                            focusFirstOf([`app-aside-reason-${app.id}`]);
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-overlay/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                        >
                          Not applying
                          <span className="sr-only">: {app.title}</span>
                        </button>
                      )}
                      <label className="ml-auto flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        Deadline
                        <input
                          type="date"
                          aria-label={`Deadline for ${app.title}`}
                          value={app.deadline ?? ''}
                          onChange={(e) => patch(app.id, { deadline: e.target.value || null })}
                          className="rounded-lg border border-border/50 bg-overlay/30 px-2 py-1 text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                        />
                      </label>
                    </>
                  )}
                  <a
                    href={`/application/?id=${encodeURIComponent(app.id)}`}
                    className="rounded-lg border border-border/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-overlay/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                  >
                    Open the desk
                  </a>
                  <button
                    id={`app-edit-${app.id}`}
                    type="button"
                    aria-expanded={editing?.id === app.id}
                    onClick={() => {
                      if (editing?.id === app.id) {
                        setEditing(null);
                        return;
                      }
                      setEditing({
                        id: app.id,
                        title: app.title,
                        company: app.company,
                        failed: false,
                      });
                      focusFirstOf([`app-edit-title-${app.id}`]);
                    }}
                    className="rounded-lg border border-border/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-overlay/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                  >
                    {editing?.id === app.id ? 'Cancel editing' : 'Edit'}
                    <span className="sr-only">: role and company of {app.title}</span>
                  </button>
                  <ConfirmButton
                    confirmLabel="Remove it? Its desk work is deleted. The role and stories stay saved."
                    onConfirm={() => remove(app.id)}
                    className="px-3 py-1.5 text-xs"
                  >
                    Remove
                  </ConfirmButton>
                </div>

                {asideFor?.id === app.id && !app.setAside && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAside(app, asideFor.reason);
                    }}
                    aria-label={`Not applying to ${app.title}`}
                    className="mt-3 space-y-3 border-t border-border/30 pt-3"
                  >
                    <div>
                      <label
                        htmlFor={`app-aside-reason-${app.id}`}
                        className="mb-1 block text-sm font-medium text-foreground"
                      >
                        Why not (optional)
                      </label>
                      <input
                        id={`app-aside-reason-${app.id}`}
                        type="text"
                        value={asideFor.reason}
                        maxLength={280}
                        onChange={(e) => setAsideFor({ id: app.id, reason: e.target.value })}
                        placeholder="e.g., Needs seven years I do not have yet"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                      >
                        Set it aside
                      </button>
                      <p className="text-xs text-muted-foreground">
                        Its desk work and stories are kept. It moves to the end of the list.
                      </p>
                    </div>
                  </form>
                )}

                {editing?.id === app.id && (
                  <form
                    onSubmit={(event) => saveDetails(event, app)}
                    aria-label={`Role and company for ${app.title}`}
                    className="mt-3 space-y-3 border-t border-border/30 pt-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`app-edit-title-${app.id}`}
                          className="mb-1 block text-sm font-medium text-foreground"
                        >
                          Role
                        </label>
                        <input
                          id={`app-edit-title-${app.id}`}
                          type="text"
                          value={editing.title}
                          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                          required
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`app-edit-company-${app.id}`}
                          className="mb-1 block text-sm font-medium text-foreground"
                        >
                          Company (optional)
                        </label>
                        <input
                          id={`app-edit-company-${app.id}`}
                          type="text"
                          value={editing.company}
                          onChange={(e) => setEditing({ ...editing, company: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={!editing.title.trim()}
                        className="rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                      >
                        Save
                      </button>
                      <p className="text-xs text-muted-foreground">
                        Its posting and desk work stay as they are.
                      </p>
                    </div>
                    {editing.failed && (
                      <p
                        role="alert"
                        className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground"
                      >
                        {SAVE_FAILED}
                      </p>
                    )}
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <NewApplicationForm
          idPrefix="dash-app"
          onCreated={() => {
            setFormOpen(false);
            onChanged();
            announce('Application tracked.');
          }}
        />
      )}
      <Announcer message={message} />
    </section>
  );
}
