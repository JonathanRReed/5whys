import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  type GlowUpData,
  type DecodedRole,
  type InterviewPacket,
  createPacket,
  updatePacket,
} from '../../lib/glowup-store';
import {
  getSkillName,
  SUGGESTED_QUESTIONS_TO_ASK,
} from '../../lib/glowup-banks';
import { TargetIcon, PrinterIcon, ClipboardIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
  currentPacket: InterviewPacket | undefined;
  onLaunchHUD: () => void;
};

export default function PacketSection({ data, setData, currentRole, currentPacket, onLaunchHUD }: Props) {
  const [mode, setMode] = React.useState<'prep' | 'review'>('prep');

  const createNewPacket = () => {
    if (!currentRole) return;

    setData(createPacket(data, {
      roleId: currentRole.id,
      mode: 'prep',
      topStoryIds: [],
      customQuestions: [],
      notes: '',
      panicAnswer: '',
      companyIntel: {
        keywords: [],
        notes: '',
        links: [],
      },
    }));
  };

  if (!currentRole) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--foam)/0.1)]">
          <ClipboardIcon className="h-6 w-6 text-[hsl(var(--foam))]" />
        </div>
        <p className="text-sm font-medium text-foreground">No role decoded yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Head to Decode JD first to analyze a job description, then create your interview packet.
        </p>
      </div>
    );
  }

  if (!currentPacket) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--foam)/0.1)]">
          <ClipboardIcon className="h-6 w-6 text-[hsl(var(--foam))]" />
        </div>
        <p className="text-sm font-medium text-foreground">No packet yet for this role</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a packet to compile your best stories, company intel, and questions to ask.
        </p>
        <button
          type="button"
          onClick={createNewPacket}
          className="mt-4 rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          Create Interview Packet
        </button>
      </div>
    );
  }

  const packetStories = data.stories.filter(s => currentPacket.topStoryIds.includes(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {currentRole.company} — {currentRole.jobTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {packetStories.length} stories in packet (target: 5)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('prep')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2',
              mode === 'prep'
                ? 'bg-[hsl(var(--foam)/0.15)] text-[hsl(var(--foam))]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Prep
          </button>
          <button
            type="button"
            onClick={() => setMode('review')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[hsl(var(--iris))] focus-visible:ring-offset-2',
              mode === 'review'
                ? 'bg-[hsl(var(--iris)/0.15)] text-[hsl(var(--iris))]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Review
          </button>
          <button
            type="button"
            onClick={onLaunchHUD}
            className="flex items-center gap-1 rounded-lg bg-[hsl(var(--foam))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--background))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
          >
            <TargetIcon className="h-4 w-4" />
            HUD
          </button>
        </div>
      </div>

      {mode === 'prep' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company Intel</h4>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">3 Keywords (for HUD header)</label>
              <p className="mb-1 text-xs text-muted-foreground">These appear at the top of your HUD so you remember what to emphasize.</p>
              <input
                type="text"
                value={currentPacket.companyIntel?.keywords.join(', ') ?? ''}
                onChange={e => {
                  const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean).slice(0, 3);
                  setData(updatePacket(data, currentPacket.id, {
                    companyIntel: { ...currentPacket.companyIntel!, keywords },
                  }));
                }}
                placeholder="e.g., growth, developer productivity, AI-first"
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foam))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Notes (mission/fit/why-us)</label>
              <p className="mb-1 text-xs text-muted-foreground">Your personal pitch: why this company, why this team, why you.</p>
              <textarea
                value={currentPacket.notes}
                onChange={e => setData(updatePacket(data, currentPacket.id, { notes: e.target.value }))}
                placeholder="Why are you excited about this role? What makes you a good fit?"
                rows={3}
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foam))]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Panic Answer (generic safe story)
            </label>
            <p className="mb-1 text-xs text-muted-foreground">A fallback story you can tell if your mind goes blank mid-interview.</p>
            <textarea
              value={currentPacket.panicAnswer ?? ''}
              onChange={e => setData(updatePacket(data, currentPacket.id, { panicAnswer: e.target.value }))}
              placeholder="A generic story you can use if you completely blank..."
              rows={2}
              className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foam))]"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Questions to Ask</h4>
            <p className="text-xs text-muted-foreground">Smart questions show interest and help you evaluate the role.</p>
            <div className="space-y-2">
              {(currentPacket.customQuestions.length > 0 ? currentPacket.customQuestions : ['']).map((q, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={e => {
                      const updated = [...currentPacket.customQuestions];
                      updated[i] = e.target.value;
                      setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                    }}
                    placeholder="Your question..."
                    className="flex-1 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foam))]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = currentPacket.customQuestions.filter((_, j) => j !== i);
                      setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                    }}
                    aria-label="Remove question"
                    className="rounded px-2 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-[hsl(var(--destructive))] focus-visible:ring-offset-2"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setData(updatePacket(data, currentPacket.id, {
                    customQuestions: [...currentPacket.customQuestions, ''],
                  }));
                }}
                className="rounded px-1 text-sm text-[hsl(var(--foam))] hover:underline focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              >
                + Add question
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Suggestions:</span>
              {SUGGESTED_QUESTIONS_TO_ASK.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (!currentPacket.customQuestions.includes(q)) {
                      setData(updatePacket(data, currentPacket.id, {
                        customQuestions: [...currentPacket.customQuestions, q],
                      }));
                    }
                  }}
                  className="rounded-full bg-[hsl(var(--overlay)/0.4)] px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
                >
                  + {q.slice(0, 30)}...
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[hsl(var(--foam)/0.3)] bg-[hsl(var(--foam)/0.05)] p-5">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Ready for the interview?</h4>
                <p className="text-xs text-muted-foreground">
                  Launch the HUD to see a clean, minimal view of your packet — stories, keywords, and panic answer — all in one glance.
                </p>
              </div>
              <button
                type="button"
                onClick={onLaunchHUD}
                className="flex items-center gap-2 rounded-lg bg-[hsl(var(--foam))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--background))] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
              >
                <TargetIcon className="h-4 w-4" />
                Launch HUD
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div className="space-y-4">
          {packetStories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--foam)/0.1)]">
                <ClipboardIcon className="h-6 w-6 text-[hsl(var(--foam))]" />
              </div>
              <p className="text-sm font-medium text-foreground">No stories in packet yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Go to the Vault tab to browse your stories and add the best ones to this packet.
              </p>
            </div>
          ) : (
            packetStories.map(story => (
              <div
                key={story.id}
                className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--foam))]">
                    {getSkillName(story.primarySkillId)}
                  </span>
                  <span className="text-xs text-muted-foreground">{story.confidence}%</span>
                </div>
                <p className="mt-2 font-medium text-foreground">{story.trigger}</p>
                <p className="mt-1 text-sm text-muted-foreground">{story.hook}</p>
                <p className="mt-2 text-sm font-medium text-[hsl(var(--foam))]">{story.proofSnippet}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--overlay)/0.5)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--foam))] focus-visible:ring-offset-2"
        >
          <PrinterIcon className="h-4 w-4" />
          Print / Export PDF
        </button>
      </div>
    </div>
  );
}
