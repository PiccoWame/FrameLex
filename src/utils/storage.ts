import type { HistoryRecord, StudioDraft } from '../types/prompt';

const STORAGE_KEY = 'framelex_prompt_history_v1';
const DRAFT_STORAGE_KEY = 'framelex_studio_draft_v1';
const MAX_RECORDS = 36;

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

export function loadStudioDraft(): StudioDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudioDraft(draft: StudioDraft): boolean {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
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
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(compactDraft));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearStudioDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
