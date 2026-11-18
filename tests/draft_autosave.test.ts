import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSetDoc, mockGetDoc, mockDeleteDoc, mockDoc, mockAuthState } = vi.hoisted(() => ({
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
  mockAuthState: { currentUser: null as { uid: string } | null },
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));

vi.mock('../src/firebase', () => ({
  db: {},
  auth: mockAuthState,
  OperationType: { WRITE: 'write', GET: 'get', DELETE: 'delete' },
  handleFirestoreError: vi.fn(),
}));

import {
  buildDraftId,
  normalizeDraftSlug,
  hasMeaningfulDraftChanges,
  saveArticleDraft,
  loadArticleDraft,
  deleteArticleDraft,
  formatDraftTimestamp,
} from '../src/services/draftService';

describe('WikiEditor Auto-Save Draft Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.currentUser = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('normalizes slugs and builds deterministic Firestore-safe draft IDs', () => {
    expect(normalizeDraftSlug('  Inteligência Artificial / 2026  ')).toBe('Intelig_ncia_Artificial_2026');
    expect(buildDraftId('uid_123', 'NotMediaWiki Guide')).toBe('uid_123_NotMediaWiki_Guide');
    expect(buildDraftId('uid_123', '   ')).toBe('uid_123_untitled');
  });

  it('detects meaningful changes compared to the loaded article baseline', () => {
    const baseline = { title: 'Artigo', wikitext: 'Conteúdo inicial', summary: '' };
    expect(hasMeaningfulDraftChanges({ title: 'Artigo', wikitext: 'Conteúdo inicial', summary: '' }, baseline)).toBe(false);
    expect(hasMeaningfulDraftChanges({ title: 'Artigo ', wikitext: 'Conteúdo inicial', summary: '  ' }, baseline)).toBe(false);
    expect(hasMeaningfulDraftChanges({ title: 'Artigo', wikitext: 'Conteúdo editado', summary: '' }, baseline)).toBe(true);
    expect(hasMeaningfulDraftChanges({ title: 'Novo Título', wikitext: 'Conteúdo inicial', summary: '' }, baseline)).toBe(true);
    expect(hasMeaningfulDraftChanges({ title: 'Artigo', wikitext: 'Conteúdo inicial', summary: 'Correção ortográfica' }, baseline)).toBe(true);
  });

  it('persists draft to Firestore when authenticated as the draft owner', async () => {
    mockAuthState.currentUser = { uid: 'user_abc' };
    mockSetDoc.mockResolvedValueOnce(undefined);

    const saved = await saveArticleDraft({
      userId: 'user_abc',
      articleSlug: 'Arquitetura_NotMediaWiki',
      title: 'Arquitetura NotMediaWiki',
      wikitext: '== Nova Seção ==\nTexto em andamento.',
      summary: 'Rascunho automático',
      isMinor: false,
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(saved.id).toBe('user_abc_Arquitetura_NotMediaWiki');
    expect(saved.storageSource).toBe('firestore');
    expect(saved.wikitext).toContain('Nova Seção');
  });

  it('loads an existing draft from Firestore for the authenticated user', async () => {
    mockAuthState.currentUser = { uid: 'user_abc' };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        id: 'user_abc_Guia_Wikitext',
        userId: 'user_abc',
        articleSlug: 'Guia_Wikitext',
        title: 'Guia Wikitext',
        wikitext: 'Rascunho salvo no Firestore',
        summary: 'WIP',
        isMinor: true,
        updatedAt: '2026-11-18T12:30:00.000Z',
      }),
    });

    const draft = await loadArticleDraft('user_abc', 'Guia_Wikitext');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(draft).not.toBeNull();
    expect(draft?.storageSource).toBe('firestore');
    expect(draft?.wikitext).toBe('Rascunho salvo no Firestore');
  });

  it('deletes the draft from Firestore when publishing or discarding', async () => {
    mockAuthState.currentUser = { uid: 'user_abc' };
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    await deleteArticleDraft('user_abc', 'Guia_Wikitext');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('falls back to local mode when user is unauthenticated', async () => {
    mockAuthState.currentUser = null;

    const saved = await saveArticleDraft({
      userId: 'guest',
      articleSlug: 'Visitante_Teste',
      title: 'Visitante Teste',
      wikitext: 'Texto local',
      summary: '',
      isMinor: false,
    });

    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(saved.storageSource).toBe('local');
  });

  it('formats valid ISO timestamps and safely handles invalid dates', () => {
    expect(formatDraftTimestamp('2026-11-18T14:05:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    expect(formatDraftTimestamp('invalid-date')).toBe('');
  });
});
