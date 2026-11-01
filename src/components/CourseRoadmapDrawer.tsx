import React, { useMemo } from 'react';
import {
  X,
  Map,
  CheckCircle2,
  BookOpen,
  Play,
  Sparkles,
  Layers,
  Award,
} from 'lucide-react';
import { PairMasteryStats } from '../engine/drillDirector';
import {
  ResolvedSubModulePool,
  resolveAllSubModulePools,
} from '../engine/roadmapResolver';
import { getLanguagePack } from '../languages';
import { ChunkDrillMode, LanguageCode } from '../languages/types';
import { SubModuleProgressStats } from '../state/useAppSettings';

interface CourseRoadmapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  activeSubModuleId: string;
  courseModeEnabled: boolean;
  chunkDrillMode: ChunkDrillMode;
  pairMasteryMap: Record<string, PairMasteryStats>;
  subModuleProgressMap: Record<string, SubModuleProgressStats>;
  onToggleCourseMode: (enabled: boolean) => void;
  onChangeChunkDrillMode: (mode: ChunkDrillMode) => void;
  onSelectSubModule: (subModuleId: string) => void;
  onOpenCompanionLesson: (subModuleId: string) => void;
}

export const CourseRoadmapDrawer: React.FC<CourseRoadmapDrawerProps> = ({
  isOpen,
  onClose,
  language,
  activeSubModuleId,
  courseModeEnabled,
  chunkDrillMode,
  pairMasteryMap,
  subModuleProgressMap,
  onToggleCourseMode,
  onChangeChunkDrillMode,
  onSelectSubModule,
  onOpenCompanionLesson,
}) => {
  const pack = useMemo(() => getLanguagePack(language), [language]);
  const pools = useMemo(() => resolveAllSubModulePools(language), [language]);

  const verbNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of pack.verbs) {
      map[v.id] = v.infinitive;
    }
    return map;
  }, [pack]);

  const tenseNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of pack.tenses) {
      map[t.id] = t.name;
    }
    return map;
  }, [pack]);

  const groupedByPhase = useMemo(() => {
    const groups: {
      phase: number;
      phaseTitle: string;
      items: ResolvedSubModulePool[];
    }[] = [];

    for (const pool of pools) {
      let group = groups.find((g) => g.phase === pool.subModule.phase);
      if (!group) {
        group = {
          phase: pool.subModule.phase,
          phaseTitle: pool.subModule.phaseTitle,
          items: [],
        };
        groups.push(group);
      }
      group.items.push(pool);
    }
    return groups;
  }, [pools]);

  if (!isOpen) return null;

  const computeFocusAccuracy = (pool: ResolvedSubModulePool): number | null => {
    let totalAttempts = 0;
    let totalCorrect = 0;
    for (const vId of pool.focusVerbIds) {
      for (const tId of pool.focusTenseIds) {
        const stat = pairMasteryMap[`${vId}:${tId}`];
        if (stat && stat.attempts > 0) {
          totalAttempts += stat.attempts;
          totalCorrect += stat.correctFirstTry;
        }
      }
    }
    if (totalAttempts === 0) return null;
    return Math.round((totalCorrect / totalAttempts) * 100);
  };

  const graduatedCount = pools.filter(
    (p) => subModuleProgressMap[p.subModule.id]?.graduated
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm no-print">
      <div className="w-full max-w-lg bg-surface h-full flex flex-col border-l border-border shadow-2xl animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" />
              Course Roadmap ({pack.name})
            </h2>
            <p className="text-xs text-muted">
              {graduatedCount} / {pools.length} Sub-Modules Graduated · 2-Pass Mastery Gate (≥80%)
            </p>
          </div>
          <button onClick={onClose} className="btn btn-subtle p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode & Option C Controls */}
        <div className="p-3.5 border-b border-border/60 bg-surface-raised/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Guided Course Mode (70% Focus / 30% Review)
              </div>
              <div className="text-[11px] text-muted">
                Automatically scopes verbs, tenses, and non-verb chunks to your active Sub-Module.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleCourseMode(!courseModeEnabled)}
              className={`btn text-xs py-1 px-3 ${
                courseModeEnabled ? 'btn-primary' : 'btn-subtle'
              }`}
            >
              {courseModeEnabled ? 'Active' : 'Free Mode'}
            </button>
          </div>

          {/* Option C Non-Verb Chunks Mode Toggle */}
          <div className="pt-2 border-t border-border/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3 text-accent" />
              Non-Verb Chunks Drill Mode (Option C)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeChunkDrillMode('two_part')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chunkDrillMode === 'two_part'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/60 bg-surface text-muted'
                }`}
              >
                <div className="text-xs font-bold">2-Part Warmup + Bare Verbs</div>
                <div className="text-[10px] text-muted">
                  5-snap chunk warmup first, then fast verb conjugations
                </div>
              </button>
              <button
                type="button"
                onClick={() => onChangeChunkDrillMode('full_sentence')}
                className={`p-2 rounded-lg border text-left transition-all ${
                  chunkDrillMode === 'full_sentence'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/60 bg-surface text-muted'
                }`}
              >
                <div className="text-xs font-bold">Full Sentence Tails</div>
                <div className="text-[10px] text-muted">
                  Speak verb + attached chunk out loud on every snap
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Phase & Sub-Module List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {groupedByPhase.map((group) => (
            <div key={group.phase} className="space-y-2.5">
              <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur py-1 border-b border-border/50 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
                  Phase {group.phase} — {group.phaseTitle}
                </span>
                <span className="text-[11px] text-muted">
                  {group.items.length} Sub-Modules
                </span>
              </div>

              <div className="space-y-2.5">
                {group.items.map((pool) => {
                  const sm = pool.subModule;
                  const isCurrent = sm.id === activeSubModuleId && courseModeEnabled;
                  const progress = subModuleProgressMap[sm.id];
                  const passes = progress?.passesCompleted ?? 0;
                  const reqPasses = pool.requiredPasses;
                  const isGraduated = Boolean(progress?.graduated || passes >= reqPasses);
                  const liveAccuracy = computeFocusAccuracy(pool);

                  return (
                    <div
                      key={sm.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : isGraduated
                          ? 'border-success/40 bg-surface-raised/20'
                          : 'border-border/60 bg-surface-raised/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge badge-primary text-xs font-black">
                              {pool.displayCode}
                            </span>
                            <h3 className="font-bold text-sm text-foreground">
                              {sm.title}
                            </h3>
                            {isCurrent && (
                              <span className="badge badge-accent text-[10px]">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {sm.earRule}
                          </p>
                        </div>

                        {/* Graduation / Pass Badge */}
                        <div className="text-right">
                          {isGraduated ? (
                            <span className="badge badge-success text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Graduated ({passes}/{reqPasses})
                            </span>
                          ) : passes > 0 ? (
                            <span className="badge badge-warning text-[11px] flex items-center gap-1">
                              <Award className="w-3 h-3" /> Pass {passes}/{reqPasses}
                            </span>
                          ) : (
                            <span className="badge badge-subtle text-[11px]">
                              Pass 0/{reqPasses}
                            </span>
                          )}
                          {liveAccuracy !== null && (
                            <div className="text-[10px] text-muted mt-1">
                              Pair Mastery: <strong className="text-foreground">{liveAccuracy}%</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Delta Summary Chips */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5 text-[11px]">
                        {sm.newTenseIds.length > 0 && (
                          <span className="badge badge-accent">
                            +Tense:{' '}
                            {sm.newTenseIds
                              .map((id) => tenseNameById[id] ?? id)
                              .join(', ')}
                          </span>
                        )}
                        {sm.newVerbIds.length > 0 ? (
                          <span className="badge badge-neutral">
                            +Verbs:{' '}
                            {sm.newVerbIds
                              .map((id) => verbNameById[id] ?? id)
                              .join(', ')}
                          </span>
                        ) : (
                          <span className="badge badge-subtle">
                            Focus:{' '}
                            {pool.focusVerbIds
                              .slice(0, 4)
                              .map((id) => verbNameById[id] ?? id)
                              .join(', ')}
                          </span>
                        )}
                        {sm.newChunks.length > 0 && (
                          <span className="badge badge-subtle">
                            +{sm.newChunks.length} Chunks (
                            {sm.newChunks
                              .slice(0, 2)
                              .map((c) => `"${c.target}"`)
                              .join(', ')}
                            )
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-border/40">
                        <button
                          type="button"
                          onClick={() => onOpenCompanionLesson(sm.id)}
                          className="btn btn-subtle text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          Companion Lesson
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSubModule(sm.id);
                            onClose();
                          }}
                          className={`btn text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                            isCurrent ? 'btn-primary' : 'btn-subtle'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {isCurrent ? 'Drill Active' : 'Select & Drill'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
