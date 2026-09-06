import * as React from 'react';
import { cn } from '../lib/utils';
import ConversationIngredients from './networking/ConversationIngredients';
import IntroDraft from './networking/IntroDraft';
import NetworkingHeader from './networking/NetworkingHeader';
import PracticeTimer from './networking/PracticeTimer';
import QuestionPrompts from './networking/QuestionPrompts';
import RapportWarmups from './networking/RapportWarmups';
import RatingsPanel from './networking/RatingsPanel';
import ReflectionPanel from './networking/ReflectionPanel';
import SavedIntros from './networking/SavedIntros';
import ScenarioBlueprint from './networking/ScenarioBlueprint';
import ScenarioEditor from './networking/ScenarioEditor';
import ScenarioPicker from './networking/ScenarioPicker';
import SessionHistory from './networking/SessionHistory';
import { useNetworkingPractice } from './networking/useNetworkingPractice';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type NetworkingPracticeProps = {
  showHeader?: boolean;
  className?: string;
};

function Disclosure({
  id,
  title,
  hint,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  React.useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  return (
    <section className="rounded-3xl border border-border/40 bg-overlay/20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-4 rounded-3xl px-5 py-4 text-left transition hover:bg-overlay/30 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foam"
      >
        <span>
          <span className="block text-base font-semibold text-foreground">{title}</span>
          <span className="block text-sm text-muted-foreground">{hint}</span>
        </span>
        <svg
          aria-hidden="true"
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div id={id} hidden={!open} className="space-y-6 px-5 pb-6">
        {children}
      </div>
    </section>
  );
}

export default function NetworkingPractice({
  showHeader = true,
  className,
}: NetworkingPracticeProps) {
  const state = useNetworkingPractice();
  // Reference material opens by default on wide screens and stays folded on
  // phones, where the draft box and timer need to come first.
  const [wide, setWide] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const containerClasses = cn('text-foreground', showHeader && 'min-h-screen', className);
  const innerClasses = cn(
    'mx-auto w-full max-w-6xl px-4 pb-20',
    showHeader ? 'pt-12 space-y-8' : 'pt-6 space-y-6'
  );

  return (
    <div className={containerClasses}>
      <div className={innerClasses}>
        <NetworkingHeader showHeader={showHeader} />

        <div aria-live="polite" aria-atomic="true">
          {state.storageNotice ? (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
              {state.storageNotice}
            </div>
          ) : null}
        </div>

        {/* 1. Pick the situation */}
        <section className="rounded-3xl bg-overlay/30 p-4 sm:p-6">
          <ScenarioPicker
            scenarios={state.scenarios}
            currentScenario={state.currentScenario}
            onScenarioChange={state.handleScenarioChange}
          />
        </section>

        {/* 2. The practice: draft first, timer beside it */}
        <section className="grid gap-6 md:grid-cols-[1fr_minmax(0,320px)]">
          <IntroDraft draft={state.draft} onDraftChange={state.setDraft} />
          <PracticeTimer
            timer={state.timer}
            onStart={state.startTimer}
            onPause={state.pauseTimer}
            onReset={state.resetTimer}
            onLengthChange={state.setTimerLength}
          />
        </section>

        {/* 3. Reference material, folded on phones */}
        <Disclosure
          id="networking-help"
          title="Help me write it"
          hint="The scenario's shape, honest lines that work with zero experience, warm-ups, and questions to ask."
          defaultOpen={wide}
        >
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
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
          </div>
        </Disclosure>

        {/* 4. Customize the scenario or keep more than one intro */}
        <Disclosure
          id="networking-customize"
          title="Customize this scenario"
          hint="Change who you are talking to, where, and what you are asking, or keep a second take of your intro."
          defaultOpen={false}
        >
          <ScenarioEditor
            currentVersion={state.currentVersion}
            onFieldChange={state.handleFieldChange}
          />
          <SavedIntros
            versions={state.versions}
            currentVersionId={state.currentVersionId}
            currentVersion={state.currentVersion}
            onVersionSelect={state.setCurrentVersionId}
            onCreateNewVersion={state.createNewVersion}
            onDeleteCurrentVersion={state.deleteCurrentVersion}
            onFieldChange={state.handleFieldChange}
          />
        </Disclosure>

        {/* 5. Rate and keep the rep */}
        <section>
          <Card className="border-border/60 bg-overlay/30">
            <CardHeader>
              <CardTitle className="text-iris">Rate this rep</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Score it honestly after you say it out loud. Green means 4 or higher, and that is
                the target. The next step tracks your lowest score.
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
                ratingsTouched={state.ratingsTouched}
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
