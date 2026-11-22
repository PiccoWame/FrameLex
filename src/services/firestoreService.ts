import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ActivityActionType,
  AnalysisResponse,
  AnatomyLayerKey,
  CloudActivityEntry,
  CloudSavedPrompt,
  CloudUserProfile,
  ColorSwatch,
  Dialect,
  FocusBias,
  MidjourneyOptions,
  PromptAnatomy,
  UserApiKeyConfig,
} from '../types/prompt';

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function sanitizeAnatomy(anatomy: PromptAnatomy): PromptAnatomy {
  return {
    subject: clampStr(anatomy.subject, 8000),
    spatialFields: clampStr(anatomy.spatialFields, 8000),
    environment: clampStr(anatomy.environment, 8000),
    composition: clampStr(anatomy.composition, 8000),
    lighting: clampStr(anatomy.lighting, 8000),
    colorHarmony: clampStr(anatomy.colorHarmony, 8000),
    surfaceTraces: clampStr(anatomy.surfaceTraces, 8000),
    mediumStyle: clampStr(anatomy.mediumStyle, 8000),
    negativePrompt: clampStr(anatomy.negativePrompt, 8000),
  };
}

function sanitizeEnabledLayers(
  layers: Record<AnatomyLayerKey, boolean>
): Record<AnatomyLayerKey, boolean> {
  return {
    subject: Boolean(layers.subject),
    spatialFields: Boolean(layers.spatialFields),
    environment: Boolean(layers.environment),
    composition: Boolean(layers.composition),
    lighting: Boolean(layers.lighting),
    colorHarmony: Boolean(layers.colorHarmony),
    surfaceTraces: Boolean(layers.surfaceTraces),
    mediumStyle: Boolean(layers.mediumStyle),
  };
}

function sanitizeDialects(analysis: AnalysisResponse) {
  return {
    general: clampStr(analysis.dialects.general, 40000),
    midjourney: clampStr(analysis.dialects.midjourney, 40000),
    flux: clampStr(analysis.dialects.flux, 40000),
    sdxl: clampStr(analysis.dialects.sdxl, 40000),
    video: clampStr(analysis.dialects.video, 40000),
  };
}

function sanitizeMjOptions(opts: MidjourneyOptions): MidjourneyOptions {
  return {
    includeAr: Boolean(opts.includeAr),
    styleRaw: Boolean(opts.styleRaw),
    stylize: Math.round(clampNum(opts.stylize, 0, 1000, 250)),
    version: opts.version === '6.1' ? '6.1' : '7',
    includeNo: Boolean(opts.includeNo),
  };
}

function sanitizeStringArray(arr: string[], maxItems: number, maxItemLen: number): string[] {
  return arr
    .filter((item): item is string => typeof item === 'string')
    .map((item) => clampStr(item.trim(), maxItemLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const profilePath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Creator', 120);
    const email = clampStr(user.email || '', 254);
    const photoURL = clampStr(user.photoURL || '', 1000);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        photoURL,
        generationCount: 0,
        savedCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      const keptName =
        typeof existingData.displayName === 'string' && existingData.displayName.trim()
          ? clampStr(existingData.displayName.trim(), 120)
          : displayName;
      await updateDoc(ref, {
        displayName: keptName,
        email,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export function subscribeUserProfile(
  userId: string,
  onData: (profile: CloudUserProfile | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid || userId),
        displayName: String(d.displayName || ''),
        email: String(d.email || ''),
        photoURL: String(d.photoURL || ''),
        generationCount: Number(d.generationCount || 0),
        savedCount: Number(d.savedCount || 0),
        createdAtMs: toMillis(d.createdAt),
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeUserPrompts(
  userId: string,
  onData: (prompts: CloudSavedPrompt[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/prompts`;
  const q = query(
    collection(db, 'users', userId, 'prompts'),
    where('userId', '==', userId),
    limit(80)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CloudSavedPrompt[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const hexes = Array.isArray(d.colorHexes) ? (d.colorHexes as string[]) : [];
        const pcts = Array.isArray(d.colorPercentages)
          ? (d.colorPercentages as number[])
          : [];
        const colors: ColorSwatch[] = hexes.map((hex, idx) => ({
          hex,
          percentage: Number(pcts[idx] ?? 10),
        }));

        return {
          id: String(d.id || docSnap.id),
          userId: String(d.userId || userId),
          title: String(d.title || 'Untitled Prompt'),
          thumbnailUrl: String(d.thumbnailUrl || ''),
          aspectRatioLabel: String(d.aspectRatioLabel || '4:3'),
          dimensions: String(d.dimensions || ''),
          activeDialect: (d.activeDialect as Dialect) || 'general',
          complexity: Number(d.complexity || 8),
          focusBias: (d.focusBias as FocusBias) || 'full',
          activePrompt: String(d.activePrompt || ''),
          manualOverridePrompt: String(d.manualOverridePrompt || ''),
          isCustomized: Boolean(d.isCustomized),
          sourceType: (d.sourceType as 'studio' | 'batch' | 'manual') || 'studio',
          anatomy: d.anatomy as PromptAnatomy,
          enabledLayers: d.enabledLayers as Record<AnatomyLayerKey, boolean>,
          dialects: d.dialects as AnalysisResponse['dialects'],
          keywords: Array.isArray(d.keywords) ? (d.keywords as string[]) : [],
          extraKeywords: Array.isArray(d.extraKeywords)
            ? (d.extraKeywords as string[])
            : [],
          colors,
          mjOptions: sanitizeMjOptions((d.mjOptions || {}) as MidjourneyOptions),
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
        };
      });

      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeUserActivities(
  userId: string,
  onData: (entries: CloudActivityEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/activities`;
  const q = query(
    collection(db, 'users', userId, 'activities'),
    where('userId', '==', userId),
    limit(80)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: CloudActivityEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          userId: String(d.userId || userId),
          action: (d.action as ActivityActionType) || 'analyzed',
          promptId: String(d.promptId || ''),
          title: String(d.title || 'Untitled Prompt'),
          dialect: (d.dialect as Dialect) || 'general',
          complexity: Number(d.complexity || 8),
          tokenCount: Number(d.tokenCount || 0),
          summary: String(d.summary || ''),
          createdAtMs: toMillis(d.createdAt),
        };
      });
      entries.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(entries);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function logCloudActivity(
  user: User,
  params: {
    action: ActivityActionType;
    promptId: string;
    title: string;
    dialect: Dialect;
    complexity: number;
    tokenCount: number;
    summary: string;
  }
): Promise<void> {
  const activityId = makeDocId('act');
  const path = `users/${user.uid}/activities/${activityId}`;
  try {
    await ensureUserProfile(user);
    await setDoc(doc(db, 'users', user.uid, 'activities', activityId), {
      id: activityId,
      userId: user.uid,
      action: params.action,
      promptId: clampStr(params.promptId, 128),
      title: clampStr(params.title || 'Untitled Prompt', 200, 'Untitled Prompt'),
      dialect: params.dialect,
      complexity: Math.round(clampNum(params.complexity, 1, 10, 8)),
      tokenCount: Math.round(clampNum(params.tokenCount, 0, 100000, 0)),
      summary: clampStr(params.summary, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createCloudPrompt(
  user: User,
  params: {
    title: string;
    thumbnailUrl: string;
    aspectRatioLabel: string;
    dimensions: string;
    activeDialect: Dialect;
    complexity: number;
    focusBias: FocusBias;
    activePrompt: string;
    manualOverridePrompt: string | null;
    isCustomized: boolean;
    sourceType: 'studio' | 'batch' | 'manual';
    anatomy: PromptAnatomy;
    enabledLayers: Record<AnatomyLayerKey, boolean>;
    analysis: AnalysisResponse;
    extraKeywords: string[];
    colors: ColorSwatch[];
    mjOptions: MidjourneyOptions;
    tokenCount: number;
    activityAction: ActivityActionType;
    activitySummary: string;
  }
): Promise<string> {
  const promptId = makeDocId('prm');
  const path = `users/${user.uid}/prompts/${promptId}`;

  try {
    await ensureUserProfile(user);

    const safeTitle = clampStr(params.title.trim() || 'Untitled Prompt', 200, 'Untitled Prompt');
    const safeThumb =
      params.thumbnailUrl && params.thumbnailUrl.length <= 150000
        ? params.thumbnailUrl
        : '';
    const colorHexes = sanitizeStringArray(
      params.colors.map((c) => c.hex),
      10,
      16
    );
    const colorPercentages = params.colors
      .slice(0, colorHexes.length)
      .map((c) => Math.round(clampNum(c.percentage, 0, 100, 10)));

    await setDoc(doc(db, 'users', user.uid, 'prompts', promptId), {
      id: promptId,
      userId: user.uid,
      title: safeTitle,
      thumbnailUrl: safeThumb,
      aspectRatioLabel: clampStr(params.aspectRatioLabel || '4:3', 20, '4:3'),
      dimensions: clampStr(params.dimensions || '', 40),
      activeDialect: params.activeDialect,
      complexity: Math.round(clampNum(params.complexity, 1, 10, 8)),
      focusBias: params.focusBias,
      activePrompt: clampStr(params.activePrompt, 40000),
      manualOverridePrompt: clampStr(params.manualOverridePrompt ?? '', 40000),
      isCustomized: Boolean(params.isCustomized),
      sourceType: params.sourceType,
      anatomy: sanitizeAnatomy(params.anatomy),
      enabledLayers: sanitizeEnabledLayers(params.enabledLayers),
      dialects: sanitizeDialects(params.analysis),
      keywords: sanitizeStringArray(params.analysis.keywords || [], 30, 120),
      extraKeywords: sanitizeStringArray(params.extraKeywords || [], 40, 120),
      colorHexes,
      colorPercentages,
      mjOptions: sanitizeMjOptions(params.mjOptions),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'users', user.uid), {
      generationCount:
        params.activityAction === 'analyzed' || params.activityAction === 'batch_analyzed'
          ? increment(1)
          : increment(0),
      savedCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    await logCloudActivity(user, {
      action: params.activityAction,
      promptId,
      title: safeTitle,
      dialect: params.activeDialect,
      complexity: params.complexity,
      tokenCount: params.tokenCount,
      summary: params.activitySummary,
    });

    return promptId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCloudPrompt(
  user: User,
  promptId: string,
  params: {
    title: string;
    activeDialect: Dialect;
    complexity: number;
    focusBias: FocusBias;
    activePrompt: string;
    manualOverridePrompt: string | null;
    isCustomized: boolean;
    anatomy: PromptAnatomy;
    enabledLayers: Record<AnatomyLayerKey, boolean>;
    analysis: AnalysisResponse;
    extraKeywords: string[];
    mjOptions: MidjourneyOptions;
    tokenCount: number;
    activityAction?: ActivityActionType;
    activitySummary?: string;
  }
): Promise<void> {
  const path = `users/${user.uid}/prompts/${promptId}`;
  try {
    await ensureUserProfile(user);
    const safeTitle = clampStr(params.title.trim() || 'Untitled Prompt', 200, 'Untitled Prompt');

    await updateDoc(doc(db, 'users', user.uid, 'prompts', promptId), {
      title: safeTitle,
      activeDialect: params.activeDialect,
      complexity: Math.round(clampNum(params.complexity, 1, 10, 8)),
      focusBias: params.focusBias,
      activePrompt: clampStr(params.activePrompt, 40000),
      manualOverridePrompt: clampStr(params.manualOverridePrompt ?? '', 40000),
      isCustomized: Boolean(params.isCustomized),
      anatomy: sanitizeAnatomy(params.anatomy),
      enabledLayers: sanitizeEnabledLayers(params.enabledLayers),
      dialects: sanitizeDialects(params.analysis),
      keywords: sanitizeStringArray(params.analysis.keywords || [], 30, 120),
      extraKeywords: sanitizeStringArray(params.extraKeywords || [], 40, 120),
      mjOptions: sanitizeMjOptions(params.mjOptions),
      updatedAt: serverTimestamp(),
    });

    await logCloudActivity(user, {
      action: params.activityAction || 'modified',
      promptId,
      title: safeTitle,
      dialect: params.activeDialect,
      complexity: params.complexity,
      tokenCount: params.tokenCount,
      summary:
        params.activitySummary ||
        `Modified saved prompt (${params.activeDialect}, ~${params.tokenCount} tokens)`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudPrompt(userId: string, promptId: string): Promise<void> {
  const path = `users/${userId}/prompts/${promptId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'prompts', promptId));
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const currentSaved = Number(userSnap.data().savedCount || 0);
      const nextSaved = Math.max(0, currentSaved - 1);
      await updateDoc(userRef, {
        savedCount: nextSaved,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearCloudUserHistory(
  userId: string,
  promptIds: string[],
  activityIds: string[]
): Promise<void> {
  const path = `users/${userId}/prompts`;
  try {
    const refs = [
      ...promptIds.map((id) => doc(db, 'users', userId, 'prompts', id)),
      ...activityIds.map((id) => doc(db, 'users', userId, 'activities', id)),
    ];
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      for (const ref of refs.slice(i, i + 400)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        savedCount: 0,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function maskApiKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function subscribeUserApiKeyConfig(
  userId: string,
  onData: (config: UserApiKeyConfig | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/private/apiKeyConfig`;
  return onSnapshot(
    doc(db, 'users', userId, 'private', 'apiKeyConfig'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        userId: String(d.userId || userId),
        usePersonalKey: Boolean(d.usePersonalKey),
        geminiApiKey: String(d.geminiApiKey || ''),
        keyPreview: String(d.keyPreview || ''),
        label: String(d.label || ''),
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveUserApiKeyConfig(
  user: User,
  params: {
    geminiApiKey: string;
    usePersonalKey: boolean;
    label: string;
  }
): Promise<void> {
  const path = `users/${user.uid}/private/apiKeyConfig`;
  const ref = doc(db, 'users', user.uid, 'private', 'apiKeyConfig');
  try {
    await ensureUserProfile(user);
    const cleanedKey = clampStr(params.geminiApiKey.trim(), 256);
    const keyPreview = clampStr(maskApiKey(cleanedKey), 32);
    const label = clampStr(params.label.trim(), 80);
    const existing = await getDoc(ref);

    if (!existing.exists()) {
      await setDoc(ref, {
        userId: user.uid,
        usePersonalKey: Boolean(params.usePersonalKey && cleanedKey.length > 0),
        geminiApiKey: cleanedKey,
        keyPreview,
        label,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        usePersonalKey: Boolean(params.usePersonalKey && cleanedKey.length > 0),
        geminiApiKey: cleanedKey,
        keyPreview,
        label,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserApiKeyConfig(userId: string): Promise<void> {
  const path = `users/${userId}/private/apiKeyConfig`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'private', 'apiKeyConfig'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateUserDisplayName(
  user: User,
  displayName: string
): Promise<void> {
  const path = `users/${user.uid}`;
  const cleaned = clampStr(displayName.trim(), 120);
  if (!cleaned) {
    throw new Error('Display name cannot be empty.');
  }
  try {
    await ensureUserProfile(user);
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: cleaned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

