import * as React from 'react';
import {
  getSkillName,
  resolveQuestionText,
  SUGGESTED_QUESTIONS_TO_ASK,
} from '../../lib/glowup-banks';
import {
  type DecodedRole,
  ensurePacketForRole,
  type GlowUpData,
  type InterviewPacket,
  readinessLabel,
  type Story,
  toggleStoryInPacket,
  updatePacket,
} from '../../lib/glowup-store';
import { cn } from '../../lib/utils';
import { ClipboardIcon, PrinterIcon, TargetIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
  currentPacket: InterviewPacket | undefined;
  onLaunchHUD: () => void;
  onGoToStories: () => void;
  onGoToDecode: () => void;
};

export default function PacketSection({
  data,
  setData,
  currentRole,
  currentPacket,
  onLaunchHUD,
  onGoToStories,
  onGoToDecode,
}: Props) {
  const [mode, setMode] = React.useState<'prep' | 'review'>('prep');

  // The packet is created with the role; this only runs for data saved before that.
  React.useEffect(() => {
    if (currentRole && !currentPacket) setData(ensurePacketForRole(data, currentRole.id));
  }, [currentRole, currentPacket, data, setData]);

  if (!currentRole || !currentPacket) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foam/10">
          <ClipboardIcon className="h-6 w-6 text-foam" />
        </div>
        <p className="text-sm font-medium text-foreground">No job decoded yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The packet belongs to a posting. Decode one first and it appears here.
        </p>
        <button
          type="button"
          onClick={onGoToDecode}
          className="mt-4 rounded-lg bg-foam px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foam/90 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          Decode a job
        </button>
      </div>
    );
  }

  const packetStories = data.stories.filter((s) => currentPacket.topStoryIds.includes(s.id));
  const otherStories = data.stories.filter((s) => !currentPacket.topStoryIds.includes(s.id));

  // Group packet stories by primary skill for a scannable rehearsal order.
  const storiesBySkill: [string, Story[]][] = [];
  for (const story of packetStories) {
    const existing = storiesBySkill.find(([skillId]) => skillId === story.primarySkillId);
    if (existing) {
      existing[1].push(story);
    } else {
      storiesBySkill.push([story.primarySkillId, [story]]);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {[currentRole.jobTitle || 'Untitled role', currentRole.company]
              .filter(Boolean)
              .join(' at ')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {packetStories.length === 1 ? '1 story' : `${packetStories.length} stories`} in the
            packet. Five is plenty for one interview.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('prep')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2',
              mode === 'prep'
                ? 'bg-foam/15 text-foam'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Prep
          </button>
          <button
            type="button"
            onClick={() => setMode('review')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-iris focus-visible:ring-offset-2',
              mode === 'review'
                ? 'bg-iris/15 text-iris'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Review
          </button>
          <button
            type="button"
            onClick={onLaunchHUD}
            className="flex items-center gap-1 rounded-lg bg-foam px-3 py-1.5 text-sm font-semibold text-background focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            <TargetIcon className="h-4 w-4" />
            HUD
          </button>
        </div>
      </div>

      {mode === 'prep' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Stories in this packet
            </h4>
            {packetStories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 p-5 text-sm text-muted-foreground">
                Nothing packed yet.{' '}
                {data.stories.length > 0 ? (
                  'Add stories below, or from any story card.'
                ) : (
                  <button
                    type="button"
                    onClick={onGoToStories}
                    className="font-medium text-foam underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  >
                    Write your first story
                  </button>
                )}
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {packetStories.map((story) => (
                  <li
                    key={story.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-foam/30 bg-foam/5 p-3"
                  >
                    <div>
                      <span className="rounded-full bg-foam/15 px-2 py-0.5 text-xs font-medium text-foam">
                        {getSkillName(story.primarySkillId)}
                      </span>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {story.trigger || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground">{readinessLabel(story)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setData(toggleStoryInPacket(data, currentPacket.id, story.id))}
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {otherStories.length > 0 && (
              <details className="rounded-xl border border-border/30 bg-overlay/15 p-3">
                <summary className="cursor-pointer text-sm text-foreground">
                  Add from your other {otherStories.length === 1 ? 'story' : 'stories'} (
                  {otherStories.length})
                </summary>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {otherStories.map((story) => (
                    <li
                      key={story.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border/30 bg-overlay/20 p-3"
                    >
                      <div>
                        <span className="rounded-full bg-overlay/50 px-2 py-0.5 text-xs text-muted-foreground">
                          {getSkillName(story.primarySkillId)}
                        </span>
                        <p className="mt-1 text-sm text-foreground">
                          {story.trigger || 'Untitled'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setData(toggleStoryInPacket(data, currentPacket.id, story.id))
                        }
                        className="rounded-lg border border-border/50 bg-overlay/30 px-2 py-1 text-xs text-foreground hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Company Intel
            </h4>
            <div>
              <label htmlFor="packet-keywords" className="mb-1 block text-sm text-muted-foreground">
                3 Keywords (for HUD header)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                These appear at the top of your HUD so you remember what to emphasize.
              </p>
              <input
                id="packet-keywords"
                type="text"
                value={currentPacket.companyIntel?.keywords.join(', ') ?? ''}
                onChange={(e) => {
                  const keywords = e.target.value
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean)
                    .slice(0, 3);
                  setData(
                    updatePacket(data, currentPacket.id, {
                      companyIntel: {
                        ...(currentPacket.companyIntel ?? { keywords: [], notes: '', links: [] }),
                        keywords,
                      },
                    })
                  );
                }}
                placeholder="e.g., growth, developer productivity, AI-first"
                className="w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              />
            </div>
            <div>
              <label htmlFor="packet-notes" className="mb-1 block text-sm text-muted-foreground">
                Notes (mission/fit/why-us)
              </label>
              <p className="mb-1 text-xs text-muted-foreground">
                Your personal pitch: why this company, why this team, why you.
              </p>
              <textarea
                id="packet-notes"
                value={currentPacket.notes}
                onChange={(e) =>
                  setData(updatePacket(data, currentPacket.id, { notes: e.target.value }))
                }
                placeholder="Why are you excited about this role? What makes you a good fit?"
                rows={3}
                className="w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="packet-panic"
              className="mb-1 block text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Panic Answer (generic safe story)
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              A fallback story you can tell if your mind goes blank mid-interview.
            </p>
            <textarea
              id="packet-panic"
              value={currentPacket.panicAnswer ?? ''}
              onChange={(e) =>
                setData(updatePacket(data, currentPacket.id, { panicAnswer: e.target.value }))
              }
              placeholder="A generic story you can use if you completely blank..."
              rows={2}
              className="w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Questions to Ask
            </h4>
            <p className="text-xs text-muted-foreground">
              Smart questions show interest and help you evaluate the role.
            </p>
            <div className="space-y-2">
              {(currentPacket.customQuestions.length > 0
                ? currentPacket.customQuestions
                : ['']
              ).map((q, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => {
                      const updated = [...currentPacket.customQuestions];
                      updated[i] = e.target.value;
                      setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                    }}
                    placeholder="Your question..."
                    className="flex-1 rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = currentPacket.customQuestions.filter((_, j) => j !== i);
                      setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                    }}
                    aria-label="Remove question"
                    className="rounded px-2 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setData(
                    updatePacket(data, currentPacket.id, {
                      customQuestions: [...currentPacket.customQuestions, ''],
                    })
                  );
                }}
                className="rounded px-1 text-sm text-foam hover:underline focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              >
                + Add question
              </button>
            </div>
            {SUGGESTED_QUESTIONS_TO_ASK.some((q) => !currentPacket.customQuestions.includes(q)) && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Suggestions (click to add):</span>
                <div className="flex flex-col items-start gap-1">
                  {SUGGESTED_QUESTIONS_TO_ASK.filter(
                    (q) => !currentPacket.customQuestions.includes(q)
                  ).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setData(
                          updatePacket(data, currentPacket.id, {
                            customQuestions: [...currentPacket.customQuestions, q],
                          })
                        );
                      }}
                      className="rounded-lg px-2 py-1 text-left text-xs text-muted-foreground hover:bg-overlay/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
                    >
                      + {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-foam/30 bg-foam/5 p-5">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Ready for the interview?</h4>
                <p className="text-xs text-muted-foreground">
                  Launch the HUD to see a clean, minimal view of your packet: stories, keywords, and
                  panic answer in one glance.
                </p>
              </div>
              <button
                type="button"
                onClick={onLaunchHUD}
                className="flex items-center gap-2 rounded-lg bg-foam px-4 py-2.5 text-sm font-semibold text-background shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              >
                <TargetIcon className="h-4 w-4" />
                Open the HUD
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div className="space-y-6">
          {packetStories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foam/10">
                <ClipboardIcon className="h-6 w-6 text-foam" />
              </div>
              <p className="text-sm font-medium text-foreground">No stories in the packet yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Switch to Prep to add stories, or write one in Build stories.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Rehearsal order: read the questions first, answer out loud from the Trigger, then
                check the Play and Proof.
              </p>
              {storiesBySkill.map(([skillId, skillStories]) => (
                <div key={skillId} className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {getSkillName(skillId)}
                  </h4>
                  {skillStories.map((story) => (
                    <div
                      key={story.id}
                      className="rounded-xl border border-border/30 bg-overlay/15 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground">{story.trigger || 'Untitled'}</p>
                        <span className="text-xs text-muted-foreground">
                          {readinessLabel(story)}
                        </span>
                      </div>
                      {story.questionPrompts.length > 0 && (
                        <ul className="mt-2 space-y-1 rounded-lg bg-iris/8 p-2">
                          {story.questionPrompts.map((q, i) => (
                            <li key={i} className="text-sm text-iris">
                              Q: {resolveQuestionText(q)}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-sm text-muted-foreground">{story.hook}</p>
                      {story.play && (
                        <p className="mt-2 text-sm text-foreground">
                          <span className="font-semibold">Play:</span> {story.play}
                        </p>
                      )}
                      {story.proof && (
                        <p className="mt-1 text-sm text-foreground">
                          <span className="font-semibold">Proof:</span> {story.proof}
                        </p>
                      )}
                      {story.proofSnippet && (
                        <p className="mt-2 text-sm font-medium text-foam">{story.proofSnippet}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {currentPacket.customQuestions.filter(Boolean).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Questions to Ask
                  </h4>
                  <ul className="space-y-1">
                    {currentPacket.customQuestions.filter(Boolean).map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-iris" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {currentPacket.panicAnswer && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-destructive">
                    Panic Answer
                  </h4>
                  <p className="mt-2 text-sm text-foreground">{currentPacket.panicAnswer}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-overlay/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        >
          <PrinterIcon className="h-4 w-4" />
          Print / Export PDF
        </button>
      </div>
    </div>
  );
}
