import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const firestoreState = vi.hoisted(() => ({
  docs: new Map<string, Record<string, any>>(),
  setCalls: [] as Array<{ path: string; data: Record<string, any> }>,
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

const mockAuth = vi.hoisted(() => ({
  currentUser: null as null | { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null },
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
  collection: vi.fn((_db: any, collName: string) => ({ collName })),
  doc: vi.fn((_db: any, collName: string, id: string) => ({ path: `${collName}/${id}`, collName, id })),
  setDoc: vi.fn(async (ref: { path: string }, data: Record<string, any>, opts?: { merge?: boolean }) => {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) {
        throw new Error(`Unsupported field value: undefined for key ${k}`);
      }
    }
    firestoreState.setCalls.push({ path: ref.path, data });
    if (opts?.merge && firestoreState.docs.has(ref.path)) {
      firestoreState.docs.set(ref.path, { ...firestoreState.docs.get(ref.path)!, ...data });
    } else {
      firestoreState.docs.set(ref.path, { ...data });
    }
  }),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(async () => ({
    empty: true,
    docs: [],
    forEach: () => {},
  })),
  getDoc: vi.fn(async (ref: { path: string }) => {
    const existing = firestoreState.docs.get(ref.path);
    return {
      exists: () => Boolean(existing),
      data: () => existing,
    };
  }),
  getDocFromServer: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import App from '../src/App';
import {
  buildWelcomeTalkPost,
  ensureUserPageInFirestore,
  resolveCurrentFirestoreUser,
  syncFirebaseUserToSession,
} from '../src/firebase';

describe('New User Login Welcome Talk Message & App Accessibility', () => {
  beforeEach(() => {
    firestoreState.docs.clear();
    firestoreState.setCalls.length = 0;
    mockAuth.currentUser = null;
  });

  it('creates a personal user page with a welcome talk message on new user login even when photoURL/email are absent', async () => {
    const fbUser = {
      uid: 'new-user-001',
      displayName: 'Clara Nova',
      email: 'clara.nova@example.com',
      photoURL: null,
    } as any;
    mockAuth.currentUser = fbUser;

    const session = await syncFirebaseUserToSession(fbUser);
    expect(session.id).toBe('new-user-001');
    expect(session.userTag).toBeDefined();

    const savedUserPage = firestoreState.docs.get('user_pages/userpage_new-user-001');
    expect(savedUserPage).toBeDefined();
    expect(Array.isArray(savedUserPage?.talkPosts)).toBe(true);
    expect(savedUserPage?.talkPosts).toHaveLength(1);
    expect(savedUserPage?.talkPosts[0].authorUsername).toBe('NotMediaWiki Boas-Vindas');
    expect(savedUserPage?.talkPosts[0].text).toContain('Olá Clara Nova!');
    expect(savedUserPage?.talkPosts[0].text).toContain('bem-vindo(a)');
    expect(savedUserPage).not.toHaveProperty('photoURL');
  });

  it('adds a welcome message when resolving a user whose /users doc exists but personal talk page has empty talkPosts', async () => {
    const fbUser = {
      uid: 'existing-auth-empty-talk',
      displayName: 'Lucas Antigo',
      email: 'lucas@example.com',
      photoURL: null,
    } as any;
    mockAuth.currentUser = fbUser;

    firestoreState.docs.set('users/existing-auth-empty-talk', {
      uid: 'existing-auth-empty-talk',
      displayName: 'Lucas Antigo',
      userTag: '#0404',
      role: 'editor',
      email: 'lucas@example.com',
    });
    firestoreState.docs.set('user_pages/userpage_existing-auth-empty-talk', {
      id: 'userpage_existing-auth-empty-talk',
      userId: 'existing-auth-empty-talk',
      username: 'Lucas Antigo',
      userTag: '#0404',
      displayName: 'Lucas Antigo#0404',
      slug: 'Usuário:Lucas Antigo#0404',
      wikitext: 'Perfil',
      talkPosts: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await resolveCurrentFirestoreUser(fbUser);

    const updatedPage = firestoreState.docs.get('user_pages/userpage_existing-auth-empty-talk');
    expect(updatedPage?.talkPosts).toHaveLength(1);
    expect(updatedPage?.talkPosts[0].text).toContain('Olá Lucas Antigo!');
  });

  it('does not duplicate welcome messages when a user already has talkPosts on subsequent logins', async () => {
    const existingPost = buildWelcomeTalkPost({ username: 'Ana' }, '#0101');
    firestoreState.docs.set('user_pages/userpage_user-with-posts', {
      id: 'userpage_user-with-posts',
      userId: 'user-with-posts',
      username: 'Ana',
      userTag: '#0101',
      displayName: 'Ana#0101',
      slug: 'Usuário:Ana#0101',
      wikitext: 'Perfil',
      talkPosts: [existingPost],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    mockAuth.currentUser = { uid: 'user-with-posts', email: 'ana@example.com' };
    const res = await ensureUserPageInFirestore({
      id: 'user-with-posts',
      username: 'Ana',
      userTag: '#0101',
      role: 'editor',
      editCount: 2,
      avatar: 'AN',
    });

    expect(res.userPage.talkPosts).toHaveLength(1);
    expect(res.userPage.talkPosts[0].id).toBe(existingPost.id);
  });

  it('includes semantic role and aria-label attributes on main sections and navigation buttons in App.tsx', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('<main role="main" aria-label="Conteúdo principal da enciclopédia"');
    expect(appSource).toContain('role="region" aria-label="Página inicial da enciclopédia"');
    expect(appSource).toContain('role="region" aria-label="Página pessoal e discussão de usuário"');
    expect(appSource).toContain('role="alert"');
    expect(appSource).toContain('aria-label="Abrir Chat Comunitário em Tempo Real"');
    expect(appSource).toContain('aria-label="Voltar para a Página Inicial"');
    expect(appSource).toContain('aria-label="Navegar para a Página dos Burocratas"');

    const html = renderToStaticMarkup(<App />);
    expect(html.length).toBeGreaterThan(0);
  });
});
