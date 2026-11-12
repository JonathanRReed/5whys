import * as React from 'react';
import { updateBulletsFlow } from '../../lib/application-desk';
import { requirementsFromBullets } from '../../lib/posting';
import { scoreBullet } from '../../lib/resume-game';
import RewriteHelp from '../resume-game/RewriteHelp';
import PrintSheet from '../shared/PrintSheet';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import type { DeskState } from './useDesk';

const STEPS = [
  {
    key: 'experience',
    title: 'Pick one experience',
    help: 'It does not have to be a job. A class project, a part-time role, a club, volunteering, or something you built on your own all count. Say what it was, what you did, and how it connects to what this employer wants.',
    placeholder: 'I ran social media for the campus radio station for a year...',
  },
  {
    key: 'impact',
    title: 'Say what happened because of it',
    help: 'The result does not have to be a number. A finished project, a problem solved, a smoother process, good feedback, or something that got easier because of your work all count.',
    placeholder: 'Because of the weekly schedule I set up, volunteers stopped missing shifts...',
  },
] as const;

export default function BulletsStation({ desk }: { desk: DeskState }) {
  const { application, role, changeDesks } = desk;
  const [printing, setPrinting] = React.useState(false);
  const donePrinting = React.useCallback(() => setPrinting(false), []);
  if (!application) return null;
  const flow = desk.desk.bullets;
  const appId = application.id;
  const confirmed = requirementsFromBullets(role?.bullets ?? []).filter(
    (r) => r.status === 'confirmed'
  );
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

      <ol className="space-y-8">
        {STEPS.map((step, index) => (
          <li key={step.key} className="space-y-2">
            <h3 className="text-lg font-semibold">
              <span className="num-index mr-2 text-lichen">{index + 1}</span>
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.help}</p>
            <label className="block">
              <span className="sr-only">{step.title}</span>
              <Textarea
                rows={4}
                value={flow[step.key]}
                placeholder={step.placeholder}
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
                    placeholder="Grew the station's Instagram from 400 to 2,100 followers by posting three times a week"
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
                {text.trim().length > 12 && <RewriteHelp line={text} />}
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
