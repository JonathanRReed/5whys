import QuickStartTiles from '../QuickStartTiles';

type Props = {
  showHeader?: boolean;
};

export default function ResumeHeader({ showHeader = true }: Props) {
  if (!showHeader) return null;
  return (
    <header className="space-y-4 text-center">
      <p className="eyebrow justify-self-center" style={{ color: 'hsl(var(--gold))' }}>
        Prove your impact
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">Resume Game</h1>
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
        Score every line for what you did, what the work was, what happened because of it, and a
        number if you have a true one. Rewrite the weak ones and watch the score move.
      </p>
      <QuickStartTiles
        className="max-w-4xl"
        items={[
          {
            title: 'Drop your draft',
            body: 'Paste bullets or upload a .txt, .md, .docx, or .pdf file. Use the sample resume if you need a quick demo.',
          },
          {
            title: 'Run the analysis',
            body: 'Scoring runs in your browser. Every line gets one score out of 100, with its four parts shown.',
          },
          {
            title: 'Download the review',
            body: 'A Word or Markdown file of each line, its score, and your rewrites. It is a review, not a resume.',
          },
        ]}
      />
    </header>
  );
}
