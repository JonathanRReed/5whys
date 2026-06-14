import QuickStartTiles from '../QuickStartTiles';

type Props = {
  showHeader?: boolean;
};

export default function ResumeHeader({ showHeader = true }: Props) {
  if (!showHeader) return null;
  return (
    <header className="space-y-4 text-center">
      <p className="eyebrow justify-self-center" style={{ color: 'hsl(var(--gold))' }}>Prove your impact</p>
      <h1 className="text-4xl font-semibold tracking-tight">Resume Game</h1>
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
        Simulate an 8-second recruiter scan to surface power verbs and numbers. Rewrite every bullet
        into a quantified, high-impact statement that stands out in a quick glance.
      </p>
      <QuickStartTiles
        className="max-w-4xl"
        items={[
          {
            title: 'Drop your draft',
            body: 'Paste bullets or upload a .txt, .md, .docx, or .pdf file. Use the sample resume if you need a quick demo.',
          },
          {
            title: 'Run the scan',
            body: 'Watch the 8-second pass surface verbs and numbers. Edit fields to experiment with stronger phrasing.',
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
