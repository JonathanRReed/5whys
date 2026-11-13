import * as React from 'react';
import { updateBulletsFlow } from '../../lib/application-desk';
import { type DraftFields, draftBullet, draftFields } from '../../lib/bullet-draft';
import { deskRequirements } from '../../lib/desk-checks';
import { hiringCondition, requirementsFromBullets } from '../../lib/posting';
import { scoreBullet } from '../../lib/resume-game';
import RewriteHelp from '../resume-game/RewriteHelp';
import PrintSheet from '../shared/PrintSheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useDeskExamples } from './examples';
import type { DeskState } from './useDesk';

const STEPS = [
  {
    key: 'experience',
    title: 'Pick one experience',
    help: '',
  },
  {
    key: 'impact',
    title: 'Say what happened because of it',
    help: 'The result does not have to be a number. A finished project, a problem solved, a smoother process, good feedback, or something that got easier because of your work all count.',
  },
] as const;

export default function BulletsStation({ desk }: { desk: DeskState }) {
  const { application, role, changeDesks } = desk;
  const examples = useDeskExamples();
  const [printing, setPrinting] = React.useState(false);
  const donePrinting = React.useCallback(() => setPrinting(false), []);
  // Arriving from "I have this: write a bullet" carries the requirement, so
  // the bullet is written against it instead of in the abstract.
  const [wantedId, setWantedId] = React.useState<string | null>(null);
  React.useEffect(() => {
    setWantedId(new URLSearchParams(window.location.search).get('requirement'));
  }, []);
  // A first draft built only from the two answers above, in fields the
  // visitor edits before using it. Null until they ask for one.
  const [draft, setDraft] = React.useState<DraftFields | null>(null);
  const [used, setUsed] = React.useState<0 | 1 | null>(null);
  if (!application) return null;
  const flow = desk.desk.bullets;
  const appId = application.id;
  // Conditions of hiring are never a bullet's target or on the worksheet.
  const confirmed = deskRequirements(role?.bullets ?? []).requirements;
  const asked = wantedId
    ? (requirementsFromBullets(role?.bullets ?? []).find((r) => r.id === wantedId) ?? null)
    : null;
  const wantedCondition = asked ? hiringCondition(asked.text) : null;
  const wanted = asked && !wantedCondition ? asked : null;
  const drafted = draft ? draftBullet(draft) : '';
  const putDraft = (slot: 0 | 1) => {
    if (!drafted) return;
    changeDesks((data) =>
      updateBulletsFlow(data, appId, { bullet: { index: slot, slot: { text: drafted } } })
    );
    setUsed(slot);
  };
  const hasWork = Boolean(
    flow.experience.trim() || flow.impact.trim() || flow.bullets.some((b) => b.text.trim())
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Two bullets for this role</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Work from one real experience to two resume bullets that answer what this posting asks
          for. Each step builds on the last.
        </p>
      </div>

      {wanted && (
        <div className="space-y-1 rounded-xl border border-lichen/50 bg-lichen/8 p-4" role="note">
          <p className="text-sm font-medium text-foreground">Write a bullet that shows this</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{wanted.text}</p>
          <p className="text-xs text-muted-foreground">
            Pick the experience where you did this, and use the posting's words only where they are
            true of what you did.
          </p>
        </div>
      )}

      {asked && wantedCondition && (
        <p className="rounded-xl border border-border/40 p-4 text-sm leading-relaxed" role="note">
          <span className="text-foreground">"{asked.text}"</span>{' '}
          <span className="text-muted-foreground">
            is a condition of the job ({wantedCondition.label.toLowerCase()}), not something to
            write a bullet about. It is listed under Qualifications, with what it means.
          </span>
        </p>
      )}

      <ol className="space-y-8">
        {STEPS.map((step, index) => (
          <li key={step.key} className="space-y-2">
            <h3 className="text-lg font-semibold">
              <span className="num-index mr-2 text-lichen">{index + 1}</span>
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.key === 'experience' ? examples.experienceHelp : step.help}
            </p>
            <label className="block">
              <span className="sr-only">{step.title}</span>
              <Textarea
                rows={4}
                value={flow[step.key]}
                placeholder={
                  step.key === 'experience'
                    ? examples.experiencePlaceholder
                    : examples.impactPlaceholder
                }
                onChange={(event) =>
                  changeDesks((data) =>
                    updateBulletsFlow(data, appId, { [step.key]: event.target.value })
                  )
                }
                className="text-base"
              />
            </label>
          </li>
        ))}

        <li className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!flow.experience.trim()}
              aria-describedby="bullet-draft-note"
              onClick={() => {
                setDraft(draftFields(flow.experience, flow.impact));
                setUsed(null);
              }}
            >
              {draft ? 'Draft it again from what I wrote' : 'Draft a bullet from what I wrote'}
            </Button>
            <p id="bullet-draft-note" className="text-xs text-muted-foreground">
              {flow.experience.trim()
                ? 'Uses only your words from the two steps above.'
                : 'Write step 1 first.'}
            </p>
          </div>
          {draft && (
            <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
              <legend className="mb-2 text-sm font-medium text-foreground">
                A first draft, in your words. Edit any part.
              </legend>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <label className="block space-y-1">
                  <span className="block text-sm text-muted-foreground">Verb</span>
                  <Input
                    value={draft.verb}
                    placeholder={examples.draft.verb}
                    onChange={(event) => setDraft({ ...draft, verb: event.target.value })}
                    className="text-base"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-sm text-muted-foreground">What you did</span>
                  <Input
                    value={draft.task}
                    placeholder={examples.draft.task}
                    onChange={(event) => setDraft({ ...draft, task: event.target.value })}
                    className="text-base"
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="block text-sm text-muted-foreground">What happened</span>
                  <Input
                    value={draft.result}
                    placeholder={examples.draft.result}
                    onChange={(event) => setDraft({ ...draft, result: event.target.value })}
                    className="text-base"
                  />
                </label>
              </div>
              <p className="text-sm leading-relaxed text-foreground" data-testid="bullet-draft">
                {drafted || 'Fill a field to see the draft.'}
              </p>
              {!draft.verb.trim() && drafted && (
                <p className="text-xs text-muted-foreground">
                  No verb was found in what you wrote. Add the one word for what you did, such as "
                  {examples.draft.verb}".
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {([0, 1] as const).map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    size="sm"
                    disabled={!drafted}
                    onClick={() => putDraft(slot)}
                  >
                    {flow.bullets[slot]?.text.trim()
                      ? `Replace bullet ${slot + 1} with it`
                      : `Use it as bullet ${slot + 1}`}
                  </Button>
                ))}
              </div>
              <p role="status" className="min-h-5 text-xs text-muted-foreground">
                {used !== null ? `Bullet ${used + 1} now holds the draft. Edit it below.` : ''}
              </p>
            </fieldset>
          )}
        </li>

        <li className="space-y-3">
          <h3 className="text-lg font-semibold">
            <span className="num-index mr-2 text-lichen">3</span>
            Write the two bullets
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Action verb, then what you did, then the result or purpose. Each bullet should answer
            something the posting asks for.
          </p>
          {([0, 1] as const).map((slot) => {
            const text = flow.bullets[slot]?.text ?? '';
            const score = text.trim() ? scoreBullet(text) : null;
            return (
              <div key={slot} className="space-y-2">
                <label className="block">
                  <span className="mb-1 block text-sm text-muted-foreground">
                    Bullet {slot + 1}
                  </span>
                  <Textarea
                    rows={2}
                    data-guide={`bullet-slot-${slot}`}
                    value={text}
                    placeholder={examples.bulletPlaceholders[slot]}
                    onChange={(event) =>
                      changeDesks((data) =>
                        updateBulletsFlow(data, appId, {
                          bullet: { index: slot, slot: { text: event.target.value } },
                        })
                      )
                    }
                    className="text-base"
                  />
                </label>
                {score !== null && (
                  <p className="text-xs text-muted-foreground">
                    Scores {score}/100 as written, by the Resume Game's rules for action, result,
                    and measure.
                  </p>
                )}
                {text.trim().length > 12 && (
                  <RewriteHelp
                    line={text}
                    noneFollowUp="Add what happened because of the work, or a number you know is true, in your own words above."
                  />
                )}
              </div>
            );
          })}
        </li>

        <li className="space-y-2">
          <h3 className="text-lg font-semibold">
            <span className="num-index mr-2 text-lichen">4</span>
            Step back
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Why do these bullets fit this role? What did you emphasize, change, or leave out because
            of what the employer seems to care about?
          </p>
          <label className="block">
            <span className="sr-only">Why these bullets fit</span>
            <Textarea
              rows={4}
              value={flow.reflection}
              onChange={(event) =>
                changeDesks((data) =>
                  updateBulletsFlow(data, appId, { reflection: event.target.value })
                )
              }
              className="text-base"
            />
          </label>
        </li>
      </ol>

      <div className="space-y-2 border-t border-border/40 pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={!hasWork}
          onClick={() => setPrinting(true)}
        >
          Print or save this as a worksheet
        </Button>
        <p className="text-xs text-muted-foreground">
          One page with the role, what it asks for, your experience, and your two bullets. Choose
          "Save as PDF" in the print dialog to keep a copy.
        </p>
      </div>

      {printing && (
        <PrintSheet onDone={donePrinting}>
          <h1>
            {application.title}
            {application.company ? `, ${application.company}` : ''}
          </h1>
          <p>Application worksheet</p>
          {confirmed.length > 0 && (
            <>
              <h2>What the posting asks for</h2>
              <ul>
                {confirmed.slice(0, 8).map((requirement) => (
                  <li key={requirement.id}>{requirement.text}</li>
                ))}
              </ul>
            </>
          )}
          <h2>The experience I chose</h2>
          <p>{flow.experience.trim() || 'Not written yet.'}</p>
          <h2>What happened because of it</h2>
          <p>{flow.impact.trim() || 'Not written yet.'}</p>
          <h2>My two bullets</h2>
          <ul>
            {flow.bullets.map((bullet, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two fixed slots
              <li key={index}>{bullet.text.trim() || 'Not written yet.'}</li>
            ))}
          </ul>
          <h2>Why these bullets fit this role</h2>
          <p>{flow.reflection.trim() || 'Not written yet.'}</p>
        </PrintSheet>
      )}
    </div>
  );
}
