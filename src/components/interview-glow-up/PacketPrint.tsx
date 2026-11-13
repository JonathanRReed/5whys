import { getSkillName, resolveQuestionText } from '../../lib/glowup-banks';
import type { DecodedRole, InterviewPacket, Story } from '../../lib/glowup-store';
import { isRealAnswer } from '../../lib/non-answer';
import PrintSheet from '../shared/PrintSheet';

type Props = {
  packet: InterviewPacket;
  stories: Story[];
  role: DecodedRole | undefined;
  /** Which screen asked: the packet tab, or the open cheat sheet. */
  from: 'packet' | 'cheat-sheet';
  onDone: () => void;
  /** False when the browser's own print dialog is already open (Ctrl+P). */
  autoPrint?: boolean;
};

/** "Community Programs Intern at City Parks", without a stray colon or "at". */
export function roleHeading(role: DecodedRole | undefined): string {
  if (!role) return 'Interview';
  return [role.jobTitle.trim() || 'Untitled role', role.company.trim()]
    .filter(Boolean)
    .join(' at ');
}

/**
 * The packet as a plain sheet to bring to the interview: the role, every
 * chosen story with its parts written out, the keywords, and the questions to
 * ask. No form boxes, page help, or guide bar.
 */
export default function PacketPrint({
  packet,
  stories,
  role,
  from,
  onDone,
  autoPrint = true,
}: Props) {
  const chosen = packet.topStoryIds
    .map((id) => stories.find((story) => story.id === id))
    .filter((story): story is Story => Boolean(story));
  const keywords = (packet.companyIntel?.keywords ?? []).filter(Boolean);
  const questions = packet.customQuestions.filter(Boolean);

  return (
    <PrintSheet onDone={onDone} autoPrint={autoPrint}>
      <div data-testid="packet-print">
        <h1>{roleHeading(role)}</h1>
        <p>
          {from === 'cheat-sheet'
            ? 'One-screen cheat sheet (HUD)'
            : 'What you bring to the interview (packet)'}
        </p>
        {keywords.length > 0 && (
          <>
            <h2>Keywords</h2>
            <p>{keywords.join(', ')}</p>
          </>
        )}
        <h2>Stories</h2>
        {chosen.length === 0 ? (
          <p>No stories in the packet yet.</p>
        ) : (
          chosen.map((story) => (
            <section key={story.id} style={{ marginTop: '8pt' }}>
              <h3
                style={{
                  margin: '0 0 2pt',
                  fontFamily: 'inherit',
                  fontSize: '12pt',
                  fontWeight: 700,
                }}
              >
                {story.trigger.trim() || 'Untitled'} ({getSkillName(story.primarySkillId)})
              </h3>
              {story.hook.trim() && (
                <p>
                  <strong>The situation:</strong> {story.hook}
                </p>
              )}
              <p>
                <strong>What I did:</strong>{' '}
                {isRealAnswer(story.play) ? story.play : 'Not written yet.'}
              </p>
              {(story.proof.trim() || story.proofSnippet.trim()) && (
                <p>
                  <strong>What came of it:</strong> {story.proof.trim() || story.proofSnippet}
                </p>
              )}
              {story.questionPrompts.length > 0 && (
                <>
                  <p>
                    <strong>Questions it answers:</strong>
                  </p>
                  <ul>
                    {story.questionPrompts.map((question) => (
                      <li key={question}>{resolveQuestionText(question)}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))
        )}
        {questions.length > 0 && (
          <>
            <h2>Questions to ask them</h2>
            <ul>
              {questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </>
        )}
        {packet.panicAnswer?.trim() && (
          <>
            <h2>Fallback story</h2>
            <p>{packet.panicAnswer}</p>
          </>
        )}
        {packet.notes?.trim() && (
          <>
            <h2>Notes</h2>
            <p>{packet.notes}</p>
          </>
        )}
      </div>
    </PrintSheet>
  );
}
