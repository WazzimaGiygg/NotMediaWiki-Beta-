import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserSession } from '../src/types';

const {
  mockGetDoc,
  mockSetDoc,
  mockGetDocs,
  mockAuth,
} = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn<(...args: any[]) => Promise<void>>(async () => undefined),
  mockGetDocs: vi.fn(async () => ({ forEach: () => {} })),
  mockAuth: {
    currentUser: null as {
      uid: string;
      email?: string | null;
      displayName?: string | null;
      photoURL?: string | null;
      emailVerified?: boolean;
    } | null,
  },
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockAuth),
  GoogleAuthProvider: vi.fn(function () {
    return { setCustomParameters: vi.fn() };
  }),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, col: string) => ({ col })),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id, path: `${col}/${id}` })),
  setDoc: mockSetDoc,
  deleteDoc: vi.fn(),
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  getDocFromServer: vi.fn(async () => ({ exists: () => false })),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn((...args: unknown[]) => ({ args })),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import { centralAuthService } from '../server/services/auth';
import { contentService } from '../server/services/content';
import {
  resolveCurrentFirestoreUser,
  saveArticleToFirestore,
  syncFirebaseUserToSession,
} from '../src/firebase';

describe('Wiki Editor & Role Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
  });

  it('allows non-banned editors to edit seed articles (including MediaWiki & Node.js) and create articles on backend ContentService', () => {
    const editorUser: UserSession = {
      id: 'editor-uid-1',
      username: 'EditorTeste',
      role: 'editor',
      editCount: 2,
      avatar: 'ED',
      isBanned: false,
    };

    expect(centralAuthService.checkPermission(editorUser, 'edit', false).allowed).toBe(true);
    expect(centralAuthService.checkPermission(editorUser, 'edit', true).allowed).toBe(false);

    const mediaWikiSave = contentService.saveArticle({
      slug: 'MediaWiki',
      title: 'MediaWiki',
      wikitext: "'''MediaWiki''' atualizado por um editor comunitário.",
      comment: 'Atualização colaborativa de editor',
      user: editorUser,
    });
    expect(mediaWikiSave.article.slug).toBe('MediaWiki');
    expect(mediaWikiSave.revision.author.name).toBe('EditorTeste');

    const nodejsSave = contentService.saveArticle({
      slug: 'Node.js',
      title: 'Node.js',
      wikitext: "'''Node.js''' atualizado por editor.",
      comment: 'Edição permitida',
      user: editorUser,
    });
    expect(nodejsSave.article.slug).toBe('Node.js');

    const readerUser: UserSession = {
      id: 'reader-uid-1',
      username: 'LeitorTeste',
      role: 'reader',
      editCount: 0,
      avatar: 'LE',
      isBanned: false,
    };
    expect(centralAuthService.checkPermission(readerUser, 'edit', false).allowed).toBe(false);

    const bannedEditor: UserSession = { ...editorUser, isBanned: true, banReason: 'Vandalismo' };
    expect(centralAuthService.checkPermission(bannedEditor, 'edit', false).allowed).toBe(false);
  });

  it('preserves existing roles and avoids writing protected fields when syncing non-admin /users/{uid}', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'user-mod-1',
        displayName: 'ModeradorComunitario',
        role: 'moderator',
        editCount: 15,
        isBanned: false,
        userTag: '#0042',
        userPageSlug: 'Usuário:ModeradorComunitario#0042',
      }),
    });

    const fbUser = {
      uid: 'user-mod-1',
      email: 'moderador@example.com',
      displayName: 'ModeradorComunitario',
      photoURL: null,
    } as any;

    const synced = await syncFirebaseUserToSession(fbUser);
    expect(synced.role).toBe('moderator');

    const userSetCall = mockSetDoc.mock.calls.find(
      call => (call[0] as any)?.path === 'users/user-mod-1'
    );
    expect(userSetCall).toBeDefined();
    const writtenPayload = userSetCall?.[1] as Record<string, unknown>;
    expect(writtenPayload.role).toBeUndefined();
    expect(writtenPayload.isBanned).toBeUndefined();

    const resolved = await resolveCurrentFirestoreUser(fbUser);
    expect(resolved.role).toBe('moderator');
    expect(resolved.userTag).toBe('#0042');
  });

  it('allows authenticated non-banned editor to save unprotected Firestore articles without mutating protected user fields', async () => {
    mockAuth.currentUser = {
      uid: 'editor-fb-123',
      email: 'editor@example.com',
      displayName: 'MariaEditora',
    };

    mockGetDoc.mockImplementation(async (ref: any) => {
      if (ref?.path === 'articles/Artigo_Colaborativo') {
        return {
          exists: () => true,
          data: () => ({
            id: 'art-colab',
            slug: 'Artigo_Colaborativo',
            title: 'Artigo Colaborativo',
            namespace: 0,
            wikitext: 'Versão anterior',
            latestRevisionId: 'rev-old',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            categories: [],
            views: 3,
            isProtected: false,
            authorUid: 'original-author-999',
          }),
        };
      }
      if (ref?.path === 'users/editor-fb-123') {
        return {
          exists: () => true,
          data: () => ({
            uid: 'editor-fb-123',
            role: 'editor',
            editCount: 4,
            isBanned: false,
          }),
        };
      }
      return { exists: () => false };
    });

    const result = await saveArticleToFirestore({
      slug: 'Artigo_Colaborativo',
      title: 'Artigo Colaborativo',
      wikitext: "'''Artigo Colaborativo''' expandido por editor.",
      comment: 'Adicionada nova seção',
      authorUser: {
        id: 'editor-fb-123',
        username: 'MariaEditora',
        role: 'editor',
        editCount: 4,
        avatar: 'MA',
      },
    });

    const articleRecord = result.article as unknown as Record<string, unknown>;
    expect(articleRecord.authorUid).toBe('original-author-999');
    expect(articleRecord.lastEditedByUid).toBe('editor-fb-123');
    expect(result.article.isProtected).toBe(false);

    const userUpdateCall = mockSetDoc.mock.calls.find(
      call => (call[0] as any)?.path === 'users/editor-fb-123'
    );
    expect(userUpdateCall).toBeDefined();
    const userPayload = userUpdateCall?.[1] as Record<string, unknown>;
    expect(userPayload.editCount).toBe(5);
    expect(userPayload.role).toBeUndefined();
    expect(userPayload.isBanned).toBeUndefined();
  });

  it('blocks editors from saving protected articles or when role is reader or banned', async () => {
    mockAuth.currentUser = {
      uid: 'editor-fb-123',
      email: 'editor@example.com',
      displayName: 'MariaEditora',
    };

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        id: 'art-prot',
        slug: 'Pagina_Protegida',
        title: 'Página Protegida',
        namespace: 0,
        wikitext: 'Protegido',
        latestRevisionId: 'rev-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        categories: [],
        views: 1,
        isProtected: true,
      }),
    });

    await expect(
      saveArticleToFirestore({
        slug: 'Pagina_Protegida',
        title: 'Página Protegida',
        wikitext: 'Tentativa',
        comment: 'Teste',
        authorUser: {
          id: 'editor-fb-123',
          username: 'MariaEditora',
          role: 'editor',
          editCount: 4,
          avatar: 'MA',
        },
      })
    ).rejects.toThrow('protegida');

    await expect(
      saveArticleToFirestore({
        slug: 'Artigo_Normal',
        title: 'Artigo Normal',
        wikitext: 'Tentativa',
        comment: 'Teste',
        authorUser: {
          id: 'editor-fb-123',
          username: 'LeitorApenas',
          role: 'reader',
          editCount: 0,
          avatar: 'LE',
        },
      })
    ).rejects.toThrow('reader');
  });
});
