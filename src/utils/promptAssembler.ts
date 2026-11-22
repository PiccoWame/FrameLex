import type {
  AnalysisResponse,
  AnatomyLayerKey,
  Dialect,
  MidjourneyOptions,
  PromptAnatomy,
} from '../types/prompt';

export const LAYER_ORDER: AnatomyLayerKey[] = [
  'composition',
  'subject',
  'spatialFields',
  'environment',
  'surfaceTraces',
  'lighting',
  'colorHarmony',
  'mediumStyle',
];

export const LAYER_LABELS: Record<AnatomyLayerKey, string> = {
  composition: 'Framing, Optics & Geometry',
  subject: 'Subject, Pose & Micro-Details',
  spatialFields: 'Spatial Fields, Planes & Routes',
  environment: 'Environment & Context',
  surfaceTraces: 'Surface Traces, Wear & Materiality',
  lighting: 'Lighting Physics & Shadow Falloff',
  colorHarmony: 'Color Palette, Tones & Grading',
  mediumStyle: 'Medium, Emulsion & Finish',
};

export const DIALECT_META: Record<
  Dialect,
  { label: string; shortLabel: string; summary: string }
> = {
  general: {
    label: 'General / Natural',
    shortLabel: 'General',
    summary: 'Balanced descriptive prose for Imagen, Gemini, and GPT Image',
  },
  midjourney: {
    label: 'Midjourney',
    shortLabel: 'Midjourney',
    summary: 'Comma-separated phrases with --ar, --stylize, and --style raw flags',
  },
  flux: {
    label: 'Flux.1',
    shortLabel: 'Flux.1',
    summary: 'Optical physics and surface-rich spatial prose without spam tags',
  },
  sdxl: {
    label: 'Stable Diffusion XL',
    shortLabel: 'SDXL',
    summary: 'Weighted tag syntax with dedicated negative prompt exclusions',
  },
  video: {
    label: 'Video Motion',
    shortLabel: 'Video',
    summary: 'Camera choreography and temporal movement for Veo and Runway',
  },
};

function stripMidjourneyFlags(prompt: string): string {
  return prompt
    .replace(/\s+--(?:ar|stylize|s|style|v|no|q|chaos|weird|iw|seed)\b(?:\s+(?:(?!--).)*?)?(?=\s+--|$)/gi, '')
    .trim();
}

function formatMidjourneyFlags(
  aspectRatioLabel: string,
  mjOptions: MidjourneyOptions,
  negativePrompt: string
): string {
  const flags: string[] = [];
  if (mjOptions.includeAr) {
    flags.push(`--ar ${aspectRatioLabel}`);
  }
  if (mjOptions.styleRaw) {
    flags.push('--style raw');
  }
  if (mjOptions.stylize !== 100) {
    flags.push(`--stylize ${mjOptions.stylize}`);
  }
  if (mjOptions.version) {
    flags.push(`--v ${mjOptions.version}`);
  }
  if (mjOptions.includeNo && negativePrompt.trim()) {
    const cleanNo = negativePrompt
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(', ');
    if (cleanNo) {
      flags.push(`--no ${cleanNo}`);
    }
  }
  return flags.join(' ');
}

export function assemblePrompt(params: {
  analysis: AnalysisResponse | null;
  dialect: Dialect;
  anatomy: PromptAnatomy;
  enabledLayers: Record<AnatomyLayerKey, boolean>;
  isAnatomyCustomized: boolean;
  extraKeywords: string[];
  aspectRatioLabel: string;
  mjOptions: MidjourneyOptions;
}): { promptText: string; negativeText: string } {
  const {
    analysis,
    dialect,
    anatomy,
    enabledLayers,
    isAnatomyCustomized,
    extraKeywords,
    aspectRatioLabel,
    mjOptions,
  } = params;

  if (!analysis) {
    return { promptText: '', negativeText: '' };
  }

  const negativeText = anatomy.negativePrompt.trim();

  // If user has not edited or disabled individual anatomy layers, start from Gemini's native dialect output
  if (!isAnatomyCustomized) {
    let base = analysis.dialects[dialect] || analysis.dialects.general;
    if (dialect === 'midjourney') {
      const cleanBase = stripMidjourneyFlags(base);
      const keywordSuffix = extraKeywords.length > 0 ? `, ${extraKeywords.join(', ')}` : '';
      const flags = formatMidjourneyFlags(aspectRatioLabel, mjOptions, negativeText);
      return {
        promptText: `${cleanBase}${keywordSuffix}${flags ? ` ${flags}` : ''}`.trim(),
        negativeText,
      };
    }

    if (extraKeywords.length > 0) {
      const sep = base.endsWith('.') ? ' ' : ', ';
      base = `${base}${sep}${extraKeywords.join(', ')}`;
    }
    return { promptText: base.trim(), negativeText };
  }

  // Re-assemble dynamically from enabled + edited anatomy layers
  const activeSegments = LAYER_ORDER.filter((key) => enabledLayers[key])
    .map((key) => anatomy[key]?.trim())
    .filter(Boolean);

  if (dialect === 'midjourney') {
    const body = [...activeSegments, ...extraKeywords].join(', ');
    const flags = formatMidjourneyFlags(aspectRatioLabel, mjOptions, negativeText);
    return {
      promptText: `${body}${flags ? ` ${flags}` : ''}`.trim(),
      negativeText,
    };
  }

  if (dialect === 'sdxl') {
    const weighted = activeSegments.map((seg, idx) => (idx === 0 ? `(${seg}:1.15)` : seg));
    const allParts = [...weighted, ...extraKeywords];
    return {
      promptText: allParts.join(', '),
      negativeText,
    };
  }

  if (dialect === 'video') {
    const body = activeSegments.join('. ');
    const kw = extraKeywords.length > 0 ? ` Visual accents: ${extraKeywords.join(', ')}.` : '';
    return {
      promptText: `${body}.${kw} Subtle, natural camera motion with continuous atmospheric drift.`.trim(),
      negativeText,
    };
  }

  // general or flux
  const prose = activeSegments.join('. ');
  const kw = extraKeywords.length > 0 ? ` ${extraKeywords.join(', ')}.` : '';
  return {
    promptText: `${prose}${prose.endsWith('.') ? '' : '.'}${kw}`.trim(),
    negativeText,
  };
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const chunks = trimmed.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g);
  if (!chunks) return 0;

  let tokens = 0;
  for (const chunk of chunks) {
    if (chunk.length === 1) {
      tokens += 1;
    } else if (/^\d+$/.test(chunk)) {
      tokens += Math.ceil(chunk.length / 3);
    } else {
      tokens += Math.max(1, Math.ceil(chunk.length / 4.2));
    }
  }
  return tokens;
}

