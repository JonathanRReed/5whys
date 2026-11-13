import * as React from 'react';
import { type ApplicationDesk as Desk, stationsWithContent } from '../../lib/application-desk';
import {
  addApplication,
  daysUntilDeadline,
  deadlineLabel,
  setActiveApplication,
  updateApplication,
} from '../../lib/applications';
import { fullLetter } from '../../lib/desk-checks';
import { switchRole, updateRole } from '../../lib/glowup-store';
import { focusWhenReady } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import BulletsStation from './BulletsStation';
import LetterStation from './LetterStation';
import PostingStation from './PostingStation';
import QualificationsStation from './QualificationsStation';
import ResumeStation from './ResumeStation';
import SendStation from './SendStation';
import { type DeskLoss, useDesk } from './useDesk';

type Station = 'posting' | 'qualifications' | 'bullets' | 'resume' | 'letter' | 'send';

const STATIONS: { id: Station; label: string }[] = [
  { id: 'posting', label: 'Posting' },
  { id: 'qualifications', label: 'Qualifications' },
  { id: 'bullets', label: 'Bullets' },
  { id: 'resume', label: 'Resume' },
  { id: 'letter', label: 'Letter' },
  { id: 'send', label: 'Before you send' },
];

const isStation = (value: string | null): value is Station =>
  STATIONS.some((station) => station.id === value);

/** The label a field is shown with, for the copy of what was on screen. */
function fieldLabel(field: HTMLInputElement | HTMLTextAreaElement): string {
  return (
    field.getAttribute('aria-label') ??
    field.labels?.[0]?.querySelector('span')?.textContent?.trim() ??
    ''
  );
}

/**
 * Everything written for one application, as plain text: what is in the
 * fields on screen (saved or not), then the desk's saved work for it.
 */
function collectText(root: HTMLElement | null, desk: Desk | null): string {
  const parts: string[] = [];
  const add = (label: string, value: string) => {
    const text = value.trim();
    if (!text || parts.some((part) => part.includes(text))) return;
    parts.push(label ? `${label}\n${text}` : text);
  };
  for (const field of root?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input[type="text"], input:not([type])'
  ) ?? []) {
    add(fieldLabel(field), field.value);
  }
  if (desk) {
    add('Letter', fullLetter(desk.letter));
    add('Experience', desk.bullets.experience);
    add('Impact', desk.bullets.impact);
    for (const slot of desk.bullets.bullets) add('Bullet', slot.text);
    add('Reflection', desk.bullets.reflection);
    for (const row of desk.qualifications) add('Plan', row.plan);
    for (const step of desk.actionPlan)
      add('Step', step.due ? `${step.text} (${step.due})` : step.text);
    for (const message of Object.values(desk.letter.messages))
      if (message) add('Message', message.text);
    add('Offer notes', desk.offer.notes);
  }
  return parts.join('\n\n');
}

/** Says the open application is gone, and offers what was typed in it to copy. */
function LossNotice({ lost, onDismiss }: { lost: DeskLoss; onDismiss: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const name = lost.title.trim() ? `"${lost.title.trim()}"` : 'The application you had open';
  return (
    <div role="alert" className="max-w-3xl space-y-3 rounded-lg bg-gold/12 px-4 py-3 text-sm">
      <p className="text-foreground">
        {lost.reason === 'cleared'
          ? 'Everything saved on this device was cleared in another tab, so this page was emptied too. Nothing from it will be saved again.'
          : `${name} was removed in another tab, so this page stopped saving it.`}
      </p>
      {lost.text && (
        <>
          <p className="text-muted-foreground">
            What you had written for it is below. It is not saved anywhere, so copy it now if you
            want to keep it.
          </p>
          <textarea
            readOnly
            value={lost.text}
            rows={6}
            aria-label="What you had written for the removed application"
            className="w-full rounded-md border border-border/50 bg-transparent p-2 text-sm text-foreground"
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {lost.text && (
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(lost.text);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied' : 'Copy the text'}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          {lost.text ? 'Discard it' : 'Dismiss'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The application desk: one posting, pasted once, worked through stations.
 * Stations are not a forced sequence. Each keeps its own state under the
 * application and can be opened in any order.
 */
export default function ApplicationDesk() {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const deskRef = React.useRef<Desk | null>(null);
  const snapshot = React.useCallback(() => collectText(rootRef.current, deskRef.current), []);
  const desk = useDesk({ snapshot });
  deskRef.current = desk.application ? desk.desk : null;
  const { ready, applications, application, role, select, changeApplications, changeGlow } = desk;
  // The interview tools open on whichever role is current. Make it this
  // application's before leaving, so they show this posting and not the last
  // one worked on. Saved before the page changes; nothing is written when the
  // role is already current.
  const openOnThisRole = () => {
    if (!role) return;
    changeGlow((data) => (data.currentRoleId === role.id ? data : switchRole(data, role.id)));
  };
  const [station, setStation] = React.useState<Station>('posting');
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [deadline, setDeadline] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editCompany, setEditCompany] = React.useState('');

  // The forms belong to the application on screen; another one starts them over.
  const shownId = application?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: resets when the application changes
  React.useEffect(() => {
    setEditing(false);
    setAdding(false);
  }, [shownId]);

  React.useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('station');
    if (isStation(wanted)) setStation(wanted);
  }, []);

  const openStation = (next: string) => {
    if (!isStation(next)) return;
    setStation(next);
    const url = new URL(window.location.href);
    url.searchParams.set('station', next);
    window.history.replaceState(null, '', url);
  };

  const create = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    let createdId = '';
    changeApplications((data) => {
      const added = addApplication(data, { title, company, deadline: deadline || null });
      createdId = added.application.id;
      return setActiveApplication(added.data, createdId);
    });
    if (createdId) select(createdId);
    setTitle('');
    setCompany('');
    setDeadline('');
    setAdding(false);
    openStation('posting');
    // The form is gone; the posting step that replaced it takes focus.
    focusWhenReady('desk-paste-heading');
  };

  const startEditing = () => {
    if (!application) return;
    setEditTitle(application.title);
    setEditCompany(application.company);
    setEditing(true);
    setAdding(false);
    focusWhenReady('desk-edit-title');
  };

  const saveDetails = (event: React.FormEvent) => {
    event.preventDefault();
    if (!application || !editTitle.trim()) return;
    const title = editTitle.trim();
    const company = editCompany.trim();
    changeApplications((data) => updateApplication(data, application.id, { title, company }));
    // The decoded role carries the same names to the interview tools and the
    // dashboard. Its posting and requirements are untouched.
    if (role && (role.jobTitle !== title || role.company !== company)) {
      changeGlow((data) => updateRole(data, role.id, { jobTitle: title, company }));
    }
    setEditing(false);
    focusWhenReady('desk-edit-open');
  };

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Opening your desk.</p>;
  }

  const lostNotice = desk.lost && <LossNotice lost={desk.lost} onDismiss={desk.dismissLost} />;

  const form = (
    <form
      onSubmit={create}
      data-guide="desk-new"
      className="grid max-w-3xl gap-3 sm:grid-cols-[2fr_2fr_auto_auto] sm:items-end"
    >
      <label className="space-y-1">
        <span className="block text-sm text-muted-foreground">Role</span>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Marketing intern"
          className="text-base"
          required
        />
      </label>
      <label className="space-y-1">
        <span className="block text-sm text-muted-foreground">
          Company or organization (optional)
        </span>
        <Input
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Riverside Food Bank"
          className="text-base"
        />
      </label>
      <label className="space-y-1">
        <span className="block text-sm text-muted-foreground">Deadline (optional)</span>
        <Input
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="text-base"
        />
      </label>
      <Button
        type="submit"
        disabled={!title.trim()}
        aria-describedby={title.trim() ? undefined : 'desk-new-needs'}
      >
        Start this application
      </Button>
      {!title.trim() && (
        <p id="desk-new-needs" className="text-xs text-muted-foreground sm:col-span-4">
          Type the role to start.
        </p>
      )}
    </form>
  );

  if (!application) {
    return (
      <div ref={rootRef} className="space-y-5">
        {lostNotice}
        {applications.applications.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Open one you are working on</span>
            <select
              value=""
              onChange={(event) => event.target.value && select(event.target.value)}
              className="h-9 max-w-[14rem] rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choose</option>
              {applications.applications.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.company ? `, ${item.company}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Start with a job you are interested in</h2>
          <p className="max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
            Name the role, then paste its posting once. The desk turns it into what the employer is
            asking for, where you stand, two bullets, a letter, and a last check before you send.
            Everything stays on this device.
          </p>
        </div>
        {form}
      </div>
    );
  }

  const days = daysUntilDeadline(application.deadline);
  const filled = stationsWithContent(desk.desk);
  const hasContent: Record<Station, boolean> = {
    posting: Boolean(role?.bullets.length),
    qualifications: filled.qualifications,
    bullets: filled.bullets,
    resume: filled.resume,
    letter: filled.letter,
    send: filled['before-you-send'],
  };

  return (
    <div ref={rootRef} className="space-y-8">
      {lostNotice}
      {desk.unsaved && (
        <p role="alert" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
          This browser would not save your last change. It is still on this page, but it will be
          gone when the page closes. Free some space in the storage panel on the dashboard, or copy
          your work out first.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-5">
        <div className="min-w-0 space-y-1" data-guide="desk-current">
          <p className="text-sm text-muted-foreground">Working on</p>
          <p
            className="font-display text-2xl font-semibold text-foreground"
            style={{ viewTransitionName: 'desk-application' }}
          >
            {application.title}
            {application.company && (
              <span className="text-muted-foreground"> at {application.company}</span>
            )}
          </p>
          {days !== null && (
            <p className="text-sm text-muted-foreground">
              {days < 0 ? 'The deadline has passed' : deadlineLabel(days)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {applications.applications.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Switch</span>
              <select
                value={application.id}
                onChange={(event) => select(event.target.value)}
                className="h-9 max-w-[14rem] rounded-md border border-border/50 bg-transparent px-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                {applications.applications.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.company ? `, ${item.company}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            id="desk-edit-open"
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={editing}
            onClick={() => (editing ? setEditing(false) : startEditing())}
          >
            {editing ? 'Cancel editing' : 'Edit role and company'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAdding((v) => !v);
              setEditing(false);
            }}
          >
            {adding ? 'Cancel' : 'New application'}
          </Button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={saveDetails}
          aria-label="Role and company for this application"
          className="grid max-w-3xl gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end"
        >
          <label className="space-y-1">
            <span className="block text-sm text-muted-foreground">Role</span>
            <Input
              id="desk-edit-title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="text-base"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm text-muted-foreground">
              Company or organization (optional)
            </span>
            <Input
              value={editCompany}
              onChange={(event) => setEditCompany(event.target.value)}
              placeholder="Riverside Food Bank"
              className="text-base"
            />
          </label>
          <Button type="submit" disabled={!editTitle.trim()}>
            Save
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            The posting and everything on this desk stay as they are.
          </p>
        </form>
      )}

      {adding && form}

      <Tabs value={station} onValueChange={openStation}>
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto">
          {STATIONS.map((item, index) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              data-guide={`station-${item.id}`}
              className="h-10 flex-none rounded-lg border border-transparent px-3 text-muted-foreground data-[state=active]:border-lichen/60 data-[state=active]:bg-lichen/12 data-[state=active]:text-foreground"
            >
              <span className="num-index mr-1.5 text-xs text-muted-foreground">{index + 1}</span>
              {item.label}
              {hasContent[item.id] && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-lichen" aria-hidden="true" />
              )}
              {hasContent[item.id] && <span className="sr-only"> (started)</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="pt-8">
          <TabsContent value="posting">
            <PostingStation key={application.id} desk={desk} />
          </TabsContent>
          <TabsContent value="qualifications">
            <QualificationsStation key={application.id} desk={desk} />
          </TabsContent>
          <TabsContent value="bullets">
            <BulletsStation key={application.id} desk={desk} />
          </TabsContent>
          <TabsContent value="resume">
            <ResumeStation key={application.id} desk={desk} />
          </TabsContent>
          <TabsContent value="letter">
            <LetterStation key={application.id} desk={desk} />
          </TabsContent>
          <TabsContent value="send">
            <SendStation key={application.id} desk={desk} />
          </TabsContent>
        </div>
      </Tabs>

      <nav
        aria-label="Other tools for this application"
        className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/40 pt-5 text-sm"
      >
        <span className="text-muted-foreground">Also for this role:</span>
        <a
          className="underline underline-offset-4 hover:text-foam"
          href={`/resume-game/?application=${encodeURIComponent(application.id)}`}
        >
          Check your resume
        </a>
        {role ? (
          <>
            <a
              className="underline underline-offset-4 hover:text-foam"
              href="/interview-glow-up/workspace/?tab=stories"
              onClick={openOnThisRole}
            >
              Build interview stories
            </a>
            <a
              className="underline underline-offset-4 hover:text-foam"
              href="/interview-glow-up/rehearse/"
              onClick={openOnThisRole}
            >
              Rehearse the interview
            </a>
          </>
        ) : (
          // The interview tools open on a decoded posting. Without one they
          // would show whichever role was worked on last.
          <span className="text-muted-foreground" data-testid="desk-interview-needs-posting">
            Interview stories and rehearsal work from this role's posting.{' '}
            <button
              type="button"
              className="text-foreground underline underline-offset-4 hover:text-foam"
              onClick={() => {
                openStation('posting');
                focusWhenReady('desk-paste-heading');
              }}
            >
              Paste and decode it first
            </button>
          </span>
        )}
        <a
          className="underline underline-offset-4 hover:text-foam"
          href={`/pay/?id=${encodeURIComponent(application.id)}`}
        >
          Weigh the pay
        </a>
      </nav>
    </div>
  );
}
