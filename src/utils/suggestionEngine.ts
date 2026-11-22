import type { AnalysisResponse, Dialect } from '../types/prompt';

export interface KeywordSuggestionGroup {
  category: string;
  modifiers: string[];
}

interface DomainRule {
  id: string;
  category: string;
  patterns: RegExp;
  modifiers: string[];
}

const DOMAIN_RULES: DomainRule[] = [
  {
    id: 'portrait',
    category: 'Portrait & Human Subject',
    patterns:
      /\b(person|woman|man|portrait|face|skin|eyes|hair|hands|apron|artisan|ceramicist|expression|gaze|figure|human|clothing|garment)\b/i,
    modifiers: [
      'natural skin pores',
      'catchlight in eyes',
      '85mm f/1.4 shallow DOF',
      'candid documentary posture',
      'Rembrandt key light',
      'soft north window wrap',
      'subtle linen texture',
      'unretouched editorial authenticity',
    ],
  },
  {
    id: 'architecture',
    category: 'Architecture & Spatial Geometry',
    patterns:
      /\b(concrete|brutalist|pavilion|courtyard|building|wall|interior|facade|arch|corridor|stairs|pool|glass|steel|structural|minimalist)\b/i,
    modifiers: [
      'tilt-shift perspective correction',
      'board-formed concrete grain',
      'crisp geometric shadow lines',
      'calm water mirror reflection',
      '24mm wide architectural lens',
      'symmetrical vanishing plane',
      'natural ambient bounce',
      'museum-grade tonal balance',
    ],
  },
  {
    id: 'product',
    category: 'Product & Tactile Still Life',
    patterns:
      /\b(lens|camera|metal|aluminum|basalt|stone|glass|bottle|watch|ceramic|vessel|studio|macro|knurling|engraved|product|object|matte|anodized)\b/i,
    modifiers: [
      'precision specular rim highlight',
      'anodized micro-brushed finish',
      'razor-thin focus plane',
      'softbox gradient falloff',
      'honed mineral surface',
      '100mm macro compression',
      'contact shadow grounding',
      'dust-free commercial polish',
    ],
  },
  {
    id: 'illustration',
    category: 'Illustration & Traditional Media',
    patterns:
      /\b(gouache|watercolor|ink|paint|brush|paper|illustration|sketch|drawing|linework|canvas|pigment|hatch|wash|cold-press|observatory)\b/i,
    modifiers: [
      '300gsm cold-press paper tooth',
      'dry-brush pigment texture',
      'variable nib ink lineweight',
      'layered translucent washes',
      'subtle deckled edge',
      'cross-hatched shadow depth',
      'hand-painted matte opacity',
      'archival mineral pigments',
    ],
  },
  {
    id: 'landscape',
    category: 'Environment & Atmospheric Depth',
    patterns:
      /\b(cliff|sea|ocean|sky|cloud|tree|mountain|forest|coast|horizon|water|grass|field|landscape|outdoor|sunlight|twilight|dusk)\b/i,
    modifiers: [
      'layered atmospheric perspective',
      'distant horizon haze',
      'directional low-angle sun',
      'foreground foliage framing',
      'natural wind motion cues',
      'broad dynamic range',
      'organic terrain weathering',
      'golden-to-cobalt sky gradient',
    ],
  },
  {
    id: 'nocturnal',
    category: 'Low-Key & Practical Glow',
    patterns:
      /\b(night|twilight|dusk|lantern|glow|amber|shadow|dark|moon|neon|lamp|candle|dim|chiaroscuro)\b/i,
    modifiers: [
      'warm-to-cool tungsten split',
      'subtle optical halation',
      'rich uncrushed shadow detail',
      'practical light spill',
      'deep nocturnal contrast',
      'atmospheric mist scatter',
    ],
  },
];

const DIALECT_MODIFIERS: Record<Dialect, string[]> = {
  general: [
    'authentic material fidelity',
    'balanced tonal dynamic range',
    'coherent spatial depth',
  ],
  midjourney: [
    'medium format film',
    'subtle film grain',
    'clean composition',
  ],
  flux: [
    'physically accurate light falloff',
    'micro-surface texture detail',
    'natural optical vignette',
  ],
  sdxl: [
    'sharp focus on primary subject',
    'fine surface detail',
    'natural lighting gradient',
  ],
  video: [
    'steady slow dolly-in',
    '24fps cinematic cadence',
    'subtle ambient dust drift',
  ],
};

export function generateContextualSuggestions(
  analysis: AnalysisResponse | null,
  dialect: Dialect
): {
  matchedSubjectLabel: string;
  groups: KeywordSuggestionGroup[];
  flatModifiers: string[];
} {
  if (!analysis) {
    return {
      matchedSubjectLabel: 'General Modifiers',
      groups: [],
      flatModifiers: [],
    };
  }

  const corpus = [
    analysis.title,
    analysis.anatomy.subject,
    analysis.anatomy.spatialFields,
    analysis.anatomy.environment,
    analysis.anatomy.composition,
    analysis.anatomy.lighting,
    analysis.anatomy.colorHarmony,
    analysis.anatomy.surfaceTraces,
    analysis.anatomy.mediumStyle,
    analysis.keywords.join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  const existingNormalized = new Set(
    analysis.keywords.map((k) => k.trim().toLowerCase())
  );

  const scored = DOMAIN_RULES.map((rule) => {
    const matches = corpus.match(new RegExp(rule.patterns.source, 'gi'));
    return {
      rule,
      score: matches ? matches.length : 0,
    };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const topRules =
    scored.length > 0
      ? scored.slice(0, 2).map((s) => s.rule)
      : [DOMAIN_RULES[0], DOMAIN_RULES[2]];

  const seen = new Set<string>(existingNormalized);
  const groups: KeywordSuggestionGroup[] = [];
  const flatModifiers: string[] = [];

  for (const rule of topRules) {
    const fresh = rule.modifiers.filter((mod) => {
      const norm = mod.toLowerCase();
      if (seen.has(norm) || corpus.toLowerCase().includes(norm)) return false;
      seen.add(norm);
      return true;
    });
    if (fresh.length > 0) {
      const sliced = fresh.slice(0, 6);
      groups.push({ category: rule.category, modifiers: sliced });
      flatModifiers.push(...sliced);
    }
  }

  const dialectFresh = (DIALECT_MODIFIERS[dialect] || []).filter((mod) => {
    const norm = mod.toLowerCase();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });

  if (dialectFresh.length > 0) {
    groups.push({
      category: 'Engine & Optics Finish',
      modifiers: dialectFresh,
    });
    flatModifiers.push(...dialectFresh);
  }

  return {
    matchedSubjectLabel: topRules.map((r) => r.category).join(' · '),
    groups,
    flatModifiers,
  };
}
