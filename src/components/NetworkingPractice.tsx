import { cn } from '../lib/utils';
import ConversationIngredients from './networking/ConversationIngredients';
import IntroDraft from './networking/IntroDraft';
import NetworkingHeader from './networking/NetworkingHeader';
import PracticeTimer from './networking/PracticeTimer';
import QuestionPrompts from './networking/QuestionPrompts';
import RapportWarmups from './networking/RapportWarmups';
import RatingsPanel from './networking/RatingsPanel';
import ReflectionPanel from './networking/ReflectionPanel';
import ScenarioBlueprint from './networking/ScenarioBlueprint';
import ScenarioEditor from './networking/ScenarioEditor';
import ScenarioSelector from './networking/ScenarioSelector';
import SessionHistory from './networking/SessionHistory';
import { useNetworkingPractice } from './networking/useNetworkingPractice';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export type { Scenario } from './networking/useNetworkingPractice';

type NetworkingPracticeProps = {
  showHeader?: boolean;
  className?: string;
};

export default function NetworkingPractice({
  showHeader = true,
  className,
}: NetworkingPracticeProps) {
  const state = useNetworkingPractice();

  const containerClasses = cn('text-foreground', showHeader && 'min-h-screen', className);
  const innerClasses = cn(
    'mx-auto w-full max-w-6xl px-4 pb-20',
    showHeader ? 'pt-12 space-y-10' : 'pt-6 space-y-8'
  );

  return (
    <div className={containerClasses}>
      <div className={innerClasses}>
        <NetworkingHeader showHeader={showHeader} />

        <section className="w-full grid gap-6 p-4 mb-10 rounded-3xl bg-overlay/30 shadow-xl sm:p-6 overflow-hidden">
          {state.storageNotice ? (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
              {state.storageNotice}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-[minmax(0,200px)_1fr]">
            <ScenarioSelector
              scenarios={state.scenarios}
              versions={state.versions}
              currentVersionId={state.currentVersionId}
              currentVersion={state.currentVersion}
              onScenarioChange={state.handleScenarioChange}
              onVersionSelect={state.setCurrentVersionId}
              onCreateNewVersion={state.createNewVersion}
              onDeleteCurrentVersion={state.deleteCurrentVersion}
              onFieldChange={state.handleFieldChange}
            />
            <ScenarioEditor
              currentVersion={state.currentVersion}
              onFieldChange={state.handleFieldChange}
            />
          </div>
        </section>

        <section className="grid gap-6 mb-10 lg:grid-cols-[1.1fr_0.9fr]">
          <ScenarioBlueprint
            currentScenario={state.currentScenario}
            scenarioSteps={state.scenarioSteps}
            timer={state.timer}
          />
          <ConversationIngredients
            currentScenario={state.currentScenario}
            onCopy={state.handleCopy}
            copiedKey={state.copiedKey}
          />
        </section>
        <section className="grid gap-6 mb-10 lg:grid-cols-2">
          <RapportWarmups
            rapportSamples={state.rapportSamples}
            scenarioId={state.currentScenario?.id}
            onCopy={state.handleCopy}
            copiedKey={state.copiedKey}
          />
          <QuestionPrompts
            questionTemplates={state.questionTemplates}
            scenarioId={state.currentScenario?.id}
            onCopy={state.handleCopy}
            copiedKey={state.copiedKey}
          />
        </section>

        <section className="w-full grid gap-6 mb-10 md:grid-cols-[minmax(0,320px)_1fr]">
          <PracticeTimer
            timer={state.timer}
            onStart={state.startTimer}
            onPause={state.pauseTimer}
            onReset={state.resetTimer}
          />
          <IntroDraft draft={state.draft} onDraftChange={state.setDraft} />
        </section>

        <section className="w-full mb-10">
          <Card className="border-border/60 bg-overlay/30">
            <CardHeader>
              <CardTitle className="text-iris">Self-Review</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Score the rep honestly. Green means 4 or higher, and that is the target. The next
                step below tracks your lowest score.
              </p>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <RatingsPanel ratings={state.ratings} onRatingChange={state.handleRatingChange} />
              <ReflectionPanel
                reflection={state.reflection}
                onReflectionField={state.handleReflectionField}
                onSaveSession={state.saveCurrentSession}
                onResetReview={state.handleResetReview}
                sessionsAtCapacity={state.sessionsAtCapacity}
                draftEmpty={state.draft.trim().length === 0}
              />
            </CardContent>
          </Card>
        </section>

        <SessionHistory
          sessions={state.sessions}
          onExport={state.exportSessions}
          onClearHistory={state.clearSessionHistory}
          onRemoveSession={state.removeSession}
        />
      </div>
    </div>
  );
}
