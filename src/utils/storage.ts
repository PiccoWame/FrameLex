import type { HistoryRecord, StudioDraft } from '../types/prompt';

const STORAGE_KEY = 'framelex_prompt_history_v1';
const DRAFT_STORAGE_PREFIX = 'framelex_studio_draft_v2_';
const MAX_RECORDS = 36;

function getDraftKey(userId?: string | null): string | null {
  if (!userId) return null;
  return `${DRAFT_STORAGE_PREFIX}${userId}`;
}

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(records: HistoryRecord[]): void {
  const trimmed = records.slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // If quota is exceeded, progressively trim older entries
    let count = Math.min(trimmed.length, 15);
    while (count > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(0, count)));
        return;
      } catch {
        count = Math.floor(count / 2);
      }
    }
  }
}

export function loadStudioDraft(userId?: string | null): StudioDraft | null {
  const key = getDraftKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudioDraft(draft: StudioDraft, userId?: string | null): boolean {
  const key = getDraftKey(userId);
  if (!key) return false;
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    // Strip heavy full-res base64/previewUrl if storage quota is tight, keeping thumbnail + all prompt/anatomy edits
    try {
      const compactDraft: StudioDraft = {
        ...draft,
        image: draft.image
          ? {
              ...draft.image,
              previewUrl: draft.image.thumbnailUrl,
              base64: '',
            }
          : null,
      };
      localStorage.setItem(key, JSON.stringify(compactDraft));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearStudioDraft(userId?: string | null): void {
  const key = getDraftKey(userId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage removal errors
  }
}
