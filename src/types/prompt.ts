export type Dialect = 'general' | 'midjourney' | 'flux' | 'sdxl' | 'video';

export type DetailLevel = 'concise' | 'balanced' | 'exhaustive';

export type FocusBias = 'full' | 'photography' | 'style' | 'composition';

export type AnatomyLayerKey =
  | 'subject'
  | 'spatialFields'
  | 'environment'
  | 'composition'
  | 'lighting'
  | 'colorHarmony'
  | 'surfaceTraces'
  | 'mediumStyle';

export interface PromptAnatomy {
  subject: string;
  spatialFields: string;
  environment: string;
  composition: string;
  lighting: string;
  colorHarmony: string;
  surfaceTraces: string;
  mediumStyle: string;
  negativePrompt: string;
}

export interface DialectPrompts {
  general: string;
  midjourney: string;
  flux: string;
  sdxl: string;
  video: string;
}

export interface AnalysisResponse {
  title: string;
  anatomy: PromptAnatomy;
  keywords: string[];
  dialects: DialectPrompts;
}

export interface ColorSwatch {
  hex: string;
  percentage: number;
}

export interface ImageMetadata {
  name: string;
  width: number;
  height: number;
  aspectRatioLabel: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
  thumbnailUrl: string;
  base64: string;
}

export interface MidjourneyOptions {
  includeAr: boolean;
  styleRaw: boolean;
  stylize: number;
  version: '7' | '6.1';
  includeNo: boolean;
}

export interface HistoryRecord {
  id: string;
  createdAt: number;
  title: string;
  thumbnailUrl: string;
  aspectRatioLabel: string;
  dimensions: string;
  colors: ColorSwatch[];
  activeDialect: Dialect;
  detailLevel: DetailLevel;
  complexity?: number;
  focusBias: FocusBias;
  analysis: AnalysisResponse;
}

export interface BatchQueueItem {
  id: string;
  image: ImageMetadata;
  colors: ColorSwatch[];
  status: 'queued' | 'analyzing' | 'done' | 'error';
  error?: string;
  analysis?: AnalysisResponse;
}

export interface StudioDraft {
  savedAt: number;
  image: ImageMetadata | null;
  colors: ColorSwatch[];
  dialect: Dialect;
  complexity: number;
  lastAnalyzedComplexity: number | null;
  focusBias: FocusBias;
  customNotes: string;
  analysis: AnalysisResponse | null;
  anatomy: PromptAnatomy;
  enabledLayers: Record<AnatomyLayerKey, boolean>;
  isAnatomyCustomized: boolean;
  extraKeywords: string[];
  mjOptions: MidjourneyOptions;
  manualOverridePrompt: string | null;
  activeCloudPromptId?: string | null;
}

export type ActivityActionType =
  | 'analyzed'
  | 'batch_analyzed'
  | 'enhanced'
  | 'refined'
  | 'saved'
  | 'modified';

export interface CloudUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  generationCount: number;
  savedCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CloudSavedPrompt {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  aspectRatioLabel: string;
  dimensions: string;
  activeDialect: Dialect;
  complexity: number;
  focusBias: FocusBias;
  activePrompt: string;
  manualOverridePrompt: string;
  isCustomized: boolean;
  sourceType: 'studio' | 'batch' | 'manual';
  anatomy: PromptAnatomy;
  enabledLayers: Record<AnatomyLayerKey, boolean>;
  dialects: DialectPrompts;
  keywords: string[];
  extraKeywords: string[];
  colors: ColorSwatch[];
  mjOptions: MidjourneyOptions;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CloudActivityEntry {
  id: string;
  userId: string;
  action: ActivityActionType;
  promptId: string;
  title: string;
  dialect: Dialect;
  complexity: number;
  tokenCount: number;
  summary: string;
  createdAtMs: number;
}

export interface UserApiKeyConfig {
  userId: string;
  usePersonalKey: boolean;
  geminiApiKey: string;
  keyPreview: string;
  label: string;
  updatedAtMs: number;
}

export interface StylisticVariation {
  id: string;
  styleLabel: string;
  tagline: string;
  styleNotes: string[];
  anatomyPatch: Pick<
    PromptAnatomy,
    | 'composition'
    | 'lighting'
    | 'colorHarmony'
    | 'surfaceTraces'
    | 'mediumStyle'
    | 'negativePrompt'
  >;
  fullPrompt: string;
}
