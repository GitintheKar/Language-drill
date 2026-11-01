import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  RotateCcw,
  BookOpen,
  Check,
  Search,
} from 'lucide-react';
import { CurriculumTier, LanguageCode, VerbEntry } from '../languages/types';
import { VerbMasteryStats } from '../engine/drillDirector';

interface VerbLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  allVerbs: VerbEntry[];
  activeVerbIds: string[];
  masteryMap: Record<string, VerbMasteryStats>;
  onSaveAndRestart: (updatedVerbIds: string[]) => void;
}

export const VerbLibraryDrawer: React.FC<VerbLibraryDrawerProps> = ({
  isOpen,
  onClose,
  language,
  allVerbs,
  activeVerbIds,
  masteryMap,
  onSaveAndRestart,
}) => {
  const [draftVerbIds, setDraftVerbIds] = useState<string[]>(activeVerbIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    if (isOpen) {
      setDraftVerbIds([...activeVerbIds]);
    }
  }, [isOpen, activeVerbIds]);

  if (!isOpen) return null;

  const activeSet = new Set(draftVerbIds);

  const toggleVerb = (verbId: string) => {
    setDraftVerbIds((prev) => {
      const exists = prev.includes(verbId);
      if (exists && prev.length <= 1) return prev; // Keep at least 1 verb active
      return exists ? prev.filter((id) => id !== verbId) : [...prev, verbId];
    });
  };

  const toggleTier = (tier: CurriculumTier, enable: boolean) => {
    const tierVerbIds = allVerbs.filter((v) => v.tier === tier).map((v) => v.id);
    setDraftVerbIds((prev) => {
      if (enable) {
        return Array.from(new Set([...prev, ...tierVerbIds]));
      }
      const remaining = prev.filter((id) => !tierVerbIds.includes(id));
      return remaining.length > 0 ? remaining : prev;
    });
  };

  const unlockNext = (count = 3) => {
    const inactive = allVerbs.filter((v) => !activeSet.has(v.id));
    if (inactive.length === 0) return;
    const toAdd = inactive.slice(0, count).map((v) => v.id);
    setDraftVerbIds((prev) => [...prev, ...toAdd]);
  };

  const resetToTier1 = () => {
    const tier1Ids = allVerbs.filter((v) => v.tier === 1).map((v) => v.id);
    setDraftVerbIds(tier1Ids);
  };

  const handleSave = () => {
    onSaveAndRestart(draftVerbIds);
  };

  const filteredVerbs = allVerbs.filter((v) => {
    const matchesSearch =
      v.infinitive.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.translation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.groupTag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier =
      selectedTierFilter === 'all' || v.tier === selectedTierFilter;
    return matchesSearch && matchesTier;
  });

  const tierCounts: Record<number, { active: number; total: number }> = {
    1: { active: 0, total: 0 },
    2: { active: 0, total: 0 },
    3: { active: 0, total: 0 },
    4: { active: 0, total: 0 },
    5: { active: 0, total: 0 },
  };

  allVerbs.forEach((v) => {
    if (tierCounts[v.tier]) {
      tierCounts[v.tier].total += 1;
      if (activeSet.has(v.id)) {
        tierCounts[v.tier].active += 1;
      }
    }
  });

  const hasChanges =
    JSON.stringify(draftVerbIds.sort()) !== JSON.stringify([...activeVerbIds].sort());

  return (
    <div className="drawer-overlay fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="drawer-panel w-full max-w-md h-full bg-surface flex flex-col shadow-2xl border-l border-border animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                Verb Curriculum Library
              </h2>
              <p className="text-xs text-muted">
                {draftVerbIds.length} of {allVerbs.length} verbs selected ({language.toUpperCase()})
                {hasChanges && <span className="text-primary font-bold ml-1.5">• Unsaved draft</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-raised text-muted hover:text-foreground"
            title="Cancel / Close (Discard changes)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: + Add Next 3 Verbs & Reset */}
        <div className="p-3 bg-surface-raised/60 border-b border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => unlockNext(3)}
            className="btn btn-primary text-xs py-1.5 px-3 flex-1 flex-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> + Add Next 3 Verbs
          </button>
          <button
            type="button"
            onClick={resetToTier1}
            className="btn btn-subtle text-xs py-1.5 px-3 flex items-center gap-1 text-muted hover:text-foreground"
            title="Reset to Core Tier 1 (6 verbs)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Tier 1
          </button>
        </div>

        {/* Search & Tier Pills */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search verbs or English meanings..."
              className="input-field text-xs pl-8 pr-3 py-1.5 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTierFilter('all')}
              className={`py-1 px-2.5 rounded-full font-semibold transition-all ${
                selectedTierFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-surface-raised text-muted hover:text-foreground'
              }`}
            >
              All ({allVerbs.length})
            </button>
            {[1, 2, 3, 4, 5].map((t) => {
              const info = tierCounts[t];
              const isFull = info.active === info.total && info.total > 0;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    if (selectedTierFilter === t) {
                      toggleTier(t as CurriculumTier, !isFull);
                    } else {
                      setSelectedTierFilter(t);
                    }
                  }}
                  className={`py-1 px-2.5 rounded-full font-semibold whitespace-nowrap transition-all ${
                    selectedTierFilter === t
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-surface-raised text-muted hover:text-foreground'
                  }`}
                  title={`Click to filter. Click again to toggle all Tier ${t} verbs.`}
                >
                  Tier {t} ({info.active}/{info.total})
                </button>
              );
            })}
          </div>
        </div>

        {/* Verb List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredVerbs.length === 0 ? (
            <div className="text-center py-8 text-muted text-xs">
              No verbs found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredVerbs.map((v) => {
              const isActive = activeSet.has(v.id);
              const stats = masteryMap[v.id];
              const masteryRate =
                stats && stats.attempts > 0
                  ? Math.round((stats.correctFirstTry / stats.attempts) * 100)
                  : null;

              return (
                <div
                  key={v.id}
                  onClick={() => toggleVerb(v.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-primary/5 border-primary/40 shadow-sm'
                      : 'bg-surface-raised/20 border-border/40 hover:bg-surface-raised/40 text-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-md flex-center border text-xs ${
                        isActive
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border'
                      }`}
                    >
                      {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {v.infinitive}
                        </span>
                        <span className="text-xs text-muted">
                          — {v.translation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                        <span className="badge badge-subtle py-0 px-1.5 text-[10px]">
                          Tier {v.tier}
                        </span>
                        <span className="text-[11px]">{v.groupTag}</span>
                      </div>
                    </div>
                  </div>

                  {/* Mastery Stats Pill */}
                  {masteryRate !== null ? (
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold ${
                          masteryRate >= 80
                            ? 'text-success'
                            : masteryRate >= 50
                            ? 'text-amber-500'
                            : 'text-muted'
                        }`}
                      >
                        {masteryRate}%
                      </span>
                      <div className="text-[10px] text-muted">
                        {stats.attempts} reps
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted italic">New</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Footer: Cancel (Undo) vs Save & Restart Drill */}
        <div className="p-4 border-t border-border bg-surface/95 backdrop-blur flex items-center justify-between gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-subtle text-xs py-2 px-4 flex-1 text-muted hover:text-foreground"
          >
            Cancel (Undo)
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary text-xs py-2 px-4 flex-2 font-bold shadow-md flex-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Save &amp; Restart Drill
          </button>
        </div>
      </div>
    </div>
  );
};
