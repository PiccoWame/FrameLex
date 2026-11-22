import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  signInWithEmailLink,
  signOut,
  type User,
} from 'firebase/auth';
import { Header, type AppView } from './components/Header';
import { AccessGate } from './components/AccessGate';
import { UploadDropzone } from './components/UploadDropzone';
import { ImageInspector } from './components/ImageInspector';
import { PromptWorkbench } from './components/PromptWorkbench';
import { FRAMELEX_LOGO_URL } from './data/anatomyCatalog';
import { auth } from './firebase';
import { EMAIL_LINK_STORAGE_KEY } from './utils/authErrors';

const BatchQueueView = lazy(() =>
  import('./components/BatchQueueView').then((m) => ({ default: m.BatchQueueView }))
);
const HistoryView = lazy(() =>
  import('./components/HistoryView').then((m) => ({ default: m.HistoryView }))
);
const DialectsGuideView = lazy(() =>
  import('./components/DialectsGuideView').then((m) => ({ default: m.DialectsGuideView }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const AccountModal = lazy(() =>
  import('./components/AccountModal').then((m) => ({ default: m.AccountModal }))
);
const AboutModal = lazy(() =>
  import('./components/AboutModal').then((m) => ({ default: m.AboutModal }))
);
import {
  clearCloudUserHistory,
  createCloudPrompt,
  deleteCloudPrompt,
  ensureUserProfile,
  logCloudActivity,
  subscribeUserActivities,
  subscribeUserApiKeyConfig,
  subscribeUserProfile,
  subscribeUserPrompts,
  updateCloudPrompt,
} from './services/firestoreService';
import type {
  AnalysisResponse,
  AnatomyLayerKey,
  BatchQueueItem,
  CloudActivityEntry,
  CloudSavedPrompt,
  CloudUserProfile,
  ColorSwatch,
  DetailLevel,
  Dialect,
  FocusBias,
  HistoryRecord,
  ImageMetadata,
  MidjourneyOptions,
  PromptAnatomy,
  StudioDraft,
  StylisticVariation,
  UserApiKeyConfig,
} from './types/prompt';
import type { SampleAsset } from './data/samples';
import type { PromptTemplate } from './data/promptTemplates';
import type { TemplateApplyMode } from './components/PromptTemplateLibrary';
import {
  processBundledImage,
  processDataUrl,
  processImageFile,
} from './utils/imageProcessing';
import { assemblePrompt, estimateTokenCount } from './utils/promptAssembler';
import {
  clearStudioDraft,
  loadHistory,
  loadStudioDraft,
  saveHistory,
  saveStudioDraft,
} from './utils/storage';

const DEFAULT_ANATOMY: PromptAnatomy = {
  subject: '',
  spatialFields: '',
  environment: '',
  composition: '',
  lighting: '',
  colorHarmony: '',
  surfaceTraces: '',
  mediumStyle: '',
  negativePrompt: '',
};

const DEFAULT_ENABLED_LAYERS: Record<AnatomyLayerKey, boolean> = {
  composition: true,
  subject: true,
  spatialFields: true,
  environment: true,
  surfaceTraces: true,
  lighting: true,
  colorHarmony: true,
  mediumStyle: true,
};

function normalizeAnatomy(raw?: Partial<PromptAnatomy> | null): PromptAnatomy {
  return {
    subject: raw?.subject ?? '',
    spatialFields: raw?.spatialFields ?? '',
    environment: raw?.environment ?? '',
    composition: raw?.composition ?? '',
    lighting: raw?.lighting ?? '',
    colorHarmony: raw?.colorHarmony ?? '',
    surfaceTraces: raw?.surfaceTraces ?? '',
    mediumStyle: raw?.mediumStyle ?? '',
    negativePrompt: raw?.negativePrompt ?? '',
  };
}

function complexityToDetailLevel(complexity: number): DetailLevel {
  if (complexity <= 4) return 'concise';
  if (complexity <= 7) return 'balanced';
  return 'exhaustive';
}

const DEFAULT_MJ_OPTIONS: MidjourneyOptions = {
  includeAr: true,
  styleRaw: true,
  stylize: 250,
  version: '7',
  includeNo: false,
};

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUidRef = useRef<string | null>(null);

  const [activeView, setActiveView] = useState<AppView>('studio');
  const [image, setImage] = useState<ImageMetadata | null>(null);
  const [colors, setColors] = useState<ColorSwatch[]>([]);

  const [dialect, setDialect] = useState<Dialect>('general');
  const [complexity, setComplexity] = useState<number>(8);
  const [lastAnalyzedComplexity, setLastAnalyzedComplexity] = useState<number | null>(null);
  const [focusBias, setFocusBias] = useState<FocusBias>('full');
  const [customNotes, setCustomNotes] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  const [anatomy, setAnatomy] = useState<PromptAnatomy>(DEFAULT_ANATOMY);
  const [enabledLayers, setEnabledLayers] =
    useState<Record<AnatomyLayerKey, boolean>>(DEFAULT_ENABLED_LAYERS);
  const [isAnatomyCustomized, setIsAnatomyCustomized] = useState<boolean>(false);
  const [extraKeywords, setExtraKeywords] = useState<string[]>([]);
  const [mjOptions, setMjOptions] = useState<MidjourneyOptions>(DEFAULT_MJ_OPTIONS);
  const [manualOverridePrompt, setManualOverridePrompt] = useState<string | null>(null);
  const [activeCloudPromptId, setActiveCloudPromptId] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);

  // Firebase Auth, Personal Key Binding & Cloud Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [pendingEmailLinkUrl, setPendingEmailLinkUrl] = useState<string | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authRedirectHint, setAuthRedirectHint] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [authContextHint, setAuthContextHint] = useState<string | null>(null);
  const [cloudProfile, setCloudProfile] = useState<CloudUserProfile | null>(null);
  const [cloudPrompts, setCloudPrompts] = useState<CloudSavedPrompt[]>([]);
  const [cloudActivities, setCloudActivities] = useState<CloudActivityEntry[]>([]);
  const [apiKeyConfig, setApiKeyConfig] = useState<UserApiKeyConfig | null>(null);
  const [apiKeyConfigLoaded, setApiKeyConfigLoaded] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<string | null>(null);

  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [isRefining, setIsRefining] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [refineSummary, setRefineSummary] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [stylisticVariations, setStylisticVariations] = useState<StylisticVariation[]>([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [variationsError, setVariationsError] = useState<string | null>(null);
  const [appliedVariationId, setAppliedVariationId] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryRecord[]>(() => loadHistory());
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  const hasActivePersonalKey = Boolean(
    user &&
      isEmailVerified &&
      apiKeyConfig?.usePersonalKey &&
      apiKeyConfig.geminiApiKey &&
      apiKeyConfig.geminiApiKey.trim().length >= 20
  );
  const isWorkspaceUnlocked = Boolean(
    authReady && user && isEmailVerified && apiKeyConfigLoaded && hasActivePersonalKey
  );
  const isGuestStudioStart = Boolean(
    authReady && !user && !showAuthGate && !pendingEmailLinkUrl
  );

  const redirectToAuthGate = useCallback((hint?: string) => {
    setAuthRedirectHint(
      hint ||
        'Sign in or create a FrameLex account first to unlock Studio tools, upload images, and bind your personal Gemini API key.'
    );
    setShowAuthGate(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Resolve canonical and OpenGraph URLs dynamically for search engines & social cards
  useEffect(() => {
    const currentUrl = window.location.origin + window.location.pathname;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = currentUrl;

    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = currentUrl;
  }, []);

  const resetStudioWorkspace = useCallback((draft: StudioDraft | null) => {
    setImage(draft?.image ?? null);
    setColors(draft?.colors ?? []);
    setDialect(draft?.dialect ?? 'general');
    setComplexity(draft?.complexity ?? 8);
    setLastAnalyzedComplexity(draft?.lastAnalyzedComplexity ?? null);
    setFocusBias(draft?.focusBias ?? 'full');
    setCustomNotes(draft?.customNotes ?? '');
    setAnalysis(draft?.analysis ?? null);
    setAnatomy(draft ? normalizeAnatomy(draft.anatomy) : DEFAULT_ANATOMY);
    setEnabledLayers(
      draft?.enabledLayers
        ? { ...DEFAULT_ENABLED_LAYERS, ...draft.enabledLayers }
        : DEFAULT_ENABLED_LAYERS
    );
    setIsAnatomyCustomized(draft?.isAnatomyCustomized ?? false);
    setExtraKeywords(draft?.extraKeywords ?? []);
    setMjOptions(draft?.mjOptions ?? DEFAULT_MJ_OPTIONS);
    setManualOverridePrompt(draft?.manualOverridePrompt ?? null);
    setActiveCloudPromptId(draft?.activeCloudPromptId ?? null);
    setLastAutoSavedAt(draft?.savedAt ?? null);
    setAppliedTemplateId(null);
    setAnalysisError(null);
    setRefineSummary(null);
    setRefineError(null);
    setStylisticVariations([]);
    setVariationsError(null);
    setAppliedVariationId(null);
    setCloudSaveStatus(null);
    setBatchQueue([]);
    setActiveView('studio');
  }, []);

  // Complete passwordless Magic Email Link sign-in when returning from inbox
  useEffect(() => {
    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) return;

    const storedEmail = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (!storedEmail) {
      setPendingEmailLinkUrl(href);
      return;
    }

    void signInWithEmailLink(auth, storedEmail, href)
      .then(() => {
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        window.history.replaceState({}, document.title, window.location.pathname);
        setPendingEmailLinkUrl(null);
      })
      .catch(() => {
        setPendingEmailLinkUrl(href);
      });
  }, []);

  // Listen to Firebase Auth state and scope local studio draft strictly per user UID
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      const prevUid = activeUidRef.current;
      const nextUid = nextUser?.uid ?? null;
      activeUidRef.current = nextUid;

      setUser(nextUser);
      setIsEmailVerified(Boolean(nextUser?.emailVerified));
      setAuthReady(true);

      if (nextUser) {
        setShowAuthGate(false);
        setAuthRedirectHint(null);
        if (prevUid !== nextUser.uid) {
          setApiKeyConfig(null);
          setApiKeyConfigLoaded(false);
          resetStudioWorkspace(loadStudioDraft(nextUser.uid));
        }
        if (nextUser.emailVerified) {
          void ensureUserProfile(nextUser).catch((err) => {
            console.error('Failed to sync user profile:', err);
          });
        }
      } else {
        setShowAuthGate(false);
        setAuthRedirectHint(null);
        setCloudProfile(null);
        setCloudPrompts([]);
        setCloudActivities([]);
        setApiKeyConfig(null);
        setApiKeyConfigLoaded(false);
        setAccountModalOpen(false);
        resetStudioWorkspace(null);
      }
    });
    return () => unsub();
  }, [resetStudioWorkspace]);

  const handleRefreshVerification = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    await current.reload();
    await current.getIdToken(true);
    const verified = Boolean(current.emailVerified);
    setIsEmailVerified(verified);
    if (verified) {
      setUser(auth.currentUser);
      void ensureUserProfile(current).catch((err) => {
        console.error('Failed to sync user profile:', err);
      });
    }
    return verified;
  }, []);

  // Subscribe to user's Firestore profile, prompts, activity & private API key config
  useEffect(() => {
    if (!authReady || !user || !isEmailVerified) return;

    const handleSyncError = (err: Error) => {
      console.error('Cloud sync error:', err.message);
    };

    const unsubProfile = subscribeUserProfile(user.uid, setCloudProfile, handleSyncError);
    const unsubPrompts = subscribeUserPrompts(user.uid, setCloudPrompts, handleSyncError);
    const unsubActivities = subscribeUserActivities(
      user.uid,
      setCloudActivities,
      handleSyncError
    );
    const unsubApiKey = subscribeUserApiKeyConfig(
      user.uid,
      (config) => {
        setApiKeyConfig(config);
        setApiKeyConfigLoaded(true);
      },
      (err) => {
        setApiKeyConfigLoaded(true);
        handleSyncError(err);
      }
    );

    return () => {
      unsubProfile();
      unsubPrompts();
      unsubActivities();
      unsubApiKey();
    };
  }, [authReady, isEmailVerified, user]);

  const buildAiRequestHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) {
      throw new Error('Please sign in to use FrameLex.');
    }
    if (!isEmailVerified) {
      throw new Error('Please verify your email address before running AI tools.');
    }
    const personalKey = apiKeyConfig?.usePersonalKey
      ? apiKeyConfig.geminiApiKey.trim()
      : '';
    if (!personalKey) {
      throw new Error(
        'A personal Gemini API key bound to your account is required. Enter your API key in Account Settings.'
      );
    }
    const idToken = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'x-user-gemini-key': personalKey,
    };
  }, [apiKeyConfig, isEmailVerified, user]);

  const draftSnapshotRef = useRef<Omit<StudioDraft, 'savedAt'>>({
    image,
    colors,
    dialect,
    complexity,
    lastAnalyzedComplexity,
    focusBias,
    customNotes,
    analysis,
    anatomy,
    enabledLayers,
    isAnatomyCustomized,
    extraKeywords,
    mjOptions,
    manualOverridePrompt,
    activeCloudPromptId,
  });

  useEffect(() => {
    draftSnapshotRef.current = {
      image,
      colors,
      dialect,
      complexity,
      lastAnalyzedComplexity,
      focusBias,
      customNotes,
      analysis,
      anatomy,
      enabledLayers,
      isAnatomyCustomized,
      extraKeywords,
      mjOptions,
      manualOverridePrompt,
      activeCloudPromptId,
    };
  }, [
    image,
    colors,
    dialect,
    complexity,
    lastAnalyzedComplexity,
    focusBias,
    customNotes,
    analysis,
    anatomy,
    enabledLayers,
    isAnatomyCustomized,
    extraKeywords,
    mjOptions,
    manualOverridePrompt,
    activeCloudPromptId,
  ]);

  const persistCurrentDraft = useCallback(() => {
    if (!user) return;
    const snap = draftSnapshotRef.current;
    const hasWorkToSave =
      snap.analysis !== null ||
      snap.manualOverridePrompt !== null ||
      snap.isAnatomyCustomized;
    if (!hasWorkToSave) return;

    const now = Date.now();
    const ok = saveStudioDraft(
      {
        ...snap,
        savedAt: now,
      },
      user.uid
    );
    if (ok) {
      setLastAutoSavedAt(now);
    }
  }, [user]);

  // Periodic 5-second auto-save + page-unload safeguard
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      persistCurrentDraft();
    }, 5000);

    const handleBeforeUnload = () => {
      persistCurrentDraft();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [persistCurrentDraft]);

  // Quick debounced save whenever manualOverridePrompt or anatomy changes
  useEffect(() => {
    const hasWorkToSave =
      analysis !== null || manualOverridePrompt !== null || isAnatomyCustomized;
    if (!hasWorkToSave) return;

    const timer = window.setTimeout(() => {
      persistCurrentDraft();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    analysis,
    anatomy,
    enabledLayers,
    extraKeywords,
    isAnatomyCustomized,
    manualOverridePrompt,
    mjOptions,
    persistCurrentDraft,
  ]);

  const appendHistoryRecord = useCallback(
    (
      img: ImageMetadata,
      palette: ColorSwatch[],
      result: AnalysisResponse,
      usedDialect: Dialect,
      usedComplexity: number,
      usedFocus: FocusBias
    ) => {
      const record: HistoryRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        title: result.title || img.name,
        thumbnailUrl: img.thumbnailUrl,
        aspectRatioLabel: img.aspectRatioLabel,
        dimensions: `${img.width} × ${img.height}`,
        colors: palette,
        activeDialect: usedDialect,
        detailLevel: complexityToDetailLevel(usedComplexity),
        complexity: usedComplexity,
        focusBias: usedFocus,
        analysis: result,
      };
      setHistory((prev) => {
        const next = [record, ...prev];
        saveHistory(next);
        return next;
      });
    },
    []
  );

  const runAnalysisForImage = useCallback(
    async (
      targetImage: ImageMetadata,
      targetColors: ColorSwatch[],
      opts?: {
        complexityValue?: number;
        focus?: FocusBias;
        notes?: string;
        targetDialect?: Dialect;
      }
    ) => {
      if (!targetImage.base64) {
        setAnalysisError('Please upload the full image to re-analyze from pixels.');
        return;
      }

      const usedComplexity = opts?.complexityValue ?? complexity;
      const usedDetail = complexityToDetailLevel(usedComplexity);
      const usedFocus = opts?.focus ?? focusBias;
      const usedNotes = opts?.notes ?? customNotes;
      const usedDialect = opts?.targetDialect ?? dialect;

      setIsAnalyzing(true);
      setAnalysisError(null);
      setRefineSummary(null);
      setRefineError(null);
      setAppliedTemplateId(null);
      setStylisticVariations([]);
      setVariationsError(null);
      setAppliedVariationId(null);
      setManualOverridePrompt(null);

      try {
        const headers = await buildAiRequestHeaders();
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            imageBase64: targetImage.base64,
            mimeType: targetImage.mimeType,
            detailLevel: usedDetail,
            complexity: usedComplexity,
            focusBias: usedFocus,
            aspectRatio: targetImage.aspectRatioLabel,
            customNotes: usedNotes,
            sampledColors: targetColors.map((c) => c.hex),
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || `Server error (${res.status})`);
        }

        const data = payload as AnalysisResponse;
        const normalized = normalizeAnatomy(data.anatomy);
        setAnalysis(data);
        setAnatomy(normalized);
        setEnabledLayers(DEFAULT_ENABLED_LAYERS);
        setIsAnatomyCustomized(false);
        setExtraKeywords([]);
        setActiveCloudPromptId(null);
        setCloudSaveStatus(null);
        setLastAnalyzedComplexity(usedComplexity);
        appendHistoryRecord(
          targetImage,
          targetColors,
          data,
          usedDialect,
          usedComplexity,
          usedFocus
        );

        if (user) {
          const generatedText = data.dialects[usedDialect] || data.dialects.general || '';
          const tokens = estimateTokenCount(generatedText);
          void createCloudPrompt(user, {
            title: data.title || targetImage.name,
            thumbnailUrl: targetImage.thumbnailUrl,
            aspectRatioLabel: targetImage.aspectRatioLabel,
            dimensions: `${targetImage.width} × ${targetImage.height}`,
            activeDialect: usedDialect,
            complexity: usedComplexity,
            focusBias: usedFocus,
            activePrompt: generatedText,
            manualOverridePrompt: null,
            isCustomized: false,
            sourceType: 'studio',
            anatomy: normalized,
            enabledLayers: DEFAULT_ENABLED_LAYERS,
            analysis: data,
            extraKeywords: [],
            colors: targetColors,
            mjOptions,
            tokenCount: tokens,
            activityAction: 'analyzed',
            activitySummary: `Generated ${usedDialect} prompt (${tokens} tokens) at complexity ${usedComplexity}/10`,
          })
            .then((newPromptId) => {
              setActiveCloudPromptId(newPromptId);
            })
            .catch((err) => {
              console.error('Failed to persist generation to cloud:', err);
            });
        }
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : 'Failed to analyze image.'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [
      appendHistoryRecord,
      buildAiRequestHeaders,
      complexity,
      customNotes,
      dialect,
      focusBias,
      mjOptions,
      user,
    ]
  );

  const loadIntoStudioAndAnalyze = useCallback(
    (img: ImageMetadata, palette: ColorSwatch[]) => {
      setImage(img);
      setColors(palette);
      setAnalysis(null);
      setAnalysisError(null);
      setManualOverridePrompt(null);
      setRefineSummary(null);
      setRefineError(null);
      setActiveView('studio');
      void runAnalysisForImage(img, palette);
    },
    [runAnalysisForImage]
  );

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      if (imageFiles.length === 1 && activeView === 'studio') {
        try {
          const { image: processed, colors: palette } = await processImageFile(
            imageFiles[0]
          );
          loadIntoStudioAndAnalyze(processed, palette);
        } catch (err) {
          setAnalysisError(
            err instanceof Error ? err.message : 'Could not load image file.'
          );
        }
        return;
      }

      // Queue multiple images into Batch Queue
      const queuedItems: BatchQueueItem[] = [];
      for (const file of imageFiles) {
        try {
          const { image: processed, colors: palette } = await processImageFile(file);
          queuedItems.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            image: processed,
            colors: palette,
            status: 'queued',
          });
        } catch {
          // Skip invalid files
        }
      }
      if (queuedItems.length > 0) {
        setBatchQueue((prev) => [...prev, ...queuedItems]);
        setActiveView('batch');
      }
    },
    [activeView, loadIntoStudioAndAnalyze]
  );

  const handleUrlSubmit = useCallback(
    async (url: string) => {
      if (!user) {
        setUrlError('Please sign in to fetch remote images.');
        return;
      }
      setIsFetchingUrl(true);
      setUrlError(null);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/fetch-image-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ url }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || 'Could not fetch remote image.');
        }
        const dataUrl = `data:${payload.mimeType};base64,${payload.base64}`;
        const urlName = url.split('/').pop()?.split('?')[0] || 'remote-image';
        const { image: processed, colors: palette } = await processDataUrl(
          dataUrl,
          urlName,
          Math.round((payload.base64.length * 3) / 4),
          payload.mimeType
        );
        loadIntoStudioAndAnalyze(processed, palette);
      } catch (err) {
        setUrlError(
          err instanceof Error ? err.message : 'Failed to load image URL.'
        );
      } finally {
        setIsFetchingUrl(false);
      }
    },
    [loadIntoStudioAndAnalyze, user]
  );

  const handleSampleSelect = useCallback(
    async (sample: SampleAsset) => {
      try {
        setUrlError(null);
        const { image: processed, colors: palette } = await processBundledImage(
          sample.url,
          `${sample.title}.jpg`
        );
        loadIntoStudioAndAnalyze(processed, palette);
      } catch (err) {
        setAnalysisError(
          err instanceof Error ? err.message : 'Could not load sample image.'
        );
      }
    },
    [loadIntoStudioAndAnalyze]
  );

  // Global Ctrl+V / Cmd+V image paste support
  useEffect(() => {
    if (!isWorkspaceUnlocked && !isGuestStudioStart) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedImages: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) pastedImages.push(file);
        }
      }
      if (pastedImages.length > 0) {
        e.preventDefault();
        if (!user) {
          redirectToAuthGate('Sign in or create an account to paste and analyze images.');
          return;
        }
        void handleFilesSelected(pastedImages);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFilesSelected, isGuestStudioStart, isWorkspaceUnlocked, redirectToAuthGate, user]);

  // Ctrl+Enter / Cmd+Enter shortcut to extract / re-analyze in Studio
  useEffect(() => {
    if (!isWorkspaceUnlocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (activeView === 'studio' && image?.base64 && !isAnalyzing) {
          e.preventDefault();
          void runAnalysisForImage(image, colors);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, colors, image, isAnalyzing, isWorkspaceUnlocked, runAnalysisForImage]);

  const { promptText: originalPrompt } = useMemo(
    () =>
      assemblePrompt({
        analysis,
        dialect,
        anatomy: normalizeAnatomy(analysis?.anatomy),
        enabledLayers: DEFAULT_ENABLED_LAYERS,
        isAnatomyCustomized: false,
        extraKeywords: [],
        aspectRatioLabel: image?.aspectRatioLabel || '4:3',
        mjOptions,
      }),
    [analysis, dialect, image?.aspectRatioLabel, mjOptions]
  );

  const { promptText: assembledPrompt, negativeText: assembledNegative } = useMemo(
    () =>
      assemblePrompt({
        analysis,
        dialect,
        anatomy,
        enabledLayers,
        isAnatomyCustomized,
        extraKeywords,
        aspectRatioLabel: image?.aspectRatioLabel || '4:3',
        mjOptions,
      }),
    [
      analysis,
      anatomy,
      dialect,
      enabledLayers,
      extraKeywords,
      image?.aspectRatioLabel,
      isAnatomyCustomized,
      mjOptions,
    ]
  );

  const handleDialectChange = (nextDialect: Dialect) => {
    setDialect(nextDialect);
    setManualOverridePrompt(null);
    setRefineSummary(null);
    setRefineError(null);
  };

  const handleToggleLayer = (key: AnatomyLayerKey) => {
    setEnabledLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    setIsAnatomyCustomized(true);
    setManualOverridePrompt(null);
  };

  const handleUpdateLayerText = (key: keyof PromptAnatomy, value: string) => {
    setAnatomy((prev) => ({ ...prev, [key]: value }));
    if (key !== 'negativePrompt') {
      setIsAnatomyCustomized(true);
    }
    setManualOverridePrompt(null);
  };

  const handleResetAnatomy = () => {
    if (!analysis) return;
    setAnatomy(normalizeAnatomy(analysis.anatomy));
    setEnabledLayers(DEFAULT_ENABLED_LAYERS);
    setIsAnatomyCustomized(false);
    setAppliedTemplateId(null);
    setAppliedVariationId(null);
    setManualOverridePrompt(null);
  };

  const handleApplyTemplate = (
    template: PromptTemplate,
    mode: TemplateApplyMode
  ) => {
    if (!analysis) {
      const nextAnatomy = normalizeAnatomy(template.anatomy);
      const assembledStarter = assemblePrompt({
        analysis: {
          title: template.name,
          anatomy: nextAnatomy,
          keywords: template.keywords,
          dialects: {
            general: '',
            midjourney: '',
            flux: '',
            sdxl: '',
            video: '',
          },
        },
        dialect: template.recommendedDialect,
        anatomy: nextAnatomy,
        enabledLayers: DEFAULT_ENABLED_LAYERS,
        isAnatomyCustomized: true,
        extraKeywords: [],
        aspectRatioLabel: image?.aspectRatioLabel || '4:3',
        mjOptions,
      }).promptText;

      setDialect(template.recommendedDialect);
      setAnalysis({
        title: template.name,
        anatomy: nextAnatomy,
        keywords: template.keywords,
        dialects: {
          general: assembledStarter,
          midjourney: assembledStarter,
          flux: assembledStarter,
          sdxl: assembledStarter,
          video: assembledStarter,
        },
      });
      setAnatomy(nextAnatomy);
      setEnabledLayers(DEFAULT_ENABLED_LAYERS);
      setIsAnatomyCustomized(true);
      setExtraKeywords([]);
      setManualOverridePrompt(null);
      setAppliedTemplateId(template.id);
      setRefineSummary(`Loaded "${template.name}" (${template.category}) template across all anatomy layers.`);
      setRefineError(null);
      return;
    }

    if (mode === 'replace') {
      setAnatomy(normalizeAnatomy(template.anatomy));
    } else {
      setAnatomy((prev) => ({
        ...prev,
        ...template.stylePatch,
      }));
    }
    setIsAnatomyCustomized(true);
    setManualOverridePrompt(null);
    setAppliedTemplateId(template.id);
    setAppliedVariationId(null);
    setRefineSummary(
      mode === 'replace'
        ? `Replaced anatomy layers with "${template.name}" (${template.category}).`
        : `Blended "${template.name}" (${template.category}) optics, lighting, color, and medium onto your current subject.`
    );
    setRefineError(null);
  };

  const handleToggleKeyword = (kw: string) => {
    const isRemoving = extraKeywords.includes(kw);
    setExtraKeywords((prev) =>
      isRemoving ? prev.filter((item) => item !== kw) : [...prev, kw]
    );

    if (manualOverridePrompt !== null) {
      if (isRemoving) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cleaned = manualOverridePrompt
          .replace(new RegExp(`(?:,\\s*|\\s+)${escaped}(?=\\s*(?:--|$|,|\\.|\\n))`, 'gi'), '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        setManualOverridePrompt(cleaned);
      } else {
        const flagMatch = manualOverridePrompt.match(/\s(--(?:ar|stylize|s|style|v|no)\b.*)$/i);
        if (dialect === 'midjourney' && flagMatch && flagMatch.index !== undefined) {
          const head = manualOverridePrompt.slice(0, flagMatch.index).trimEnd();
          const tail = flagMatch[1];
          setManualOverridePrompt(`${head}, ${kw} ${tail}`);
        } else {
          const trimmed = manualOverridePrompt.trimEnd();
          const sep = trimmed.endsWith(',') ? ' ' : ', ';
          setManualOverridePrompt(`${trimmed}${sep}${kw}`);
        }
      }
    }
  };

  const handleRefinePrompt = async (instruction: string) => {
    const activeText = manualOverridePrompt ?? assembledPrompt;
    if (!activeText) return;

    setIsRefining(true);
    setRefineError(null);
    setRefineSummary(null);

    try {
      const headers = await buildAiRequestHeaders();
      const res = await fetch('/api/refine-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPrompt: activeText,
          dialect,
          instruction,
          imageBase64: image?.base64 || undefined,
          mimeType: image?.mimeType || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not apply refinement.');
      }
      setManualOverridePrompt(payload.updatedPrompt);
      setRefineSummary(payload.changeSummary || 'Prompt updated.');

      if (user) {
        const tokens = estimateTokenCount(payload.updatedPrompt);
        void logCloudActivity(user, {
          action: 'refined',
          promptId: activeCloudPromptId || '',
          title: analysis?.title || image?.name || 'Untitled Prompt',
          dialect,
          complexity,
          tokenCount: tokens,
          summary: `${payload.changeSummary || 'Applied prompt remix'} (${tokens} tokens)`,
        }).catch((err) => console.error('Activity log failed:', err));
      }
    } catch (err) {
      setRefineError(
        err instanceof Error ? err.message : 'Failed to refine prompt.'
      );
    } finally {
      setIsRefining(false);
    }
  };

  const handleEnhancePrompt = async (): Promise<boolean> => {
    const activeText = manualOverridePrompt ?? assembledPrompt;
    if (!activeText) return false;

    setIsEnhancing(true);
    setRefineError(null);
    setRefineSummary(null);

    try {
      const headers = await buildAiRequestHeaders();
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPrompt: activeText,
          dialect,
          anatomy,
          aspectRatio: image?.aspectRatioLabel || '4:3',
          sampledColors: colors.map((c) => c.hex),
          imageBase64: image?.base64 || undefined,
          mimeType: image?.mimeType || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not enhance prompt.');
      }
      setManualOverridePrompt(payload.enhancedPrompt);
      if (payload.enhancedNegativePrompt) {
        setAnatomy((prev) => ({
          ...prev,
          negativePrompt: payload.enhancedNegativePrompt,
        }));
      }
      const summaryText =
        payload.enhancementSummary ||
        'Prompt enhanced and reorganized for production quality.';
      setRefineSummary(summaryText);

      if (user) {
        const tokens = estimateTokenCount(payload.enhancedPrompt);
        void logCloudActivity(user, {
          action: 'enhanced',
          promptId: activeCloudPromptId || '',
          title: analysis?.title || image?.name || 'Untitled Prompt',
          dialect,
          complexity,
          tokenCount: tokens,
          summary: `${summaryText} (${tokens} tokens)`,
        }).catch((err) => console.error('Activity log failed:', err));
      }
      return true;
    } catch (err) {
      setRefineError(
        err instanceof Error ? err.message : 'Failed to enhance prompt.'
      );
      return false;
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSuggestVariations = async () => {
    const activeText = manualOverridePrompt ?? assembledPrompt;
    if (!activeText && !analysis) return;

    setIsGeneratingVariations(true);
    setVariationsError(null);

    try {
      const headers = await buildAiRequestHeaders();
      const res = await fetch('/api/suggest-variations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPrompt: activeText,
          dialect,
          complexity,
          anatomy,
          enabledLayers,
          aspectRatio: image?.aspectRatioLabel || '4:3',
          sampledColors: colors.map((c) => c.hex),
          imageBase64: image?.base64 || undefined,
          mimeType: image?.mimeType || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Could not generate stylistic variations.');
      }
      const nextVariations = Array.isArray(payload?.variations)
        ? (payload.variations as StylisticVariation[])
        : [];
      setStylisticVariations(nextVariations);
      setAppliedVariationId(null);
    } catch (err) {
      setVariationsError(
        err instanceof Error ? err.message : 'Failed to suggest stylistic variations.'
      );
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const handleApplyVariation = (variation: StylisticVariation) => {
    const updatedAnatomy: PromptAnatomy = {
      ...anatomy,
      ...variation.anatomyPatch,
    };
    setAnatomy(updatedAnatomy);
    setIsAnatomyCustomized(true);
    setManualOverridePrompt(null);
    setAppliedTemplateId(null);
    setAppliedVariationId(variation.id);
    setRefineError(null);
    setRefineSummary(
      `Applied "${variation.styleLabel}" stylistic variation across optics, lighting, surface traces, color, and medium layers.`
    );

    if (user) {
      const nextPrompt = assemblePrompt({
        analysis,
        dialect,
        anatomy: updatedAnatomy,
        enabledLayers,
        isAnatomyCustomized: true,
        extraKeywords,
        aspectRatioLabel: image?.aspectRatioLabel || '4:3',
        mjOptions,
      }).promptText;
      const tokens = estimateTokenCount(nextPrompt);
      void logCloudActivity(user, {
        action: 'refined',
        promptId: activeCloudPromptId || '',
        title: analysis?.title || image?.name || 'Untitled Prompt',
        dialect,
        complexity,
        tokenCount: tokens,
        summary: `Applied "${variation.styleLabel}" stylistic variation (${tokens} tokens)`,
      }).catch((err) => console.error('Activity log failed:', err));
    }
  };

  const handleSaveToCloud = async (asNew = false) => {
    if (!analysis) return;
    if (!user) {
      setAuthContextHint(
        'Sign in or create an account to save this prompt, preserve your custom anatomy edits, and access your generation history anytime.'
      );
      setAuthModalOpen(true);
      return;
    }

    const activeText = manualOverridePrompt ?? assembledPrompt;
    const tokens = estimateTokenCount(activeText);
    const title = analysis.title || image?.name || 'Untitled Prompt';

    setIsSavingCloud(true);
    setCloudSaveStatus(null);
    try {
      if (activeCloudPromptId && !asNew) {
        await updateCloudPrompt(user, activeCloudPromptId, {
          title,
          activeDialect: dialect,
          complexity,
          focusBias,
          activePrompt: activeText,
          manualOverridePrompt,
          isCustomized: isAnatomyCustomized || manualOverridePrompt !== null,
          anatomy,
          enabledLayers,
          analysis,
          extraKeywords,
          mjOptions,
          tokenCount: tokens,
          activityAction: 'modified',
          activitySummary: `Updated saved prompt (${dialect}, ${tokens} tokens)`,
        });
        setCloudSaveStatus('Saved updates to your cloud prompt library.');
      } else {
        const newId = await createCloudPrompt(user, {
          title,
          thumbnailUrl: image?.thumbnailUrl || '',
          aspectRatioLabel: image?.aspectRatioLabel || '4:3',
          dimensions: image ? `${image.width} × ${image.height}` : '',
          activeDialect: dialect,
          complexity,
          focusBias,
          activePrompt: activeText,
          manualOverridePrompt,
          isCustomized: isAnatomyCustomized || manualOverridePrompt !== null,
          sourceType: 'studio',
          anatomy,
          enabledLayers,
          analysis,
          extraKeywords,
          colors,
          mjOptions,
          tokenCount: tokens,
          activityAction: 'saved',
          activitySummary: `Saved prompt snapshot (${dialect}, ${tokens} tokens)`,
        });
        setActiveCloudPromptId(newId);
        setCloudSaveStatus(
          asNew
            ? 'Saved as a new entry in your cloud prompt library.'
            : 'Saved to your cloud prompt library.'
        );
      }
      window.setTimeout(() => setCloudSaveStatus(null), 3500);
    } catch (err) {
      setRefineError(
        err instanceof Error ? err.message : 'Could not save prompt to cloud.'
      );
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleExportTxt = () => {
    const text = manualOverridePrompt ?? assembledPrompt;
    if (!text) return;
    const content =
      dialect === 'sdxl' && assembledNegative
        ? `PROMPT (${dialect.toUpperCase()}):\n${text}\n\nNEGATIVE PROMPT:\n${assembledNegative}\n`
        : `${text}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(analysis?.title || 'prompt').toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!analysis) return;
    const exportPayload = {
      title: analysis.title,
      activeDialect: dialect,
      activePrompt: manualOverridePrompt ?? assembledPrompt,
      aspectRatio: image?.aspectRatioLabel,
      colors,
      anatomy,
      keywords: analysis.keywords,
      dialects: analysis.dialects,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(analysis.title || 'prompt').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Batch Queue Execution
  const handleRunBatch = async () => {
    if (isBatchRunning) return;
    setIsBatchRunning(true);

    const snapshot = [...batchQueue];
    for (const item of snapshot) {
      if (item.status === 'done') continue;
      setBatchQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'analyzing', error: undefined } : q))
      );

      try {
        const headers = await buildAiRequestHeaders();
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            imageBase64: item.image.base64,
            mimeType: item.image.mimeType,
            detailLevel: complexityToDetailLevel(complexity),
            complexity,
            focusBias,
            aspectRatio: item.image.aspectRatioLabel,
            customNotes,
            sampledColors: item.colors.map((c) => c.hex),
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || `Error ${res.status}`);
        }
        const result = payload as AnalysisResponse;
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'done', analysis: result } : q
          )
        );
        appendHistoryRecord(
          item.image,
          item.colors,
          result,
          dialect,
          complexity,
          focusBias
        );

        if (user) {
          const generatedText = result.dialects[dialect] || result.dialects.general || '';
          const tokens = estimateTokenCount(generatedText);
          void createCloudPrompt(user, {
            title: result.title || item.image.name,
            thumbnailUrl: item.image.thumbnailUrl,
            aspectRatioLabel: item.image.aspectRatioLabel,
            dimensions: `${item.image.width} × ${item.image.height}`,
            activeDialect: dialect,
            complexity,
            focusBias,
            activePrompt: generatedText,
            manualOverridePrompt: null,
            isCustomized: false,
            sourceType: 'batch',
            anatomy: normalizeAnatomy(result.anatomy),
            enabledLayers: DEFAULT_ENABLED_LAYERS,
            analysis: result,
            extraKeywords: [],
            colors: item.colors,
            mjOptions,
            tokenCount: tokens,
            activityAction: 'batch_analyzed',
            activitySummary: `Batch extracted ${dialect} prompt (${tokens} tokens)`,
          }).catch((err) => console.error('Batch cloud save failed:', err));
        }
      } catch (err) {
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Failed',
                }
              : q
          )
        );
      }
    }

    setIsBatchRunning(false);
  };

  const handleExportBatchCsv = () => {
    const doneItems = batchQueue.filter((i) => i.status === 'done' && i.analysis);
    if (doneItems.length === 0) return;

    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const headers = ['File', 'Title', 'Aspect Ratio', 'Dialect', 'Prompt', 'Negative Prompt'];
    const rows = doneItems.map((i) => [
      escapeCsv(i.image.name),
      escapeCsv(i.analysis!.title),
      escapeCsv(i.image.aspectRatioLabel),
      escapeCsv(dialect),
      escapeCsv(i.analysis!.dialects[dialect]),
      escapeCsv(i.analysis!.anatomy.negativePrompt),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framelex-batch-${dialect}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBatchJson = () => {
    const doneItems = batchQueue
      .filter((i) => i.status === 'done' && i.analysis)
      .map((i) => ({
        file: i.image.name,
        dimensions: `${i.image.width}x${i.image.height}`,
        aspectRatio: i.image.aspectRatioLabel,
        colors: i.colors,
        analysis: i.analysis,
      }));
    const blob = new Blob([JSON.stringify(doneItems, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framelex-batch.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadHistoryRecord = (record: HistoryRecord) => {
    const [wStr, hStr] = record.dimensions.split('×').map((s) => s.trim());
    setImage({
      name: record.title,
      width: Number(wStr) || 0,
      height: Number(hStr) || 0,
      aspectRatioLabel: record.aspectRatioLabel,
      mimeType: 'image/jpeg',
      sizeBytes: 0,
      previewUrl: record.thumbnailUrl,
      thumbnailUrl: record.thumbnailUrl,
      base64: '',
    });
    const restoredComplexity =
      record.complexity ??
      (record.detailLevel === 'concise'
        ? 3
        : record.detailLevel === 'exhaustive'
          ? 10
          : 7);
    setColors(record.colors);
    setDialect(record.activeDialect);
    setComplexity(restoredComplexity);
    setLastAnalyzedComplexity(restoredComplexity);
    setFocusBias(record.focusBias);
    setAnalysis(record.analysis);
    setAnatomy(normalizeAnatomy(record.analysis.anatomy));
    setEnabledLayers(DEFAULT_ENABLED_LAYERS);
    setIsAnatomyCustomized(false);
    setExtraKeywords([]);
    setManualOverridePrompt(null);
    setActiveCloudPromptId(null);
    setAppliedTemplateId(null);
    setStylisticVariations([]);
    setVariationsError(null);
    setAppliedVariationId(null);
    setCloudSaveStatus(null);
    setAnalysisError(null);
    setActiveView('studio');
  };

  const handleLoadCloudPrompt = (saved: CloudSavedPrompt) => {
    const [wStr, hStr] = saved.dimensions.split('×').map((s) => s.trim());
    setImage({
      name: saved.title,
      width: Number(wStr) || 0,
      height: Number(hStr) || 0,
      aspectRatioLabel: saved.aspectRatioLabel,
      mimeType: 'image/jpeg',
      sizeBytes: 0,
      previewUrl: saved.thumbnailUrl,
      thumbnailUrl: saved.thumbnailUrl,
      base64: '',
    });
    setColors(saved.colors);
    setDialect(saved.activeDialect);
    setComplexity(saved.complexity);
    setLastAnalyzedComplexity(saved.complexity);
    setFocusBias(saved.focusBias);
    const loadedAnatomy = normalizeAnatomy(saved.anatomy);
    setAnalysis({
      title: saved.title,
      anatomy: loadedAnatomy,
      keywords: saved.keywords,
      dialects: saved.dialects,
    });
    setAnatomy(loadedAnatomy);
    setEnabledLayers({ ...DEFAULT_ENABLED_LAYERS, ...saved.enabledLayers });
    setIsAnatomyCustomized(saved.isCustomized);
    setExtraKeywords(saved.extraKeywords);
    setMjOptions(saved.mjOptions || DEFAULT_MJ_OPTIONS);
    setManualOverridePrompt(
      saved.manualOverridePrompt ? saved.manualOverridePrompt : null
    );
    setActiveCloudPromptId(saved.id);
    setAppliedTemplateId(null);
    setStylisticVariations([]);
    setVariationsError(null);
    setAppliedVariationId(null);
    setCloudSaveStatus(null);
    setAnalysisError(null);
    setRefineSummary(null);
    setRefineError(null);
    setActiveView('studio');
  };

  const handleDeleteHistoryRecord = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveHistory(next);
      return next;
    });
  };

  const handleDeleteCloudPrompt = async (id: string) => {
    if (!user) return;
    try {
      await deleteCloudPrompt(user.uid, id);
      if (activeCloudPromptId === id) {
        setActiveCloudPromptId(null);
      }
    } catch (err) {
      console.error('Failed to delete cloud prompt:', err);
    }
  };

  const handleClearHistory = () => {
    if (user) {
      void clearCloudUserHistory(
        user.uid,
        cloudPrompts.map((p) => p.id),
        cloudActivities.map((a) => a.id)
      ).catch((err) => console.error('Failed to clear cloud history:', err));
      setActiveCloudPromptId(null);
    }
    setHistory([]);
    saveHistory([]);
  };

  const handleGuestClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isGuestStudioStart) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest(
      'button, a, label, [role="button"], [role="tab"], input[type="button"], input[type="submit"], input[type="file"], input[type="checkbox"], input[type="range"], select'
    );
    if (interactive) {
      e.preventDefault();
      e.stopPropagation();
      redirectToAuthGate();
    }
  };

  const handleGuestSubmitCapture = (e: React.FormEvent<HTMLDivElement>) => {
    if (!isGuestStudioStart) return;
    e.preventDefault();
    e.stopPropagation();
    redirectToAuthGate();
  };

  const handleGuestDropCapture = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isGuestStudioStart) return;
    e.preventDefault();
    e.stopPropagation();
    redirectToAuthGate('Sign in or create an account first to upload or drop images.');
  };

  return (
    <div
      onClickCapture={handleGuestClickCapture}
      onSubmitCapture={handleGuestSubmitCapture}
      onDropCapture={handleGuestDropCapture}
      className="min-h-screen flex flex-col bg-[#F6F5FA] text-slate-900"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) void handleFilesSelected(files);
          e.target.value = '';
        }}
      />

      <Header
        activeView={activeView}
        onNavigate={(view) => {
          if (!user) {
            if (view === 'studio' && showAuthGate && !pendingEmailLinkUrl) {
              setShowAuthGate(false);
              setAuthRedirectHint(null);
            } else {
              redirectToAuthGate();
            }
            return;
          }
          setActiveView(view);
        }}
        onTriggerUpload={() => {
          if (!user) {
            redirectToAuthGate('Sign in or create an account first to upload images.');
            return;
          }
          fileInputRef.current?.click();
        }}
        user={user}
        authReady={authReady}
        profileDisplayName={cloudProfile?.displayName}
        savedCount={cloudProfile?.savedCount ?? cloudPrompts.length}
        usingPersonalKey={hasActivePersonalKey}
        personalKeyPreview={apiKeyConfig?.keyPreview || null}
        isWorkspaceUnlocked={isWorkspaceUnlocked}
        showWorkspaceNav={isGuestStudioStart}
        onOpenAuthModal={() => {
          redirectToAuthGate();
        }}
        onOpenAccountModal={() => setAccountModalOpen(true)}
        onOpenAboutModal={() => {
          if (!user) {
            redirectToAuthGate();
            return;
          }
          setAboutModalOpen(true);
        }}
        onSignOut={() => {
          void signOut(auth);
        }}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8">
        {!authReady ? (
          <div className="max-w-md mx-auto py-16 text-center space-y-3">
            <img
              src={FRAMELEX_LOGO_URL}
              alt="FrameLex icon"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover border border-[#D8E0FC] mx-auto shadow-2xs"
            />
            <div className="w-6 h-6 rounded-full border-2 border-indigo-700 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-600">
              Checking your sign-in session...
            </p>
          </div>
        ) : !user && (showAuthGate || pendingEmailLinkUrl) ? (
          <AccessGate
            mode="signin"
            user={null}
            redirectHint={authRedirectHint}
            pendingEmailLinkUrl={pendingEmailLinkUrl}
            onClearPendingEmailLink={() => setPendingEmailLinkUrl(null)}
            onBackToStudio={() => {
              setShowAuthGate(false);
              setAuthRedirectHint(null);
            }}
          />
        ) : user && !isEmailVerified ? (
          <AccessGate
            mode="verify"
            user={user}
            onRefreshVerification={handleRefreshVerification}
            onSignOut={() => {
              void signOut(auth);
            }}
          />
        ) : user && !apiKeyConfigLoaded ? (
          <div className="max-w-md mx-auto py-16 text-center space-y-3">
            <img
              src={FRAMELEX_LOGO_URL}
              alt="FrameLex icon"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover border border-[#D8E0FC] mx-auto shadow-2xs"
            />
            <div className="w-6 h-6 rounded-full border-2 border-indigo-700 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-600">
              Loading your private account configuration...
            </p>
          </div>
        ) : user && !hasActivePersonalKey ? (
          <AccessGate
            mode="apikey"
            user={user}
            onSignOut={() => {
              void signOut(auth);
            }}
          />
        ) : (
          <>
            {(activeView === 'studio' || isGuestStudioStart) && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-1.5">
                  See Every Pixel · Speak Every Engine
                </p>
                <h1
                  className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
                  style={{ textWrap: 'balance' }}
                >
                  Reverse-engineer any image into structured, generator-ready prompts.
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                  Inspect framing, spatial fields, surface traces, lighting physics, and color harmony—then dial Complexity 1–10, customize 8 modular anatomy layers, or enhance for production.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 lg:max-w-xl w-full shrink-0">
                <div className="px-3 py-2.5 rounded-xl bg-[#EEF2FF]/80 border border-[#D8E0FC]">
                  <div className="text-[11px] font-mono font-semibold text-indigo-900">
                    01 · Drop Frame
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">
                    Upload, paste, URL, or sample
                  </div>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#FFF4ED]/85 border border-[#F5DFD0]">
                  <div className="text-[11px] font-mono font-semibold text-amber-950">
                    02 · Dial 1–10
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">
                    Extract 8 layers &amp; 5 dialects
                  </div>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#F5F3FF]/90 border border-[#E2D9FA]">
                  <div className="text-[11px] font-mono font-semibold text-violet-950">
                    03 · Refine &amp; Export
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">
                    Enhance, template &amp; compare
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-5">
                {image ? (
                  <ImageInspector
                    image={image}
                    colors={colors}
                    onReplaceImage={() => fileInputRef.current?.click()}
                    onSampleSelect={handleSampleSelect}
                    onClearImage={() => {
                      setImage(null);
                      setColors([]);
                      setAnalysis(null);
                      setAnalysisError(null);
                      setManualOverridePrompt(null);
                      setActiveCloudPromptId(null);
                      setAppliedTemplateId(null);
                      setStylisticVariations([]);
                      setVariationsError(null);
                      setAppliedVariationId(null);
                      setCloudSaveStatus(null);
                      setAnatomy(DEFAULT_ANATOMY);
                      setEnabledLayers(DEFAULT_ENABLED_LAYERS);
                      setIsAnatomyCustomized(false);
                      setExtraKeywords([]);
                      setLastAutoSavedAt(null);
                      clearStudioDraft(user?.uid);
                    }}
                  />
                ) : (
                  <UploadDropzone
                    onFilesSelected={handleFilesSelected}
                    onUrlSubmit={handleUrlSubmit}
                    onSampleSelect={handleSampleSelect}
                    isFetchingUrl={isFetchingUrl}
                    urlError={urlError}
                  />
                )}
              </div>

              <div className="lg:col-span-7">
                <PromptWorkbench
                  hasImage={Boolean(image && image.base64)}
                  isAnalyzing={isAnalyzing}
                  analysisError={analysisError}
                  analysis={analysis}
                  dialect={dialect}
                  onDialectChange={handleDialectChange}
                  complexity={complexity}
                  lastAnalyzedComplexity={lastAnalyzedComplexity}
                  onComplexityChange={setComplexity}
                  focusBias={focusBias}
                  onFocusBiasChange={setFocusBias}
                  customNotes={customNotes}
                  onCustomNotesChange={setCustomNotes}
                  onRunAnalysis={() => {
                    if (image) void runAnalysisForImage(image, colors);
                  }}
                  originalPrompt={originalPrompt}
                  assembledPrompt={assembledPrompt}
                  assembledNegative={assembledNegative}
                  manualOverridePrompt={manualOverridePrompt}
                  onManualOverrideChange={setManualOverridePrompt}
                  anatomy={anatomy}
                  enabledLayers={enabledLayers}
                  onToggleLayer={handleToggleLayer}
                  onUpdateLayerText={handleUpdateLayerText}
                  isAnatomyCustomized={isAnatomyCustomized}
                  onResetAnatomy={handleResetAnatomy}
                  extraKeywords={extraKeywords}
                  onToggleKeyword={handleToggleKeyword}
                  mjOptions={mjOptions}
                  onMjOptionsChange={setMjOptions}
                  aspectRatioLabel={image?.aspectRatioLabel || '4:3'}
                  onRefinePrompt={handleRefinePrompt}
                  isRefining={isRefining}
                  refineSummary={refineSummary}
                  refineError={refineError}
                  stylisticVariations={stylisticVariations}
                  isGeneratingVariations={isGeneratingVariations}
                  variationsError={variationsError}
                  appliedVariationId={appliedVariationId}
                  onSuggestVariations={handleSuggestVariations}
                  onApplyVariation={handleApplyVariation}
                  onEnhancePrompt={handleEnhancePrompt}
                  isEnhancing={isEnhancing}
                  lastAutoSavedAt={lastAutoSavedAt}
                  isSignedIn={Boolean(user)}
                  activeCloudPromptId={activeCloudPromptId}
                  isSavingCloud={isSavingCloud}
                  cloudSaveStatus={cloudSaveStatus}
                  onSaveToCloud={handleSaveToCloud}
                  appliedTemplateId={appliedTemplateId}
                  onApplyTemplate={handleApplyTemplate}
                  onExportJson={handleExportJson}
                  onExportTxt={handleExportTxt}
                />
              </div>
            </div>
          </div>
        )}

        {isWorkspaceUnlocked && activeView === 'batch' && (
          <Suspense
            fallback={
              <div className="bg-white border border-[#E2DFEE] rounded-xl p-10 text-center text-xs text-slate-500">
                Loading Batch Queue...
              </div>
            }
          >
            <BatchQueueView
              items={batchQueue}
              activeDialect={dialect}
              isRunning={isBatchRunning}
              onAddFiles={handleFilesSelected}
              onRunBatch={handleRunBatch}
              onRemoveItem={(id) =>
                setBatchQueue((prev) => prev.filter((item) => item.id !== id))
              }
              onClearCompleted={() =>
                setBatchQueue((prev) => prev.filter((item) => item.status !== 'done'))
              }
              onOpenInStudio={(item) => {
                if (!item.analysis) return;
                setImage(item.image);
                setColors(item.colors);
                setAnalysis(item.analysis);
                setAnatomy(normalizeAnatomy(item.analysis.anatomy));
                setEnabledLayers(DEFAULT_ENABLED_LAYERS);
                setIsAnatomyCustomized(false);
                setExtraKeywords([]);
                setManualOverridePrompt(null);
                setActiveCloudPromptId(null);
                setAppliedTemplateId(null);
                setCloudSaveStatus(null);
                setAnalysisError(null);
                setLastAnalyzedComplexity(complexity);
                setActiveView('studio');
              }}
              onExportCsv={handleExportBatchCsv}
              onExportJson={handleExportBatchJson}
            />
          </Suspense>
        )}

        {isWorkspaceUnlocked && activeView === 'history' && (
          <Suspense
            fallback={
              <div className="bg-white border border-[#E2DFEE] rounded-xl p-10 text-center text-xs text-slate-500">
                Loading Prompt History...
              </div>
            }
          >
            <HistoryView
              user={user}
              authReady={authReady}
              onOpenAuthModal={() => {
                setAuthContextHint(null);
                setAuthModalOpen(true);
              }}
              records={history}
              cloudPrompts={cloudPrompts}
              cloudActivities={cloudActivities}
              onLoadRecord={handleLoadHistoryRecord}
              onLoadCloudPrompt={handleLoadCloudPrompt}
              onDeleteRecord={handleDeleteHistoryRecord}
              onDeleteCloudPrompt={handleDeleteCloudPrompt}
              onClearAll={handleClearHistory}
              onGoToStudio={() => setActiveView('studio')}
            />
          </Suspense>
        )}

        {isWorkspaceUnlocked && activeView === 'dialects' && (
          <Suspense
            fallback={
              <div className="bg-white border border-[#E2DFEE] rounded-xl p-10 text-center text-xs text-slate-500">
                Loading Dialect Reference...
              </div>
            }
          >
            <DialectsGuideView
              onSelectDialectAndReturn={(d) => {
                handleDialectChange(d);
                setActiveView('studio');
              }}
            />
          </Suspense>
            )}
          </>
        )}
      </main>

      <Suspense fallback={null}>
        {authModalOpen && (
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => {
              setAuthModalOpen(false);
              setAuthContextHint(null);
            }}
            contextHint={authContextHint}
          />
        )}

        {accountModalOpen && (
          <AccountModal
            isOpen={accountModalOpen}
            onClose={() => setAccountModalOpen(false)}
            user={user}
            cloudProfile={cloudProfile}
            activityCount={cloudActivities.length}
            savedCount={cloudProfile?.savedCount ?? cloudPrompts.length}
            apiKeyConfig={apiKeyConfig}
            onOpenHistory={() => setActiveView('history')}
            onSignOut={() => {
              void signOut(auth);
            }}
          />
        )}

        {aboutModalOpen && (
          <AboutModal
            isOpen={aboutModalOpen}
            onClose={() => setAboutModalOpen(false)}
          />
        )}
      </Suspense>

      <footer className="border-t border-[#E2DFEE] bg-white">
        <div className="max-w-[1360px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-2">
            <img
              src={FRAMELEX_LOGO_URL}
              alt="FrameLex icon"
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded-md object-cover border border-[#D8E0FC] shrink-0"
            />
            <span>
              <strong className="font-semibold text-slate-900">FrameLex</strong> · Visual Prompt Workbench ·{' '}
              <span className="text-indigo-800">See every pixel, speak every engine.</span>
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => setAboutModalOpen(true)}
              className="hover:text-indigo-900 transition-colors"
            >
              App Info &amp; Shortcuts
            </button>
            {(isWorkspaceUnlocked || isGuestStudioStart) && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveView('dialects')}
                  className="hover:text-indigo-900 transition-colors"
                >
                  Dialect Reference
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('batch')}
                  className="hover:text-indigo-900 transition-colors"
                >
                  Batch Queue
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('history')}
                  className="hover:text-indigo-900 transition-colors"
                >
                  {`Saved Prompts (${cloudPrompts.length})`}
                </button>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
