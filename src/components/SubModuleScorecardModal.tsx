import React from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Award,
  BookOpen,
  RotateCcw,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { SubModuleCheckReport } from '../engine/drillDirector';

interface SubModuleScorecardModalProps {
  isOpen: boolean;
  report: SubModuleCheckReport | null;
  subModuleTitle: string;
  displayCode: string;
  hasNextSubModule: boolean;
  nextSubModuleLabel?: string;
  onClose: () => void;
  onRetryCheck: () => void;
  onOpenEncoreLesson: (report: SubModuleCheckReport) => void;
  onOpenConsolidationLesson: (report: SubModuleCheckReport) => void;
  onAdvanceToNextSubModule: () => void;
}

export const SubModuleScorecardModal: React.FC<SubModuleScorecardModalProps> = ({
  isOpen,
  report,
  subModuleTitle,
  displayCode,
  hasNextSubModule,
  nextSubModuleLabel,
  onClose,
  onRetryCheck,
  onOpenEncoreLesson,
  onOpenConsolidationLesson,
  onAdvanceToNextSubModule,
}) => {
  if (!isOpen || !report) return null;

  const isEncore = report.outcome === 'encore_required';
  const isPass1Complete = report.outcome === 'pass_1_complete';
  const isGraduated =
    report.outcome === 'graduated_clean' ||
    report.outcome === 'graduated_with_stragglers';

  return (
    <div className="modal-overlay no-print">
      <div className="modal-panel max-w-xl">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-primary text-xs font-black">
              Sub-Module {displayCode}
            </span>
            <h2 className="text-base font-bold text-foreground">
              {subModuleTitle} — Check Results
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-subtle p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Outcome Banner */}
          <div
            className={`p-4 rounded-xl border text-center space-y-1.5 ${
              isGraduated
                ? 'bg-success/10 border-success/40'
                : isPass1Complete
                ? 'bg-primary/10 border-primary/40'
                : 'bg-warning/10 border-warning/40'
            }`}
          >
            <div className="flex-center">
              {isGraduated ? (
                <CheckCircle2 className="w-8 h-8 text-success" />
              ) : isPass1Complete ? (
                <Award className="w-8 h-8 text-primary" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              )}
            </div>
            <h3 className="text-lg font-black text-foreground">
              {isGraduated
                ? `Sub-Module ${displayCode} Graduated! (${report.newPassesCompleted}/${report.requiredPasses} Passes)`
                : isPass1Complete
                ? `Pass 1 of ${report.requiredPasses} Complete! (${report.firstTryAccuracyPct}%)`
                : `Encore Recommended (${report.firstTryAccuracyPct}% — Need ≥80%)`}
            </h3>
            <p className="text-xs text-muted">
              {isGraduated
                ? report.outcome === 'graduated_with_stragglers'
                  ? 'You passed both checks! Any missed forms have been added to your 30% Review Queue for automatic reinforcement in the next Sub-Module.'
                  : 'Flawless mastery across both passes! You are ready for the next Sub-Module.'
                : isPass1Complete
                ? 'Great reflex speed on Pass 1! Review Scene B (Consolidation Lesson) or jump straight into Pass 2 to graduate.'
                : 'Your oral reflexes need one more cycle before advancing. Open your personalized Diagnostic Encore Lesson below to spotlight the exact forms you missed.'}
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-surface-raised border border-border/60">
              <div className="text-[10px] font-bold uppercase text-muted">
                Verb Reflex Accuracy
              </div>
              <div
                className={`text-2xl font-black mt-0.5 ${
                  report.firstTryAccuracyPct >= 80
                    ? 'text-success'
                    : 'text-amber-500'
                }`}
              >
                {report.firstTryAccuracyPct}%
              </div>
              <div className="text-[11px] text-muted">
                {report.verbCorrectFirstTry}/{report.completedVerbSnaps} first-try
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-raised border border-border/60">
              <div className="text-[10px] font-bold uppercase text-muted">
                Non-Verb Chunks
              </div>
              <div className="text-2xl font-black text-primary mt-0.5">
                {report.chunkSnapsTotal > 0 ? `${report.chunkAccuracyPct}%` : '—'}
              </div>
              <div className="text-[11px] text-muted">
                {report.chunkSnapsTotal > 0
                  ? `${report.chunkCorrectFirstTry}/${report.chunkSnapsTotal} warmup`
                  : 'Full-sentence mode'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-raised border border-border/60">
              <div className="text-[10px] font-bold uppercase text-muted">
                Graduation Gate
              </div>
              <div className="text-2xl font-black text-foreground mt-0.5">
                {report.newPassesCompleted}/{report.requiredPasses}
              </div>
              <div className="text-[11px] text-muted">Passes ≥80%</div>
            </div>
          </div>

          {/* Missed Verb Forms List */}
          {report.missedForms.length > 0 && (
            <div className="p-3.5 rounded-xl bg-surface-raised/40 border border-border/60 space-y-2">
              <div className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>
                  Missed Verb Forms ({report.missedForms.length})
                </span>
                <span className="text-[11px] text-muted">
                  {isGraduated
                    ? 'Carried into 30% Straggler Queue'
                    : 'Spotlighted in Encore Lesson'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missedForms.map((m, idx) => (
                  <span
                    key={idx}
                    className="badge badge-pingpong text-xs py-1 px-2.5"
                  >
                    « {m.expectedFullForm} » ({m.infinitive} · {m.tenseName})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missed Chunks List */}
          {report.missedChunks.length > 0 && (
            <div className="p-3.5 rounded-xl bg-surface-raised/40 border border-border/60 space-y-2">
              <div className="text-xs font-bold text-foreground">
                Missed Non-Verb Chunks ({report.missedChunks.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.missedChunks.map((c) => (
                  <span key={c.id} className="badge badge-warning text-xs py-1 px-2.5">
                    « {c.target} » ({c.english})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="p-4 border-t border-border bg-surface-raised/40 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {isEncore && (
            <>
              <button
                type="button"
                onClick={onRetryCheck}
                className="btn btn-subtle text-xs py-2.5 px-3.5 w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry 15-Snap Check
              </button>
              <button
                type="button"
                onClick={() => onOpenEncoreLesson(report)}
                className="btn btn-warning text-xs py-2.5 px-4 w-full sm:flex-1 flex items-center justify-center gap-2 font-bold shadow-md"
              >
                <BookOpen className="w-4 h-4" />
                Open Personalized Encore Lesson (Spotlight Missed Forms)
              </button>
            </>
          )}

          {isPass1Complete && (
            <>
              <button
                type="button"
                onClick={onRetryCheck}
                className="btn btn-subtle text-xs py-2.5 px-3.5 w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-primary" /> Start Pass 2 Check Now
              </button>
              <button
                type="button"
                onClick={() => onOpenConsolidationLesson(report)}
                className="btn btn-primary text-xs py-2.5 px-4 w-full sm:flex-1 flex items-center justify-center gap-2 font-bold shadow-md"
              >
                <BookOpen className="w-4 h-4" />
                Open Scene B (Pass 2 Consolidation Lesson)
              </button>
            </>
          )}

          {isGraduated && (
            <>
              <button
                type="button"
                onClick={onRetryCheck}
                className="btn btn-subtle text-xs py-2.5 px-3.5 w-full sm:w-auto flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Practice Again
              </button>
              {hasNextSubModule ? (
                <button
                  type="button"
                  onClick={onAdvanceToNextSubModule}
                  className="btn btn-success text-xs py-2.5 px-4 w-full sm:flex-1 flex items-center justify-center gap-2 font-bold shadow-md"
                >
                  Advance to {nextSubModuleLabel ?? 'Next Sub-Module'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-success text-xs py-2.5 px-4 w-full sm:flex-1 flex items-center justify-center gap-2 font-bold shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" /> Course Completed!
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
