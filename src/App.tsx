import React, { useCallback, useMemo, useState } from 'react';
import {
  BookOpen,
  Settings as SettingsIcon,
  Flame,
  RotateCcw,
  Plus,
  Sparkles,
  Map,
  Zap,
  CheckCircle2,
  Award,
  Layers,
} from 'lucide-react';
import { generateCompanionLesson } from './companion/aiLessonGenerator';
import {
  CompanionLesson,
  CompanionLessonVariant,
} from './companion/lessonTypes';
import { CompanionLessonModal } from './components/CompanionLessonModal';
import { CourseRoadmapDrawer } from './components/CourseRoadmapDrawer';
import { DrillStage } from './components/DrillStage';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SubModuleScorecardModal } from './components/SubModuleScorecardModal';
import { VerbLibraryDrawer } from './components/VerbLibraryDrawer';
import { SubModuleCheckReport } from './engine/drillDirector';
import {
  resolveAllSubModulePools,
  resolveSubModulePool,
} from './engine/roadmapResolver';
import { useRassiasDrillSession } from './hooks/useRassiasDrillSession';
import { useAppSettings } from './state/useAppSettings';

export const App: React.FC = () => {
  const {
    settings,
    currentLanguagePack,
    activeVerbIds,
    activeSubModuleId,
    currentMastery,
    currentPairMastery,
    currentSubModuleProgress,
    currentStragglers,
    updateSettings,
    selectSubModule,
    recordSubModuleCheckResult,
    unlockNextVerbs,
    syncLanguageMastery,
  } = useAppSettings();

  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Companion Lesson Modal State
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<CompanionLesson | null>(null);
  const [isLessonLoading, setIsLessonLoading] = useState(false);
  const [encoreCounter, setEncoreCounter] = useState(0);

  // Sub-Module Check Scorecard Modal State
  const [completedCheckReport, setCompletedCheckReport] =
    useState<SubModuleCheckReport | null>(null);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);

  const allSubModulePools = useMemo(
    () => resolveAllSubModulePools(settings.language),
    [settings.language]
  );

  const activeSubModulePool = useMemo(
    () => resolveSubModulePool(settings.language, activeSubModuleId),
    [settings.language, activeSubModuleId]
  );

  const nextSubModulePool = useMemo(() => {
    const nextIdx = activeSubModulePool.index + 1;
    return nextIdx < allSubModulePools.length
      ? allSubModulePools[nextIdx]
      : null;
  }, [activeSubModulePool.index, allSubModulePools]);

  const activeProgress = currentSubModuleProgress[activeSubModulePool.subModule.id];
  const passesCompleted = activeProgress?.passesCompleted ?? 0;
  const requiredPasses = activeSubModulePool.requiredPasses;
  const isGraduated = Boolean(
    activeProgress?.graduated || passesCompleted >= requiredPasses
  );

  const handleSubModuleCheckComplete = useCallback(
    (report: SubModuleCheckReport) => {
      recordSubModuleCheckResult(settings.language, report);
      setCompletedCheckReport(report);
      setIsScorecardOpen(true);
    },
    [recordSubModuleCheckResult, settings.language]
  );

  const {
    isSessionRunning,
    stageStatus,
    currentCard,
    lastEvaluation,
    checkReport,
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
    startGradedSubModuleCheck,
    clearGradedSubModuleCheck,
    advanceToNextCard,
    triggerManualMicListen,
    submitTypedOrSpokenResponse,
    replayATPrompt,
    preloadLocalWhisper,
  } = useRassiasDrillSession(
    settings,
    currentMastery,
    syncLanguageMastery,
    currentPairMastery,
    currentStragglers,
    handleSubModuleCheckComplete
  );

  const openCompanionLessonForSubModule = useCallback(
    async (
      subModuleId: string,
      variant: CompanionLessonVariant = 'baseline',
      options?: {
        freshRemix?: boolean;
        report?: SubModuleCheckReport;
      }
    ) => {
      pauseSession();
      setIsLessonModalOpen(true);
      setIsLessonLoading(true);

      const nextEncoreIdx = options?.freshRemix ? encoreCounter + 1 : encoreCounter;
      if (options?.freshRemix) {
        setEncoreCounter(nextEncoreIdx);
      }

      try {
        const lesson = await generateCompanionLesson({
          language: settings.language,
          subModuleId,
          variant,
          encoreIndex: nextEncoreIdx,
          missedForms: options?.report?.missedForms ?? completedCheckReport?.missedForms ?? [],
          missedChunks: options?.report?.missedChunks ?? completedCheckReport?.missedChunks ?? [],
          byokConfig: settings.byokConfig,
          bypassCache: Boolean(options?.freshRemix),
        });
        setActiveLesson(lesson);
      } finally {
        setIsLessonLoading(false);
      }
    },
    [
      completedCheckReport?.missedChunks,
      completedCheckReport?.missedForms,
      encoreCounter,
      pauseSession,
      settings.byokConfig,
      settings.language,
    ]
  );

  const handleStartCheckForActiveSubModule = useCallback(() => {
    setIsLessonModalOpen(false);
    setIsScorecardOpen(false);
    startGradedSubModuleCheck(
      activeSubModulePool.subModule.id,
      passesCompleted
    );
  }, [
    activeSubModulePool.subModule.id,
    passesCompleted,
    startGradedSubModuleCheck,
  ]);

  const handleSelectSubModule = useCallback(
    (subModuleId: string) => {
      clearGradedSubModuleCheck();
      selectSubModule(subModuleId);
      setTimeout(() => {
        restartSession();
      }, 50);
    },
    [clearGradedSubModuleCheck, restartSession, selectSubModule]
  );

  const handleAdvanceToNextSubModule = useCallback(() => {
    setIsScorecardOpen(false);
    if (!nextSubModulePool) return;
    const nextId = nextSubModulePool.subModule.id;
    clearGradedSubModuleCheck();
    selectSubModule(nextId);
    openCompanionLessonForSubModule(nextId, 'baseline');
  }, [
    clearGradedSubModuleCheck,
    nextSubModulePool,
    openCompanionLessonForSubModule,
    selectSubModule,
  ]);

  const handleSaveSettingsAndRestart = (updatedSettings: typeof settings) => {
    updateSettings(updatedSettings);
    setIsSettingsOpen(false);
    setTimeout(() => {
      restartSession();
    }, 50);
  };

  const handleSaveVerbsAndRestart = (updatedVerbIds: string[]) => {
    updateSettings({
      courseModeEnabled: false,
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

  const defaultLessonVariant: CompanionLessonVariant =
    passesCompleted === 1 ? 'pass_2_consolidation' : 'baseline';

  return (
    <div className="app-container min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="navbar sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border px-4 py-2.5 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="app-logo flex-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight leading-none text-foreground">
              RASSIAS DRILL
            </h1>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
              {currentLanguagePack.name} ·{' '}
              {settings.courseModeEnabled
                ? `Sub-Module ${activeSubModulePool.displayCode}`
                : 'Free Practice'}
            </span>
          </div>
        </div>

        {/* Score & Navigation Actions */}
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

          {/* Companion Lesson Trigger */}
          <button
            type="button"
            onClick={() =>
              openCompanionLessonForSubModule(
                activeSubModulePool.subModule.id,
                defaultLessonVariant
              )
            }
            className="btn btn-subtle text-xs py-1.5 px-2.5 flex items-center gap-1.5"
            title="Open Companion Lesson & Printable Field Manual"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="hidden md:inline font-semibold">Lesson</span>
          </button>

          {/* Course Roadmap Trigger */}
          <button
            type="button"
            onClick={() => setIsRoadmapOpen(true)}
            className="btn btn-subtle text-xs py-1.5 px-2.5 flex items-center gap-1.5"
            title="Open Progressive Sub-Module Roadmap"
          >
            <Map className="w-4 h-4 text-primary" />
            <span className="hidden md:inline font-semibold">
              Roadmap ({activeSubModulePool.displayCode})
            </span>
          </button>

          {/* Verb Library Trigger */}
          <button
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            className="btn btn-subtle text-xs py-1.5 px-2.5 flex items-center gap-1.5"
            title="Open Verb Library"
          >
            <span className="font-semibold">
              Verbs ({activeVerbIds.length})
            </span>
          </button>

          {/* Settings Trigger */}
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
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start no-print">
        {/* Left Column: Interactive Rassias Drill Stage */}
        <section className="lg:col-span-8 flex flex-col gap-3">
          <DrillStage
            card={currentCard}
            status={stageStatus}
            isSessionRunning={isSessionRunning}
            lastEvaluation={lastEvaluation}
            checkReport={checkReport}
            activeSubModuleLabel={
              settings.courseModeEnabled
                ? `Sub-Module ${activeSubModulePool.displayCode}: ${activeSubModulePool.subModule.title} (Pass ${passesCompleted}/${requiredPasses})`
                : undefined
            }
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
            onStartSubModuleCheck={handleStartCheckForActiveSubModule}
            onOpenCompanionLesson={() =>
              openCompanionLessonForSubModule(
                activeSubModulePool.subModule.id,
                defaultLessonVariant
              )
            }
            onPause={pauseSession}
            onAdvance={advanceToNextCard}
            onTriggerMic={triggerManualMicListen}
            onReplayPrompt={replayATPrompt}
            onSubmitTypedResponse={submitTypedOrSpokenResponse}
          />
        </section>

        {/* Right Column: Active Sub-Module Companion Panel & Scorecard */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          {/* Active Sub-Module Course Card */}
          <div className="card p-4 flex flex-col gap-3 border-primary/30">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="badge badge-primary text-xs font-black">
                    Sub-Module {activeSubModulePool.displayCode}
                  </span>
                  {isGraduated ? (
                    <span className="badge badge-success text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Graduated
                    </span>
                  ) : (
                    <span className="badge badge-warning text-[10px] flex items-center gap-1">
                      <Award className="w-3 h-3" /> Pass {passesCompleted}/{requiredPasses}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-sm text-foreground mt-1">
                  {activeSubModulePool.subModule.title}
                </h3>
                <p className="text-xs text-muted">
                  Phase {activeSubModulePool.subModule.phase}:{' '}
                  {activeSubModulePool.subModule.phaseTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRoadmapOpen(true)}
                className="btn btn-subtle text-xs py-1 px-2.5"
              >
                All ({allSubModulePools.length})
              </button>
            </div>

            {/* Option C Quick Toggle */}
            <div className="p-2.5 rounded-lg bg-surface-raised/50 border border-border/50 flex items-center justify-between gap-2">
              <div className="text-[11px]">
                <span className="font-bold text-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3 text-accent" />
                  Non-Verb Chunks Mode:
                </span>
                <span className="text-muted">
                  {settings.chunkDrillMode === 'two_part'
                    ? '2-Part (5-Snap Warmup + Bare Verbs)'
                    : 'Full Sentence (Speak Verb + Tail)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateSettings({
                    chunkDrillMode:
                      settings.chunkDrillMode === 'two_part'
                        ? 'full_sentence'
                        : 'two_part',
                  })
                }
                className="btn btn-subtle text-[11px] py-1 px-2.5 whitespace-nowrap"
              >
                Switch
              </button>
            </div>

            {/* Sub-Module Primary CTAs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  openCompanionLessonForSubModule(
                    activeSubModulePool.subModule.id,
                    defaultLessonVariant
                  )
                }
                className="btn btn-subtle text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-bold"
              >
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                Lesson Sheet
              </button>
              <button
                type="button"
                onClick={handleStartCheckForActiveSubModule}
                className="btn btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-bold shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                15-Snap Check
              </button>
            </div>
          </div>

          {/* Quick Unlock / Active Verbs Card */}
          <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Active Verbs ({activeVerbIds.length})
                </h3>
                <p className="text-xs text-muted">
                  {settings.courseModeEnabled
                    ? `70% Focus (${activeSubModulePool.focusVerbIds.length}) · 30% Review (${activeSubModulePool.reviewVerbIds.length})`
                    : 'Custom free-practice selection'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => unlockNextVerbs(3)}
                className="btn btn-subtle text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> +3 Verbs
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentLanguagePack.verbs
                .filter((v) => activeVerbIds.includes(v.id))
                .map((v) => {
                  const isFocus = activeSubModulePool.focusVerbIds.includes(v.id);
                  return (
                    <span
                      key={v.id}
                      className={`badge py-1 px-2 text-xs font-semibold cursor-pointer ${
                        isFocus && settings.courseModeEnabled
                          ? 'badge-primary'
                          : 'badge-subtle'
                      }`}
                      onClick={() => setIsLibraryOpen(true)}
                    >
                      {v.infinitive}
                    </span>
                  );
                })}
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
                  Stragglers Queued
                </span>
                <span className="text-lg font-black text-primary">
                  {currentStragglers.length}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Course Roadmap Drawer */}
      <CourseRoadmapDrawer
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
        language={settings.language}
        activeSubModuleId={activeSubModulePool.subModule.id}
        courseModeEnabled={settings.courseModeEnabled}
        chunkDrillMode={settings.chunkDrillMode}
        pairMasteryMap={currentPairMastery}
        subModuleProgressMap={currentSubModuleProgress}
        onToggleCourseMode={(enabled) =>
          updateSettings({ courseModeEnabled: enabled })
        }
        onChangeChunkDrillMode={(mode) =>
          updateSettings({ chunkDrillMode: mode })
        }
        onSelectSubModule={handleSelectSubModule}
        onOpenCompanionLesson={(subModuleId) => {
          setIsRoadmapOpen(false);
          selectSubModule(subModuleId);
          openCompanionLessonForSubModule(subModuleId, 'baseline');
        }}
      />

      {/* Companion Lesson & Printable Field Manual Modal */}
      <CompanionLessonModal
        isOpen={isLessonModalOpen}
        lesson={activeLesson}
        isLoading={isLessonLoading}
        locale={settings.locales[settings.language]}
        passesCompleted={passesCompleted}
        requiredPasses={requiredPasses}
        onClose={() => setIsLessonModalOpen(false)}
        onSwitchVariant={(variant, freshRemix) =>
          openCompanionLessonForSubModule(
            activeSubModulePool.subModule.id,
            variant,
            { freshRemix }
          )
        }
        onStartSubModuleCheck={handleStartCheckForActiveSubModule}
      />

      {/* Post-Check 2-Pass Gate & Encore Modal */}
      <SubModuleScorecardModal
        isOpen={isScorecardOpen}
        report={completedCheckReport}
        subModuleTitle={activeSubModulePool.subModule.title}
        displayCode={activeSubModulePool.displayCode}
        hasNextSubModule={Boolean(nextSubModulePool)}
        nextSubModuleLabel={
          nextSubModulePool
            ? `Sub-Module ${nextSubModulePool.displayCode}: ${nextSubModulePool.subModule.title}`
            : undefined
        }
        onClose={() => setIsScorecardOpen(false)}
        onRetryCheck={handleStartCheckForActiveSubModule}
        onOpenEncoreLesson={(report) => {
          setIsScorecardOpen(false);
          openCompanionLessonForSubModule(
            report.subModuleId,
            'encore_remedial',
            { freshRemix: true, report }
          );
        }}
        onOpenConsolidationLesson={(report) => {
          setIsScorecardOpen(false);
          openCompanionLessonForSubModule(
            report.subModuleId,
            'pass_2_consolidation',
            { report }
          );
        }}
        onAdvanceToNextSubModule={handleAdvanceToNextSubModule}
      />

      {/* Verb Library & Settings Drawers */}
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
