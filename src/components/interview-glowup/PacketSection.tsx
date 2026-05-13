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
import { TargetIcon, PrinterIcon } from './icons';

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
        <p className="text-muted-foreground">Decode a job description first to create a packet.</p>
      </div>
    );
  }

  if (!currentPacket) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border)/0.4)] p-8 text-center">
        <p className="text-muted-foreground">No packet yet for this role.</p>
        <button
          type="button"
          onClick={createNewPacket}
          className="mt-4 rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))]"
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
              'rounded-lg px-3 py-1.5 text-sm font-medium',
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
              'rounded-lg px-3 py-1.5 text-sm font-medium',
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
            className="flex items-center gap-1 rounded-lg bg-[hsl(var(--foam))] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--background))]"
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
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Notes (mission/fit/why-us)</label>
              <textarea
                value={currentPacket.notes}
                onChange={e => setData(updatePacket(data, currentPacket.id, { notes: e.target.value }))}
                placeholder="Why are you excited about this role? What makes you a good fit?"
                rows={3}
                className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Panic Answer (generic safe story)
            </label>
            <textarea
              value={currentPacket.panicAnswer ?? ''}
              onChange={e => setData(updatePacket(data, currentPacket.id, { panicAnswer: e.target.value }))}
              placeholder="A generic story you can use if you completely blank..."
              rows={2}
              className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Questions to Ask</h4>
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
                    className="flex-1 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = currentPacket.customQuestions.filter((_, j) => j !== i);
                      setData(updatePacket(data, currentPacket.id, { customQuestions: updated }));
                    }}
                    className="text-muted-foreground hover:text-destructive"
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
                className="text-sm text-[hsl(var(--foam))] hover:underline"
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
                  className="rounded-full bg-[hsl(var(--overlay)/0.4)] px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  + {q.slice(0, 30)}...
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'review' && (
        <div className="space-y-4">
          {packetStories.length === 0 ? (
            <p className="text-center text-muted-foreground">No stories in packet. Add from the Vault.</p>
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
          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-[hsl(var(--overlay)/0.5)] hover:text-foreground"
        >
          <PrinterIcon className="h-4 w-4" />
          Print / Export PDF
        </button>
      </div>
    </div>
  );
}
