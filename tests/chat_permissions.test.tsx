import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
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
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(async () => ({ forEach: () => {} })),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import { createExpressApp } from '../server/app';
import { ChatDrawer } from '../src/components/ChatDrawer';
import type { UserSession } from '../src/types';

describe('Non-Bureaucrat Chat Permissions, COOP Policy & Auth Upsert', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('allows non-bureaucrat participants to get, list, create, update direct_chats and subscribe/send messages without admin-only blocks', () => {
    const chatRulesSection = rulesContent.substring(
      rulesContent.indexOf('function isValidChatId(id)'),
      rulesContent.indexOf('match /user_daily_checklists/{checklistId}')
    );

    // Null-safe parent existence check before get() on messages subcollection
    expect(chatRulesSection).toContain('exists(/databases/$(database)/documents/direct_chats/$(chatId))');
    // Pre-create getDoc() support when chat document does not yet exist (resource == null)
    expect(chatRulesSection).toContain('resource == null');
    // Standard array-contains list query constraint matching for non-admin participants
    expect(chatRulesSection).toContain('request.auth.uid in resource.data.participants');
    // Registered non-bureaucrat participants can create chats and send messages
    expect(chatRulesSection).toContain('allow create: if isRegistered() && isValidChatId(chatId)');
    expect(chatRulesSection).toContain('data.senderId == request.auth.uid');
    // Messages subcollection get/list/create delegates cleanly to isDirectChatParticipant(chatId)
    expect(chatRulesSection).toContain('isDirectChatParticipant(chatId)');
  });

  it('sets Cross-Origin-Opener-Policy to same-origin-allow-popups so Google Sign-In popup does not trigger COOP window.closed blocks', async () => {
    const app = createExpressApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });

  it('handles POST /api/v1/auth/users/upsert with 200 OK for non-bureaucrat editors, preserves tags, and prevents privilege escalation', async () => {
    const app = createExpressApp();

    // Authenticated non-bureaucrat editor syncing own profile behind reverse proxy headers
    const resSelf = await request(app)
      .post('/api/v1/auth/users/upsert')
      .set('X-Forwarded-For', '203.0.113.10, 10.0.0.1')
      .set('Authorization', 'Bearer test-token-editor-uid-777:editor777@example.com')
      .send({
        id: 'editor-uid-777',
        username: 'Maria Editora',
        userTag: '#0777',
        discriminator: '0777',
        userPageSlug: 'Usuário:Maria Editora#0777',
        role: 'bureaucrat', // Attempted escalation must remain 'editor'
        avatar: 'ME',
        isGoogleUser: true,
      });

    expect(resSelf.status).toBe(200);
    expect(resSelf.body.success).toBe(true);
    expect(resSelf.body.user.id).toBe('editor-uid-777');
    expect(resSelf.body.user.role).toBe('editor');
    expect(resSelf.body.user.userTag).toBe('#0777');
    expect(resSelf.body.user.userPageSlug).toBe('Usuário:Maria Editora#0777');

    // Also accepts minimal payload without crashing (never 500)
    const resAnon = await request(app)
      .post('/api/v1/auth/users/upsert')
      .send({
        id: 'editor-uid-888',
        username: 'Joao Colaborador',
        avatar: null,
      });

    expect(resAnon.status).toBe(200);
    expect(resAnon.body.success).toBe(true);
    expect(resAnon.body.user.role).toBe('editor');
    expect(resAnon.body.user.avatar).toBe('JO');
  });

  it('does not use window.alert in ChatDrawer and renders cleanly for non-bureaucrat editors', () => {
    const drawerSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ChatDrawer.tsx'), 'utf8');
    expect(drawerSource).not.toMatch(/\balert\s*\(/);

    const editorUser: UserSession = {
      id: 'editor-uid-777',
      username: 'Maria Editora',
      userTag: '#0777',
      role: 'editor',
      editCount: 3,
      avatar: 'ME',
      isGoogleUser: true,
    };

    const html = renderToStaticMarkup(
      <ChatDrawer currentUser={editorUser} isOpen={true} onClose={() => {}} />
    );
    expect(html).toContain('Chat Comunitário em Tempo Real');
    expect(html).toContain('Buscar usuário...');
  });
});
