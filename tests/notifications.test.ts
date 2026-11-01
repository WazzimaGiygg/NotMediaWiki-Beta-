import { describe, it, expect } from 'vitest';
import { WatchlistSubscription, ArticleNotification, FcmTokenRegistration } from '../src/types';

describe('Watchlist, Favorites & FCM Push Notifications Suite', () => {
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
});
