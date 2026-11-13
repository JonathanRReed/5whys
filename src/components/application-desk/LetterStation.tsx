import * as React from 'react';
import {
  type LetterPart,
  type MessageKind,
  type MessageSource,
  saveMessageVariant,
  updateLetter,
} from '../../lib/application-desk';
import { isGenericOpener, LINKEDIN_NOTE_LIMIT } from '../../lib/desk-checks';
import { loadFeature, runFeature } from '../../lib/lazy-feature';
import type { AiResult } from '../../lib/local-ai';
import { requirementsFromBullets } from '../../lib/posting';
import { cn } from '../../lib/utils';
import { sourceLabel } from '../shared/AiText';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useDeskExamples } from './examples';
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
  const examples = useDeskExamples();
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
    const { messageVariants, grounded } = await loadFeature(import('../../lib/local-ai'));
    const input = {
      opener: letter.hook,
      role: application.title,
      company: application.company,
      contactName: letter.recipient.trim() || undefined,
    };
    // These messages are saved and copied without a second look, so a model
    // result that adds something the visitor did not write is not kept. The
    // rules only rearrange the visitor's own words.
    const result = await grounded(messageVariants, input);
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
              No name on the posting? Use the team, such as "Hiring Team".
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
            {examples.letter.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
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
                the role. For example: "{examples.hook}"
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
          <Button
            type="button"
            onClick={() => void runFeature(derive, () => setBusy(false))}
            disabled={busy || !letter.hook.trim() || generic}
          >
            {busy ? 'Writing' : hasMessages ? 'Write them again' : 'Write the three messages'}
          </Button>
        </div>
        {!letter.hook.trim() && (
          <p className="text-sm text-muted-foreground">Write the hook first.</p>
        )}
        {letter.hook.trim() && generic && (
          <p className="text-sm text-muted-foreground">
            Rewrite the hook first. These messages reuse it, and a generic opener would be repeated
            three more times.
          </p>
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
              {kind === 'linkedin' && (
                <p
                  className={cn(
                    'text-xs',
                    variant.text.length > LINKEDIN_NOTE_LIMIT
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {variant.text.length} characters. A connection note on a free LinkedIn account
                  holds {LINKEDIN_NOTE_LIMIT}
                  {variant.text.length > LINKEDIN_NOTE_LIMIT
                    ? ', so this one would be cut off.'
                    : '.'}
                </p>
              )}
              {kind === 'follow-up-email' && (
                <p className="text-xs text-muted-foreground">
                  Send it once, a week or two after you apply, or after the date they gave you.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
