import React from 'react';
import {
  Volume2,
  Mic,
  Flame,
  RotateCcw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Play,
  Square,
  ArrowRight,
  Zap,
  BookOpen,
  Layers,
} from 'lucide-react';
import {
  DrillPromptCard,
  DrillStageStatus,
  RassiasDrillCadence,
  SubModuleCheckReport,
} from '../engine/drillDirector';
import { EvaluationResult } from '../engine/evaluator';
import { NegationType, PolarityMode } from '../languages/types';

function describeDrillCadence(cadence: RassiasDrillCadence = 'substitution'): {
  label: string;
  rule: string;
} {
  switch (cadence) {
    case 'substitution':
      return {
        label: 'Substitution Drill',
        rule: 'Same verb & tense — conjugate for each new person.',
      };
    case 'qa_flip':
      return {
        label: 'Question ↔ Answer Flip',
        rule: "Answer the AT's question (flipping tú/usted ↔ yo, ustedes ↔ nosotros).",
      };
    case 'transformation':
      return {
        label: 'Tense Shift',
        rule: 'Same person — shift the verb across tenses using the time trigger.',
      };
    case 'roulette':
      return {
        label: 'Full Roulette',
        rule: 'Random verb, tense, and person on every snap.',
      };
  }
}

function describePolarityMode(polarity: PolarityMode = 'affirmative'): {
  label: string;
  rule: string;
} {
  switch (polarity) {
    case 'affirmative':
      return {
        label: 'Affirmative Only (+)',
        rule: 'Every response is positive.',
      };
    case 'ping_pong':
      return {
        label: '2-Beat Ping-Pong (+ → −)',
        rule: 'Beat 1: Say it Affirmative (+) → Beat 2: Flip the exact same form to Negative (−).',
      };
    case 'negative':
      return {
        label: 'Negative Only (−)',
        rule: 'Every response is negative.',
      };
    case 'mixed':
      return {
        label: 'Mixed Polarity (+ / −)',
        rule: 'Alternates between Affirmative (+) and Negative (−) — watch the prompt badge.',
      };
  }
}

function formatCenterNegationCue(
  language: 'fr' | 'es',
  negation: NegationType
): { badgeText: string; formulaHint: string } | null {
  if (negation === 'none') return null;

  if (language === 'es') {
    if (negation === 'jamais') {
      return {
        badgeText: '🚫 NEGATIVE (−): Use « nunca » ("never")',
        formulaHint: 'nunca + verb (or no + verb + nunca)',
      };
    }
    if (negation === 'plus') {
      return {
        badgeText: '🚫 NEGATIVE (−): Use « ya no » ("no longer / anymore")',
        formulaHint: 'ya no + verb',
      };
    }
    return {
      badgeText: '🚫 NEGATIVE (−): Use « no » ("not")',
      formulaHint: 'no + conjugated verb',
    };
  }

  if (negation === 'jamais') {
    return {
      badgeText: '🚫 NEGATIVE (−): Use « ne … jamais » ("never")',
      formulaHint: 'subject + ne/n’ + verb + jamais',
    };
  }
  if (negation === 'plus') {
    return {
      badgeText: '🚫 NEGATIVE (−): Use « ne … plus » ("no longer")',
      formulaHint: 'subject + ne/n’ + verb + plus',
    };
  }
  return {
    badgeText: '🚫 NEGATIVE (−): Use « ne … pas » ("not")',
    formulaHint: 'subject + ne/n’ + verb + pas',
  };
}

interface DrillStageProps {
  card: DrillPromptCard | null;
  status: DrillStageStatus;
  isSessionRunning: boolean;
  lastEvaluation: EvaluationResult | null;
  checkReport?: SubModuleCheckReport | null;
  activeSubModuleLabel?: string;
  cadence?: RassiasDrillCadence;
  polarityMode?: PolarityMode;
  interimTranscript: string;
  audioLevel: number;
  snapVisualPulse: boolean;
  beatProgressPercent: number;
  speechError: string | null;
  inRepeatLoop: boolean;
  handsFreeMode: boolean;
  beatTimerSeconds: number;
  hideWrittenPromptUntilSnap: boolean;
  onStart: () => void;
  onStartSubModuleCheck?: () => void;
  onOpenCompanionLesson?: () => void;
  onPause: () => void;
  onAdvance: () => void;
  onTriggerMic: () => void;
  onReplayPrompt: () => void;
  onSubmitTypedResponse: (text: string) => void;
}

export const DrillStage: React.FC<DrillStageProps> = ({
  card,
  status,
  isSessionRunning,
  lastEvaluation,
  checkReport,
  activeSubModuleLabel,
  cadence = 'substitution',
  polarityMode = 'affirmative',
  interimTranscript,
  audioLevel,
  snapVisualPulse,
  beatProgressPercent,
  speechError,
  inRepeatLoop,
  handsFreeMode,
  beatTimerSeconds,
  hideWrittenPromptUntilSnap,
  onStart,
  onStartSubModuleCheck,
  onOpenCompanionLesson,
  onPause,
  onAdvance,
  onTriggerMic,
  onReplayPrompt,
  onSubmitTypedResponse,
}) => {
  const [typedInput, setTypedInput] = React.useState('');

  const cadenceInfo = describeDrillCadence(cadence);
  const polarityInfo = describePolarityMode(polarityMode);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim()) return;
    onSubmitTypedResponse(typedInput.trim());
    setTypedInput('');
  };

  if (!card) {
    return (
      <div className="card-stage empty-stage flex-center flex-col text-center p-8">
        <div className="rassias-emblem mb-4">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
        {activeSubModuleLabel && (
          <span className="badge badge-primary text-xs font-bold mb-2">
            {activeSubModuleLabel}
          </span>
        )}
        <h2 className="text-2xl font-bold mb-2">Dartmouth Rassias Drill</h2>
        <p className="text-muted text-sm max-w-md mb-4">
          High-energy oral verb conjugation training. Review the Companion Lesson, then run a 15-Snap Sub-Module Check or free drill.
        </p>

        {/* Active Drill Mode & Rules Preview Card */}
        <div className="w-full max-w-lg mb-6 p-3.5 rounded-xl bg-surface-raised/60 border border-border/70 text-left space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-muted">
              Active Drill Rules
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="badge badge-primary text-xs font-bold">
                {cadenceInfo.label}
              </span>
              <span className="badge badge-accent text-xs font-bold">
                {polarityInfo.label}
              </span>
            </div>
          </div>
          <p className="text-xs text-foreground">
            <strong>Flow:</strong> {cadenceInfo.rule}
          </p>
          <p className="text-xs text-muted">
            <strong>Polarity:</strong> {polarityInfo.rule}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onOpenCompanionLesson && (
            <button
              type="button"
              onClick={onOpenCompanionLesson}
              className="btn btn-subtle btn-lg flex-center gap-2"
            >
              <BookOpen className="w-5 h-5 text-primary" /> Companion Lesson
            </button>
          )}
          {onStartSubModuleCheck && (
            <button
              type="button"
              onClick={onStartSubModuleCheck}
              className="btn btn-primary btn-lg flex-center gap-2 shadow-md"
            >
              <Zap className="w-5 h-5 fill-current" /> Start 15-Snap Check
            </button>
          )}
          <button
            type="button"
            onClick={onStart}
            className="btn btn-subtle btn-lg flex-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" /> Open Practice
          </button>
        </div>
      </div>
    );
  }

  const isChunkWarmupCard = card.promptKind === 'chunk_warmup';

  // Obscure prompt text if user enabled Ear-First mode until the AT snaps
  const isPromptObscured =
    hideWrittenPromptUntilSnap && status === 'at_speaking_cue';

  const isListening =
    status === 'listening_initial' || status === 'listening_repeat';

  const centerNegationCue = formatCenterNegationCue(card.language, card.negation);

  return (
    <div
      className={`card-stage relative flex flex-col justify-between ${
        snapVisualPulse ? 'snap-pulse-active' : ''
      } ${inRepeatLoop ? 'repeat-border-active' : ''}`}
    >
      {/* Top Status & Cadence Row */}
      <div className="flex flex-col gap-2 pb-3 border-b border-border/40 text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="badge badge-primary font-bold"
              title={cadenceInfo.rule}
            >
              {cadenceInfo.label}
            </span>
            <span
              className="badge badge-accent font-bold"
              title={polarityInfo.rule}
            >
              {polarityInfo.label}
            </span>
            <span className="badge badge-neutral font-semibold">
              {card.tenseName}
            </span>
            {card.isBoomerang && (
              <span className="badge badge-boomerang flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Boomerang Recall
              </span>
            )}
            {card.poolSource === 'focus' && (
              <span className="badge badge-subtle text-[11px]">70% Focus</span>
            )}
            {card.poolSource === 'review' && (
              <span className="badge badge-subtle text-[11px]">30% Review</span>
            )}
            {card.poolSource === 'straggler' && (
              <span className="badge badge-warning text-[11px]">Straggler Recall</span>
            )}
            {card.poolSource === 'chunk_warmup' && (
              <span className="badge badge-accent text-[11px] flex items-center gap-1">
                <Layers className="w-3 h-3" /> Chunk Warmup
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {checkReport && !checkReport.isComplete && (
              <span className="badge badge-warning text-[11px] font-bold">
                {checkReport.chunkSnapsCompleted < checkReport.chunkSnapsTotal
                  ? `Warmup ${checkReport.chunkSnapsCompleted + 1}/${checkReport.chunkSnapsTotal}`
                  : `Check ${Math.min(
                      checkReport.targetVerbSnaps,
                      checkReport.completedVerbSnaps + 1
                    )}/${checkReport.targetVerbSnaps} · Pass ${Math.min(
                      checkReport.requiredPasses,
                      checkReport.previousPasses + 1
                    )}/${checkReport.requiredPasses}`}
              </span>
            )}
            {isSessionRunning ? (
              <button
                onClick={onPause}
                className="btn btn-subtle text-xs py-1 px-2.5 flex items-center gap-1 text-danger"
                title="Pause drill"
              >
                <Square className="w-3 h-3 fill-current" /> Pause
              </button>
            ) : (
              <button
                onClick={onStart}
                className="btn btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" /> Resume
              </button>
            )}
          </div>
        </div>

        {/* One-line active drill rule explanation so the learner always knows what to do */}
        <div className="text-[11px] text-muted flex items-center justify-between flex-wrap gap-1">
          <span>
            <strong>Mode:</strong> {cadenceInfo.rule} · <strong>Polarity:</strong> {polarityInfo.rule}
          </span>
        </div>
      </div>

      {/* Reflex Beat Bar (if timer enabled) */}
      {beatTimerSeconds > 0 && isSessionRunning && (
        <div className="beat-progress-track">
          <div
            className={`beat-progress-fill ${
              beatProgressPercent < 25 ? 'bg-danger' : 'bg-primary'
            }`}
            style={{ width: `${beatProgressPercent}%` }}
          />
        </div>
      )}

      {/* Center Prompt Stage */}
      <div className="my-auto py-6 text-center">
        {isChunkWarmupCard ? (
          <>
            <div className="text-xs font-bold text-accent tracking-wider uppercase mb-1">
              5-Snap Non-Verb Chunk Warmup · Say in{' '}
              {card.language === 'fr' ? 'French' : 'Spanish'}
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-3 tracking-tight">
              &ldquo;{card.translation}&rdquo;
            </h1>
            {!isPromptObscured && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-border/60 text-sm font-bold text-primary">
                Target Chunk: « {card.pronounDisplay} »
              </div>
            )}
          </>
        ) : (
          <>
            {/* 2-Beat Ping-Pong Step Indicator (Beat 1 vs Beat 2) */}
            {polarityMode === 'ping_pong' && (
              <div className="mb-2 flex-center">
                {card.isPingPongSecondBeat ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-danger/15 text-danger border border-danger/40">
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    Beat 2 of 2 — Flip to Negative (−)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-success/15 text-success border border-success/40">
                    Beat 1 of 2 — Affirmative (+)
                  </span>
                )}
              </div>
            )}

            {/* Translation Hint */}
            <div className="text-sm font-medium text-muted tracking-wide uppercase mb-1">
              {card.translation}
            </div>

            {/* Main Verb Infinitive */}
            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-3 tracking-tight">
              {card.infinitive}
            </h1>

            {/* Question <-> Answer Scenario Display OR Natural Rassias Trigger */}
            {card.qaMetadata ? (
              <div className="qa-bubble mx-auto max-w-lg p-3 rounded-xl bg-surface-raised border border-border/70 my-3">
                <div className="text-xs font-semibold text-primary/90 uppercase tracking-wider mb-1 flex-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" /> AT Asks:
                </div>
                <div className="text-lg md:text-xl font-bold text-foreground">
                  {card.qaMetadata.questionPromptDisplay}
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent">
                  Answer: {card.qaMetadata.answerCueBadge}
                </div>
              </div>
            ) : (
              <div className="rassias-cue-box mx-auto my-3 max-w-md">
                <span className="text-base text-muted font-normal mr-2">
                  {card.rassiasTrigger}
                </span>
                <span className="text-2xl md:text-3xl font-extrabold text-primary underline decoration-2 decoration-primary/40 underline-offset-4">
                  {isPromptObscured ? '•••••' : card.pronounDisplay}
                </span>
              </div>
            )}

            {/* Prominent Visual Polarity / Negation Cue Pill */}
            {centerNegationCue ? (
              <div className="mt-2 flex-center flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-danger/15 border border-danger/40 text-danger text-sm font-extrabold shadow-sm">
                  {centerNegationCue.badgeText}
                </span>
                <span className="text-[11px] font-semibold text-muted">
                  Pattern: {centerNegationCue.formulaHint}
                </span>
              </div>
            ) : (
              (polarityMode === 'ping_pong' || polarityMode === 'mixed') && (
                <div className="mt-2 flex-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success/10 border border-success/30 text-success text-xs font-bold">
                    ✓ AFFIRMATIVE (+) — Say the positive form
                  </span>
                </div>
              )
            )}

            {/* Attached Non-Verb Lexical Chunk Badge (Option C) */}
            {card.lexicalChunk && (
              <div className="mt-2 flex-center">
                {card.requireTailInResponse ? (
                  <span className="badge badge-accent text-xs py-1 px-3 font-bold">
                    + Speak Sentence Tail: « {card.lexicalChunk.target} » ({card.lexicalChunk.english})
                  </span>
                ) : (
                  <span className="badge badge-subtle text-xs py-1 px-2.5">
                    Scene Tail: + « {card.lexicalChunk.target} » ({card.lexicalChunk.english})
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Status Callout / Spoken AT Cue */}
        <div className="status-cue-row flex-center gap-2 mt-4 text-xs font-semibold">
          {status === 'at_speaking_cue' && (
            <span className="text-primary flex-center gap-1.5 animate-pulse">
              <Volume2 className="w-4 h-4" /> AT cueing: &quot;{card.atSpokenCue}&quot;
            </span>
          )}
          {status === 'snapping' && (
            <span className="text-amber-500 font-bold tracking-widest text-sm animate-bounce">
              * SNAP ! * Speak now!
            </span>
          )}
          {status === 'at_speaking_correction' && (
            <span className="text-danger flex-center gap-1.5 animate-pulse font-bold">
              <Volume2 className="w-4 h-4" />{' '}
              {card.language === 'fr'
                ? 'Répétez ! Listening for correction...'
                : '¡Repita! Listening for correction...'}
            </span>
          )}
          {status === 'feedback_success' && (
            <span className="text-success font-bold text-sm">
              {card.language === 'fr' ? '✓ Parfait !' : '✓ ¡Perfecto!'}
            </span>
          )}
          {status === 'repeat_verified' && (
            <span className="text-success font-bold text-sm">
              {card.language === 'fr'
                ? '✓ Très bien ! Continuing...'
                : '✓ ¡Muy bien! Continuing...'}
            </span>
          )}
        </div>
      </div>

      {/* Répétez ! / ¡Repita! Correction Overlay Alert */}
      {inRepeatLoop && (
        <div className="repetez-banner mb-3 p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-center animate-fade-in">
          <div className="text-xs uppercase font-extrabold tracking-wider text-danger mb-1 flex-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {card.language === 'fr' ? 'Répétez !' : '¡Repita!'}
          </div>
          <div className="text-xl md:text-2xl font-black text-foreground">
            « {card.target.requiresFrenchSi ? `Si, ${card.target.fullForm}` : card.target.fullForm} »
          </div>
          <div className="text-xs text-muted mt-1">
            Model the exact pronunciation back out loud.
          </div>
        </div>
      )}

      {/* Live Interim Transcript or Error Message */}
      {(interimTranscript || speechError || lastEvaluation?.feedbackMessage) && (
        <div className="transcript-feedback-box mb-3 text-center">
          {interimTranscript && (
            <p className="text-sm font-medium italic text-muted animate-pulse">
              &quot;{interimTranscript}&quot;
            </p>
          )}
          {speechError && (
            <p className="text-xs text-danger font-medium flex-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {speechError}
            </p>
          )}
          {lastEvaluation && !interimTranscript && (
            <p
              className={`text-xs font-semibold ${
                lastEvaluation.isCorrect ? 'text-success' : 'text-danger'
              }`}
            >
              {lastEvaluation.feedbackMessage}
            </p>
          )}
        </div>
      )}

      {/* Bottom Controls / Microphone / Manual Input */}
      <div className="pt-4 border-t border-border/40 flex flex-col gap-3">
        {/* Audio Waveform Meter (when mic is active) */}
        {isListening && (
          <div className="waveform-bar flex-center gap-1 h-3">
            {[0.3, 0.6, 1, 0.7, 0.4, 0.9, 0.5].map((mult, idx) => (
              <span
                key={idx}
                className="waveform-pill bg-primary rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(4, audioLevel * 14 * mult)}px`,
                  width: '3.5px',
                }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {/* Replay AT Cue button */}
          <button
            type="button"
            onClick={onReplayPrompt}
            className="btn btn-subtle text-xs py-2 px-3 flex items-center gap-1.5"
            title="Hear prompt again"
          >
            <Volume2 className="w-4 h-4 text-primary" /> Hear Again
          </button>

          {/* Main Push-To-Talk / Tap-to-Speak Mic Trigger */}
          <button
            type="button"
            onClick={onTriggerMic}
            className={`btn btn-lg flex-1 flex-center gap-2 font-bold shadow-md ${
              isListening
                ? 'btn-danger animate-pulse'
                : inRepeatLoop
                ? 'btn-warning'
                : 'btn-primary'
            }`}
          >
            {isListening ? (
              <>
                <Mic className="w-5 h-5" /> Listening...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />{' '}
                {inRepeatLoop ? 'Say Correct Form' : handsFreeMode ? 'Listening (Hands-Free)' : 'Tap to Speak'}
              </>
            )}
          </button>

          {/* Skip / Next Card button */}
          <button
            type="button"
            onClick={onAdvance}
            className="btn btn-subtle text-xs py-2 px-3 flex items-center gap-1.5"
            title="Skip to next"
          >
            Skip <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quiet Mode text fallback input */}
        <form onSubmit={handleTextSubmit} className="mt-1 flex gap-2">
          <input
            type="text"
            className="input-field text-xs flex-1 py-1.5 px-3"
            placeholder={
              card.language === 'fr'
                ? "Type conjugation (or use mic)... e.g. je parle"
                : "Type conjugation (or use mic)... e.g. hablo"
            }
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
          />
          <button type="submit" className="btn btn-subtle text-xs px-3">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};
