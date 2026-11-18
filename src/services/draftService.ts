import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { ArticleDraft } from '../types';

const DRAFT_COLLECTION = 'article_drafts';
const LOCAL_STORAGE_PREFIX = 'notmediawiki_draft_v1_';

export const AUTOSAVE_INACTIVITY_MS = 2500;
export const AUTOSAVE_PERIODIC_MS = 30000;

export interface DraftBaseline {
  title: string;
  wikitext: string;
  summary?: string;
}

export interface SaveDraftPayload {
  userId: string;
  articleSlug: string;
  title: string;
  wikitext: string;
  summary: string;
  isMinor: boolean;
}

/**
 * Normalizes a slug into a Firestore-safe document ID segment.
 */
export function normalizeDraftSlug(slug: string): string {
  const cleaned = slug
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (cleaned || 'untitled').slice(0, 120);
}

/**
 * Builds a deterministic, collision-resistant document ID for a user + article draft.
 */
export function buildDraftId(userId: string, articleSlug: string): string {
  const safeUser = (userId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const safeSlug = normalizeDraftSlug(articleSlug);
  return `${safeUser}_${safeSlug}`.slice(0, 256);
}

/**
 * Returns true if the current editor content differs meaningfully from the baseline article.
 */
export function hasMeaningfulDraftChanges(
  current: DraftBaseline,
  baseline: DraftBaseline
): boolean {
  const titleChanged = current.title.trim() !== baseline.title.trim();
  const wikitextChanged = current.wikitext !== baseline.wikitext;
  const summaryChanged = (current.summary ?? '').trim() !== (baseline.summary ?? '').trim();
  return titleChanged || wikitextChanged || summaryChanged;
}

function getLocalStorageKey(draftId: string): string {
  return `${LOCAL_STORAGE_PREFIX}${draftId}`;
}

function writeLocalDraft(draft: ArticleDraft): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getLocalStorageKey(draft.id), JSON.stringify(draft));
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function readLocalDraft(draftId: string): ArticleDraft | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(getLocalStorageKey(draftId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ArticleDraft;
      if (parsed && typeof parsed.wikitext === 'string' && typeof parsed.title === 'string') {
        return { ...parsed, storageSource: 'local' };
      }
    }
  } catch {
    // Ignore corrupted localStorage entries
  }
  return null;
}

function removeLocalDraft(draftId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(getLocalStorageKey(draftId));
    }
  } catch {
    // Ignore storage access errors
  }
}

function sanitizeDraftPayload(payload: SaveDraftPayload): Omit<ArticleDraft, 'storageSource'> {
  const id = buildDraftId(payload.userId, payload.articleSlug);
  return {
    id,
    userId: payload.userId.slice(0, 128),
    articleSlug: payload.articleSlug.trim().slice(0, 255) || 'untitled',
    title: payload.title.slice(0, 255),
    wikitext: payload.wikitext.slice(0, 500000),
    summary: (payload.summary || '').slice(0, 1000),
    isMinor: Boolean(payload.isMinor),
    updatedAt: new Date().toISOString(),
  };
}

function isAuthenticatedAs(userId: string): boolean {
  return Boolean(auth.currentUser && auth.currentUser.uid === userId);
}

/**
 * Persists an article draft to Firestore (when authenticated) and mirrors it in localStorage.
 */
export async function saveArticleDraft(payload: SaveDraftPayload): Promise<ArticleDraft> {
  const sanitized = sanitizeDraftPayload(payload);

  // Always mirror locally for instant resilience if offline or tab crashes
  writeLocalDraft({ ...sanitized, storageSource: 'local' });

  if (!isAuthenticatedAs(sanitized.userId)) {
    return { ...sanitized, storageSource: 'local' };
  }

  const path = `${DRAFT_COLLECTION}/${sanitized.id}`;
  try {
    await setDoc(doc(db, DRAFT_COLLECTION, sanitized.id), sanitized, { merge: false });
    return { ...sanitized, storageSource: 'firestore' };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Fallback already written to localStorage; rethrow so UI can show status accurately
    }
    throw error;
  }
}

/**
 * Loads the most recent saved draft for a user + article slug, preferring Firestore when authenticated.
 */
export async function loadArticleDraft(
  userId: string,
  articleSlug: string
): Promise<ArticleDraft | null> {
  const draftId = buildDraftId(userId, articleSlug);
  const localDraft = readLocalDraft(draftId);

  if (!isAuthenticatedAs(userId)) {
    return localDraft;
  }

  try {
    const snap = await getDoc(doc(db, DRAFT_COLLECTION, draftId));
    if (!snap.exists()) {
      return localDraft;
    }

    const remoteData = snap.data() as ArticleDraft;
    const remoteDraft: ArticleDraft = {
      ...remoteData,
      id: remoteData.id || draftId,
      storageSource: 'firestore',
    };

    if (localDraft) {
      const remoteTs = Date.parse(remoteDraft.updatedAt || '') || 0;
      const localTs = Date.parse(localDraft.updatedAt || '') || 0;
      return localTs > remoteTs ? localDraft : remoteDraft;
    }

    return remoteDraft;
  } catch {
    return localDraft;
  }
}

/**
 * Deletes the saved draft from both Firestore and localStorage (e.g., after publishing or discarding).
 */
export async function deleteArticleDraft(userId: string, articleSlug: string): Promise<void> {
  const draftId = buildDraftId(userId, articleSlug);
  removeLocalDraft(draftId);

  if (!isAuthenticatedAs(userId)) {
    return;
  }

  try {
    await deleteDoc(doc(db, DRAFT_COLLECTION, draftId));
  } catch {
    // Non-fatal if document did not exist or user is offline
  }
}

/**
 * Formats an ISO timestamp into a compact HH:MM (pt-BR) label for the editor toolbar.
 */
export function formatDraftTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
