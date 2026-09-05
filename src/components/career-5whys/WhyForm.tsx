import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { condenseAnswer, getAnswerNudge, type TrackExample } from './shared';

type WhyFormProps = {
  responses: string[];
  sequentialCount: number;
  prompts: readonly string[];
  example: TrackExample;
  exampleOpen: Record<number, boolean>;
  onResponseChange: (index: number, value: string) => void;
  onToggleExample: (index: number) => void;
};

export default function WhyForm({
  responses,
  sequentialCount,
  prompts,
  example,
  exampleOpen,
  onResponseChange,
  onToggleExample,
}: WhyFormProps) {
  return (
    <>
      {responses.map((response, index) => {
        const prompt = prompts[index];
        const isExampleVisible = exampleOpen[index];
        const locked = index > sequentialCount;
        const previousAnswer = index > 0 ? (responses[index - 1] ?? '') : '';
        const nudge = locked ? null : getAnswerNudge(response, previousAnswer);
        const exampleAnswer = example.answers[index] ?? '';
        const examplePrevious = index > 0 ? condenseAnswer(example.answers[index - 1] ?? '') : '';
        return (
          <Card
            key={index}
            className="bg-card/98 border-border/55 text-foreground shadow-inner shadow-background/16"
          >
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Depth {index + 1}
                </p>
                <CardTitle className="text-lg text-foreground">{prompt}</CardTitle>
              </div>
              <span className="rounded-full border border-border/50 px-4 py-1 text-xs text-muted-foreground">
                {response.trim().length ? 'Captured' : 'Pending'}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                aria-label={`Depth ${index + 1} response`}
                value={response}
                onChange={(event) => onResponseChange(index, event.target.value)}
                placeholder="Document your reasoning. Be specific and concrete."
                disabled={locked}
                className="min-h-[120px] resize-none border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2 disabled:opacity-60"
              />
              {locked && (
                <p className="text-xs text-muted-foreground">
                  Complete the previous depth before continuing.
                </p>
              )}
              {nudge && <p className="text-xs leading-relaxed text-gold">{nudge}</p>}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleExample(index)}
                aria-expanded={isExampleVisible}
                className="w-full justify-between rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              >
                Show a worked example
                <span aria-hidden>{isExampleVisible ? '−' : '+'}</span>
              </Button>
              {isExampleVisible && (
                <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {example.persona}
                  </p>
                  {index > 0 && examplePrevious && (
                    <p className="text-xs text-muted-foreground">
                      Their depth {index} answer, condensed: "{examplePrevious}"
                    </p>
                  )}
                  <p className="leading-relaxed">{exampleAnswer}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
