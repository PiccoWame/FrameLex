import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Columns2,
  Copy,
  Download,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type {
  AnalysisResponse,
  AnatomyLayerKey,
  Dialect,
  FocusBias,
  MidjourneyOptions,
  PromptAnatomy,
  StylisticVariation,
} from '../types/prompt';
import {
  DIALECT_META,
  estimateTokenCount,
} from '../utils/promptAssembler';
import {
  ANATOMY_GROUPS,
  filterAnatomyIndex,
  type AnatomyFilterGroup,
  type AnatomyLayerGroup,
} from '../data/anatomyCatalog';
import { generateContextualSuggestions } from '../utils/suggestionEngine';
import type { PromptTemplate } from '../data/promptTemplates';
import { copyToClipboard } from '../utils/clipboard';
import {
  PromptTemplateLibrary,
  type TemplateApplyMode,
} from './PromptTemplateLibrary';

const AnatomyRadarChart = lazy(() =>
  import('./AnatomyRadarChart').then((m) => ({ default: m.AnatomyRadarChart }))
);

const GROUP_ICON_STYLE: Record<AnatomyLayerGroup, string> = {
  'Optics & Space': 'bg-[#EEF2FF] border-[#D8E0FC]',
  'Subject & Scene': 'bg-[#FFF4ED] border-[#F5DFD0]',
  'Light & Material': 'bg-[#F5F3FF] border-[#E2D9FA]',
};

interface PromptWorkbenchProps {
  hasImage: boolean;
  isAnalyzing: boolean;
  analysisError: string | null;
  analysis: AnalysisResponse | null;
  dialect: Dialect;
  onDialectChange: (d: Dialect) => void;
  complexity: number;
  lastAnalyzedComplexity: number | null;
  onComplexityChange: (value: number) => void;
  focusBias: FocusBias;
  onFocusBiasChange: (bias: FocusBias) => void;
  customNotes: string;
  onCustomNotesChange: (notes: string) => void;
  onRunAnalysis: () => void;
  originalPrompt: string;
  assembledPrompt: string;
  assembledNegative: string;
  manualOverridePrompt: string | null;
  onManualOverrideChange: (text: string | null) => void;
  anatomy: PromptAnatomy;
  enabledLayers: Record<AnatomyLayerKey, boolean>;
  onToggleLayer: (key: AnatomyLayerKey) => void;
  onUpdateLayerText: (key: keyof PromptAnatomy, value: string) => void;
  isAnatomyCustomized: boolean;
  onResetAnatomy: () => void;
  extraKeywords: string[];
  onToggleKeyword: (kw: string) => void;
  mjOptions: MidjourneyOptions;
  onMjOptionsChange: (opts: MidjourneyOptions) => void;
  aspectRatioLabel: string;
  onRefinePrompt: (instruction: string) => Promise<void>;
  isRefining: boolean;
  refineSummary: string | null;
  refineError: string | null;
  stylisticVariations: StylisticVariation[];
  isGeneratingVariations: boolean;
  variationsError: string | null;
  appliedVariationId: string | null;
  onSuggestVariations: () => Promise<void>;
  onApplyVariation: (variation: StylisticVariation) => void;
  onEnhancePrompt: () => Promise<boolean>;
  isEnhancing: boolean;
  lastAutoSavedAt: number | null;
  isSignedIn: boolean;
  activeCloudPromptId: string | null;
  isSavingCloud: boolean;
  cloudSaveStatus: string | null;
  onSaveToCloud: (asNew?: boolean) => Promise<void>;
  appliedTemplateId: string | null;
  onApplyTemplate: (template: PromptTemplate, mode: TemplateApplyMode) => void;
  onExportJson: () => void;
  onExportTxt: () => void;
}

const DIALECT_LIST: Dialect[] = ['general', 'midjourney', 'flux', 'sdxl', 'video'];

const REMIX_PRESETS = [
  'Shift to golden hour sunlight',
  '35mm Kodak Portra film grain',
  'Minimalist studio backdrop',
  'Architectural ink and wash',
];

function getComplexityLabel(value: number): string {
  if (value <= 2) return 'Minimal Core';
  if (value <= 4) return 'Crisp Structured';
  if (value <= 6) return 'Balanced Detail';
  if (value <= 8) return 'Granular Systematic';
  return 'Forensic Exhaustive';
}

export const PromptWorkbench: React.FC<PromptWorkbenchProps> = ({
  hasImage,
  isAnalyzing,
  analysisError,
  analysis,
  dialect,
  onDialectChange,
  complexity,
  lastAnalyzedComplexity,
  onComplexityChange,
  focusBias,
  onFocusBiasChange,
  customNotes,
  onCustomNotesChange,
  onRunAnalysis,
  originalPrompt,
  assembledPrompt,
  assembledNegative,
  manualOverridePrompt,
  onManualOverrideChange,
  anatomy,
  enabledLayers,
  onToggleLayer,
  onUpdateLayerText,
  isAnatomyCustomized,
  onResetAnatomy,
  extraKeywords,
  onToggleKeyword,
  mjOptions,
  onMjOptionsChange,
  aspectRatioLabel,
  onRefinePrompt,
  isRefining,
  refineSummary,
  refineError,
  stylisticVariations,
  isGeneratingVariations,
  variationsError,
  appliedVariationId,
  onSuggestVariations,
  onApplyVariation,
  onEnhancePrompt,
  isEnhancing,
  lastAutoSavedAt,
  isSignedIn,
  activeCloudPromptId,
  isSavingCloud,
  cloudSaveStatus,
  onSaveToCloud,
  appliedTemplateId,
  onApplyTemplate,
  onExportJson,
  onExportTxt,
}) => {
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [isEditingDirect, setIsEditingDirect] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [anatomySearch, setAnatomySearch] = useState('');
  const [anatomyFilterGroup, setAnatomyFilterGroup] =
    useState<AnatomyFilterGroup>('all');

  const displayedPrompt = manualOverridePrompt ?? assembledPrompt;
  const wordCount = displayedPrompt.trim() ? displayedPrompt.trim().split(/\s+/).length : 0;
  const charCount = displayedPrompt.length;
  const tokenCount = useMemo(() => estimateTokenCount(displayedPrompt), [displayedPrompt]);
  const originalWordCount = originalPrompt.trim()
    ? originalPrompt.trim().split(/\s+/).length
    : 0;
  const originalCharCount = originalPrompt.length;
  const originalTokenCount = useMemo(() => estimateTokenCount(originalPrompt), [originalPrompt]);
  const hasPromptChanges = displayedPrompt.trim() !== originalPrompt.trim();
  const complexityChanged =
    Boolean(analysis) && lastAnalyzedComplexity !== null && lastAnalyzedComplexity !== complexity;
  const autoSaveLabel = lastAutoSavedAt
    ? `Auto-saved ${new Date(lastAutoSavedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

  const contextualSuggestions = useMemo(
    () => generateContextualSuggestions(analysis, dialect),
    [analysis, dialect]
  );

  const filteredAnatomyLayers = useMemo(
    () =>
      filterAnatomyIndex({
        query: anatomySearch,
        group: anatomyFilterGroup,
        enabledLayers,
        anatomy,
      }),
    [anatomySearch, anatomyFilterGroup, enabledLayers, anatomy]
  );

  const handleCopy = async (text: string, target: string) => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1500);
    }
  };

  const handleCopyAllAnatomy = () => {
    const serialized = JSON.stringify(
      {
        ...anatomy,
        enabledLayers,
      },
      null,
      2
    );
    void handleCopy(serialized, 'anatomyAll');
  };

  const handleEnhanceClick = async () => {
    const ok = await onEnhancePrompt();
    if (ok) {
      setIsSplitView(true);
    }
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineInput.trim() || isRefining) return;
    const cmd = refineInput.trim();
    setRefineInput('');
    await onRefinePrompt(cmd);
  };

  return (
    <div className="space-y-5">
      {/* Dialect & Extraction Controls */}
      <div className="bg-white border border-[#E2DFEE] rounded-xl p-4 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#ECEAF6] rounded-lg overflow-x-auto max-w-full">
            {DIALECT_LIST.map((d) => {
              const active = dialect === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDialectChange(d)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
                    active
                      ? 'bg-white text-indigo-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {DIALECT_META[d].shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedConfig((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                showAdvancedConfig
                  ? 'border-indigo-950 bg-indigo-950 text-white'
                  : 'border-[#E2DFEE] bg-white text-slate-700 hover:border-indigo-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Parameters</span>
            </button>
            <button
              type="button"
              disabled={!hasImage || isAnalyzing}
              onClick={onRunAnalysis}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-1"
            >
              {isAnalyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Extract Prompt'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          {DIALECT_META[dialect].label} — {DIALECT_META[dialect].summary}
        </p>

        {/* Complexity Slider */}
        <div className="pt-3 border-t border-[#ECEAF6]">
          <div className="flex items-center justify-between gap-3 mb-2">
            <label
              htmlFor="complexity-slider"
              className="text-xs font-semibold text-slate-900"
            >
              Complexity
            </label>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              <span className="font-medium text-slate-700">
                {getComplexityLabel(complexity)}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#EEF2FF] font-mono font-semibold text-indigo-900">
                {complexity}/10
              </span>
            </div>
          </div>
          <input
            id="complexity-slider"
            type="range"
            min={1}
            max={10}
            step={1}
            value={complexity}
            onChange={(e) => onComplexityChange(Number(e.target.value))}
            className="w-full accent-indigo-700 cursor-pointer"
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>1 · Core subject</span>
            <span>5 · Balanced planes</span>
            <span>10 · Unlimited forensic detail</span>
          </div>
          {complexityChanged && hasImage && (
            <p className="mt-1.5 text-[11px] text-indigo-700 font-medium">
              Complexity updated to {complexity}/10 — click Re-analyze to regenerate extraction at this depth.
            </p>
          )}
        </div>

        {showAdvancedConfig && (
          <div className="pt-3 border-t border-[#ECEAF6] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="focus-bias-select"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Analytical Focus
              </label>
              <select
                id="focus-bias-select"
                value={focusBias}
                onChange={(e) => onFocusBiasChange(e.target.value as FocusBias)}
                className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-[#E2DFEE] rounded-lg text-slate-900 focus:outline-none focus:border-indigo-700"
              >
                <option value="full">Full Forensic Inventory</option>
                <option value="photography">Photography, Lens &amp; Lighting</option>
                <option value="style">Art Medium &amp; Surface Craft</option>
                <option value="composition">Spatial Fields, Planes &amp; Routes</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="custom-notes-input"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Optional Extraction Guidance
              </label>
              <input
                id="custom-notes-input"
                type="text"
                value={customNotes}
                onChange={(e) => onCustomNotesChange(e.target.value)}
                placeholder="e.g., Trace wall patina and floor reflections, omit distant figures..."
                className="w-full px-3 py-1.5 text-xs bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-700"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {analysisError && (
        <div
          role="alert"
          className="bg-[#FFF1F2] border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-4"
        >
          <div>
            <h3 className="text-sm font-semibold text-rose-900">
              Analysis could not be completed
            </h3>
            <p className="text-xs text-rose-800 mt-1">{analysisError}</p>
          </div>
          {hasImage && (
            <button
              type="button"
              onClick={onRunAnalysis}
              className="px-3 py-1.5 text-xs font-medium text-rose-900 bg-white border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isAnalyzing && (
        <div className="bg-white border border-[#E2DFEE] rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">
              Inspecting visual structure and lighting...
            </span>
            <span className="text-xs text-indigo-800 font-medium">Extracting 5 dialects</span>
          </div>
          <div className="space-y-2.5 animate-pulse">
            <div className="h-4 bg-[#ECEAF6] rounded w-11/12" />
            <div className="h-4 bg-[#ECEAF6] rounded w-full" />
            <div className="h-4 bg-[#ECEAF6] rounded w-4/5" />
          </div>
          <div className="pt-3 border-t border-[#ECEAF6] grid grid-cols-2 gap-3 animate-pulse">
            <div className="h-12 bg-[#F5F3FF] rounded-lg" />
            <div className="h-12 bg-[#F5F3FF] rounded-lg" />
          </div>
        </div>
      )}

      {/* Empty State when image is loaded or before first analysis */}
      {!isAnalyzing && !analysis && !analysisError && (
        <div className="space-y-5">
          <div className="bg-white border border-[#E2DFEE] rounded-xl p-8 text-center shadow-2xs">
            <h3 className="font-display text-base font-semibold text-slate-900">
              {hasImage ? 'Ready to extract prompt' : 'Select or drop an image to begin'}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
              {hasImage
                ? 'Click Extract Prompt above to generate multi-dialect prompts, modular anatomy layers, and keyword tokens.'
                : 'FrameLex inspects composition, lens optics, lighting, medium, and color harmony across five generator dialects—or start directly from a template below.'}
            </p>
          </div>

          <PromptTemplateLibrary
            hasAnalysis={false}
            appliedTemplateId={appliedTemplateId}
            onApplyTemplate={onApplyTemplate}
          />
        </div>
      )}

      {/* Populated Master Prompt & Modular Anatomy */}
      {!isAnalyzing && analysis && (
        <>
          <div className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-[#E2DFEE] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {analysis.title || 'Generated Prompt'}
                </h3>
                <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                  {wordCount} words · {charCount} chars
                </span>
                {hasPromptChanges && (
                  <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">
                    · Modified
                  </span>
                )}
                {autoSaveLabel && (
                  <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                    · {autoSaveLabel}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <span
                  aria-live="polite"
                  title="Real-time estimated BPE/CLIP token count"
                  className="px-2.5 py-1.5 text-xs font-mono text-indigo-950 bg-[#F5F3FF] border border-[#E2DFEE] rounded-lg tabular-nums whitespace-nowrap shrink-0"
                >
                  {tokenCount} {tokenCount === 1 ? 'token' : 'tokens'}
                </span>
                <button
                  type="button"
                  disabled={!displayedPrompt || isEnhancing || isRefining}
                  onClick={handleEnhanceClick}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>{isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingCloud || !displayedPrompt}
                  onClick={() => void onSaveToCloud(false)}
                  title={
                    isSignedIn
                      ? activeCloudPromptId
                        ? 'Save updates to this cloud prompt'
                        : 'Save prompt to your account library'
                      : 'Sign in to save prompts and track history in your account'
                  }
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isSignedIn && activeCloudPromptId
                      ? 'border-emerald-200 bg-[#ECFDF5] text-emerald-800 hover:bg-emerald-100'
                      : 'border-[#E2DFEE] bg-white text-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>
                    {isSavingCloud
                      ? 'Saving...'
                      : isSignedIn
                        ? activeCloudPromptId
                          ? 'Update Saved'
                          : 'Save Prompt'
                        : 'Save to Account'}
                  </span>
                </button>
                {isSignedIn && activeCloudPromptId && (
                  <button
                    type="button"
                    disabled={isSavingCloud}
                    onClick={() => void onSaveToCloud(true)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-[#F7F6FB] border border-[#E2DFEE] hover:bg-[#ECEAF6] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Save as New
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSplitView((v) => !v)}
                  aria-pressed={isSplitView}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isSplitView
                      ? 'border-indigo-700 bg-[#EEF2FF] text-indigo-950'
                      : 'border-[#E2DFEE] bg-white text-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDirect((v) => !v)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isEditingDirect || manualOverridePrompt !== null
                      ? 'bg-[#ECEAF6] text-indigo-950'
                      : 'text-slate-700 bg-[#F7F6FB] border border-[#E2DFEE] hover:bg-[#ECEAF6]'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isEditingDirect ? 'Done' : 'Edit'}</span>
                </button>
                {manualOverridePrompt !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      onManualOverrideChange(null);
                      setIsEditingDirect(false);
                    }}
                    title="Revert to extracted prompt"
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-[#F5F3FF] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExportTxt}
                  title="Export TXT"
                  aria-label="Export prompt as TXT"
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-[#F5F3FF] rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onExportJson}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-[#F7F6FB] border border-[#E2DFEE] hover:bg-[#ECEAF6] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy(displayedPrompt, 'prompt')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-indigo-950 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedTarget === 'prompt' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {cloudSaveStatus && (
              <div className="px-4 py-1.5 bg-[#ECFDF5] border-b border-emerald-200 text-xs text-emerald-800">
                {cloudSaveStatus}
              </div>
            )}

            {isSplitView ? (
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E2DFEE]">
                {/* Original AI-Generated Prompt Pane */}
                <div className="p-4 bg-[#F7F6FB] flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2DFEE]">
                    <div>
                      <span className="text-xs font-semibold text-slate-800">
                        Original AI Prompt
                      </span>
                      <span className="ml-2 text-[11px] text-slate-500 tabular-nums">
                        {originalTokenCount} tokens · {originalWordCount} words · {originalCharCount} chars
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasPromptChanges && (
                        <button
                          type="button"
                          onClick={() => {
                            onResetAnatomy();
                            setIsEditingDirect(false);
                          }}
                          className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline"
                        >
                          Use original
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopy(originalPrompt, 'original')}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                      >
                        {copiedTarget === 'original' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-700" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                    {originalPrompt}
                  </p>
                </div>

                {/* Current Edited / Enhanced Prompt Pane */}
                <div className="p-4 bg-white flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2DFEE]">
                    <div>
                      <span className="text-xs font-semibold text-slate-900">
                        {manualOverridePrompt !== null
                          ? 'Edited / Enhanced Prompt'
                          : isAnatomyCustomized
                            ? 'Customized Anatomy Prompt'
                            : 'Current Active Prompt'}
                      </span>
                      <span className="ml-2 text-[11px] text-slate-500 tabular-nums">
                        {tokenCount} tokens · {wordCount} words · {charCount} chars
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopy(displayedPrompt, 'prompt')}
                      className="text-xs font-medium text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedTarget === 'prompt' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  {isEditingDirect ? (
                    <textarea
                      value={displayedPrompt}
                      onChange={(e) => onManualOverrideChange(e.target.value)}
                      rows={10}
                      aria-label="Direct prompt editor"
                      className="w-full p-3 font-mono text-[13px] leading-relaxed text-slate-900 bg-[#F7F6FB] border border-[#CFC9E6] rounded-lg focus:outline-none focus:bg-white focus:border-indigo-700 resize-y"
                    />
                  ) : (
                    <p className="font-mono text-[13px] leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
                      {displayedPrompt}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {isEditingDirect ? (
                  <textarea
                    value={displayedPrompt}
                    onChange={(e) => onManualOverrideChange(e.target.value)}
                    rows={8}
                    aria-label="Direct prompt editor"
                    className="w-full p-3 font-mono text-[13px] leading-relaxed text-slate-900 bg-[#F7F6FB] border border-[#CFC9E6] rounded-lg focus:outline-none focus:bg-white focus:border-indigo-700 resize-y"
                  />
                ) : (
                  <p className="font-mono text-[13px] leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
                    {displayedPrompt}
                  </p>
                )}
              </div>
            )}

            {((dialect === 'midjourney' && manualOverridePrompt === null) ||
              (dialect === 'sdxl' && assembledNegative)) && (
              <div className="px-4 pb-4">
                {/* Midjourney Parameter Controls */}
                {dialect === 'midjourney' && manualOverridePrompt === null && (
                  <div className="pt-3.5 border-t border-[#ECEAF6] flex flex-wrap items-center gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        onMjOptionsChange({ ...mjOptions, includeAr: !mjOptions.includeAr })
                      }
                      className={`px-2.5 py-1 rounded-md border font-mono transition-colors ${
                        mjOptions.includeAr
                          ? 'border-indigo-700 bg-[#EEF2FF] text-indigo-950'
                          : 'border-[#E2DFEE] text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      --ar {aspectRatioLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMjOptionsChange({ ...mjOptions, styleRaw: !mjOptions.styleRaw })
                      }
                      className={`px-2.5 py-1 rounded-md border font-mono transition-colors ${
                        mjOptions.styleRaw
                          ? 'border-indigo-700 bg-[#EEF2FF] text-indigo-950'
                          : 'border-[#E2DFEE] text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      --style raw
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMjOptionsChange({ ...mjOptions, includeNo: !mjOptions.includeNo })
                      }
                      className={`px-2.5 py-1 rounded-md border font-mono transition-colors ${
                        mjOptions.includeNo
                          ? 'border-indigo-700 bg-[#EEF2FF] text-indigo-950'
                          : 'border-[#E2DFEE] text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      --no exclusions
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMjOptionsChange({
                          ...mjOptions,
                          version: mjOptions.version === '7' ? '6.1' : '7',
                        })
                      }
                      className="px-2.5 py-1 rounded-md border border-[#E2DFEE] text-slate-700 hover:border-indigo-300 font-mono transition-colors"
                    >
                      --v {mjOptions.version}
                    </button>
                    <label className="flex items-center gap-2 ml-auto text-slate-600 font-mono tabular-nums">
                      <span>--stylize {mjOptions.stylize}</span>
                      <input
                        type="range"
                        min={0}
                        max={1000}
                        step={50}
                        value={mjOptions.stylize}
                        onChange={(e) =>
                          onMjOptionsChange({
                            ...mjOptions,
                            stylize: Number(e.target.value),
                          })
                        }
                        className="w-24 accent-indigo-700"
                      />
                    </label>
                  </div>
                )}

                {/* SDXL Negative Prompt */}
                {dialect === 'sdxl' && assembledNegative && (
                  <div className="pt-3.5 border-t border-[#ECEAF6]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-700">
                        Negative Prompt
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(assembledNegative, 'negative')}
                        className="text-xs font-medium text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
                      >
                        {copiedTarget === 'negative' ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Negative</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-slate-600 leading-relaxed">
                      {assembledNegative}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Steer & Remix Bar */}
            <div className="px-4 py-3.5 border-t border-[#E2DFEE] bg-[#F5F3FF]/65 space-y-2.5">
              <form onSubmit={handleRefineSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={refineInput}
                    onChange={(e) => setRefineInput(e.target.value)}
                    placeholder="Steer or remix prompt (e.g., Shift to rainy night, switch to 16mm lens)..."
                    aria-label="Prompt refinement instruction"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!refineInput.trim() || isRefining}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-indigo-950 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isRefining ? 'Refining...' : 'Apply Remix'}
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-600 mr-1">Quick variations:</span>
                {REMIX_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isRefining}
                    onClick={() => onRefinePrompt(preset)}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 hover:bg-[#EEF2FF]/60 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {refineSummary && (
                <p className="text-xs text-emerald-700 font-medium">{refineSummary}</p>
              )}
              {refineError && (
                <p className="text-xs text-rose-700">{refineError}</p>
              )}
            </div>

            {/* AI Stylistic Variations (3 Directions from Current Anatomy) */}
            <div className="px-4 py-3.5 border-t border-[#E2DFEE] bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">
                    Stylistic Variations
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Generate 3 distinct artistic iterations (e.g., Cinematic, Ethereal, Gritty) grounded in your current anatomy layers
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!displayedPrompt || isGeneratingVariations || isEnhancing || isRefining}
                  onClick={() => void onSuggestVariations()}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-950 bg-[#EEF2FF] border border-[#D8E0FC] hover:bg-[#E0E7FF] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                  <span>
                    {isGeneratingVariations
                      ? 'Generating 3 Styles...'
                      : stylisticVariations.length > 0
                        ? 'Regenerate 3 Styles'
                        : 'Suggest 3 Styles'}
                  </span>
                </button>
              </div>

              {variationsError && (
                <div
                  role="alert"
                  className="p-2.5 bg-[#FFF1F2] border border-rose-200 rounded-lg text-xs text-rose-800"
                >
                  {variationsError}
                </div>
              )}

              {isGeneratingVariations && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-[#E2DFEE] bg-[#F7F6FB] space-y-2.5"
                    >
                      <div className="h-4 w-24 bg-[#ECEAF6] rounded" />
                      <div className="h-3 w-full bg-[#ECEAF6] rounded" />
                      <div className="h-12 w-full bg-white rounded-lg" />
                    </div>
                  ))}
                </div>
              )}

              {!isGeneratingVariations && stylisticVariations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {stylisticVariations.map((variation, idx) => {
                    const cardPalettes = [
                      'bg-[#FFF4ED]/75 border-[#F5DFD0]',
                      'bg-[#F5F3FF]/85 border-[#E2D9FA]',
                      'bg-[#EEF2FF]/80 border-[#D8E0FC]',
                    ];
                    const isApplied = appliedVariationId === variation.id;
                    const copyKey = `variation:${variation.id}`;
                    const varTokens = estimateTokenCount(variation.fullPrompt);

                    return (
                      <div
                        key={variation.id}
                        className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                          isApplied
                            ? 'border-indigo-700 bg-[#EEF2FF]/90 ring-1 ring-indigo-700/15'
                            : `${cardPalettes[idx % cardPalettes.length]} hover:border-indigo-300`
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <h5 className="text-xs font-semibold text-slate-900 truncate">
                              {variation.styleLabel}
                            </h5>
                            <span className="text-[11px] font-mono text-slate-600 tabular-nums shrink-0">
                              {varTokens}t
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {variation.tagline}
                          </p>
                          {variation.styleNotes.length > 0 && (
                            <p className="text-[11px] text-indigo-900/80 font-medium leading-snug">
                              {variation.styleNotes.slice(0, 3).join(' · ')}
                            </p>
                          )}
                          <p className="font-mono text-[11px] text-slate-700 bg-white/80 border border-black/5 rounded-lg p-2 line-clamp-3 leading-relaxed">
                            {variation.fullPrompt}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5">
                          <button
                            type="button"
                            onClick={() => void handleCopy(variation.fullPrompt, copyKey)}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            {copiedTarget === copyKey ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onApplyVariation(variation)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                              isApplied
                                ? 'bg-indigo-700 text-white'
                                : 'bg-slate-900 text-white hover:bg-indigo-950'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Applied</span>
                              </>
                            ) : (
                              <span>Apply to Anatomy</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Descriptor Keywords */}
          {analysis.keywords.length > 0 && (
            <div className="bg-white border border-[#E2DFEE] rounded-xl p-4 shadow-2xs">
              <div className="flex items-baseline justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-slate-900">
                  Visual Descriptor Tokens
                </h3>
                <span className="text-[11px] text-slate-500">
                  Click tokens to append or remove from prompt
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((kw) => {
                  const active = extraKeywords.includes(kw);
                  return (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => onToggleKeyword(kw)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-[#F7F6FB] text-slate-700 border-[#E2DFEE] hover:border-indigo-300'
                      }`}
                    >
                      {active ? `✓ ${kw}` : `+ ${kw}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Anatomy Weight Radar Chart */}
          <Suspense
            fallback={
              <div className="bg-white border border-[#E2DFEE] rounded-xl p-4 h-[320px] flex items-center justify-center text-xs text-slate-500">
                Loading anatomy weight chart...
              </div>
            }
          >
            <AnatomyRadarChart
              anatomy={anatomy}
              enabledLayers={enabledLayers}
              activePrompt={displayedPrompt}
              isManuallyOverridden={manualOverridePrompt !== null}
            />
          </Suspense>

          {/* Reusable Style Prompt Templates Library */}
          <PromptTemplateLibrary
            hasAnalysis={true}
            appliedTemplateId={appliedTemplateId}
            onApplyTemplate={onApplyTemplate}
          />

          {/* Modular Visual Anatomy */}
          <div className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-[#E2DFEE] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Modular Visual Anatomy
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle layers on or off, or edit text inline to rebuild the master prompt
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isAnatomyCustomized && (
                  <button
                    type="button"
                    onClick={onResetAnatomy}
                    className="px-2.5 py-1.5 text-xs font-medium text-indigo-900 bg-[#EEF2FF] hover:bg-[#E0E7FF] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Restore Native Dialect
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyAllAnatomy}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-[#E2DFEE] hover:border-indigo-300 hover:text-slate-900 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedTarget === 'anatomyAll' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-emerald-700">Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Anatomy Index Search & Group Filter Toolbar */}
            <div className="px-4 py-3 bg-[#F7F6FB] border-b border-[#E2DFEE] space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={anatomySearch}
                    onChange={(e) => setAnatomySearch(e.target.value)}
                    placeholder="Filter indexed layers (e.g. 01, lighting, optics, wear, text...)"
                    aria-label="Filter modular anatomy layers"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2DFEE] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-700"
                  />
                </div>
                <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                  Showing {filteredAnatomyLayers.length} of 8 indexed layers
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {ANATOMY_GROUPS.map((grp) => {
                  const selected = anatomyFilterGroup === grp.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setAnatomyFilterGroup(grp.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-white text-slate-700 border-[#E2DFEE] hover:border-indigo-300 hover:text-slate-900'
                      }`}
                    >
                      {grp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-[#ECEAF6]">
              {filteredAnatomyLayers.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-600">
                    No anatomy layers match your current filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAnatomySearch('');
                      setAnatomyFilterGroup('all');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-800 hover:text-indigo-950 bg-[#EEF2FF] rounded-lg transition-colors"
                  >
                    Reset Layer Filters
                  </button>
                </div>
              ) : (
                filteredAnatomyLayers.map((layerMeta) => {
                  const layerKey = layerMeta.key;
                  const isEnabled = enabledLayers[layerKey];
                  const iconFrameClass = GROUP_ICON_STYLE[layerMeta.group];
                  return (
                    <div
                      key={layerKey}
                      className={`p-4 transition-colors ${
                        isEnabled ? 'bg-white' : 'bg-[#F7F6FB] opacity-65'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <label className="inline-flex items-start gap-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => onToggleLayer(layerKey)}
                            className="w-4 h-4 mt-1.5 rounded border-slate-300 text-indigo-700 focus:ring-indigo-700 shrink-0"
                          />
                          <span
                            className={`p-0.5 rounded-lg border shrink-0 ${iconFrameClass}`}
                          >
                            <img
                              src={layerMeta.iconUrl}
                              alt={layerMeta.label}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded-md object-cover"
                            />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-indigo-950 bg-[#ECEAF6] rounded">
                                {layerMeta.indexCode}
                              </span>
                              <span className="text-xs font-semibold text-slate-900">
                                {layerMeta.label}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500">
                                {layerMeta.group}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {layerMeta.description}
                            </p>
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={() => void handleCopy(anatomy[layerKey], layerKey)}
                          className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 shrink-0 mt-1"
                        >
                          {copiedTarget === layerKey ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        value={anatomy[layerKey]}
                        onChange={(e) => onUpdateLayerText(layerKey, e.target.value)}
                        rows={2}
                        aria-label={layerMeta.label}
                        className="w-full px-2.5 py-1.5 text-xs leading-relaxed text-slate-800 bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg focus:outline-none focus:bg-white focus:border-indigo-700 resize-y"
                      />
                    </div>
                  );
                })
              )}

              {/* Negative Prompt Anatomy Row */}
              <div className="p-4 bg-[#FFF1F2]/35">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Negative / Exclusions
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(anatomy.negativePrompt, 'negative')}
                    className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    {copiedTarget === 'negative' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={anatomy.negativePrompt}
                  onChange={(e) => onUpdateLayerText('negativePrompt', e.target.value)}
                  aria-label="Negative exclusions"
                  className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-700 bg-white border border-rose-200/80 rounded-lg focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Contextual Extra Keywords Suggestion Engine */}
          {contextualSuggestions.groups.length > 0 && (
            <div className="bg-white border border-[#E2DFEE] rounded-xl p-4 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Extra Keywords
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Subject-matched modifiers for{' '}
                    <span className="text-indigo-900 font-medium">
                      {contextualSuggestions.matchedSubjectLabel}
                    </span>
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  Click to add or remove from prompt
                </span>
              </div>

              <div className="divide-y divide-[#ECEAF6]">
                {contextualSuggestions.groups.map((group) => (
                  <div key={group.category} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="text-[11px] font-medium text-slate-500 mb-2">
                      {group.category}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.modifiers.map((mod) => {
                        const active = extraKeywords.includes(mod);
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => onToggleKeyword(mod)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap ${
                              active
                                ? 'bg-indigo-700 text-white border-indigo-700'
                                : 'bg-[#F7F6FB] text-slate-700 border-[#E2DFEE] hover:border-indigo-300'
                            }`}
                          >
                            {active ? `✓ ${mod}` : `+ ${mod}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
