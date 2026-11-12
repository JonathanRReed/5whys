import type { BulletRecord } from '../../lib/resume-game';
import { STRONG_SCORE } from '../../lib/resume-game';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
  bullets: BulletRecord[];
  onExportMarkdown: () => void;
  onExportDocx: () => void;
};

const buttonClass =
  'h-auto w-full whitespace-normal rounded-lg border border-border/50 bg-overlay/30 px-4 py-2 text-sm sm:w-auto font-medium text-foreground transition-colors hover:bg-overlay/50 focus-visible:ring-2 focus-visible:ring-foam focus-visible:ring-offset-2';

/**
 * Where the lines stand now, as a count, and the review download. The
 * download is a report about the resume; nothing here calls it a resume.
 */
export default function Scoreboard({ bullets, onExportMarkdown, onExportDocx }: Props) {
  const total = bullets.length;
  const strong = bullets.filter((bullet) => bullet.improvedScore >= STRONG_SCORE).length;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">Download this review</CardTitle>
        <p className="text-sm text-muted-foreground">
          {strong} of {total} {total === 1 ? 'line is' : 'lines are'} strong now, {STRONG_SCORE} or
          more.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The file lists each line, its score and parts, and any rewrite you made. It is a review of
          your resume, not a resume: copy the lines you want into your own document.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={onExportDocx} className={buttonClass}>
            Download this review (Word)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onExportMarkdown}
            className={buttonClass}
          >
            Download this review (Markdown)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
