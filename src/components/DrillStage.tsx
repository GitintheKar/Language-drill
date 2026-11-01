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
} from 'lucide-react';
import { DrillPromptCard, DrillStageStatus } from '../engine/drillDirector';
import { EvaluationResult } from '../engine/evaluator';

interface DrillStageProps {
  card: DrillPromptCard | null;
  status: DrillStageStatus;
  isSessionRunning: boolean;
  lastEvaluation: EvaluationResult | null;
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
  onPause,
  onAdvance,
  onTriggerMic,
  onReplayPrompt,
  onSubmitTypedResponse,
}) => {
  const [typedInput, setTypedInput] = React.useState('');

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
        <h2 className="text-2xl font-bold mb-2">Dartmouth Rassias Drill</h2>
        <p className="text-muted text-sm max-w-md mb-6">
          High-energy oral verb conjugation training. Listen to the Assistant Teacher (AT) cue, wait for the snap (*Snap!*), and respond out loud.
        </p>
        <button className="btn btn-primary btn-lg flex-center gap-2" onClick={onStart}>
          <Play className="w-5 h-5 fill-current" /> Begin Drill Session
        </button>
      </div>
    );
  }

  // Obscure prompt text if user enabled Ear-First mode until the AT snaps
  const isPromptObscured =
    hideWrittenPromptUntilSnap && status === 'at_speaking_cue';

  const isListening =
    status === 'listening_initial' || status === 'listening_repeat';

  return (
    <div
      className={`card-stage relative flex flex-col justify-between ${
        snapVisualPulse ? 'snap-pulse-active' : ''
      } ${inRepeatLoop ? 'repeat-border-active' : ''}`}
    >
      {/* Top Status & Cadence Row */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40 text-xs">
        <div className="flex items-center gap-2">
          {card.isBoomerang && (
            <span className="badge badge-boomerang flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Boomerang Recall
            </span>
          )}
          {card.isPingPongSecondBeat && (
            <span className="badge badge-pingpong flex items-center gap-1">
              <Flame className="w-3 h-3" /> Beat 2: Negative Flip!
            </span>
          )}
          <span className="badge badge-neutral font-semibold">
            {card.tenseName}
          </span>
        </div>

        <div className="flex items-center gap-2">
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
              <Volume2 className="w-4 h-4" /> Répétez ! Listening for correction...
            </span>
          )}
          {status === 'feedback_success' && (
            <span className="text-success font-bold text-sm">
              ✓ Parfait !
            </span>
          )}
          {status === 'repeat_verified' && (
            <span className="text-success font-bold text-sm">
              ✓ Corrected! Continuing...
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
