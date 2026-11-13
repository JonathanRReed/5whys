import { useId } from 'react';
import type { FollowUpWhyInput } from '../../lib/local-ai';
import {
  isNonAnswer,
  isRealAnswer,
  MIN_ANSWER_WORDS,
  NON_ANSWER_FOLLOW_UP,
} from '../../lib/non-answer';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import SharperWhy from './SharperWhy';
import { condenseAnswer, getAnswerNudge, type TrackExample, WHY_COUNT } from './shared';

type WhyFormProps = {
  responses: string[];
  sequentialCount: number;
  prompts: readonly string[];
  example: TrackExample;
  exampleOpen: Record<number, boolean>;
  onResponseChange: (index: number, value: string) => void;
  onToggleExample: (index: number) => void;
  /** Set only when the browser's own model is ready to write follow-ups. */
  sharper?: Pick<FollowUpWhyInput, 'track' | 'topic'>;
};

export default function WhyForm({
  responses,
  sequentialCount,
  prompts,
  example,
  exampleOpen,
  onResponseChange,
  onToggleExample,
  sharper,
}: WhyFormProps) {
  const exampleIdPrefix = useId();
  return (
    <>
      {responses.map((response, index) => {
        const prompt = prompts[index];
        const isExampleVisible = Boolean(exampleOpen[index]);
        const locked = index > sequentialCount;
        const previousAnswer = index > 0 ? (responses[index - 1] ?? '') : '';
        const nudge = locked ? null : getAnswerNudge(response, previousAnswer);
        const placeholderAnswer = isNonAnswer(response);
        const answered = isRealAnswer(response);
        // The rule is on screen before anyone trips over it. A reply that is
        // only short gets the rule inside its own nudge instead.
        const showRule =
          !locked && !answered && (!response.trim() || nudge === NON_ANSWER_FOLLOW_UP);
        const ruleId = `${exampleIdPrefix}-rule-${index}`;
        const statusLabel = answered
          ? 'Answered'
          : locked
            ? 'Locked'
            : placeholderAnswer
              ? 'Needs more'
              : 'Your turn';
        const exampleAnswer = example.answers[index] ?? '';
        const examplePrevious = index > 0 ? condenseAnswer(example.answers[index - 1] ?? '') : '';
        const exampleId = `${exampleIdPrefix}-example-depth-${index}`;
        return (
          <Card
            key={index}
            className="bg-card/98 border-border/55 text-foreground shadow-inner shadow-background/16"
          >
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Depth {index + 1}
                </p>
                <CardTitle id={`${exampleId}-question`} className="text-lg text-foreground">
                  {prompt}
                </CardTitle>
              </div>
              <span
                className={
                  answered
                    ? 'shrink-0 self-start whitespace-nowrap rounded-full border border-primary/60 bg-primary/15 px-4 py-1 text-xs text-foreground'
                    : 'shrink-0 self-start whitespace-nowrap rounded-full border border-border/50 px-4 py-1 text-xs text-muted-foreground'
                }
              >
                {statusLabel}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                aria-label={`Depth ${index + 1} response`}
                aria-describedby={
                  showRule || locked ? `${exampleId}-question ${ruleId}` : `${exampleId}-question`
                }
                value={response}
                data-answered={answered ? '' : undefined}
                onChange={(event) => onResponseChange(index, event.target.value)}
                placeholder={
                  locked ? '' : 'A sentence or two in your own words. Be specific and concrete.'
                }
                disabled={locked}
                className="min-h-[120px] resize-none border-border/50 bg-overlay/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foam disabled:opacity-60"
              />
              {locked && (
                <p id={ruleId} className="text-sm text-muted-foreground">
                  Answer depth {index} first. This question is built from it.
                </p>
              )}
              {showRule && (
                <p id={ruleId} className="text-sm text-muted-foreground">
                  {MIN_ANSWER_WORDS} words or more counts as an answer
                  {index < WHY_COUNT - 1
                    ? ` and opens depth ${index + 2}.`
                    : ' and finishes the chain.'}
                </p>
              )}
              {nudge && (
                <p
                  className={
                    placeholderAnswer
                      ? 'text-sm leading-relaxed text-foreground'
                      : 'text-sm leading-relaxed text-muted-foreground'
                  }
                >
                  {nudge}
                </p>
              )}
              {sharper &&
                !locked &&
                index > 0 &&
                isRealAnswer(previousAnswer) &&
                !response.trim() && (
                  <SharperWhy
                    track={sharper.track}
                    topic={sharper.topic}
                    answers={responses.slice(0, index)}
                  />
                )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => onToggleExample(index)}
                data-guide={`why-example-${index}`}
                aria-expanded={isExampleVisible}
                aria-controls={exampleId}
                className="h-auto min-h-9 w-full justify-between gap-3 rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-left text-sm font-medium whitespace-normal text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2"
              >
                <span>
                  {isExampleVisible ? 'Hide worked example' : 'Show a worked example'}{' '}
                  <span className="sr-only">for depth {index + 1}</span>
                </span>
                <span aria-hidden>{isExampleVisible ? '−' : '+'}</span>
              </Button>
              <div
                id={exampleId}
                hidden={!isExampleVisible}
                className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
              >
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
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
