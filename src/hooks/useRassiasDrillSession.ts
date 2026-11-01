import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelATSpeech,
  playFingerSnap,
  playSuccessMicroChime,
  speakATUtterance,
} from '../audio/atVoiceAndSnap';
import {
  DrillPromptCard,
  DrillStageStatus,
  RassiasDrillDirector,
  VerbMasteryStats,
} from '../engine/drillDirector';
import { EvaluationResult } from '../engine/evaluator';
import { LanguageCode } from '../languages/types';
import { speechManager } from '../speech/speechManager';
import { LocalWhisperStatus } from '../speech/types';
import { AppSettings } from '../state/useAppSettings';

export interface SessionScoreboard {
  totalReps: number;
  correctFirstTry: number;
  currentStreak: number;
  bestStreak: number;
  boomerangsCleared: number;
}

export function useRassiasDrillSession(
  settings: AppSettings,
  initialMastery: Record<string, VerbMasteryStats>,
  onMasteryUpdate: (lang: LanguageCode, map: Record<string, VerbMasteryStats>) => void
) {
  const directorRef = useRef<RassiasDrillDirector | null>(null);
  if (!directorRef.current) {
    directorRef.current = new RassiasDrillDirector(
      {
        language: settings.language,
        activeVerbIds: settings.activeVerbIdsByLang[settings.language],
        activeTenseIds: settings.activeTenseIdsByLang[settings.language],
        cadence: settings.cadence,
        polarityMode: settings.polarityMode,
        enableNegativeAdverbs: settings.enableNegativeAdverbs,
        includeVosotros: settings.includeVosotros,
        useNaturalTriggers: settings.useNaturalTriggers,
      },
      initialMastery
    );
  }

  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const [stageStatus, setStageStatus] = useState<DrillStageStatus>('idle');
  const [currentCard, setCurrentCard] = useState<DrillPromptCard | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [snapVisualPulse, setSnapVisualPulse] = useState(false);
  const [beatProgressPercent, setBeatProgressPercent] = useState(100);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [whisperStatus, setWhisperStatus] = useState<LocalWhisperStatus>({
    state: 'unloaded',
    progress: 0,
    statusText: 'Not downloaded yet (~40 MB)',
  });
  const [scoreboard, setScoreboard] = useState<SessionScoreboard>({
    totalReps: 0,
    correctFirstTry: 0,
    currentStreak: 0,
    bestStreak: 0,
    boomerangsCleared: 0,
  });

  const sessionActiveRef = useRef(false);
  const cycleTokenRef = useRef(0);
  const beatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);

  // Subscribe to Local Whisper Web Worker download/ready status
  useEffect(() => {
    return speechManager.subscribeWhisperStatus(setWhisperStatus);
  }, []);

  // Keep RassiasDrillDirector config synced with user Settings
  useEffect(() => {
    directorRef.current?.updateConfig({
      language: settings.language,
      activeVerbIds: settings.activeVerbIdsByLang[settings.language],
      activeTenseIds: settings.activeTenseIdsByLang[settings.language],
      cadence: settings.cadence,
      polarityMode: settings.polarityMode,
      enableNegativeAdverbs: settings.enableNegativeAdverbs,
      includeVosotros: settings.includeVosotros,
      useNaturalTriggers: settings.useNaturalTriggers,
    });
  }, [
    settings.language,
    settings.activeVerbIdsByLang,
    settings.activeTenseIdsByLang,
    settings.cadence,
    settings.polarityMode,
    settings.enableNegativeAdverbs,
    settings.includeVosotros,
    settings.useNaturalTriggers,
  ]);

  // Manage Screen Wake Lock on Pixel 10 & Pixel Tablet while session is running
  useEffect(() => {
    async function acquireWakeLock() {
      if (
        isSessionRunning &&
        typeof navigator !== 'undefined' &&
        'wakeLock' in navigator
      ) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch {
          // Ignore if browser denies wakeLock
        }
      }
    }

    function releaseWakeLock() {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }

    if (isSessionRunning) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isSessionRunning]);

  const clearTimers = useCallback(() => {
    if (beatTimerRef.current) {
      clearInterval(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, []);

  const triggerVisualAndAudioSnap = useCallback(
    (isRepeatCue = false) => {
      playFingerSnap({
        quietMode: settings.quietVisualOnlyMode,
        isRepeatCue,
      });
      setSnapVisualPulse(true);
      setTimeout(() => setSnapVisualPulse(false), 340);
    },
    [settings.quietVisualOnlyMode]
  );

  const startBeatCountdown = useCallback(
    (durationSeconds: number, onExpire: () => void) => {
      if (beatTimerRef.current) {
        clearInterval(beatTimerRef.current);
        beatTimerRef.current = null;
      }
      if (durationSeconds <= 0) {
        setBeatProgressPercent(100);
        return;
      }

      const totalMs = durationSeconds * 1000;
      const startedAt = Date.now();
      setBeatProgressPercent(100);

      beatTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remainingPct = Math.max(0, 100 - (elapsed / totalMs) * 100);
        setBeatProgressPercent(remainingPct);

        if (elapsed >= totalMs) {
          if (beatTimerRef.current) {
            clearInterval(beatTimerRef.current);
            beatTimerRef.current = null;
          }
          onExpire();
        }
      }, 60);
    },
    []
  );

  /**
   * Executes the Rassias "Répétez ! / ¡Repita!" loop when the student misses a conjugation
   * or hesitates past the beat timer.
   */
  const runRepeatCorrectionFlow = useCallback(
    async (card: DrillPromptCard, token: number) => {
      if (!sessionActiveRef.current || cycleTokenRef.current !== token) return;

      clearTimers();
      speechManager.stopActiveListening();
      setStageStatus('at_speaking_correction');

      await speakATUtterance(card.atSpokenCorrection, {
        language: card.language,
        locale: settings.locales[card.language],
        quietMode: settings.quietVisualOnlyMode,
      });

      if (!sessionActiveRef.current || cycleTokenRef.current !== token) return;

      // Rassias micro-beat pause (~280ms) between spoken cue and finger snap
      await new Promise((r) => setTimeout(r, 280));
      if (!sessionActiveRef.current || cycleTokenRef.current !== token) return;

      triggerVisualAndAudioSnap(true);
      setStageStatus('listening_repeat');

      if (settings.handsFreeMode) {
        // Short 120ms acoustic settling buffer so laptop speakers don't echo into mic
        await new Promise((r) => setTimeout(r, 120));
        if (!sessionActiveRef.current || cycleTokenRef.current !== token) return;

        // Automatically listen for the student to repeat the correct form back
        try {
          const result = await speechManager.listenOnce({
            language: card.language,
            locale: settings.locales[card.language],
            target: card.target,
            engine: settings.speechEngine,
            byokConfig: settings.byokConfig,
            maxDurationMs: 4500,
            onAudioLevel: setAudioLevel,
            onInterimTranscript: setInterimTranscript,
            onSpeechStarted: clearTimers,
          });

          if (!sessionActiveRef.current || cycleTokenRef.current !== token) return;
          handleTranscriptSubmission(
            result.transcript,
            result.aiPronunciationNote,
            token,
            result.alternatives
          );
        } catch (err) {
          if (!sessionActiveRef.current || cycleTokenRef.current !== token) return;
          setSpeechError(err instanceof Error ? err.message : 'Microphone error');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      clearTimers,
      settings.locales,
      settings.quietVisualOnlyMode,
      settings.handsFreeMode,
      settings.speechEngine,
      settings.byokConfig,
      triggerVisualAndAudioSnap,
    ]
  );

  /**
   * Evaluates a transcript (either spoken via mic or typed/tapped in Quiet Mode)
   * and advances or triggers the "Répétez !" loop.
   */
  const handleTranscriptSubmission = useCallback(
    (
      transcript: string,
      aiPronunciationNote?: string,
      activeToken?: number,
      alternatives?: string[]
    ) => {
      const token = activeToken ?? cycleTokenRef.current;
      const director = directorRef.current;
      const card = director?.getCurrentPrompt();
      if (!director || !card) return;

      clearTimers();
      speechManager.stopActiveListening();
      setAudioLevel(0);
      setStageStatus('evaluating');

      const wasAlreadyInRepeatLoop = director.isInRepeatLoop();

      const outcome = director.submitResponse(transcript, {
        spanishPronounMode: settings.spanishPronounMode,
        aiPronunciationNote,
        alternatives,
      });

      setLastEvaluation(outcome.evaluation);
      onMasteryUpdate(settings.language, director.getMasteryMap());

      if (outcome.completedRepeatLoop) {
        // Student repeated the right form after "Répétez !" -> celebrate and advance!
        playSuccessMicroChime(settings.quietVisualOnlyMode);
        setStageStatus('repeat_verified');

        if (settings.handsFreeMode && sessionActiveRef.current) {
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (sessionActiveRef.current && cycleTokenRef.current === token) {
              advanceToNextCard();
            }
          }, 1450);
        }
        return;
      }

      // If we were ALREADY in the repeat loop and the user missed again or the mic heard silence:
      // Never bark "Repita!" a second time! The card is already in the Boomerang Queue for 3 prompts later.
      if (wasAlreadyInRepeatLoop) {
        setStageStatus('evaluating');
        if (settings.handsFreeMode && sessionActiveRef.current) {
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (sessionActiveRef.current && cycleTokenRef.current === token) {
              advanceToNextCard();
            }
          }, 1600);
        }
        return;
      }

      if (outcome.evaluation.isCorrect) {
        // Nailed it on the first try!
        playSuccessMicroChime(settings.quietVisualOnlyMode);
        setStageStatus('feedback_success');
        setScoreboard((prev) => {
          const nextStreak = prev.currentStreak + 1;
          return {
            totalReps: prev.totalReps + 1,
            correctFirstTry: prev.correctFirstTry + 1,
            currentStreak: nextStreak,
            bestStreak: Math.max(prev.bestStreak, nextStreak),
            boomerangsCleared: prev.boomerangsCleared + (card.isBoomerang ? 1 : 0),
          };
        });

        if (settings.handsFreeMode && sessionActiveRef.current) {
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (sessionActiveRef.current && cycleTokenRef.current === token) {
              advanceToNextCard();
            }
          }, 1450);
        }
        return;
      }

      // First-try mistake or repeat mistake -> Reset streak and trigger "Répétez !" loop
      if (outcome.queuedBoomerang) {
        setScoreboard((prev) => ({
          ...prev,
          totalReps: prev.totalReps + 1,
          currentStreak: 0,
        }));
      }

      runRepeatCorrectionFlow(card, token);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      clearTimers,
      onMasteryUpdate,
      runRepeatCorrectionFlow,
      settings.handsFreeMode,
      settings.language,
      settings.quietVisualOnlyMode,
      settings.spanishPronounMode,
    ]
  );

  /**
   * Manually triggers microphone listening (for Tap-to-Speak mode or re-trying the mic).
   */
  const triggerManualMicListen = useCallback(async () => {
    const director = directorRef.current;
    const card = director?.getCurrentPrompt();
    if (!director || !card) return;

    const token = cycleTokenRef.current;
    setSpeechError(null);
    setInterimTranscript('');
    const isRepeat = director.isInRepeatLoop();
    setStageStatus(isRepeat ? 'listening_repeat' : 'listening_initial');

    if (!isRepeat && settings.beatTimerSeconds > 0) {
      startBeatCountdown(settings.beatTimerSeconds, () => {
        if (cycleTokenRef.current !== token) return;
        director.triggerBeatTimeout();
        setLastEvaluation({
          isCorrect: false,
          matchType: 'wrong_conjugation',
          heardNormalized: '',
          expectedDisplay: card.target.fullForm,
          expectedSpoken: card.target.fullForm,
          feedbackMessage:
            card.language === 'fr'
              ? `Temps écoulé ! Répétez : « ${card.target.fullForm} ! »`
              : `¡Tiempo! ¡Repita!: « ${card.target.fullForm} ! »`,
          shouldTriggerRepeat: true,
        });
        runRepeatCorrectionFlow(card, token);
      });
    }

    try {
      const maxDurationMs =
        !isRepeat && settings.beatTimerSeconds > 0
          ? Math.max(2500, settings.beatTimerSeconds * 1000 + 800)
          : 4800;

      const result = await speechManager.listenOnce({
        language: card.language,
        locale: settings.locales[card.language],
        target: card.target,
        engine: settings.speechEngine,
        byokConfig: settings.byokConfig,
        maxDurationMs,
        onAudioLevel: setAudioLevel,
        onInterimTranscript: setInterimTranscript,
        onSpeechStarted: clearTimers,
      });

      if (cycleTokenRef.current !== token) return;
      handleTranscriptSubmission(
        result.transcript,
        result.aiPronunciationNote,
        token,
        result.alternatives
      );
    } catch (err) {
      if (cycleTokenRef.current !== token) return;
      clearTimers();
      setAudioLevel(0);
      setSpeechError(err instanceof Error ? err.message : 'Microphone recognition failed');
    }
  }, [
    clearTimers,
    handleTranscriptSubmission,
    runRepeatCorrectionFlow,
    settings.beatTimerSeconds,
    settings.byokConfig,
    settings.locales,
    settings.speechEngine,
    startBeatCountdown,
  ]);

  /**
   * Advances to the next prompt card and runs the AT Cue -> Finger-Snap -> Listen sequence.
   */
  const advanceToNextCard = useCallback(async () => {
    const director = directorRef.current;
    if (!director) return;

    clearTimers();
    cancelATSpeech();
    speechManager.stopActiveListening();

    const token = cycleTokenRef.current + 1;
    cycleTokenRef.current = token;

    const card = director.nextPrompt();
    setCurrentCard(card);
    setLastEvaluation(null);
    setInterimTranscript('');
    setSpeechError(null);
    setBeatProgressPercent(100);
    setStageStatus('at_speaking_cue');

    await speakATUtterance(card.atSpokenCue, {
      language: card.language,
      locale: settings.locales[card.language],
      quietMode: settings.quietVisualOnlyMode,
    });

    if (cycleTokenRef.current !== token) return;

    // Rassias micro-beat pause (~280ms) between spoken cue and finger snap
    await new Promise((r) => setTimeout(r, 280));
    if (cycleTokenRef.current !== token) return;

    // Fire the Dartmouth Rassias Finger-Snap (*Snap!*)
    setStageStatus('snapping');
    triggerVisualAndAudioSnap(false);

    if (settings.handsFreeMode && sessionActiveRef.current) {
      // Short 120ms acoustic settling delay so desktop/laptop speakers don't echo the snap/TTS into the mic
      await new Promise((r) => setTimeout(r, 120));
      if (cycleTokenRef.current !== token || !sessionActiveRef.current) return;
      await triggerManualMicListen();
    } else {
      setStageStatus('listening_initial');
      if (settings.beatTimerSeconds > 0) {
        startBeatCountdown(settings.beatTimerSeconds, () => {
          if (cycleTokenRef.current !== token) return;
          director.triggerBeatTimeout();
          setLastEvaluation({
            isCorrect: false,
            matchType: 'wrong_conjugation',
            heardNormalized: '',
            expectedDisplay: card.target.fullForm,
            expectedSpoken: card.target.fullForm,
            feedbackMessage:
              card.language === 'fr'
                ? `Temps écoulé ! Répétez : « ${card.target.fullForm} ! »`
                : `¡Tiempo! ¡Repita!: « ${card.target.fullForm} ! »`,
            shouldTriggerRepeat: true,
          });
          runRepeatCorrectionFlow(card, token);
        });
      }
    }
  }, [
    clearTimers,
    runRepeatCorrectionFlow,
    settings.beatTimerSeconds,
    settings.handsFreeMode,
    settings.locales,
    settings.quietVisualOnlyMode,
    startBeatCountdown,
    triggerManualMicListen,
    triggerVisualAndAudioSnap,
  ]);

  const startSession = useCallback(() => {
    sessionActiveRef.current = true;
    setIsSessionRunning(true);
    advanceToNextCard();
  }, [advanceToNextCard]);

  const pauseSession = useCallback(() => {
    sessionActiveRef.current = false;
    cycleTokenRef.current += 1;
    clearTimers();
    cancelATSpeech();
    speechManager.stopActiveListening();
    setAudioLevel(0);
    setIsSessionRunning(false);
    setStageStatus('idle');
  }, [clearTimers]);

  const replayATPrompt = useCallback(async () => {
    if (!currentCard) return;
    await speakATUtterance(currentCard.atSpokenCue, {
      language: currentCard.language,
      locale: settings.locales[currentCard.language],
      quietMode: false,
    });
    triggerVisualAndAudioSnap(false);
  }, [currentCard, settings.locales, triggerVisualAndAudioSnap]);

  const restartSession = useCallback(() => {
    clearTimers();
    cancelATSpeech();
    speechManager.stopActiveListening();
    sessionActiveRef.current = true;
    setIsSessionRunning(true);
    advanceToNextCard();
  }, [advanceToNextCard, clearTimers]);

  return {
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
    boomerangCount: directorRef.current?.getBoomerangQueueLength() ?? 0,
    inRepeatLoop: directorRef.current?.isInRepeatLoop() ?? false,
    startSession,
    pauseSession,
    restartSession,
    advanceToNextCard,
    triggerManualMicListen,
    submitTypedOrSpokenResponse: (text: string) => handleTranscriptSubmission(text),
    replayATPrompt,
    preloadLocalWhisper: () => speechManager.preloadLocalWhisper(),
  };
}
