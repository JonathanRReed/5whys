import * as React from 'react';
import { stationsWithContent } from '../../lib/application-desk';
import {
  addApplication,
  daysUntilDeadline,
  deadlineLabel,
  setActiveApplication,
} from '../../lib/applications';
import { switchRole } from '../../lib/glowup-store';
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
import { useDesk } from './useDesk';

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

/**
 * The application desk: one posting, pasted once, worked through stations.
 * Stations are not a forced sequence. Each keeps its own state under the
 * application and can be opened in any order.
 */
export default function ApplicationDesk() {
  const desk = useDesk();
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

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Opening your desk.</p>;
  }

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
      <div className="space-y-5">
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
    <div className="space-y-8">
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
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : 'New application'}
          </Button>
        </div>
      </div>

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
            <PostingStation desk={desk} />
          </TabsContent>
          <TabsContent value="qualifications">
            <QualificationsStation desk={desk} />
          </TabsContent>
          <TabsContent value="bullets">
            <BulletsStation desk={desk} />
          </TabsContent>
          <TabsContent value="resume">
            <ResumeStation desk={desk} />
          </TabsContent>
          <TabsContent value="letter">
            <LetterStation desk={desk} />
          </TabsContent>
          <TabsContent value="send">
            <SendStation desk={desk} />
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
