import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';
import { useNetworkingPractice } from './networking/useNetworkingPractice';
import NetworkingHeader from './networking/NetworkingHeader';
import ScenarioSelector from './networking/ScenarioSelector';
import ScenarioEditor from './networking/ScenarioEditor';
import ScenarioBlueprint from './networking/ScenarioBlueprint';
import ConversationIngredients from './networking/ConversationIngredients';
import RapportWarmups from './networking/RapportWarmups';
import QuestionPrompts from './networking/QuestionPrompts';
import PracticeTimer from './networking/PracticeTimer';
import RatingsPanel from './networking/RatingsPanel';
import ReflectionPanel from './networking/ReflectionPanel';
import SessionHistory from './networking/SessionHistory';

export type { Scenario } from './networking/useNetworkingPractice';

type NetworkingPracticeProps = {
  showHeader?: boolean;
  className?: string;
};

export default function NetworkingPractice({ showHeader = true, className }: NetworkingPracticeProps) {
  const state = useNetworkingPractice();

  const containerClasses = cn('text-[hsl(var(--foreground))]', showHeader && 'min-h-screen', className);
  const innerClasses = cn(
    'mx-auto w-full max-w-6xl px-4 pb-20',
    showHeader ? 'pt-12 space-y-10' : 'pt-6 space-y-8'
  );

  return (
    <div className={containerClasses}>
      <div className={innerClasses}>
        <NetworkingHeader showHeader={showHeader} />

        <section className="w-full grid gap-6 p-4 mb-10 rounded-3xl bg-[hsl(var(--overlay)/0.3)] shadow-xl sm:p-6 overflow-hidden">
          {state.storageNotice ? (
            <div className="rounded-2xl border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.1)] px-4 py-3 text-sm text-[hsl(var(--gold))]">
              {state.storageNotice}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-[minmax(0,_200px)_1fr]">
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
            <ScenarioEditor currentVersion={state.currentVersion} onFieldChange={state.handleFieldChange} />
          </div>
        </section>

        {state.currentScenario && (
          <>
            <section className="grid gap-6 mb-10 lg:grid-cols-[1.1fr,0.9fr]">
              <ScenarioBlueprint currentScenario={state.currentScenario} scenarioSteps={state.scenarioSteps} />
              <ConversationIngredients
                currentScenario={state.currentScenario}
                onCopy={state.handleCopy}
                copiedKey={state.copiedKey}
              />
            </section>
            <section className="grid gap-6 mb-10 lg:grid-cols-2">
              <RapportWarmups
                rapportSamples={state.rapportSamples}
                scenarioId={state.currentScenario.id}
                onCopy={state.handleCopy}
                copiedKey={state.copiedKey}
              />
              <QuestionPrompts
                questionTemplates={state.questionTemplates}
                scenarioId={state.currentScenario.id}
                onCopy={state.handleCopy}
                copiedKey={state.copiedKey}
              />
            </section>
          </>
        )}

        <section className="w-full grid gap-6 mb-10 md:grid-cols-[minmax(0,_320px)_1fr]">
          <PracticeTimer timer={state.timer} onStart={state.startTimer} onPause={state.pauseTimer} onReset={state.resetTimer} />
          <Card className="border-[hsl(var(--border)/0.6)] bg-[hsl(var(--overlay)/0.3)]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--iris))]">Self-Review</CardTitle>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Slide to score this round. Target green across the board.
              </p>
            </CardHeader>
            <CardContent className="grid gap-6">
              <RatingsPanel ratings={state.ratings} onRatingChange={state.handleRatingChange} />
              <ReflectionPanel
                reflection={state.reflection}
                onReflectionChange={state.setReflection}
                onSaveSession={state.saveCurrentSession}
                onResetReview={state.handleResetReview}
                sessionsAtCapacity={state.sessionsAtCapacity}
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
