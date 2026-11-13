import * as React from 'react';
import { audienceForProfile, tidyQuestionText } from '../../lib/glowup-banks';
import {
  type DecodedRole,
  type GlowUpData,
  type InterviewPacket,
  requirementBullets,
  updatePacket,
} from '../../lib/glowup-store';
import { loadFeature, runFeature } from '../../lib/lazy-feature';
import { readProfile } from '../../lib/profile';
import { useClipboard } from '../networking/useClipboard';
import { sourceLabel } from '../shared/AiText';

type Props = {
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  role: DecodedRole;
  packet: InterviewPacket;
};

/**
 * The prompt is composed entirely from what is saved in this browser. The
 * visitor carries it to whatever AI they already use and pastes the answer
 * back; this site sends nothing anywhere. When no requirements were parsed,
 * the raw posting text stands in.
 */
export function buildQuestionsPrompt(role: DecodedRole): string {
  const where = [role.jobTitle || 'this role', role.company].filter(Boolean).join(' at ');
  const requirements = role.bullets.filter((b) => b.status === 'active').map((b) => b.text);
  const source = requirements.length
    ? `The posting lists these requirements:\n${requirements.map((t) => `- ${t}`).join('\n')}`
    : `The posting says:\n${role.rawJdText.trim().slice(0, 3000)}`;
  return [
    `I am interviewing for ${where}.`,
    source,
    'List the 8 questions this interviewer is most likely to ask. Under each one, name the requirement it tests and one line on what a strong answer proves.',
  ].join('\n\n');
}

export default function AiQuestions({ setData, role, packet }: Props) {
  const { copiedKey, handleCopy } = useClipboard();
  const prompt = buildQuestionsPrompt(role);
  const [busy, setBusy] = React.useState(false);
  const [written, setWritten] = React.useState<string | null>(null);

  // Writes a list here, on the device: from the browser's own model when it
  // has one, otherwise from the question bank. Nothing is sent anywhere, and
  // the list lands in the same freeform box, which the tools never score.
  const writeHere = async () => {
    setBusy(true);
    const { likelyQuestions, grounded } = await loadFeature(import('../../lib/local-ai'));
    const result = await grounded(likelyQuestions, {
      jobTitle: role.jobTitle || undefined,
      company: role.company || undefined,
      // Only real requirements, never the address or the pitch.
      requirements: requirementBullets(role.bullets).map((b) => b.text),
      audience: audienceForProfile(readProfile()),
    });
    const list = result.value.questions
      .map(
        (q, index) =>
          `${index + 1}. ${tidyQuestionText(q.question)}${q.requirement ? `\n   Tests: ${q.requirement}` : ''}`
      )
      .join('\n');
    // Build on the workspace as it is now: the visitor may have typed in the
    // box, or changed something else, while the list was being written.
    setData((latest) => {
      const existing = (latest.packets.find((p) => p.id === packet.id)?.aiQuestions ?? '').trim();
      return updatePacket(latest, packet.id, {
        aiQuestions: existing ? `${existing}\n\n${list}` : list,
      });
    });
    setWritten(
      list ? sourceLabel(result.source) : 'No questions could be written from this posting.'
    );
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Questions they will probably ask
      </h3>
      <p className="text-xs text-muted-foreground">
        A list built on this device from the posting you decoded. The rehearsal room offers these
        questions when you start a session.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runFeature(writeHere, () => setBusy(false))}
          disabled={busy}
          className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Writing' : 'Write a list on this device'}
        </button>
        <span role="status" className="text-xs text-muted-foreground">
          {written}
        </span>
      </div>
      <details className="rounded-lg border border-border/30 px-3 py-2">
        <summary className="cursor-pointer text-sm text-foreground">
          Or ask an AI you already use
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Copy this prompt, paste it into that AI, then paste its answer in the box below. This
            site sends nothing anywhere.
          </p>
          <button
            type="button"
            onClick={() => handleCopy(prompt, 'ai-questions-prompt')}
            className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
          >
            {copiedKey === 'ai-questions-prompt' ? 'Copied' : 'Copy the prompt'}
          </button>
        </div>
      </details>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="ai-answer" className="block text-sm text-muted-foreground">
            Your list of likely questions
          </label>
        </div>
        <textarea
          id="ai-answer"
          value={packet.aiQuestions ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setData((latest) => updatePacket(latest, packet.id, { aiQuestions: value }));
          }}
          placeholder="One question to a line..."
          rows={6}
          className="w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Saved as written. Nothing scores it. The rehearsal room lists each question in it and asks
          only the ones you tick.
        </p>
      </div>
    </div>
  );
}
