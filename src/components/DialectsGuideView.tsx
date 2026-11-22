import React from 'react';
import { DIALECT_META } from '../utils/promptAssembler';
import type { Dialect } from '../types/prompt';

interface DialectsGuideViewProps {
  onSelectDialectAndReturn: (dialect: Dialect) => void;
}

const DIALECT_GUIDES: Array<{
  id: Dialect;
  bestFor: string;
  syntaxNotes: string;
  example: string;
}> = [
  {
    id: 'general',
    bestFor: 'Imagen, Gemini Image, GPT Image, editorial concepts',
    syntaxNotes:
      'Clear natural-language sentences describing subject, action, setting, lighting direction, and material texture without weighted brackets or spam quality tags.',
    example:
      'Brutalist concrete courtyard pavilion in Tokyo under crisp afternoon sun, long geometric shadows falling across a dark reflecting pool, shot on medium format 35mm lens.',
  },
  {
    id: 'midjourney',
    bestFor: 'Midjourney v7 and v6.1',
    syntaxNotes:
      'Dense comma-separated visual clauses ordered by priority, paired with aspect ratio (--ar), raw photography mode (--style raw), and stylization (--stylize) flags.',
    example:
      'Minimalist brutalist concrete courtyard pavilion, sharp afternoon sunlight, reflecting pool, medium format 35mm architectural photography --ar 4:3 --style raw --v 7',
  },
  {
    id: 'flux',
    bestFor: 'Flux.1 Pro, Dev, and Schnell',
    syntaxNotes:
      'Spatial and optical-physics prose detailing lens focal length, surface roughness, light falloff, and color relationships. Avoids parenthetical weights.',
    example:
      'Architectural photograph of a board-formed concrete pavilion beside a still reflecting pool. Low-angle afternoon sun casts razor-sharp diagonal shadows across textured stone pavers.',
  },
  {
    id: 'sdxl',
    bestFor: 'Stable Diffusion XL, Pony, ComfyUI workflows',
    syntaxNotes:
      'Structured tag phrasing with weighted attention brackets (subject:1.15) paired with a dedicated negative prompt excluding distortions and unwanted styles.',
    example:
      '(minimalist brutalist concrete pavilion:1.15), reflecting pool, crisp afternoon sunlight, geometric shadows, 35mm architectural lens, fine concrete grain',
  },
  {
    id: 'video',
    bestFor: 'Veo, Runway Gen-4, Sora image-to-video motion prompts',
    syntaxNotes:
      'Infers plausible camera choreography (slow dolly-in, locked tripod with water ripple drift) and subtle environmental motion from the static reference frame.',
    example:
      'Slow forward dolly-in across a tranquil concrete courtyard as afternoon shadows gradually lengthen and gentle ripples drift across the dark reflecting pool.',
  },
];

export const DialectsGuideView: React.FC<DialectsGuideViewProps> = ({
  onSelectDialectAndReturn,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Generator Dialects &amp; Syntax Reference
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Every image analysis simultaneously generates all five dialects so you can compare phrasing and switch engines without re-uploading.
        </p>
      </div>

      <div className="bg-white border border-[#E2DFEE] rounded-xl divide-y divide-[#ECEAF6] shadow-2xs">
        {DIALECT_GUIDES.map((guide) => (
          <div
            key={guide.id}
            className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            <div className="lg:col-span-4 space-y-1.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {DIALECT_META[guide.id].label}
              </h2>
              <p className="text-xs text-slate-500">{guide.bestFor}</p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onSelectDialectAndReturn(guide.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-900 bg-[#EEF2FF] border border-[#D8E0FC] hover:bg-[#E0E7FF] rounded-lg transition-colors whitespace-nowrap"
                >
                  Use {DIALECT_META[guide.id].shortLabel} in Studio
                </button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                {guide.syntaxNotes}
              </p>
              <div className="p-3.5 bg-[#F7F6FB] border border-[#E2DFEE] rounded-lg">
                <div className="text-[11px] font-semibold text-indigo-900/75 mb-1">
                  Example structure
                </div>
                <p className="font-mono text-xs text-slate-800 leading-relaxed">
                  {guide.example}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
