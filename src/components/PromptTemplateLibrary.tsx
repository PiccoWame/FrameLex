import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import {
  PROMPT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type PromptTemplate,
  type TemplateCategory,
} from '../data/promptTemplates';

export type TemplateApplyMode = 'blend' | 'replace';

interface PromptTemplateLibraryProps {
  hasAnalysis: boolean;
  appliedTemplateId: string | null;
  onApplyTemplate: (template: PromptTemplate, mode: TemplateApplyMode) => void;
}

const CATEGORY_SURFACE: Record<TemplateCategory, { bg: string; dot: string }> = {
  Cinematic: { bg: 'bg-[#FFF4ED]/70 border-[#F5DFD0]', dot: 'bg-amber-600' },
  Illustrative: { bg: 'bg-[#F5F3FF]/80 border-[#E2D9FA]', dot: 'bg-violet-600' },
  Photorealistic: { bg: 'bg-[#EEF2FF]/80 border-[#D8E0FC]', dot: 'bg-indigo-600' },
  Architectural: { bg: 'bg-[#ECFDF5]/75 border-[#CDEEE0]', dot: 'bg-emerald-700' },
  'Fine Art': { bg: 'bg-[#FFF1F2]/75 border-[#FADCE0]', dot: 'bg-rose-600' },
};

export const PromptTemplateLibrary: React.FC<PromptTemplateLibraryProps> = ({
  hasAnalysis,
  appliedTemplateId,
  onApplyTemplate,
}) => {
  const [isExpanded, setIsExpanded] = useState(!hasAnalysis);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'All'>('All');
  const [applyMode, setApplyMode] = useState<TemplateApplyMode>(
    hasAnalysis ? 'blend' : 'replace'
  );
  const [justAppliedId, setJustAppliedId] = useState<string | null>(null);

  useEffect(() => {
    setApplyMode(hasAnalysis ? 'blend' : 'replace');
  }, [hasAnalysis]);

  const visibleTemplates = useMemo(() => {
    if (selectedCategory === 'All') return PROMPT_TEMPLATES;
    return PROMPT_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const activeTemplate = useMemo(
    () => PROMPT_TEMPLATES.find((t) => t.id === appliedTemplateId) || null,
    [appliedTemplateId]
  );

  const handleApply = (template: PromptTemplate) => {
    const effectiveMode = hasAnalysis ? applyMode : 'replace';
    onApplyTemplate(template, effectiveMode);
    setJustAppliedId(template.id);
    window.setTimeout(() => setJustAppliedId(null), 1600);
  };

  return (
    <div className="bg-white border border-[#E2DFEE] rounded-xl overflow-hidden shadow-2xs">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Style Prompt Templates
            </h3>
            {activeTemplate && (
              <span className="text-xs font-medium text-indigo-700">
                · {activeTemplate.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasAnalysis
              ? 'Apply a curated visual style to your current anatomy layers or replace all layers for fresh inspiration'
              : 'Pick a curated style blueprint to start building and customizing anatomy layers immediately'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="px-3 py-1.5 text-xs font-medium text-indigo-900 bg-[#F5F3FF] border border-[#E2DFEE] hover:bg-[#ECE8FE] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
          <span>{isExpanded ? 'Hide Library' : `Browse Templates (${PROMPT_TEMPLATES.length})`}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-3 border-t border-[#ECEAF6] space-y-3.5">
          {/* Category Filters & Apply Mode Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#ECEAF6] rounded-lg overflow-x-auto max-w-full">
              {(['All', ...TEMPLATE_CATEGORIES] as const).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-indigo-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {hasAnalysis && (
              <div className="flex items-center gap-1 p-1 bg-[#ECEAF6] rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setApplyMode('blend')}
                  title="Keep your current subject, spatial planes, and environment while applying template optics, lighting, color, and medium"
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    applyMode === 'blend'
                      ? 'bg-white text-indigo-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Blend onto Subject
                </button>
                <button
                  type="button"
                  onClick={() => setApplyMode('replace')}
                  title="Replace all 8 anatomy layers with this template blueprint"
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    applyMode === 'replace'
                      ? 'bg-white text-indigo-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Replace All Layers
                </button>
              </div>
            )}
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleTemplates.map((template) => {
              const isApplied = appliedTemplateId === template.id;
              const isJustApplied = justAppliedId === template.id;
              const styleTint = CATEGORY_SURFACE[template.category];
              return (
                <div
                  key={template.id}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    isApplied
                      ? 'border-indigo-700 bg-[#EEF2FF]/75'
                      : `${styleTint.bg} hover:border-indigo-300`
                  }`}
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-900">
                        {template.name}
                      </h4>
                      <span className="text-[11px] font-medium text-slate-600 inline-flex items-center gap-1.5 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${styleTint.dot}`} />
                        {template.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {template.summary}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 mt-2 line-clamp-2">
                      {template.stylePatch.mediumStyle}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5">
                    <span className="text-[11px] text-slate-600 truncate">
                      {hasAnalysis && applyMode === 'blend'
                        ? 'Updates optics, lighting, color & medium'
                        : 'Populates all 8 anatomy layers'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApply(template)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        isJustApplied
                          ? 'bg-emerald-700 text-white'
                          : isApplied
                            ? 'bg-indigo-700 text-white hover:bg-indigo-800'
                            : 'bg-slate-900 text-white hover:bg-indigo-950'
                      }`}
                    >
                      {isJustApplied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Applied</span>
                        </>
                      ) : (
                        <span>
                          {hasAnalysis && applyMode === 'blend'
                            ? 'Apply Style'
                            : 'Use Template'}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
