import * as React from 'react';
import {
  type LetterPart,
  type MessageKind,
  type MessageSource,
  saveMessageVariant,
  updateLetter,
} from '../../lib/application-desk';
import {
  isGenericOpener,
  LINKEDIN_NOTE_LIMIT,
  leavesOutHook,
  nameFromResume,
  tidyDoubledStop,
  whyYouDraft,
} from '../../lib/desk-checks';
import { loadFeature, runFeature } from '../../lib/lazy-feature';
import type { AiResult } from '../../lib/local-ai';
import { isNonAnswer, MIN_ANSWER_WORDS } from '../../lib/non-answer';
import { requirementsFromBullets, summarizeCoverage } from '../../lib/posting';
import { cn, focusWhenReady } from '../../lib/utils';
import { sourceLabel } from '../shared/AiText';
import WordHelp from '../shared/WordHelp';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useDeskExamples } from './examples';
import LetterPreview from './LetterPreview';
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
  const { application, role, changeDesks, resumeText } = desk;
  const examples = useDeskExamples();
  const requirements = React.useMemo(
    () => requirementsFromBullets(role?.bullets ?? []),
    [role?.bullets]
  );
  // The resume line that shows each requirement, for a "have it" line with no
  // proof typed yet. Only lines that describe work, never a skills list.
  const shownBy = React.useMemo(() => {
    const map = new Map<string, string>();
    if (!resumeText.trim()) return map;
    const coverage = summarizeCoverage(requirements, resumeText);
    for (const row of coverage.rows) {
      const line = row.excerpts.find((e) => e.kind === 'experience' && !e.listedOnly);
      if (line && (row.state === 'evidence' || row.state === 'partial'))
        map.set(row.requirement.id, line.text);
    }
    return map;
  }, [requirements, resumeText]);
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<MessageKind | null>(null);
  // A message cleared in order to rewrite it keeps its box on screen. Keyed
  // by application, so one application's empty boxes do not follow to the next.
  const [opened, setOpened] = React.useState<ReadonlySet<string>>(new Set());
  if (!application) return null;
  const appId = application.id;
  const letter = desk.desk.letter;
  const generic = letter.hook.trim() ? isGenericOpener(letter.hook) : false;
  // "idk" or two words would be wrapped in three polished messages as is.
  const thin = isNonAnswer(letter.hook);
  const shown = MESSAGES.filter(
    ({ kind }) => letter.messages[kind] || opened.has(`${appId}:${kind}`)
  );
  const editedKinds = MESSAGES.filter(({ kind }) => {
    const variant = letter.messages[kind];
    return variant?.source === 'student' && variant.text.trim();
  });
  // Up to three requirements the student marked "have it", each with the
  // proof they typed for it on the qualifications station. Conditions of
  // hiring and lines that sell no one (being enrolled) are left out.
  const haveIt = whyYouDraft(requirements, desk.desk.qualifications, 3, shownBy);
  const resumeName = letter.sender.trim() ? null : nameFromResume(resumeText);

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
      linkedin: tidyDoubledStop(linkedInMessage),
      'follow-up-email': tidyDoubledStop(
        `Subject: ${followUpEmail.subject}\n\n${followUpEmail.body}`
      ),
      'intro-call': tidyDoubledStop(introCallOpener),
    };
    // A message the visitor edited is theirs; only the others are rewritten.
    const kept = new Set(editedKinds.map(({ kind }) => kind));
    changeDesks((data) =>
      MESSAGES.reduce(
        (next, { kind }) =>
          kept.has(kind)
            ? next
            : saveMessageVariant(next, appId, kind, { text: texts[kind], source }),
        data
      )
    );
    setOpened(new Set(MESSAGES.map(({ kind }) => `${appId}:${kind}`)));
    setBusy(false);
    // The button changes its words; the first message is what the press made.
    focusWhenReady('desk-message-linkedin');
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
              id="desk-letter-sender"
              value={letter.sender}
              onChange={(event) =>
                changeDesks((data) => updateLetter(data, appId, { sender: event.target.value }))
              }
              className="text-base"
            />
          </label>
          {resumeName && (
            <div className="sm:col-start-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => {
                  changeDesks((data) => updateLetter(data, appId, { sender: resumeName }));
                  focusWhenReady('desk-letter-sender');
                }}
              >
                Use "{resumeName}" from your resume
              </Button>
            </div>
          )}
        </div>

        <details className="rounded-xl border border-border/40 p-4 text-sm">
          <summary className="cursor-pointer font-medium">See a finished example</summary>
          <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
            {examples.letter.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </details>

        <WordHelp words={['hook', 'requirement']} />

        {PARTS.map((part) => (
          <div key={part.key} className="space-y-2">
            <label className="block space-y-1">
              <span className="block font-display text-lg font-semibold">{part.title}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {part.help}
              </span>
              <Textarea
                id={`desk-letter-${part.key}`}
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
                onClick={() => {
                  changeDesks((data) =>
                    updateLetter(data, appId, {
                      // One paragraph: each skill, then its proof.
                      whyYou: haveIt.join(' '),
                    })
                  );
                  // The button is gone once the box has text; the box is next.
                  focusWhenReady('desk-letter-whyYou');
                }}
              >
                Start from what you marked "have it"
              </Button>
            )}
            {part.key === 'whyYou' && haveIt.length > 0 && !letter.whyYou.trim() && (
              <p className="text-xs text-muted-foreground">
                Names each skill, then the proof you wrote for it under Qualifications. Where you
                wrote none, it uses the resume line that shows it, marked for you to check.
              </p>
            )}
            {part.key === 'hook' && generic && (
              <p role="status" className="rounded-lg bg-gold/12 px-3 py-2 text-sm text-foreground">
                This opens the way most letters do. Try starting with something you did, then name
                the role. For example: "{examples.hook}"
              </p>
            )}
          </div>
        ))}

        <div className="border-t border-border/40 pt-6">
          <LetterPreview
            letter={letter}
            title={application.title}
            company={application.company}
            headingId="letter-preview-heading"
          />
        </div>
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
            onClick={() => {
              if (busy) return;
              void runFeature(derive, () => setBusy(false));
            }}
            // Still focusable while it writes, so the keyboard is not sent to the top of the page.
            aria-disabled={busy || undefined}
            disabled={
              !busy &&
              (!letter.hook.trim() || generic || thin || editedKinds.length === MESSAGES.length)
            }
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

        {letter.hook.trim() && !generic && thin && (
          <p className="text-sm text-foreground">
            Write one thing you did, or why this role interests you. A hook needs {MIN_ANSWER_WORDS}{' '}
            words or more.
          </p>
        )}
        {hasMessages && editedKinds.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {editedKinds.length === MESSAGES.length
              ? 'You edited all three, so they are kept as they are. Clear one to have it written again.'
              : 'Messages you edited are kept. Clear one to have it written again.'}
          </p>
        )}

        {shown.map(({ kind, title }) => {
          const variant = letter.messages[kind] ?? { text: '', source: 'student' as const };
          return (
            <div
              key={kind}
              data-guide={`message-${kind}`}
              className="space-y-2 rounded-xl border border-border/40 p-4"
            >
              <label className="block space-y-2">
                <span className="block font-display text-base font-semibold">{title}</span>
                <Textarea
                  id={`desk-message-${kind}`}
                  rows={kind === 'follow-up-email' ? 8 : 4}
                  value={variant.text}
                  placeholder="Write this message, or press the button above to have it written."
                  onChange={(event) => {
                    setOpened((before) => new Set(before).add(`${appId}:${kind}`));
                    changeDesks((data) =>
                      saveMessageVariant(data, appId, kind, {
                        text: event.target.value,
                        source: 'student',
                      })
                    );
                  }}
                  className="text-base"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={!variant.text.trim()}
                  onClick={() => copy(kind, variant.text)}
                >
                  {copied === kind ? 'Copied' : 'Copy'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {variant.text.trim() ? SOURCE_TEXT[variant.source] : 'Empty'}
                </span>
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
              {kind === 'linkedin' &&
                variant.source !== 'student' &&
                leavesOutHook(variant.text, letter.hook) && (
                  <p className="text-xs text-foreground" data-testid="linkedin-hook-left-out">
                    Your opening line did not fit in {LINKEDIN_NOTE_LIMIT} characters, so this note
                    leaves it out. Shorten the hook to use it here.
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
