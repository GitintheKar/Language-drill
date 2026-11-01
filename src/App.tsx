import React, { useState } from 'react';
import {
  BookOpen,
  Settings as SettingsIcon,
  Flame,
  RotateCcw,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAppSettings } from './state/useAppSettings';
import { useRassiasDrillSession } from './hooks/useRassiasDrillSession';
import { DrillStage } from './components/DrillStage';
import { VerbLibraryDrawer } from './components/VerbLibraryDrawer';
import { SettingsDrawer } from './components/SettingsDrawer';

export const App: React.FC = () => {
  const {
    settings,
    currentLanguagePack,
    activeVerbIds,
    currentMastery,
    updateSettings,
    unlockNextVerbs,
    syncLanguageMastery,
  } = useAppSettings();

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    isSessionRunning,
    stageStatus,
    currentCard,
    lastEvaluation,
    interimTranscript,
    audioLevel,
    snapVisualPulse,
    beatProgressPercent,
    speechError,
    whisperStatus,
    scoreboard,
    boomerangCount,
    inRepeatLoop,
    startSession,
    pauseSession,
    restartSession,
    advanceToNextCard,
    triggerManualMicListen,
    submitTypedOrSpokenResponse,
    replayATPrompt,
    preloadLocalWhisper,
  } = useRassiasDrillSession(settings, currentMastery, syncLanguageMastery);

  const handleSaveSettingsAndRestart = (updatedSettings: typeof settings) => {
    updateSettings(updatedSettings);
    setIsSettingsOpen(false);
    setTimeout(() => {
      restartSession();
    }, 50);
  };

  const handleSaveVerbsAndRestart = (updatedVerbIds: string[]) => {
    updateSettings({
      activeVerbIdsByLang: {
        ...settings.activeVerbIdsByLang,
        [settings.language]: updatedVerbIds,
      },
    });
    setIsLibraryOpen(false);
    setTimeout(() => {
      restartSession();
    }, 50);
  };

  return (
    <div className="app-container min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="navbar sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="app-logo flex-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight leading-none text-foreground">
              RASSIAS DRILL
            </h1>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
              {currentLanguagePack.name} Oral Reflex Trainer
            </span>
          </div>
        </div>

        {/* Score & Streak Chips */}
        <div className="flex items-center gap-2">
          <div className="badge badge-streak flex items-center gap-1 text-xs py-1 px-2.5 shadow-sm font-bold">
            <Flame className="w-3.5 h-3.5 fill-current text-amber-500" />
            <span>{scoreboard.currentStreak} Streak</span>
          </div>

          {boomerangCount > 0 && (
            <div
              className="badge badge-boomerang hidden sm:flex items-center gap-1 text-xs py-1 px-2.5 font-bold"
              title="Cards waiting to boomerang back"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{boomerangCount} queued</span>
            </div>
          )}

          {/* Verb Library trigger */}
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="btn btn-subtle text-xs py-1.5 px-2.5 flex items-center gap-1.5"
            title="Open Verb Library"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="hidden md:inline font-semibold">
              Verbs ({activeVerbIds.length})
            </span>
          </button>

          {/* Settings trigger */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="btn btn-subtle text-xs p-2 rounded-lg"
            title="Drill Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout (Pixel 10 single-column / Pixel Tablet 2-column) */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Interactive Rassias Drill Stage */}
        <section className="lg:col-span-8 flex flex-col gap-3">
          <DrillStage
            card={currentCard}
            status={stageStatus}
            isSessionRunning={isSessionRunning}
            lastEvaluation={lastEvaluation}
            interimTranscript={interimTranscript}
            audioLevel={audioLevel}
            snapVisualPulse={snapVisualPulse}
            beatProgressPercent={beatProgressPercent}
            speechError={speechError}
            inRepeatLoop={inRepeatLoop}
            handsFreeMode={settings.handsFreeMode}
            beatTimerSeconds={settings.beatTimerSeconds}
            hideWrittenPromptUntilSnap={settings.hideWrittenPromptUntilSnap}
            onStart={startSession}
            onPause={pauseSession}
            onAdvance={advanceToNextCard}
            onTriggerMic={triggerManualMicListen}
            onReplayPrompt={replayATPrompt}
            onSubmitTypedResponse={submitTypedOrSpokenResponse}
          />
        </section>

        {/* Right Column: Tablet Split-View / Quick Active Curriculum & Mastery Panel */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* Quick Unlock Card */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Active Verbs ({activeVerbIds.length})
                </h3>
                <p className="text-xs text-muted">
                  Tiers 1–5 progression queue
                </p>
              </div>
              <button
                type="button"
                onClick={() => unlockNextVerbs(3)}
                className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> +3 Verbs
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentLanguagePack.verbs
                .filter((v) => activeVerbIds.includes(v.id))
                .map((v) => (
                  <span
                    key={v.id}
                    className="badge badge-subtle py-1 px-2 text-xs font-semibold cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => setIsLibraryOpen(true)}
                  >
                    {v.infinitive}
                  </span>
                ))}
            </div>
          </div>

          {/* Session Scorecard */}
          <div className="card p-4 space-y-2.5">
            <h3 className="font-bold text-sm text-foreground">
              Session Scorecard
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-surface-raised border border-border/50">
                <span className="text-muted block text-[10px] uppercase font-bold">
                  Total Reps
                </span>
                <span className="text-lg font-black text-foreground">
                  {scoreboard.totalReps}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-raised border border-border/50">
                <span className="text-muted block text-[10px] uppercase font-bold">
                  First-Try Accuracy
                </span>
                <span className="text-lg font-black text-success">
                  {scoreboard.totalReps > 0
                    ? `${Math.round(
                        (scoreboard.correctFirstTry / scoreboard.totalReps) * 100
                      )}%`
                    : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-raised border border-border/50">
                <span className="text-muted block text-[10px] uppercase font-bold">
                  Best Streak
                </span>
                <span className="text-lg font-black text-amber-500">
                  {scoreboard.bestStreak}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-surface-raised border border-border/50">
                <span className="text-muted block text-[10px] uppercase font-bold">
                  Boomerangs Done
                </span>
                <span className="text-lg font-black text-primary">
                  {scoreboard.boomerangsCleared}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Drawers */}
      <VerbLibraryDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        language={settings.language}
        allVerbs={currentLanguagePack.verbs}
        activeVerbIds={activeVerbIds}
        masteryMap={currentMastery}
        onSaveAndRestart={handleSaveVerbsAndRestart}
      />

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        tenses={currentLanguagePack.tenses}
        whisperStatus={whisperStatus}
        onSaveAndRestart={handleSaveSettingsAndRestart}
        onPreloadWhisper={preloadLocalWhisper}
      />
    </div>
  );
};
