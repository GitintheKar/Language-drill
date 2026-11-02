import React, { useState, useEffect } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Mic,
  Download,
  Languages,
  Clock,
  Sliders,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react';
import { AppSettings } from '../state/useAppSettings';
import { BYOKConfig, LocalWhisperStatus } from '../speech/types';
import { PolarityMode, TenseConfig } from '../languages/types';
import { RassiasDrillCadence } from '../engine/drillDirector';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  tenses: TenseConfig[];
  whisperStatus: LocalWhisperStatus;
  onSaveAndRestart: (updatedSettings: AppSettings) => void;
  onPreloadWhisper: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  tenses,
  whisperStatus,
  onSaveAndRestart,
  onPreloadWhisper,
}) => {
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [showAdvancedTenses, setShowAdvancedTenses] = useState(false);

  // Whenever drawer opens, clone active settings into draft
  useEffect(() => {
    if (isOpen) {
      setDraftSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const currentLang = draftSettings.language;
  const currentActiveTenseIds = draftSettings.activeTenseIdsByLang[currentLang] || [];
  const activeTenseSet = new Set(currentActiveTenseIds);
  const coreTenses = tenses.filter((t) => t.category === 'core');
  const advancedTenses = tenses.filter((t) => t.category === 'advanced');

  const updateDraft = (patch: Partial<AppSettings>) => {
    setDraftSettings((prev) => ({ ...prev, ...patch }));
  };

  const updateDraftBYOK = (patch: Partial<BYOKConfig>) => {
    setDraftSettings((prev) => ({
      ...prev,
      byokConfig: { ...prev.byokConfig, ...patch },
    }));
  };

  const toggleDraftTense = (tenseId: string) => {
    setDraftSettings((prev) => {
      const lang = prev.language;
      const list = prev.activeTenseIdsByLang[lang] || [];
      const exists = list.includes(tenseId);
      if (exists && list.length <= 1) return prev; // Keep at least 1 tense
      const nextList = exists
        ? list.filter((id) => id !== tenseId)
        : [...list, tenseId];
      return {
        ...prev,
        activeTenseIdsByLang: {
          ...prev.activeTenseIdsByLang,
          [lang]: nextList,
        },
      };
    });
  };

  const selectDraftTensePreset = (preset: 'core' | 'comprehensive') => {
    setDraftSettings((prev) => {
      const nextIds =
        preset === 'core'
          ? coreTenses.map((t) => t.id)
          : tenses.map((t) => t.id);
      return {
        ...prev,
        activeTenseIdsByLang: {
          ...prev.activeTenseIdsByLang,
          [prev.language]: nextIds,
        },
      };
    });
  };

  const handleSave = () => {
    onSaveAndRestart(draftSettings);
  };

  const hasChanges = JSON.stringify(draftSettings) !== JSON.stringify(settings);

  return (
    <div className="drawer-overlay fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="drawer-panel w-full max-w-md h-full bg-surface flex flex-col shadow-2xl border-l border-border animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Drill & Audio Settings
              </h2>
              <span className="text-[11px] text-muted">
                {hasChanges ? 'Unsaved draft changes' : 'Current settings active'}
              </span>
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

        {/* Scrollable Content Body */}
        <div className="p-4 space-y-6 flex-1 text-sm overflow-y-auto">
          {/* Section 1: Language & Dialect */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Languages className="w-4 h-4" /> Practice Language
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateDraft({ language: 'fr' })}
                className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                  draftSettings.language === 'fr'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-surface-raised/40 text-muted hover:text-foreground'
                }`}
              >
                🇫🇷 French
              </button>
              <button
                type="button"
                onClick={() => updateDraft({ language: 'es' })}
                className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                  draftSettings.language === 'es'
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-surface-raised/40 text-muted hover:text-foreground'
                }`}
              >
                🇪🇸 Spanish
              </button>
            </div>

            {draftSettings.language === 'es' && (
              <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-semibold">Spanish Dialect &amp; Voice</span>
                    <span className="text-muted text-[11px]">
                      {draftSettings.locales.es === 'es-MX'
                        ? 'Latin America (es-MX / ustedes default)'
                        : 'Castilian Spain (es-ES)'}
                    </span>
                  </div>
                  <select
                    className="input-field text-xs py-1 px-2"
                    value={draftSettings.locales.es}
                    onChange={(e) => {
                      const nextLocale = e.target.value;
                      updateDraft({
                        locales: {
                          ...draftSettings.locales,
                          es: nextLocale,
                        },
                      });
                    }}
                  >
                    <option value="es-MX">Latinoamérica (es-MX)</option>
                    <option value="es-ES">España (es-ES)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Include Spain &quot;Vosotros&quot; (You all)</span>
                  <input
                    type="checkbox"
                    checked={draftSettings.includeVosotros}
                    onChange={(e) =>
                      updateDraft({ includeVosotros: e.target.checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-semibold">Spanish Subject Pronouns</span>
                    <span className="text-muted text-[11px]">
                      {draftSettings.spanishPronounMode === 'pro_drop'
                        ? 'Pro-Drop: Natural native speech (say "hablo" or "yo hablo")'
                        : 'Disambiguate: Require "yo" vs "él" on identical verb forms'}
                    </span>
                  </div>
                  <select
                    className="input-field text-xs py-1 px-2"
                    value={draftSettings.spanishPronounMode}
                    onChange={(e) =>
                      updateDraft({
                        spanishPronounMode: e.target.value as 'pro_drop' | 'disambiguate',
                      })
                    }
                  >
                    <option value="pro_drop">Pro-Drop (Natural)</option>
                    <option value="disambiguate">Disambiguate</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Rassias Drill Mechanics */}
          <div className="space-y-3 pt-4 border-t border-border">
            <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Drill Cadence & Polarity
            </label>

            <div>
              <span className="text-xs text-muted block mb-1.5 font-semibold">
                Cadence Mode
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(
                  [
                    ['substitution', 'Substitution (Pronouns)'],
                    ['transformation', 'Transformation (Tenses)'],
                    ['qa_flip', 'Q & A Flip (Dialogue)'],
                    ['roulette', 'Roulette (Mixed Chaos)'],
                  ] as [RassiasDrillCadence, string][]
                ).map(([cadence, label]) => (
                  <button
                    key={cadence}
                    type="button"
                    onClick={() => updateDraft({ cadence })}
                    className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                      draftSettings.cadence === cadence
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 bg-surface-raised/30 text-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <span className="text-xs text-muted block mb-1.5 font-semibold">
                Polarity Mode
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(
                  [
                    ['affirmative', 'Affirmative only'],
                    ['negative', 'Negative only'],
                    ['ping_pong', '2-Beat Ping-Pong'],
                    ['mixed', 'Mixed Polarity'],
                  ] as [PolarityMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateDraft({ polarityMode: mode })}
                    className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                      draftSettings.polarityMode === mode
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/60 bg-surface-raised/30 text-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
              <span className="text-muted">
                Varied negative adverbs (ne... jamais, plus / nunca, ya no)
              </span>
              <input
                type="checkbox"
                checked={draftSettings.enableNegativeAdverbs}
                onChange={(e) =>
                  updateDraft({ enableNegativeAdverbs: e.target.checked })
                }
              />
            </div>
          </div>

          {/* Section 3: Speech Recognition Engine */}
          <div className="space-y-3 pt-4 border-t border-border">
            <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Mic className="w-4 h-4" /> Speech Recognition Engine
            </label>

            <div className="space-y-3">
              {/* Option 1: Browser Web Speech */}
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  draftSettings.speechEngine === 'web_speech'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 bg-surface-raised/20'
                }`}
              >
                <input
                  type="radio"
                  name="engine"
                  value="web_speech"
                  checked={draftSettings.speechEngine === 'web_speech'}
                  onChange={() => updateDraft({ speechEngine: 'web_speech' })}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block">
                    Browser Web Speech API (Default)
                  </span>
                  <p className="text-[11px] text-muted">
                    Native speech engine in Chrome. Zero install required.
                  </p>
                </div>
              </label>

              {/* Option 2: Local Whisper */}
              <div
                className={`p-3 rounded-xl border space-y-2.5 transition-all ${
                  draftSettings.speechEngine === 'local_whisper'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 bg-surface-raised/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="engine"
                      value="local_whisper"
                      checked={draftSettings.speechEngine === 'local_whisper'}
                      onChange={() => updateDraft({ speechEngine: 'local_whisper' })}
                    />
                    Local On-Device Whisper (Offline Web Worker)
                  </label>
                  <span className="badge badge-subtle text-[10px]">Private</span>
                </div>
                <p className="text-[11px] text-muted pl-5">
                  Runs Whisper-tiny in a background Web Worker via WASM/WebGPU. 100% offline, zero network requests.
                </p>

                <div className="pl-5 flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-muted truncate">
                    {whisperStatus.statusText}
                  </span>
                  {whisperStatus.state !== 'ready' && (
                    <button
                      type="button"
                      onClick={onPreloadWhisper}
                      disabled={whisperStatus.state === 'loading'}
                      className="btn btn-subtle text-xs py-1 px-2.5 flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {whisperStatus.state === 'loading'
                        ? `${whisperStatus.progress}%`
                        : 'Download (~40 MB)'}
                    </button>
                  )}
                </div>
              </div>

              {/* Option 3: Bring Your Own Key */}
              <div
                className={`p-3 rounded-xl border space-y-2.5 transition-all ${
                  draftSettings.speechEngine === 'byok'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 bg-surface-raised/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="engine"
                      value="byok"
                      checked={draftSettings.speechEngine === 'byok'}
                      onChange={() => updateDraft({ speechEngine: 'byok' })}
                    />
                    Bring Your Own Key (BYOK Cloud API)
                  </label>
                  <span className="badge badge-warning text-[10px]">Stress Coaching</span>
                </div>
                <p className="text-[11px] text-muted pl-5">
                  Gemini 2.5 Flash evaluates exact syllable stress (hablo vs. habló) & pronunciation directly from audio.
                </p>

                <div className="pl-5 space-y-2">
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => updateDraftBYOK({ provider: 'gemini' })}
                      className={`px-2.5 py-1 rounded-lg border font-semibold ${
                        draftSettings.byokConfig.provider === 'gemini'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface-raised text-muted'
                      }`}
                    >
                      Gemini 2.5 Flash
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraftBYOK({ provider: 'openai' })}
                      className={`px-2.5 py-1 rounded-lg border font-semibold ${
                        draftSettings.byokConfig.provider === 'openai'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-surface-raised text-muted'
                      }`}
                    >
                      OpenAI Whisper
                    </button>
                  </div>

                  {draftSettings.byokConfig.provider === 'gemini' ? (
                    <input
                      type="password"
                      className="input-field text-xs w-full py-1.5 px-3"
                      placeholder="Paste Gemini API Key..."
                      value={draftSettings.byokConfig.geminiApiKey}
                      onChange={(e) => updateDraftBYOK({ geminiApiKey: e.target.value })}
                    />
                  ) : (
                    <input
                      type="password"
                      className="input-field text-xs w-full py-1.5 px-3"
                      placeholder="Paste OpenAI API Key (sk-...)"
                      value={draftSettings.byokConfig.openaiApiKey}
                      onChange={(e) => updateDraftBYOK({ openaiApiKey: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Cadence Timers & Hands-Free Toggles */}
          <div className="space-y-3 pt-4 border-t border-border">
            <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Pace & Controls
            </label>

            <div className="space-y-2.5 bg-surface-raised/30 p-3 rounded-xl border border-border/50 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold block">Hands-Free Auto-Advance</span>
                  <span className="text-[11px] text-muted">Auto-listens and advances on completion</span>
                </div>
                <input
                  type="checkbox"
                  checked={draftSettings.handsFreeMode}
                  onChange={(e) => updateDraft({ handsFreeMode: e.target.checked })}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div>
                  <span className="font-semibold block">Reflex Beat Timer</span>
                  <span className="text-[11px] text-muted">
                    {draftSettings.beatTimerSeconds > 0
                      ? `${draftSettings.beatTimerSeconds} seconds before Répétez! loop`
                      : 'Disabled (Take your time)'}
                  </span>
                </div>
                <select
                  className="input-field text-xs py-1 px-2"
                  value={draftSettings.beatTimerSeconds}
                  onChange={(e) =>
                    updateDraft({ beatTimerSeconds: Number(e.target.value) })
                  }
                >
                  <option value={0}>Off (No timer)</option>
                  <option value={3}>3s (Fast AT)</option>
                  <option value={4}>4s (Standard)</option>
                  <option value={6}>6s (Relaxed)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div>
                  <span className="font-semibold block">Quiet / Visual-Only Mode</span>
                  <span className="text-[11px] text-muted">Mutes AT audio cues & snaps for public practice</span>
                </div>
                <input
                  type="checkbox"
                  checked={draftSettings.quietVisualOnlyMode}
                  onChange={(e) =>
                    updateDraft({ quietVisualOnlyMode: e.target.checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 5: Verb Tenses Scope */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                Active Verb Tenses ({currentActiveTenseIds.length} selected)
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => selectDraftTensePreset('core')}
                  className="btn btn-subtle text-[10px] py-0.5 px-2"
                >
                  Core Only
                </button>
                <button
                  type="button"
                  onClick={() => selectDraftTensePreset('comprehensive')}
                  className="btn btn-subtle text-[10px] py-0.5 px-2"
                >
                  All
                </button>
              </div>
            </div>

            {/* Core Tenses */}
            <div className="space-y-1.5">
              {coreTenses.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface-raised/40 hover:bg-surface-raised border border-border/40 text-xs cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-foreground">{t.name}</span>
                    <span className="text-muted block text-[11px]">{t.englishName}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={activeTenseSet.has(t.id)}
                    onChange={() => toggleDraftTense(t.id)}
                  />
                </label>
              ))}
            </div>

            {/* Collapsible Advanced Tenses */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvancedTenses(!showAdvancedTenses)}
                className="btn btn-subtle w-full text-xs py-2 flex items-center justify-between text-muted"
              >
                <span>
                  Advanced & Compound Tenses ({advancedTenses.length} tenses)
                </span>
                {showAdvancedTenses ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {showAdvancedTenses && (
                <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-primary/30">
                  {advancedTenses.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-raised/40 hover:bg-surface-raised border border-border/40 text-xs cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-foreground">{t.name}</span>
                        <span className="text-muted block text-[11px]">{t.englishName}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeTenseSet.has(t.id)}
                        onChange={() => toggleDraftTense(t.id)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Action Footer: Cancel (Undo) vs Save & Restart Drill */}
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
