import * as React from 'react';
import { deleteApplication } from '../lib/application-desk';
import {
  addApplication,
  deadlineLabel,
  loadApplications,
  saveApplications,
  setActiveApplication,
  updateApplication,
} from '../lib/applications';
import type { ApplicationSummary } from '../lib/career-bridge';
import { cn } from '../lib/utils';
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

/** The next piece of tool work this application is missing. */
function workLink(app: ApplicationSummary, storyCount: number): { href: string; label: string } {
  if (!app.decoded) {
    return { href: '/interview-glow-up/workspace/?tab=decode', label: 'Decode the posting' };
  }
  if (storyCount === 0) {
    return { href: '/interview-glow-up/workspace/?tab=stories', label: 'Build a story' };
  }
  return {
    href: '/interview-glow-up/workspace/?tab=packet',
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

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const { data } = addApplication(loadApplications(), {
      title,
      company,
      deadline: deadline || null,
    });
    saveApplications(data);
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
  const showForm = formOpen || applications.length === 0;

  const patch = (id: string, updates: Parameters<typeof updateApplication>[2]) => {
    saveApplications(updateApplication(loadApplications(), id, updates));
    onChanged();
  };
  const remove = (id: string) => {
    deleteApplication(id);
    onChanged();
  };
  const focus = (id: string) => {
    saveApplications(setActiveApplication(loadApplications(), id));
    onChanged();
  };

  return (
    <section aria-labelledby="applications-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow text-muted-foreground">Applications</p>
          <h2 id="applications-heading" className="mt-1 text-lg font-semibold text-foreground">
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
        <ul className="space-y-3">
          {applications.map((app) => {
            const link = workLink(app, readiness.storyCount);
            return (
              <li key={app.id} className="rounded-2xl border border-border/35 bg-overlay/20 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-medium text-foreground">
                    {app.title}
                    {app.company && (
                      <span className="text-muted-foreground"> at {app.company}</span>
                    )}
                    {app.isActive && (
                      <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 align-middle text-xs font-medium text-gold">
                        In focus
                      </span>
                    )}
                  </p>
                  <span className={cn('text-sm', deadlineTone(app.daysUntil))}>
                    {app.daysUntil === null ? 'No deadline set' : deadlineLabel(app.daysUntil)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip on={app.decoded}>
                    {app.decoded ? 'Posting decoded' : 'No decoded posting'}
                  </Chip>
                  {app.decoded && (
                    <Chip on={app.packetStories > 0}>
                      {app.packetStories === 0
                        ? 'Packet empty'
                        : `Packet: ${app.packetStories === 1 ? '1 story' : `${app.packetStories} stories`}`}
                    </Chip>
                  )}
                  <Chip on={readiness.resumeScored}>
                    {readiness.resumeScored ? 'Resume scored' : 'No resume scored'}
                  </Chip>
                  {app.stations.qualifications && <Chip on>Qualifications marked</Chip>}
                  {app.stations.bullets && <Chip on>Bullets drafted</Chip>}
                  {app.stations.letter && <Chip on>Letter drafted</Chip>}
                  <Chip on={readiness.practiceRounds > 0}>
                    {readiness.practiceRounds === 0
                      ? 'No practice reps'
                      : `${readiness.practiceRounds} practice ${readiness.practiceRounds === 1 ? 'rep' : 'reps'}`}
                  </Chip>
                </div>

                {(() => {
                  // The next station on this application's desk that is still empty.
                  const next = !app.decoded
                    ? { station: 'posting', text: 'Paste the posting on the desk' }
                    : !app.stations.qualifications
                      ? {
                          station: 'qualifications',
                          text: 'Mark where you stand on each requirement',
                        }
                      : !app.stations.bullets
                        ? { station: 'bullets', text: 'Write two bullets for this role' }
                        : !app.stations.letter
                          ? { station: 'letter', text: 'Draft the letter' }
                          : !app.stations['before-you-send']
                            ? { station: 'send', text: 'Run the check before you send' }
                            : null;
                  return next ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Next on the desk:{' '}
                      <a
                        className="text-foreground underline underline-offset-4 hover:text-foam"
                        href={`/application/?id=${encodeURIComponent(app.id)}&station=${next.station}`}
                      >
                        {next.text}
                      </a>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      The desk is filled in.{' '}
                      <a
                        className="text-foreground underline underline-offset-4 hover:text-foam"
                        href="/interview-glow-up/rehearse/"
                      >
                        Rehearse the interview
                      </a>
                    </p>
                  );
                })()}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={link.href}
                    className="rounded-lg border border-border/50 bg-overlay/30 px-3 py-1.5 text-sm font-medium text-foam transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  >
                    {link.label}
                  </a>
                  {!app.isActive && (
                    <button
                      type="button"
                      onClick={() => focus(app.id)}
                      className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-overlay/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      Make active
                    </button>
                  )}
                  <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    Deadline
                    <input
                      type="date"
                      aria-label={`Deadline for ${app.title}`}
                      value={app.deadline ?? ''}
                      onChange={(e) => patch(app.id, { deadline: e.target.value || null })}
                      className="rounded-lg border border-border/50 bg-overlay/30 px-2 py-1 text-xs text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                    />
                  </label>
                  <a
                    href={`/application/?id=${encodeURIComponent(app.id)}`}
                    className="rounded-lg border border-border/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-overlay/40 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
                  >
                    Open the desk
                  </a>
                  <ConfirmButton
                    confirmLabel="Remove it? Its desk work is deleted. The role and stories stay saved."
                    onConfirm={() => remove(app.id)}
                    className="px-3 py-1.5 text-xs"
                  >
                    Remove
                  </ConfirmButton>
                </div>
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
          }}
        />
      )}
    </section>
  );
}
