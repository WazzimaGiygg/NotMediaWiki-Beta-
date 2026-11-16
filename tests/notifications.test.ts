import { describe, it, expect } from 'vitest';
import { WatchlistSubscription, ArticleNotification, FcmTokenRegistration } from '../src/types';
import {
  detectFollowedArticleChange,
  mergeArticleNotifications,
} from '../src/services/notificationService';

describe('Watchlist, Favorites & Real-time Header Notifications Suite', () => {
  it('Validates WatchlistSubscription schema structure', () => {
    const sub: WatchlistSubscription = {
      id: 'usr123_MediaWiki',
      userId: 'usr123',
      articleSlug: 'MediaWiki',
      articleTitle: 'MediaWiki',
      createdAt: new Date().toISOString(),
      notifyPush: true,
    };

    expect(sub.userId).toBe('usr123');
    expect(sub.articleSlug).toBe('MediaWiki');
    expect(sub.notifyPush).toBe(true);
    expect(sub.id).toContain('usr123_MediaWiki');
  });

  it('Validates ArticleNotification payload on article changes', () => {
    const notification: ArticleNotification = {
      id: 'notif-1700000000-abc12',
      userId: 'usr_watcher',
      articleSlug: 'React_(framework)',
      articleTitle: 'React (framework)',
      changeSummary: 'Adicionada seção sobre Virtual DOM e Fiber Architecture',
      editorName: 'WikiEditor42',
      editorId: 'usr_editor',
      timestamp: new Date().toISOString(),
      isRead: false,
      revisionId: 'rev_98765',
    };

    expect(notification.isRead).toBe(false);
    expect(notification.userId).not.toBe(notification.editorId);
    expect(notification.articleSlug).toBe('React_(framework)');
    expect(notification.changeSummary).toContain('Virtual DOM');
  });

  it('Validates FcmTokenRegistration schema structure', () => {
    const tokenRecord: FcmTokenRegistration = {
      id: 'usr123_fcmtoken12345678',
      userId: 'usr123',
      token: 'fcm_device_token_xyz_sample_value',
      platform: 'web',
      updatedAt: new Date().toISOString(),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };

    expect(tokenRecord.platform).toBe('web');
    expect(tokenRecord.token.startsWith('fcm_device_token_')).toBe(true);
    expect(tokenRecord.userId).toBe('usr123');
  });

  describe('Real-time Followed Article Change Detection (Firestore onSnapshot)', () => {
    it('does not alert on initial snapshot load, only records baseline', () => {
      const initial = detectFollowedArticleChange({
        userId: 'watcher_1',
        articleSlug: 'MediaWiki',
        previous: undefined,
        current: {
          title: 'MediaWiki',
          latestRevisionId: 'rev-1',
          updatedAt: '2026-11-15T10:00:00.000Z',
          wikitext: 'Initial content',
          authorUid: 'editor_2',
          lastEditedBy: 'Ana',
        },
      });

      expect(initial.changed).toBe(false);
      expect(initial.notification).toBeUndefined();
      expect(initial.nextBaseline.latestRevisionId).toBe('rev-1');
    });

    it('alerts when a followed article is edited by another user in real time', () => {
      const baseline = {
        latestRevisionId: 'rev-1',
        updatedAt: '2026-11-15T10:00:00.000Z',
        wikitext: 'Initial content',
      };

      const update = detectFollowedArticleChange({
        userId: 'watcher_1',
        articleSlug: 'MediaWiki',
        previous: baseline,
        current: {
          title: 'MediaWiki',
          summary: 'Corrigida seção de arquitetura',
          latestRevisionId: 'rev-2',
          updatedAt: '2026-11-15T10:05:00.000Z',
          wikitext: 'Updated content',
          authorUid: 'editor_2',
          lastEditedBy: 'Carlos',
        },
      });

      expect(update.changed).toBe(true);
      expect(update.notification).toBeDefined();
      expect(update.notification?.articleSlug).toBe('MediaWiki');
      expect(update.notification?.editorName).toBe('Carlos');
      expect(update.notification?.changeSummary).toBe('Corrigida seção de arquitetura');
      expect(update.notification?.revisionId).toBe('rev-2');
      expect(update.notification?.isRead).toBe(false);
    });

    it('does not alert when the follower themselves edits the article', () => {
      const baseline = {
        latestRevisionId: 'rev-1',
        updatedAt: '2026-11-15T10:00:00.000Z',
        wikitext: 'Initial content',
      };

      const selfEdit = detectFollowedArticleChange({
        userId: 'watcher_1',
        articleSlug: 'MediaWiki',
        previous: baseline,
        current: {
          title: 'MediaWiki',
          latestRevisionId: 'rev-2',
          updatedAt: '2026-11-15T10:05:00.000Z',
          wikitext: 'Self updated',
          authorUid: 'watcher_1',
          lastEditedBy: 'Myself',
        },
      });

      expect(selfEdit.changed).toBe(false);
      expect(selfEdit.notification).toBeUndefined();
    });

    it('merges and deduplicates notifications preserving read state and newest-first order', () => {
      const older: ArticleNotification = {
        id: 'n1',
        userId: 'u1',
        articleSlug: 'Artigo_A',
        articleTitle: 'Artigo A',
        changeSummary: 'Edição antiga',
        editorName: 'João',
        editorId: 'u2',
        timestamp: '2026-11-15T09:00:00.000Z',
        isRead: true,
        revisionId: 'rev-a1',
      };

      const newerLive: ArticleNotification = {
        id: 'notif_u1_Artigo_B_rev-b2',
        userId: 'u1',
        articleSlug: 'Artigo_B',
        articleTitle: 'Artigo B',
        changeSummary: 'Edição recente',
        editorName: 'Maria',
        editorId: 'u3',
        timestamp: '2026-11-15T11:00:00.000Z',
        isRead: false,
        revisionId: 'rev-b2',
      };

      const duplicateNewer: ArticleNotification = {
        ...newerLive,
        id: 'notif-persisted-copy',
        isRead: false,
      };

      const merged = mergeArticleNotifications([older, newerLive], [duplicateNewer]);
      expect(merged).toHaveLength(2);
      expect(merged[0].articleSlug).toBe('Artigo_B');
      expect(merged[1].articleSlug).toBe('Artigo_A');
      expect(merged[1].isRead).toBe(true);
    });
  });
});
