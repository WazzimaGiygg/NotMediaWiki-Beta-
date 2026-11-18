import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_FCM_TOPICS,
  NEW_ARTICLES_TOPIC_ID,
  normalizeTopicId,
  updateUserFcmTopics,
  getUserFcmPreferences,
  getFirebaseVapidKey,
  isVapidKeyConfigured,
} from '../src/services/notificationService';
import { FcmTopicSubscriptions } from '../src/components/FcmTopicSubscriptions';

describe('Firebase Cloud Messaging (FCM) Topic Subscriptions & VAPID Key', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('normalizes custom and accented topic names into valid FCM topic keys', () => {
    expect(normalizeTopicId('Inteligência Artificial')).toBe('inteligencia_artificial');
    expect(normalizeTopicId('  Segurança & Privacidade!  ')).toBe('seguranca_privacidade');
    expect(normalizeTopicId('software-livre_2026')).toBe('software-livre_2026');
    expect(normalizeTopicId('   ')).toBe('');
  });

  it('exposes curated default topics including new articles global alert', () => {
    const ids = DEFAULT_FCM_TOPICS.map(t => t.id);
    expect(ids).toContain(NEW_ARTICLES_TOPIC_ID);
    expect(ids).toContain('tecnologia');
    expect(ids).toContain('ciencia');
    expect(ids).toContain('governanca');
  });

  it('checks VITE_FIREBASE_VAPID_KEY availability cleanly without throwing', () => {
    const key = getFirebaseVapidKey();
    const configured = isVapidKeyConfigured();
    expect(typeof configured).toBe('boolean');
    expect(configured).toBe(Boolean(key));
  });

  it('persists and sanitizes user topic subscriptions and notifyNewArticles preference', async () => {
    const saved = await updateUserFcmTopics(
      'guest-test-user',
      ['Tecnologia', 'tecnologia', 'Astronomia Espacial', ''],
      true
    );

    expect(saved.notifyNewArticles).toBe(true);
    expect(saved.subscribedTopics).toContain(NEW_ARTICLES_TOPIC_ID);
    expect(saved.subscribedTopics).toContain('tecnologia');
    expect(saved.subscribedTopics).toContain('astronomia_espacial');

    const loaded = await getUserFcmPreferences('guest-test-user');
    expect(loaded.subscribedTopics).toEqual(saved.subscribedTopics);
    expect(loaded.notifyNewArticles).toBe(true);

    // Disable new articles global alert
    const updated = await updateUserFcmTopics('guest-test-user', ['ciencia'], false);
    expect(updated.notifyNewArticles).toBe(false);
    expect(updated.subscribedTopics).not.toContain(NEW_ARTICLES_TOPIC_ID);
    expect(updated.subscribedTopics).toContain('ciencia');
  });

  it('renders FcmTopicSubscriptions panel with new articles toggle, topics, and custom topic input', () => {
    const html = renderToStaticMarkup(<FcmTopicSubscriptions userId="user-123" />);
    expect(html).toContain('Firebase Cloud Messaging');
    expect(html).toContain('Novos Artigos Publicados');
    expect(html).toContain('Tecnologia &amp; Sistemas');
    expect(html).toContain('Ciência &amp; Pesquisa');
    expect(html).toContain('Adicionar tópico personalizado');
  });
});
