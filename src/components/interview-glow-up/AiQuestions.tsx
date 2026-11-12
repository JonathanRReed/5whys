import type * as React from 'react';
import {
  type DecodedRole,
  type GlowUpData,
  type InterviewPacket,
  updatePacket,
} from '../../lib/glowup-store';
import { useClipboard } from '../networking/useClipboard';

type Props = {
  data: GlowUpData;
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

export default function AiQuestions({ data, setData, role, packet }: Props) {
  const { copiedKey, handleCopy } = useClipboard();
  const prompt = buildQuestionsPrompt(role);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Questions they will probably ask
      </h4>
      <p className="text-xs text-muted-foreground">
        This prompt is built from the posting you decoded. Paste it into whatever AI you already
        use, then bring the answer back. This site sends nothing anywhere.
      </p>
      <button
        type="button"
        onClick={() => handleCopy(prompt, 'ai-questions-prompt')}
        className="rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
      >
        {copiedKey === 'ai-questions-prompt' ? 'Copied' : 'Copy the prompt'}
      </button>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="ai-answer" className="block text-sm text-muted-foreground">
            The answer it gave you
          </label>
          <span className="rounded-full bg-iris/15 px-2 py-0.5 text-xs text-iris">
            From your AI
          </span>
        </div>
        <textarea
          id="ai-answer"
          value={packet.aiQuestions ?? ''}
          onChange={(e) => setData(updatePacket(data, packet.id, { aiQuestions: e.target.value }))}
          placeholder="Paste the list here..."
          rows={6}
          className="w-full rounded-lg border border-border/50 bg-overlay/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Saved as pasted. The tools never read or score it.
        </p>
      </div>
    </div>
  );
}
