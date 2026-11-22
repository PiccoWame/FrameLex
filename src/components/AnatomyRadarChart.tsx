import React, { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { AnatomyLayerKey, PromptAnatomy } from '../types/prompt';
import { LAYER_LABELS, LAYER_ORDER } from '../utils/promptAssembler';

interface AnatomyRadarChartProps {
  anatomy: PromptAnatomy;
  enabledLayers: Record<AnatomyLayerKey, boolean>;
  activePrompt: string;
  isManuallyOverridden: boolean;
}

const SHORT_AXIS_LABELS: Record<AnatomyLayerKey, string> = {
  composition: 'Optics & Frame',
  subject: 'Subject',
  spatialFields: 'Spatial Routes',
  environment: 'Environment',
  surfaceTraces: 'Surface Traces',
  lighting: 'Lighting',
  colorHarmony: 'Color & Tones',
  mediumStyle: 'Medium',
};

interface RadarDatum {
  key: AnatomyLayerKey;
  axis: string;
  fullLabel: string;
  weight: number;
  sharePct: number;
  wordCount: number;
  enabled: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function computeOverlapFactor(layerText: string, promptText: string): number {
  const tokens = layerText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return 1;
  const promptLower = promptText.toLowerCase();
  let matched = 0;
  for (const token of tokens) {
    if (promptLower.includes(token)) matched += 1;
  }
  const ratio = matched / tokens.length;
  return 0.45 + ratio * 0.55;
}

export const AnatomyRadarChart: React.FC<AnatomyRadarChartProps> = ({
  anatomy,
  enabledLayers,
  activePrompt,
  isManuallyOverridden,
}) => {
  const { chartData, dominantLayer, activeCount } = useMemo(() => {
    const rawMetrics = LAYER_ORDER.map((key) => {
      const enabled = enabledLayers[key];
      const text = anatomy[key] || '';
      const words = enabled ? countWords(text) : 0;
      const effectiveWords =
        enabled && isManuallyOverridden && activePrompt.trim()
          ? Math.round(words * computeOverlapFactor(text, activePrompt))
          : words;
      return {
        key,
        enabled,
        words,
        effectiveWords,
      };
    });

    const totalEffective = rawMetrics.reduce((sum, item) => sum + item.effectiveWords, 0);
    const maxEffective = Math.max(1, ...rawMetrics.map((item) => item.effectiveWords));

    const data: RadarDatum[] = rawMetrics.map((item) => {
      const sharePct =
        totalEffective > 0
          ? Math.round((item.effectiveWords / totalEffective) * 100)
          : 0;
      const weight = item.enabled
        ? Math.round((item.effectiveWords / maxEffective) * 100)
        : 0;
      return {
        key: item.key,
        axis: SHORT_AXIS_LABELS[item.key],
        fullLabel: LAYER_LABELS[item.key],
        weight,
        sharePct,
        wordCount: item.words,
        enabled: item.enabled,
      };
    });

    const top = [...data].sort((a, b) => b.sharePct - a.sharePct)[0];
    const enabledCount = rawMetrics.filter((m) => m.enabled && m.words > 0).length;

    return {
      chartData: data,
      dominantLayer: top && top.sharePct > 0 ? top : null,
      activeCount: enabledCount,
    };
  }, [activePrompt, anatomy, enabledLayers, isManuallyOverridden]);

  return (
    <div className="bg-white border border-[#E2DFEE] rounded-xl p-4 shadow-2xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Anatomy Weight Distribution
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Relative emphasis across active layers in your current prompt selection
          </p>
        </div>
        {dominantLayer && (
          <div className="text-xs text-slate-600 tabular-nums">
            Primary weight:{' '}
            <span className="font-semibold text-indigo-900">
              {dominantLayer.axis}
            </span>{' '}
            ({dominantLayer.sharePct}%) · {activeCount}/8 layers active
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-7 h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
              <PolarGrid stroke="#E2DFEE" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="Weight"
                dataKey="weight"
                stroke="#4338CA"
                strokeWidth={2}
                fill="#818CF8"
                fillOpacity={0.24}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as RadarDatum;
                  return (
                    <div className="bg-white border border-[#E2DFEE] rounded-lg px-3 py-2 shadow-sm text-xs">
                      <div className="font-semibold text-slate-900">
                        {item.fullLabel}
                      </div>
                      <div className="mt-1 text-slate-600 tabular-nums">
                        {item.enabled
                          ? `${item.sharePct}% share · ${item.wordCount} words`
                          : 'Layer disabled (0%)'}
                      </div>
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="md:col-span-5 divide-y divide-[#ECEAF6] border border-[#E2DFEE] rounded-lg bg-[#F7F6FB]">
          {chartData.map((row) => (
            <div
              key={row.key}
              className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
            >
              <span
                className={`truncate ${
                  row.enabled ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'
                }`}
              >
                {row.axis}
              </span>
              <span className="font-mono text-[11px] text-indigo-800 font-medium tabular-nums shrink-0">
                {row.enabled ? `${row.sharePct}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
