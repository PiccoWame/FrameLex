import type { PromptAnatomy } from '../types/prompt';

export type TemplateCategory =
  | 'Cinematic'
  | 'Illustrative'
  | 'Photorealistic'
  | 'Architectural'
  | 'Fine Art';

export interface PromptTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  summary: string;
  recommendedDialect: 'general' | 'midjourney' | 'flux' | 'sdxl' | 'video';
  /** Full starter anatomy used when starting fresh or replacing all layers */
  anatomy: PromptAnatomy;
  /** Style-centric subset used when blending onto an existing subject */
  stylePatch: Pick<
    PromptAnatomy,
    'composition' | 'lighting' | 'colorHarmony' | 'surfaceTraces' | 'mediumStyle' | 'negativePrompt'
  >;
  keywords: string[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Cinematic',
  'Illustrative',
  'Photorealistic',
  'Architectural',
  'Fine Art',
];

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'cinematic-anamorphic-noir',
    name: 'Anamorphic Neo-Noir',
    category: 'Cinematic',
    summary: 'Wide 2.39:1 framing, sodium vapor highlights, rain-slicked reflections, and subtle halation.',
    recommendedDialect: 'flux',
    anatomy: {
      composition:
        'Wide 40mm anamorphic cinema lens at eye level, rule-of-thirds off-center subject placement, gentle horizontal oval bokeh, deep foreground-to-background leading lines.',
      subject:
        'Solitary trench-coated figure pausing beneath a dimly lit storefront awning, collar upturned against fine drizzle, profile caught in warm tungsten spill.',
      spatialFields:
        'Three-plane depth stack: rain-beaded glass foreground rail, mid-ground figure anchored on wet asphalt, receding wet street corridor vanishing into mist.',
      environment:
        'Late-night metropolitan side street with damp pavement puddles, shuttered brick facades, distant neon signage bleeding softly through atmospheric haze.',
      surfaceTraces:
        'Slick specular oil-sheen on weathered cobblestones, damp wool fabric fibers, condensation streaks along brass window frames.',
      lighting:
        'Motivated practical sodium-vapor and amber neon key light from camera-left, cool cyan skylight fill in deep uncrushed shadows, gentle optical halation around bright bulbs.',
      colorHarmony:
        'Teal-slate shadow base contrasted against burnt amber (#D97706) and warm sodium gold (#F59E0B) practical accents.',
      mediumStyle:
        'Shot on 35mm Kodak Vision3 500T motion picture film, organic silver-halide grain, calibrated cinema color grade without crushed blacks.',
      negativePrompt:
        'oversaturated neon, plastic skin, CGI gloss, harsh HDR halos, flat front flash, digital sharpening artifacts',
    },
    stylePatch: {
      composition:
        'Wide 40mm anamorphic lens framing with subtle barrel perspective, shallow cinema depth of field, and oval out-of-focus specular bokeh.',
      lighting:
        'Low-key motivated practical lighting with warm tungsten edge spill, cool cyan ambient shadow fill, and subtle optical halation around highlight sources.',
      colorHarmony:
        'Deep slate-cyan shadows balanced against warm amber-ochre highlights and restrained filmic contrast.',
      surfaceTraces:
        'Micro-condensation sheen, subtle damp specular glints, and natural atmospheric dust scatter in light beams.',
      mediumStyle:
        '35mm Kodak Vision3 500T cinema stock, fine organic silver-halide film grain, graded theatrical still frame.',
      negativePrompt:
        'flat daylight lighting, sterile studio wash, harsh HDR oversharpening, synthetic plastic reflections',
    },
    keywords: ['anamorphic oval bokeh', 'Kodak Vision3 500T', 'optical halation', 'teal and amber grade'],
  },
  {
    id: 'cinematic-golden-drama',
    name: '35mm Golden Hour Drama',
    category: 'Cinematic',
    summary: 'Low-angle backlit sun flare, warm skin tones, gentle handheld intimacy, and breeze cues.',
    recommendedDialect: 'general',
    anatomy: {
      composition:
        '50mm prime lens at waist-up medium close-up, soft foreground foliage frame edge, candid slight low-angle tilt creating natural intimacy.',
      subject:
        'Character glancing slightly off-axis toward the horizon, windswept hair strands glowing gold along the rim, relaxed authentic expression.',
      spatialFields:
        'Softly blurred sun-drenched foreground grasses framing a crisp mid-ground focal plane and warm hazy hillside distance.',
      environment:
        'Open coastal meadow at late afternoon golden hour with tall dry oat grass swaying gently across rolling terrain.',
      surfaceTraces:
        'Fine cotton weave catching warm side-light, delicate dust motes suspended in air, natural unretouched skin micro-texture.',
      lighting:
        'Low 12-degree warm solar backlight rimming edges with soft diffused bounce card fill on the shadow side, gentle vintage lens veiling flare.',
      colorHarmony:
        'Sunlit honeyed gold (#EAB308), warm terracotta earth tones, and soft dusty sage greens with creamy highlight roll-off.',
      mediumStyle:
        '35mm Arricam film frame with vintage Cooke Speed Panchro glass, tactile grain structure, and warm analog print density.',
      negativePrompt:
        'cold blue fluorescence, airbrushed skin, rigid posed stiffness, harsh midday overhead shadows',
    },
    stylePatch: {
      composition:
        '50mm vintage cinema prime framing with shallow focal plane, soft foreground framing edge, and creamy highlight roll-off.',
      lighting:
        'Low-angle golden hour rim backlight paired with warm natural ambient bounce fill and delicate vintage lens flare.',
      colorHarmony:
        'Warm honeyed gold highlights, rich ochre midtones, and softly lifted warm shadows.',
      surfaceTraces:
        'Floating airborne dust motes caught in warm side-light, organic fabric and skin micro-texture without digital smoothing.',
      mediumStyle:
        '35mm motion picture frame captured on vintage Cooke prime glass, subtle organic film grain.',
      negativePrompt:
        'cool fluorescent cast, flat overhead midday sun, plastic smoothing, synthetic HDR contrast',
    },
    keywords: ['Cooke Speed Panchro look', 'golden hour rim light', 'creamy highlight rolloff', 'subtle veiling flare'],
  },
  {
    id: 'cinematic-scifi-atmos',
    name: 'IMAX Atmospheric Scale',
    category: 'Cinematic',
    summary: 'Monumental wide-angle scale, volumetric fog shafts, muted mineral palette, and crisp detail.',
    recommendedDialect: 'flux',
    anatomy: {
      composition:
        '24mm ultra-sharp IMAX 65mm wide-angle perspective, monumental vertical scale placing small human reference points along lower third.',
      subject:
        'Monolithic weathered basalt research outpost anchored into a jagged ridgeline, illuminated observation slit glowing faintly inside fog.',
      spatialFields:
        'Rugged rock foreground shelf leading across a misty chasm toward towering mid-ground architecture and distant cloud-shrouded peaks.',
      environment:
        'High-altitude sub-arctic plateau swept by low-hanging cloud banks, damp slate scree, and patches of pale lichen.',
      surfaceTraces:
        'Wind-scoured concrete joints, oxidized titanium fasteners, frost rime clinging to shaded structural ribs.',
      lighting:
        'Diffused overcast sky dome with directional cold zenith break piercing drifting mist in crisp volumetric shafts.',
      colorHarmony:
        'Desaturated basalt charcoal (#334155), pale glacial mist (#CBD5E1), muted moss olive, and tiny warm tungsten interior pinpoints.',
      mediumStyle:
        '65mm large-format digital cinema capture, razor-sharp hyperfocal clarity, restrained atmospheric grading.',
      negativePrompt:
        'cartoonish sci-fi neon, cluttered HUD overlays, oversaturated cyberpunk purple, low-resolution fog banding',
    },
    stylePatch: {
      composition:
        '24mm large-format 65mm wide-angle perspective emphasizing monumental spatial scale and crisp hyperfocal depth.',
      lighting:
        'Diffused high-latitude overcast skylight broken by directional volumetric sun shafts cutting through layered mist.',
      colorHarmony:
        'Restrained mineral charcoal, slate mist, and desaturated cool neutrals punctuated by subtle warm practical accents.',
      surfaceTraces:
        'Weathered industrial patina, fine frost or moisture film, and crisp micro-edge detail across foreground and mid-ground.',
      mediumStyle:
        '65mm large-format cinema capture, ultra-clean dynamic range, zero artificial bloom.',
      negativePrompt:
        'oversaturated neon glow, toy-like miniature tilt-shift, flat cartoon shading, compression banding',
    },
    keywords: ['65mm IMAX large format', 'volumetric mist shafts', 'monumental scale', 'restrained mineral palette'],
  },
  {
    id: 'illustrative-ligne-claire',
    name: 'Ligne Claire Ink & Gouache',
    category: 'Illustrative',
    summary: 'Crisp uniform fountain-pen ink contours, flat matte gouache fills, and architectural clarity.',
    recommendedDialect: 'midjourney',
    anatomy: {
      composition:
        'Balanced isometric-leaning editorial angle with clean geometric rhythm, deliberate negative space, and crisp border-to-border readability.',
      subject:
        'Curated rooftop conservatory filled with potted citrus trees, brass watering cans, and a drafting table covered in hand-drawn maps.',
      spatialFields:
        'Clear overlapping planar silhouettes from foreground terracotta pots to mid-ground glasshouse framing and stylized cloud horizon.',
      environment:
        'Sunlit European city rooftop overlooking slate mansard roofs and distant terracotta chimney stacks.',
      surfaceTraces:
        'Consistent 0.5mm black ink outlines, flat opaque gouache color blocks with delicate dry-brush shadow hatching on corners.',
      lighting:
        'Crisp directional afternoon sunlight casting clean geometric cel-like shadow shapes without muddy gradients.',
      colorHarmony:
        'Warm ochre (#D97706), cerulean sky blue (#38BDF8), terracotta clay, and cream paper ground (#F8FAFC).',
      mediumStyle:
        'Franco-Belgian Ligne Claire editorial illustration on 300gsm hot-press cotton paper, subtle archival print texture.',
      negativePrompt:
        'photorealistic 3D render, heavy airbrushed gradients, messy sketchy scribbles, glossy digital plastic',
    },
    stylePatch: {
      composition:
        'Crisp editorial framing with clear overlapping planar silhouettes, structured geometry, and uncluttered negative space.',
      lighting:
        'Clean directional daylight casting sharp graphic shadow shapes with zero muddy airbrush gradients.',
      colorHarmony:
        'Curated matte gouache palette of warm ochre, slate cobalt, terracotta, and natural warm paper highlights.',
      surfaceTraces:
        'Uniform fine black ink contour linework, flat opaque gouache pigment fills, and subtle parallel ink cross-hatching.',
      mediumStyle:
        'Franco-Belgian Ligne Claire ink and gouache illustration on 300gsm hot-press archival paper.',
      negativePrompt:
        'photorealistic skin pores, 3D raytraced reflections, soft airbrush blur, messy charcoal smudges',
    },
    keywords: ['Ligne Claire linework', 'matte gouache fills', 'archival hot-press paper', 'graphic shadow shapes'],
  },
  {
    id: 'illustrative-watercolor-botanical',
    name: 'Watercolor Wash & Dip Pen',
    category: 'Illustrative',
    summary: 'Translucent layered watercolor blooms, expressive nib lineweight, and cold-press paper tooth.',
    recommendedDialect: 'general',
    anatomy: {
      composition:
        'Vignetted editorial spot composition breathing naturally into unpainted cream paper margins, gentle diagonal flow.',
      subject:
        'Glass apothecary greenhouse corner overflowing with trailing ferns, ceramic vessels, and hanging brass lanterns.',
      spatialFields:
        'Dense ink-and-wash focal cluster in center fading gracefully into loose wet-on-wet background washes.',
      environment:
        'Quiet garden studio interior bathed in morning window mist with botanical specimens arranged along weathered wooden shelves.',
      surfaceTraces:
        'Visible cold-press cotton paper tooth, subtle pigment granulation and backrun edges, variable sepia fountain-pen nib strokes.',
      lighting:
        'Luminous translucent morning light preserved through untouched white paper highlights rather than opaque white paint.',
      colorHarmony:
        'Sap green, burnt sienna, indigo shadow washes (#312E81), and warm raw parchment paper white.',
      mediumStyle:
        'Traditional hand-painted watercolor and waterproof sepia ink drawing on 300gsm cold-press Arches cotton paper.',
      negativePrompt:
        'vector flat shapes, neon digital glow, heavy black comic fills, sterile 3D shading',
    },
    stylePatch: {
      composition:
        'Editorial vignette framing allowing subtle breathing room into textured cream paper margins around outer edges.',
      lighting:
        'Luminous translucent illumination created by preserved paper whites and delicate wet-on-wet shadow glazes.',
      colorHarmony:
        'Harmonious natural pigments—sap green, burnt sienna, indigo wash, and warm raw paper highlights.',
      surfaceTraces:
        '300gsm cold-press paper tooth, organic watercolor backrun edges, pigment granulation, and expressive variable-weight ink nib lines.',
      mediumStyle:
        'Traditional watercolor wash and fine sepia dip-pen illustration on archival cotton paper.',
      negativePrompt:
        'photographic lens blur, slick digital gradients, vector flat fills, neon oversaturation',
    },
    keywords: ['300gsm cold-press paper', 'translucent watercolor glaze', 'variable nib lineweight', 'pigment granulation'],
  },
  {
    id: 'illustrative-risograph',
    name: 'Two-Tone Risograph Zine',
    category: 'Illustrative',
    summary: 'Halftone soy-ink dot screens, slight plate misregistration, and bold graphic contrast.',
    recommendedDialect: 'sdxl',
    anatomy: {
      composition:
        'Poster-like balanced framing with bold foreground silhouette, rhythmic geometric backdrop, and crisp graphic hierarchy.',
      subject:
        'Retro-modern architectural stairwell with curved concrete balustrade and cast morning sunbeam geometry.',
      spatialFields:
        'Flat layered screenprint planes creating depth through overlapping halftone densities and overprint color mixes.',
      environment:
        'Minimalist graphic courtyard rendered with stylized foliage motifs and clean architectural shapes.',
      surfaceTraces:
        'Fine stochastic soy-ink dot grain, subtle 1mm ink drum misregistration along crisp edges, fibrous uncoated zine paper.',
      lighting:
        'High-contrast graphic light and shadow planes expressed through solid ink coverage versus 30% halftone stipple.',
      colorHarmony:
        'Restricted three-ink palette of fluorescent coral (#F43F5E), deep cobalt blue (#1D4ED8), and warm uncoated cream stock.',
      mediumStyle:
        'Risograph screenprint illustration with soy-based inks on speckled 180gsm uncoated off-white paper.',
      negativePrompt:
        'photorealistic textures, smooth gradients, glossy varnish, 3D raytracing, muddy CMYK blacks',
    },
    stylePatch: {
      composition:
        'Bold poster-style graphic framing with strong positive/negative shape contrast and layered planar depth.',
      lighting:
        'High-contrast graphic illumination translated into solid ink blocks and rhythmic halftone dot stippling.',
      colorHarmony:
        'Limited spot-ink risograph palette with vibrant cobalt, warm coral overprints, and uncoated cream paper ground.',
      surfaceTraces:
        'Tactile soy-ink halftone dot grain, subtle analog print-plate misregistration, and speckled uncoated paper fibers.',
      mediumStyle:
        'Authentic Risograph printmaking artwork on textured 180gsm archival zine stock.',
      negativePrompt:
        'photographic depth of field, smooth digital airbrush, glossy 3D shading, blurry low-res JPEG',
    },
    keywords: ['risograph halftone grain', 'soy ink overprint', 'subtle misregistration', 'uncoated cream stock'],
  },
  {
    id: 'photo-medium-format-editorial',
    name: 'Medium Format Editorial',
    category: 'Photorealistic',
    summary: 'Hasselblad 80mm natural north-window light, true-to-life skin texture, and crisp tactile realism.',
    recommendedDialect: 'general',
    anatomy: {
      composition:
        'Medium format 80mm f/2.8 portrait lens at natural eye level, generous negative space, razor-sharp focus plane on primary details.',
      subject:
        'Subject framed in quiet natural poise with authentic posture, crisp fabric weave, and clean unforced gaze.',
      spatialFields:
        'Shallow medium-format three-dimensional falloff gently separating crisp subject from softly modeled studio wall.',
      environment:
        'Sunlit plaster atelier with tall north-facing industrial casement windows and warm oak floorboards.',
      surfaceTraces:
        'Unretouched natural skin pores, fine linen slub texture, subtle mineral plaster variation on backdrop.',
      lighting:
        'Large diffused north-window soft key from 45 degrees camera-left with natural room-bounce fill and clean eye catchlight.',
      colorHarmony:
        'True-to-life neutral whites, warm oatmeal linen (#D6D3D1), natural skin warmth, and muted slate shadows.',
      mediumStyle:
        'Captured on Hasselblad X2D 100C medium format digital / Portra 400 tonal profile, ultra-clean natural color fidelity.',
      negativePrompt:
        'beauty filter airbrushing, plastic skin, ring light glare, oversaturated HDR, artificial bokeh blur',
    },
    stylePatch: {
      composition:
        'Medium format 80mm f/2.8 lens framing with smooth three-dimensional focus falloff and natural uncropped proportions.',
      lighting:
        'Large diffused north-facing window key light at 45 degrees with gentle architectural room bounce and clean shadow gradients.',
      colorHarmony:
        'True-to-life Portra-inspired color fidelity, clean neutral whites, and rich subtle tonal transitions.',
      surfaceTraces:
        'Crisp unretouched micro-textures, authentic natural pores, weave fibers, and subtle surface patina.',
      mediumStyle:
        'Medium format editorial photograph on Hasselblad 80mm f/2.8 glass, zero artificial beauty smoothing.',
      negativePrompt:
        'plastic airbrushed skin, harsh ring-light reflections, over-sharpened HDR, artificial CGI sheen',
    },
    keywords: ['Hasselblad 80mm f/2.8', 'north window wrap light', 'unretouched micro-texture', 'natural tonal rolloff'],
  },
  {
    id: 'photo-macro-product',
    name: 'Studio Macro Commercial',
    category: 'Photorealistic',
    summary: '100mm macro compression, precision softbox gradient rim highlights, and tactile material polish.',
    recommendedDialect: 'flux',
    anatomy: {
      composition:
        '100mm macro telephoto lens at 15-degree elevated hero angle, razor-thin selective focus across primary chamfer and engraving.',
      subject:
        'Precision-machined brushed aluminum and dark smoked glass object resting cleanly on honed dark basalt plinth.',
      spatialFields:
        'Crisp foreground contact shadow grounding the object, razor-sharp hero bevel, softly diffused seamless studio sweep behind.',
      environment:
        'Controlled darkroom tabletop studio with matte charcoal backdrop and subtle graduated horizon falloff.',
      surfaceTraces:
        'Micro-radial CNC machining lines, clean anodized bead-blasted finish, sharp specular edge catchlights free of dust.',
      lighting:
        'Overhead diffused scrim creating smooth liquid gradient reflections across curved glass plus crisp silver strip-box rim light.',
      colorHarmony:
        'Deep obsidian charcoal (#0F172A), cool brushed titanium silver (#94A3B8), and a tiny precision amber indicator accent.',
      mediumStyle:
        'Commercial tethered studio macro photograph shot at ISO 50, tack-sharp micro-contrast, museum catalog grade.',
      negativePrompt:
        'floating no contact shadow, fingerprint smudges, harsh blown highlights, distorted wide-angle lens',
    },
    stylePatch: {
      composition:
        '100mm macro lens compression at crisp hero angle with razor-thin selective focus and grounded contact shadows.',
      lighting:
        'Controlled overhead diffusion scrim producing smooth gradient specular reflections plus crisp edge-defining strip-box rim light.',
      colorHarmony:
        'Clean commercial tonal separation between deep neutral darks and precision metallic specular highlights.',
      surfaceTraces:
        'Tack-sharp micro-surface finish—machined bevels, mineral grain, or fabric weave—completely clean of compression artifacts.',
      mediumStyle:
        'Tethered commercial studio photograph at base ISO 50, crystal-clear optical micro-contrast.',
      negativePrompt:
        'floating ungrounded shadows, blown-out clipping highlights, cheap plastic render look, wide-angle distortion',
    },
    keywords: ['100mm macro compression', 'softbox gradient falloff', 'grounded contact shadow', 'base ISO 50 clarity'],
  },
  {
    id: 'photo-leica-street',
    name: '35mm Street Documentary',
    category: 'Photorealistic',
    summary: 'Candid 35mm Tri-X / Leica reportage energy, ambient street light, and authentic human grain.',
    recommendedDialect: 'midjourney',
    anatomy: {
      composition:
        '35mm rangefinder lens at candid eye level, dynamic asymmetric framing with foreground passersby adding layered street depth.',
      subject:
        'Unposed pedestrian pausing beneath a corner newsstand awning as evening commuters blur softly past.',
      spatialFields:
        'Layered street depth: softly passing foreground shoulder, sharp mid-ground subject, glowing shop windows receding behind.',
      environment:
        'Bustling late-afternoon crosswalk framed by weathered stone facades, café chairs, and bicycle racks.',
      surfaceTraces:
        'Authentic 400-ISO film grain, slight motion blur on moving footsteps, scuffed concrete curb edges.',
      lighting:
        'Natural late-afternoon canyon light bouncing off sunlit glass storefronts into cool shadowed sidewalks.',
      colorHarmony:
        'Muted Kodak Tri-X / muted chrome tones—warm stone ochre, asphalt gray, and subdued burgundy and navy garments.',
      mediumStyle:
        'Candid 35mm Leica M rangefinder street documentary photograph, authentic optical vignette and subtle film grain.',
      negativePrompt:
        'staged stock photo smiles, studio strobe lighting, ultra-slick commercial polish, HDR clarity',
    },
    stylePatch: {
      composition:
        '35mm rangefinder street framing with candid asymmetric balance and authentic foreground-to-background spatial layering.',
      lighting:
        'Available ambient street bounce light with crisp sunlit architectural pockets and natural deep sidewalk shadows.',
      colorHarmony:
        'Subdued documentary palette with authentic street contrast, muted midtones, and natural shadow density.',
      surfaceTraces:
        'Subtle 400-ISO silver grain, slight natural motion cues, and unpolished real-world surface wear.',
      mediumStyle:
        'Candid 35mm Leica M documentary photograph, subtle edge vignetting, raw editorial authenticity.',
      negativePrompt:
        'posed stock photography, artificial studio flash, glossy commercial retouching, neon HDR',
    },
    keywords: ['35mm Leica rangefinder', 'candid street layering', 'available ambient light', '400-ISO film grain'],
  },
  {
    id: 'arch-brutalist-sun',
    name: 'Brutalist Sun & Shadow',
    category: 'Architectural',
    summary: 'Tilt-shift rectilinear verticals, board-formed concrete grain, and crisp geometric shadow planes.',
    recommendedDialect: 'flux',
    anatomy: {
      composition:
        '24mm tilt-shift architectural lens with dead-straight vertical lines, symmetrical one-point geometric framing, calm horizon.',
      subject:
        'Cantilevered board-formed concrete gallery pavilion framing a tranquil shallow reflection pool.',
      spatialFields:
        'Mirror-still water foreground plane reflecting concrete soffit, clean travertine mid-ground step, open sky beyond.',
      environment:
        'Serene minimalist architectural courtyard bordered by manicured olive trees and pale limestone walls.',
      surfaceTraces:
        'Crisp wood-grain formwork impressions in poured concrete, subtle tie-rod recesses, fine mineral water ripples.',
      lighting:
        'Clean high-afternoon diagonal sunlight slicing razor-sharp geometric shadow triangles across monolithic walls.',
      colorHarmony:
        'Warm pale limestone (#E7E5E4), cool architectural concrete gray (#94A3B8), deep pool slate, and muted olive greens.',
      mediumStyle:
        'Architectural monograph photography on large-format technical camera with tilt-shift perspective control.',
      negativePrompt:
        'tilted converging verticals, wide-angle barrel distortion, crowded tourists, overprocessed sky HDR',
    },
    stylePatch: {
      composition:
        '24mm tilt-shift architectural framing with strictly corrected vertical lines and disciplined geometric symmetry.',
      lighting:
        'Crisp directional afternoon sunlight casting clean architectural shadow planes and soft warm floor bounce.',
      colorHarmony:
        'Mineral monochrome balance of warm limestone, neutral concrete grays, and serene desaturated accents.',
      surfaceTraces:
        'Tactile mineral grain, subtle formwork lines, clean structural reveals, and crisp material junctions.',
      mediumStyle:
        'Large-format architectural monograph photograph with optical perspective control.',
      negativePrompt:
        'converging tilted walls, fisheye distortion, harsh HDR haloing, cluttered visual noise',
    },
    keywords: ['24mm tilt-shift optics', 'strict vertical lines', 'crisp shadow geometry', 'monograph mineral tone'],
  },
  {
    id: 'fineart-chiaroscuro-oil',
    name: 'Chiaroscuro Oil Impasto',
    category: 'Fine Art',
    summary: 'Velvety umber shadows, sculpted directional oil brushwork, and museum-grade canvas texture.',
    recommendedDialect: 'midjourney',
    anatomy: {
      composition:
        'Classic Dutch Golden Age three-quarter still-life framing with pyramid balance and quiet dark perimeter.',
      subject:
        'Hand-thrown stoneware pitcher, sliced figs, and tarnished brass candlestick arranged on a worn walnut table.',
      spatialFields:
        'Luminous illuminated focal cluster emerging dramatically out of deep velvety umber background darkness.',
      environment:
        'Quiet shadowed studio alcove suggested solely by faint plaster tone behind dark drapery.',
      surfaceTraces:
        'Expressive palette-knife impasto highlights on metallic rims, translucent oil glazes in shadows, woven linen canvas grain.',
      lighting:
        'Single narrow high-side window beam carving dramatic chiaroscuro volume and glistening specular catchlights.',
      colorHarmony:
        'Raw umber (#451A03), warm ochre gold (#D97706), deep burgundy, and luminous lead-white impasto accents.',
      mediumStyle:
        'Classical oil painting on primed Belgian linen canvas, museum lighting showing authentic brushwork and varnish sheen.',
      negativePrompt:
        'digital smoothness, neon colors, flat cartoon outlines, modern DSLR lens flare',
    },
    stylePatch: {
      composition:
        'Classical chiaroscuro focal framing isolating luminous subject elements against a deep, quiet shadowed perimeter.',
      lighting:
        'Single directional high-side studio beam creating dramatic volume, velvety darks, and glistening painted specular accents.',
      colorHarmony:
        'Rich Old Master palette of raw umber, warm ochre, deep crimson, and creamy lead-white highlights.',
      surfaceTraces:
        'Visible bristle brushwork, subtle raised impasto on brightest highlights, and fine woven linen canvas texture.',
      mediumStyle:
        'Museum-quality oil painting on primed linen canvas with subtle warm aged varnish depth.',
      negativePrompt:
        'slick digital airbrush, photographic bokeh circles, modern neon tones, flat vector outlines',
    },
    keywords: ['chiaroscuro brushwork', 'impasto specular highlights', 'Belgian linen texture', 'Old Master umber glaze'],
  },
];
