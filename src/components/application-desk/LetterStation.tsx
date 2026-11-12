import * as React from 'react';
import {
  type LetterPart,
  type MessageKind,
  type MessageSource,
  saveMessageVariant,
  updateLetter,
} from '../../lib/application-desk';
import { isGenericOpener } from '../../lib/desk-checks';
import type { AiResult } from '../../lib/local-ai';
import { requirementsFromBullets } from '../../lib/posting';
import { sourceLabel } from '../shared/AiText';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { DeskState } from './useDesk';

const PARTS: { key: LetterPart; title: string; help: string; rows: number }[] = [
  {
    key: 'hook',
    title: 'Name the role with a hook',
    help: 'Open with something only you could write: a result, a moment, a reason. Then name the role.',
    rows: 3,
  },
  {
    key: 'whyYou',
    title: 'Why you',
    help: 'Two or three skills from the posting, each followed by quick proof that you have it.',
    rows: 5,
  },
  {
    key: 'whyThem',
    title: 'Why them',
    help: 'What draws you to this employer in particular. Be specific enough that it could not be sent anywhere else.',
    rows: 4,
  },
  {
    key: 'closingAsk',
    title: 'Close with an ask',
    help: 'Say what you want to happen next: a conversation, an interview, a reply.',
    rows: 2,
  },
];

const MESSAGES: { kind: MessageKind; title: string }[] = [
  { kind: 'linkedin', title: 'LinkedIn message' },
  { kind: 'follow-up-email', title: 'Follow-up email' },
  { kind: 'intro-call', title: 'Opener for a networking or intro call' },
];

const SOURCE_TEXT: Record<MessageSource, string> = {
  rules: sourceLabel('rules'),
  'browser-model': sourceLabel('browser-model'),
  'site-model': sourceLabel('hosted-model'),
  student: 'Edited by you',
};

const toMessageSource = (source: AiResult<unknown>['source']): MessageSource =>
  source === 'hosted-model' ? 'site-model' : source;

export default function LetterStation({ desk }: { desk: DeskState }) {
  const { application, role, changeDesks } = desk;
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<MessageKind | null>(null);
  if (!application) return null;
  const appId = application.id;
  const letter = desk.desk.letter;
  const generic = letter.hook.trim() ? isGenericOpener(letter.hook) : false;
  // Up to three requirements the student marked "have it": the skeleton of
  // "why you" is one skill from the posting, then quick proof.
  const statuses = new Map(desk.desk.qualifications.map((row) => [row.requirementId, row.status]));
  const haveIt = requirementsFromBullets(role?.bullets ?? [])
    .filter((r) => r.status === 'confirmed' && statuses.get(r.id) === 'have')
    .slice(0, 3)
    .map((r) => r.text.replace(/[.;]+$/, ''));

  const derive = async () => {
    setBusy(true);
    const { messageVariants } = await import('../../lib/local-ai');
    const result = await messageVariants({
      opener: letter.hook,
      role: application.title,
      company: application.company,
      contactName: letter.recipient.trim() || undefined,
    });
    const source = toMessageSource(result.source);
    const { linkedInMessage, followUpEmail, introCallOpener } = result.value;
    const texts: Record<MessageKind, string> = {
      linkedin: linkedInMessage,
      'follow-up-email': `Subject: ${followUpEmail.subject}\n\n${followUpEmail.body}`,
      'intro-call': introCallOpener,
    };
    changeDesks((data) =>
      MESSAGES.reduce(
        (next, { kind }) => saveMessageVariant(next, appId, kind, { text: texts[kind], source }),
        data
      )
    );
    setBusy(false);
  };

  const copy = async (kind: MessageKind, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  };

  const hasMessages = MESSAGES.some(({ kind }) => letter.messages[kind]);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">The letter</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Four short parts. Write it in your own voice; a letter that sounds like everyone else's
            gets skimmed like everyone else's.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm text-muted-foreground">Who it is to</span>
            <Input
              value={letter.recipient}
              onChange={(event) =>
                changeDesks((data) => updateLetter(data, appId, { recipient: event.target.value }))
              }
              placeholder="Ms. Rivera"
              className="text-base"
            />
            <span className="block text-xs text-muted-foreground">
              No name on the posting? Use the team: "Marketing Team".
            </span>
          </label>
          <label className="space-y-1">
            <span className="block text-sm text-muted-foreground">Your name</span>
            <Input
              value={letter.sender}
              onChange={(event) =>
                changeDesks((data) => updateLetter(data, appId, { sender: event.target.value }))
              }
              className="text-base"
            />
          </label>
        </div>

        <details className="rounded-xl border border-border/40 p-4 text-sm">
          <summary className="cursor-pointer font-medium">See a finished example</summary>
          <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
            <p>Dear Ms. Okafor,</p>
            <p>
              Last spring I rebuilt my campus food pantry's sign-up sheet so that volunteers stopped
              missing shifts, and I would like to bring that same care to the Program Assistant role
              at Riverside Food Bank.
            </p>
            <p>
              Scheduling: I moved 30 volunteers from a paper list to a shared calendar and sent a
              reminder the night before each shift. Communication: I wrote the weekly update that
              went to every volunteer. Reliability: I opened the pantry every Tuesday for two
              semesters.
            </p>
            <p>
              Your mobile pantry stood out to me because it reaches students who cannot get to a
              fixed site, which was the problem I kept hearing about on my own campus.
            </p>
            <p>
              Thank you for considering my application. Could we talk for 15 minutes about how I
              could help with volunteer scheduling this fall?
            </p>
            <p>Sincerely, Sam Alvarez</p>
          </div>
        </details>

        {PARTS.map((part) => (
          <div key={part.key} className="space-y-2">
            <label className="block space-y-1">
              <span className="block font-display text-lg font-semibold">{part.title}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {part.help}
              </span>
              <Textarea
                rows={part.rows}
                data-guide={`letter-${part.key}`}
                value={letter[part.key]}
                onChange={(event) =>
                  changeDesks((data) =>
                    updateLetter(data, appId, { [part.key]: event.target.value })
                  )
                }
                className="mt-1 text-base"
              />
            </label>
            {part.key === 'whyYou' && haveIt.length > 0 && !letter.whyYou.trim() && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  changeDesks((data) =>
                    updateLetter(data, appId, {
                      whyYou: haveIt.map((text) => `${text}: [your proof]`).join('\n'),
                    })
                  )
                }
              >
                Start from what you marked "have it"
              </Button>
            )}
            {part.key === 'hook' && generic && (
              <p role="status" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
                This opens the way most letters do. Try starting with something you did, then name
                the role. For example: "Over the last year I grew my club's Instagram into a real
                community, and I would love to do that for your team."
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="min-w-0 space-y-5" data-guide="letter-messages">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">One letter, many conversations</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The same opener works in a LinkedIn message, a follow-up email, and the first minute of
            a call. Write the hook, then turn it into all three and edit them until they sound like
            you.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" onClick={derive} disabled={busy || !letter.hook.trim()}>
            {busy ? 'Writing' : hasMessages ? 'Write them again' : 'Write the three messages'}
          </Button>
        </div>
        {!letter.hook.trim() && (
          <p className="text-sm text-muted-foreground">Write the hook first.</p>
        )}

        {MESSAGES.map(({ kind, title }) => {
          const variant = letter.messages[kind];
          if (!variant) return null;
          return (
            <div
              key={kind}
              data-guide={`message-${kind}`}
              className="space-y-2 rounded-xl border border-border/40 p-4"
            >
              <label className="block space-y-2">
                <span className="block font-display text-base font-semibold">{title}</span>
                <Textarea
                  rows={kind === 'follow-up-email' ? 8 : 4}
                  value={variant.text}
                  onChange={(event) =>
                    changeDesks((data) =>
                      saveMessageVariant(data, appId, kind, {
                        text: event.target.value,
                        source: 'student',
                      })
                    )
                  }
                  className="text-base"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => copy(kind, variant.text)}
                >
                  {copied === kind ? 'Copied' : 'Copy'}
                </Button>
                <span className="text-xs text-muted-foreground">{SOURCE_TEXT[variant.source]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
