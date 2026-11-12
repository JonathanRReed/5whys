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
    help: 'One or two pieces of evidence that answer what the posting asks for.',
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
  const { application, changeDesks } = desk;
  const [contact, setContact] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<MessageKind | null>(null);
  if (!application) return null;
  const appId = application.id;
  const letter = desk.desk.letter;
  const generic = letter.hook.trim() ? isGenericOpener(letter.hook) : false;

  const derive = async () => {
    setBusy(true);
    const { messageVariants } = await import('../../lib/local-ai');
    const result = await messageVariants({
      opener: letter.hook,
      role: application.title,
      company: application.company,
      contactName: contact.trim() || undefined,
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
        {PARTS.map((part) => (
          <div key={part.key} className="space-y-2">
            <label className="block space-y-1">
              <span className="block font-display text-lg font-semibold">{part.title}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {part.help}
              </span>
              <Textarea
                rows={part.rows}
                value={letter[part.key]}
                onChange={(event) =>
                  changeDesks((data) =>
                    updateLetter(data, appId, { [part.key]: event.target.value })
                  )
                }
                className="mt-1 text-base"
              />
            </label>
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

      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">One letter, many conversations</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The same opener works in a LinkedIn message, a follow-up email, and the first minute of
            a call. Write the hook, then turn it into all three and edit them until they sound like
            you.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="block text-sm text-muted-foreground">
              Who are you writing to? (optional)
            </span>
            <Input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Jordan"
              className="text-base"
            />
          </label>
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
            <div key={kind} className="space-y-2 rounded-xl border border-border/40 p-4">
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
