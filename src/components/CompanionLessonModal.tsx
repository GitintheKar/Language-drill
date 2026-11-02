import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Volume2,
  Play,
  Square,
  Printer,
  Sparkles,
  BookOpen,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { cancelATSpeech, speakATUtterance } from '../audio/atVoiceAndSnap';
import {
  CompanionLesson,
  CompanionLessonVariant,
} from '../companion/lessonTypes';

interface CompanionLessonModalProps {
  isOpen: boolean;
  lesson: CompanionLesson | null;
  isLoading: boolean;
  locale: string;
  passesCompleted: number;
  requiredPasses: number;
  onClose: () => void;
  onSwitchVariant: (variant: CompanionLessonVariant, freshRemix?: boolean) => void;
  onStartSubModuleCheck: () => void;
}

export const CompanionLessonModal: React.FC<CompanionLessonModalProps> = ({
  isOpen,
  lesson,
  isLoading,
  locale,
  passesCompleted,
  requiredPasses,
  onClose,
  onSwitchVariant,
  onStartSubModuleCheck,
}) => {
  const [isPlayingScene, setIsPlayingScene] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const [shadowingPauseEnabled, setShadowingPauseEnabled] = useState(false);
  const [revealedWarmups, setRevealedWarmups] = useState<Record<number, boolean>>({});
  const playbackSessionRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      playbackSessionRef.current += 1;
      cancelATSpeech();
      setIsPlayingScene(false);
      setActiveLineIdx(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setRevealedWarmups({});
    playbackSessionRef.current += 1;
    cancelATSpeech();
    setIsPlayingScene(false);
    setActiveLineIdx(null);
  }, [lesson?.id, lesson?.variant, lesson?.encoreIndex]);

  if (!isOpen || !lesson) return null;

  const stopScenePlayback = () => {
    playbackSessionRef.current += 1;
    cancelATSpeech();
    setIsPlayingScene(false);
    setActiveLineIdx(null);
  };

  const playSingleLine = async (idx: number) => {
    playbackSessionRef.current += 1;
    const sessionId = playbackSessionRef.current;
    cancelATSpeech();
    setIsPlayingScene(false);

    const line = lesson.dialogue[idx];
    if (!line) return;

    setActiveLineIdx(idx);
    await speakATUtterance(line.target, {
      language: lesson.language,
      locale,
      pitch: line.speaker === 'A' ? 0.92 : 1.1,
      rate: 0.96,
    });
    if (playbackSessionRef.current === sessionId) {
      setActiveLineIdx(null);
    }
  };

  const playFullDialogueScene = async () => {
    if (isPlayingScene) {
      stopScenePlayback();
      return;
    }

    playbackSessionRef.current += 1;
    const sessionId = playbackSessionRef.current;
    cancelATSpeech();
    setIsPlayingScene(true);

    for (let i = 0; i < lesson.dialogue.length; i++) {
      if (playbackSessionRef.current !== sessionId) break;
      const line = lesson.dialogue[i];
      setActiveLineIdx(i);

      await speakATUtterance(line.target, {
        language: lesson.language,
        locale,
        pitch: line.speaker === 'A' ? 0.92 : 1.1,
        rate: 0.96,
      });

      if (playbackSessionRef.current !== sessionId) break;

      const pauseMs = shadowingPauseEnabled ? 3000 : 420;
      await new Promise((r) => setTimeout(r, pauseMs));
    }

    if (playbackSessionRef.current === sessionId) {
      setIsPlayingScene(false);
      setActiveLineIdx(null);
    }
  };

  const speakChunkCard = async (target: string, exampleTarget: string) => {
    stopScenePlayback();
    await speakATUtterance(`${target}. ${exampleTarget}`, {
      language: lesson.language,
      locale,
      rate: 0.96,
    });
  };

  const handlePrintLessonSheet = () => {
    stopScenePlayback();
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-3xl print-sheet">
        {/* Top Bar (Hidden when printing) */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="badge badge-primary text-xs font-black">
              Sub-Module {lesson.displayCode}
            </span>
            <h2 className="text-base md:text-lg font-bold text-foreground">
              {lesson.title}
            </h2>
            <span className="badge badge-subtle text-[11px]">
              Pass {passesCompleted}/{requiredPasses}
            </span>
            <span
              className="badge badge-subtle text-[11px] flex items-center gap-1"
              title={
                lesson.aiFallbackReason ||
                `Lesson source: ${lesson.generatedBy}`
              }
            >
              {lesson.generatedBy === 'byok_ai' && (
                <>
                  <Sparkles className="w-3 h-3 text-primary" />
                  Gemini AI Synthesized
                </>
              )}
              {lesson.generatedBy === 'rolling_buffer' && (
                <>
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  Ready Offline (Buffered AI Pack)
                </>
              )}
              {lesson.generatedBy === 'starter_builtin' && (
                <>Curated Native Scene</>
              )}
              {lesson.generatedBy === 'offline_engine' && (
                <>Offline Linguistic Engine</>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintLessonSheet}
              className="btn btn-subtle text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="Print 1-Page Field Manual Sheet"
            >
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Print 1-Page Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopScenePlayback();
                onClose();
              }}
              className="btn btn-subtle p-1.5 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Variant Switcher Tabs (Hidden when printing) */}
        <div className="px-4 py-2.5 border-b border-border/60 bg-surface-raised/30 flex items-center justify-between flex-wrap gap-2 no-print">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onSwitchVariant('baseline')}
              disabled={isLoading}
              className={`btn text-xs py-1 px-2.5 ${
                lesson.variant === 'baseline' ? 'btn-primary' : 'btn-subtle'
              }`}
            >
              Scene A (Pass 1)
            </button>
            <button
              type="button"
              onClick={() => onSwitchVariant('pass_2_consolidation')}
              disabled={isLoading}
              className={`btn text-xs py-1 px-2.5 ${
                lesson.variant === 'pass_2_consolidation'
                  ? 'btn-primary'
                  : 'btn-subtle'
              }`}
            >
              Scene B (Pass 2 Consolidation)
            </button>
            <button
              type="button"
              onClick={() => onSwitchVariant('encore_remedial')}
              disabled={isLoading}
              className={`btn text-xs py-1 px-2.5 ${
                lesson.variant === 'encore_remedial'
                  ? 'btn-warning'
                  : 'btn-subtle'
              }`}
            >
              Encore Diagnostic Lesson
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSwitchVariant('encore_remedial', true)}
            disabled={isLoading}
            className="btn btn-subtle text-xs py-1 px-2.5 flex items-center gap-1"
            title="Generate a fresh remix scene constrained to this Sub-Module's unlocked pool"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-pulse' : ''}`} />
            {isLoading ? 'Generating...' : 'New Encore Remix'}
          </button>
        </div>

        {/* Scrollable Lesson Content (Also serves as Printable 1-Page Field Manual) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Print-Only Header */}
          <div className="print-only border-b pb-3 mb-3">
            <div className="text-xs font-bold uppercase tracking-wider">
              Dartmouth Rassias Companion Field Manual ·Phase {lesson.phase}: {lesson.phaseTitle}
            </div>
            <h1 className="text-2xl font-black mt-0.5">
              Sub-Module {lesson.displayCode}: {lesson.title}
            </h1>
            <p className="text-xs mt-0.5">{lesson.subtitle}</p>
          </div>

          {/* Encore Diagnostic Callout (if active) */}
          {lesson.variant === 'encore_remedial' &&
            lesson.diagnosticNotes.length > 0 && (
              <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/40 space-y-1.5">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Diagnostic Encore Spotlight (Targeted Repair before Next Pass)
                </div>
                <ul className="space-y-1 text-xs text-foreground pl-5">
                  {lesson.diagnosticNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

          {/* Section 1: Narrative Dialogue & Dual-Voice Player */}
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary no-print" />
                  1. Contextual Scene & Dual-Voice Audio
                </h3>
                <p className="text-xs italic text-muted">{lesson.sceneSetting}</p>
              </div>

              {/* Dual-Voice Audio Controls (Hidden in Print) */}
              <div className="flex items-center gap-2 no-print">
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shadowingPauseEnabled}
                    onChange={(e) => setShadowingPauseEnabled(e.target.checked)}
                  />
                  <span>3s Shadowing Pause</span>
                </label>

                <button
                  type="button"
                  onClick={playFullDialogueScene}
                  className={`btn text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                    isPlayingScene ? 'btn-danger' : 'btn-primary'
                  }`}
                >
                  {isPlayingScene ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop Audio
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Play 2-Voice Scene
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Parallel Bilingual Dialogue Table */}
            <div className="space-y-2">
              {lesson.dialogue.map((line, idx) => {
                const isSpeakingThis = activeLineIdx === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => playSingleLine(idx)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSpeakingThis
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 bg-surface-raised/30'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`badge text-[10px] ${
                              line.speaker === 'A'
                                ? 'badge-primary'
                                : 'badge-accent'
                            }`}
                          >
                            {line.speakerName}
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {line.target}
                          </span>
                          <Volume2 className="w-3.5 h-3.5 text-primary ml-auto no-print" />
                        </div>
                        {line.audioTip && (
                          <div className="text-[11px] text-primary/90 mt-1">
                            💡 {line.audioTip}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted sm:text-right">
                        {line.english}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: "How the Ear Hears It" Sound Rules */}
          <section className="p-3.5 rounded-xl bg-surface-raised/40 border border-border/60 space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 no-print" />
              2. How the Ear Hears It (Sound-First Pattern)
            </h3>
            <ul className="space-y-1.5 text-xs text-foreground pl-5">
              {lesson.earNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </section>

          {/* Section 3: Focus Verb Conjugation Paradigms (Click to Hear All Forms) */}
          {lesson.conjugationParadigms && lesson.conjugationParadigms.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-primary no-print" />
                  3. Focus Verb Conjugations (Click to Hear Any Form)
                </h3>
                <span className="text-[11px] text-muted no-print">
                  {lesson.language === 'es' ? 'Pro-drop forms with pronouns' : 'All 6 persons'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lesson.conjugationParadigms.map((p, pIdx) => (
                  <div
                    key={pIdx}
                    className="p-3.5 rounded-xl border border-border/70 bg-surface-raised/30 space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                      <div>
                        <span className="text-sm font-black text-foreground">
                          {p.infinitive}
                        </span>
                        <span className="text-xs text-muted ml-2">
                          ({p.translation})
                        </span>
                      </div>
                      <span className="badge badge-primary text-[10px] font-bold">
                        {p.tenseName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {p.forms.map((f) => (
                        <div
                          key={f.person}
                          onClick={() => {
                            stopScenePlayback();
                            speakATUtterance(f.spokenAudio, {
                              language: lesson.language,
                              locale,
                              rate: 0.95,
                            });
                          }}
                          className="p-2 rounded-lg bg-surface border border-border/50 cursor-pointer hover:border-primary transition-all flex items-center justify-between gap-1"
                          title="Click to hear pronunciation"
                        >
                          <span className="text-muted text-[11px] font-medium">
                            {f.pronounDisplay}
                          </span>
                          <span className="font-extrabold text-foreground text-xs">
                            {lesson.language === 'es' && (f.person === 0 || f.person === 1 || f.person === 3 || f.person === 4)
                              ? f.verbForm
                              : f.fullForm}
                          </span>
                          <Volume2 className="w-3 h-3 text-primary no-print" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 4: Non-Verb Chunks & Sentence Tails */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                4. Non-Verb Chunks & Sentence Tails (Click to Hear)
              </h3>
              <span className="text-[11px] text-muted no-print">
                Used in 5-Snap Warmup & Full-Sentence Mode
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {lesson.chunkCards.map((chunk) => (
                <div
                  key={chunk.id}
                  onClick={() => speakChunkCard(chunk.target, chunk.exampleTarget)}
                  className="p-3 rounded-xl border border-border/60 bg-surface-raised/30 cursor-pointer hover:border-primary transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-primary">
                      « {chunk.target} »
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      {chunk.english}
                    </span>
                  </div>
                  <div className="text-xs text-foreground font-medium mt-1.5">
                    {chunk.exampleTarget}
                  </div>
                  <div className="text-[11px] text-muted italic">
                    {chunk.exampleEnglish}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: 3 Pre-Drill Warmup Prompts (Interactive on Screen / Blank Lines in Print) */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-foreground">
              5. Pre-Drill Warmup Check (Say Out Loud or Write on Paper)
            </h3>
            <div className="space-y-2">
              {lesson.warmupPrompts.map((wp, idx) => {
                const isRevealed = Boolean(revealedWarmups[idx]);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border/60 bg-surface-raised/20 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="text-xs font-bold text-foreground">
                        {idx + 1}. {wp.cueEnglish}
                      </div>
                      <div className="text-[11px] text-muted">{wp.hint}</div>
                      {/* Print-Only Blank Writing Line */}
                      <div className="print-only pt-2 text-xs">
                        Write & Speak: ____________________________________________
                      </div>
                    </div>

                    <div className="no-print text-right">
                      {isRevealed ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedWarmups((prev) => ({
                              ...prev,
                              [idx]: false,
                            }))
                          }
                          className="btn btn-subtle text-xs py-1 px-2.5 flex items-center gap-1.5 text-success font-bold"
                        >
                          <EyeOff className="w-3.5 h-3.5" /> « {wp.expectedTarget} »
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedWarmups((prev) => ({
                              ...prev,
                              [idx]: true,
                            }))
                          }
                          className="btn btn-subtle text-xs py-1 px-2.5 flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" /> Reveal Answer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Print-Only Answer Key Footer */}
          <div className="print-only border-t pt-2 text-[10px]">
            <strong>Answer Key (Fold under before completing):</strong>{' '}
            {lesson.warmupPrompts
              .map((wp, i) => `(${i + 1}) ${wp.expectedTarget}`)
              .join('  |  ')}
          </div>
        </div>

        {/* Bottom Action Footer (Hidden when printing) */}
        <div className="p-4 border-t border-border bg-surface-raised/40 flex items-center justify-between flex-wrap gap-3 no-print">
          <div className="text-xs text-muted">
            <div>
              <strong>Prescription:</strong> {lesson.drillPrescription.focusVerbsLabel}{' '}
              ({lesson.drillPrescription.focusTensesLabel})
            </div>
            <div className="text-[11px]">
              Cadence: <strong>{lesson.drillPrescription.recommendedCadence}</strong> ·
              Goal: <strong>≥80% First-Try Accuracy ({passesCompleted}/{requiredPasses} Passes)</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopScenePlayback();
              onStartSubModuleCheck();
            }}
            className="btn btn-primary btn-lg text-xs py-2.5 px-4 flex items-center gap-2 font-bold shadow-md"
          >
            <Zap className="w-4 h-4 fill-current" />
            Start 15-Snap Sub-Module Check (Pass {Math.min(requiredPasses, passesCompleted + 1)}/{requiredPasses})
          </button>
        </div>
      </div>
    </div>
  );
};
