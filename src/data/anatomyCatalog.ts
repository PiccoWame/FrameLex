import compositionIconUrl from '../assets/images/anatomy_composition_1795281367817.jpg';
import subjectIconUrl from '../assets/images/anatomy_subject_1795281368210.jpg';
import spatialIconUrl from '../assets/images/anatomy_spatial_1795281369805.jpg';
import environmentIconUrl from '../assets/images/anatomy_environment_1795281369260.jpg';
import tracesIconUrl from '../assets/images/anatomy_traces_1795281367891.jpg';
import lightingIconUrl from '../assets/images/anatomy_lighting_1795281367284.jpg';
import colorIconUrl from '../assets/images/anatomy_color_1795281368121.jpg';
import mediumIconUrl from '../assets/images/anatomy_medium_1795281368598.jpg';
import type { AnatomyLayerKey, PromptAnatomy } from '../types/prompt';

export const FRAMELEX_LOGO_URL = '/assets/aistudio/img_fbe0d2ce.png';

export type AnatomyLayerGroup =
  | 'Optics & Space'
  | 'Subject & Scene'
  | 'Light & Material';

export type AnatomyFilterGroup = 'all' | 'active' | AnatomyLayerGroup;

export interface IndexedAnatomyLayer {
  key: AnatomyLayerKey;
  indexCode: string;
  label: string;
  shortLabel: string;
  group: AnatomyLayerGroup;
  iconUrl: string;
  description: string;
  searchTags: string[];
}

export const ANATOMY_LAYER_INDEX: IndexedAnatomyLayer[] = [
  {
    key: 'composition',
    indexCode: '01',
    label: 'Framing, Optics & Geometry',
    shortLabel: 'Optics & Frame',
    group: 'Optics & Space',
    iconUrl: compositionIconUrl,
    description: 'Shot scale, camera pitch, focal length, aperture plane, and frame edges.',
    searchTags: ['framing', 'optics', 'lens', 'camera', 'geometry', 'crop', 'angle', 'dof'],
  },
  {
    key: 'subject',
    indexCode: '02',
    label: 'Subject, Pose & Micro-Details',
    shortLabel: 'Subject',
    group: 'Subject & Scene',
    iconUrl: subjectIconUrl,
    description: 'Primary focal subject, posture, expression, gaze, and garment tension.',
    searchTags: ['subject', 'pose', 'figure', 'focus', 'expression', 'character', 'object'],
  },
  {
    key: 'spatialFields',
    indexCode: '03',
    label: 'Spatial Fields, Planes & Routes',
    shortLabel: 'Spatial Routes',
    group: 'Optics & Space',
    iconUrl: spatialIconUrl,
    description: 'Foreground-to-background depth planes, leading lines, and vanishing routes.',
    searchTags: ['spatial', 'planes', 'depth', 'routes', 'perspective', 'foreground', 'horizon'],
  },
  {
    key: 'environment',
    indexCode: '04',
    label: 'Environment & Context',
    shortLabel: 'Environment',
    group: 'Subject & Scene',
    iconUrl: environmentIconUrl,
    description: 'Architectural or natural setting, secondary props, and surroundings.',
    searchTags: ['environment', 'context', 'architecture', 'landscape', 'setting', 'props'],
  },
  {
    key: 'surfaceTraces',
    indexCode: '05',
    label: 'Surface Traces, Wear & Materiality',
    shortLabel: 'Surface Traces',
    group: 'Light & Material',
    iconUrl: tracesIconUrl,
    description: 'Micro-textures, patina, fabric weave, dust, scratches, and reflections.',
    searchTags: ['surface', 'traces', 'wear', 'patina', 'texture', 'weave', 'material'],
  },
  {
    key: 'lighting',
    indexCode: '06',
    label: 'Lighting Physics & Shadow Falloff',
    shortLabel: 'Lighting',
    group: 'Light & Material',
    iconUrl: lightingIconUrl,
    description: 'Key/fill/rim light angles, Kelvin temperature, and shadow softness.',
    searchTags: ['lighting', 'shadow', 'kelvin', 'rim', 'specular', 'key', 'falloff'],
  },
  {
    key: 'colorHarmony',
    indexCode: '07',
    label: 'Color Palette, Tones & Grading',
    shortLabel: 'Color & Tones',
    group: 'Light & Material',
    iconUrl: colorIconUrl,
    description: 'Highlight tint, midtone bias, shadow depth, and palette harmony.',
    searchTags: ['color', 'palette', 'tones', 'grading', 'contrast', 'hue', 'tint'],
  },
  {
    key: 'mediumStyle',
    indexCode: '08',
    label: 'Medium, Emulsion & Finish',
    shortLabel: 'Medium',
    group: 'Light & Material',
    iconUrl: mediumIconUrl,
    description: 'Film stock, sensor profile, pigment brushwork, ink weight, or print finish.',
    searchTags: ['medium', 'style', 'film', 'emulsion', 'brushwork', 'ink', 'finish'],
  },
];

export const ANATOMY_ICON_BY_KEY: Record<AnatomyLayerKey, string> =
  ANATOMY_LAYER_INDEX.reduce(
    (acc, item) => {
      acc[item.key] = item.iconUrl;
      return acc;
    },
    {} as Record<AnatomyLayerKey, string>
  );

export const ANATOMY_GROUPS: Array<{ id: AnatomyFilterGroup; label: string }> = [
  { id: 'all', label: 'All (8)' },
  { id: 'active', label: 'Active Only' },
  { id: 'Optics & Space', label: 'Optics & Space' },
  { id: 'Subject & Scene', label: 'Subject & Scene' },
  { id: 'Light & Material', label: 'Light & Material' },
];

export function filterAnatomyIndex(params: {
  query: string;
  group: AnatomyFilterGroup;
  enabledLayers: Record<AnatomyLayerKey, boolean>;
  anatomy: PromptAnatomy;
}): IndexedAnatomyLayer[] {
  const { query, group, enabledLayers, anatomy } = params;
  const q = query.trim().toLowerCase();

  return ANATOMY_LAYER_INDEX.filter((item) => {
    if (group === 'active' && !enabledLayers[item.key]) {
      return false;
    }
    if (
      group !== 'all' &&
      group !== 'active' &&
      item.group !== group
    ) {
      return false;
    }
    if (!q) return true;

    const searchable = [
      item.indexCode,
      item.label,
      item.shortLabel,
      item.group,
      item.description,
      ...item.searchTags,
      anatomy[item.key] || '',
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(q);
  });
}
