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
        Score every bullet for action, evidence, and outcome. Rewrite weak lines into specific,
        quantified statements a reader can verify at a glance.
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
            body: 'Scoring runs instantly in your browser. Verbs and numbers get highlighted; every bullet gets a 0-100 score.',
          },
          {
            title: 'Export the wins',
            body: 'Download the improved set as Markdown or DOCX once the scores feel interview-ready.',
          },
        ]}
      />
    </header>
  );
}
