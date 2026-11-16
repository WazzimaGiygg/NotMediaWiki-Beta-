import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Article, WatchlistSubscription, ArticleNotification, FcmTokenRegistration } from '../types';

const PATH_WATCHLIST = 'watchlist_subscriptions';
const PATH_NOTIFICATIONS = 'article_notifications';
const PATH_FCM_TOKENS = 'fcm_tokens';
const PATH_ARTICLES = 'articles';

export interface ArticleSnapshotBaseline {
  latestRevisionId?: string;
  updatedAt?: string;
  wikitext?: string;
}

/**
 * Pure helper that compares a new Firestore article snapshot against the last observed baseline
 * for a followed article, returning an ArticleNotification if edited by another user.
 */
export function detectFollowedArticleChange(params: {
  userId: string;
  articleSlug: string;
  articleTitleFallback?: string;
  previous?: ArticleSnapshotBaseline;
  current: Partial<Article> & { authorUid?: string; lastEditedBy?: string };
}): {
  changed: boolean;
  nextBaseline: ArticleSnapshotBaseline;
  notification?: ArticleNotification;
} {
  const { userId, articleSlug, articleTitleFallback, previous, current } = params;
  const cleanSlug = articleSlug.trim().replace(/\s+/g, '_');

  const nextBaseline: ArticleSnapshotBaseline = {
    latestRevisionId: current.latestRevisionId,
    updatedAt: current.updatedAt,
    wikitext: current.wikitext,
  };

  if (!previous) {
    return { changed: false, nextBaseline };
  }

  const revChanged = Boolean(
    current.latestRevisionId &&
    previous.latestRevisionId &&
    current.latestRevisionId !== previous.latestRevisionId
  );
  const updatedAtChanged = Boolean(
    current.updatedAt &&
    previous.updatedAt &&
    current.updatedAt !== previous.updatedAt
  );
  const wikitextChanged =
    current.wikitext !== undefined &&
    previous.wikitext !== undefined &&
    current.wikitext !== previous.wikitext;

  if (!revChanged && !updatedAtChanged && !wikitextChanged) {
    return { changed: false, nextBaseline };
  }

  const editorUid = (current as any).authorUid || '';
  if (editorUid && editorUid === userId) {
    return { changed: false, nextBaseline };
  }

  const editorName = (current as any).lastEditedBy || 'Outro editor';
  const revisionId = current.latestRevisionId || `rev-${Date.now()}`;
  const timestamp = current.updatedAt || new Date().toISOString();

  const notification: ArticleNotification = {
    id: `notif_${userId}_${cleanSlug}_${revisionId}`,
    userId,
    articleSlug: cleanSlug,
    articleTitle: current.title || articleTitleFallback || cleanSlug.replace(/_/g, ' '),
    changeSummary: current.summary || 'O conteúdo do artigo seguido foi atualizado.',
    editorName,
    editorId: editorUid || 'external-editor',
    timestamp,
    isRead: false,
    revisionId,
  };

  return { changed: true, nextBaseline, notification };
}

/**
 * Merges and deduplicates notifications (by id or articleSlug+revisionId), sorted newest first.
 */
export function mergeArticleNotifications(
  existing: ArticleNotification[],
  incoming: ArticleNotification[]
): ArticleNotification[] {
  const byKey = new Map<string, ArticleNotification>();

  const getKey = (n: ArticleNotification) =>
    n.revisionId ? `${n.articleSlug}::${n.revisionId}` : n.id;

  for (const item of existing) {
    byKey.set(getKey(item), item);
  }

  for (const item of incoming) {
    const key = getKey(item);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
    } else {
      // Preserve read state if already marked read or if incoming is from persisted Firestore doc
      byKey.set(key, {
        ...prev,
        ...item,
        isRead: prev.isRead || item.isRead,
      });
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 40);
}

export type WebPushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface WebPushSetupResult {
  permission: WebPushPermissionStatus;
  fcmToken: string | null;
  serviceWorkerReady: boolean;
  fcmSupported: boolean;
  message: string;
}

let foregroundFcmListenerAttached = false;

/**
 * Returns the current browser Notification / Web Push API permission status.
 */
export function getWebPushPermissionState(): WebPushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as WebPushPermissionStatus;
}

/**
 * Displays a native OS/browser notification outside the app tab via Service Worker registration
 * (enabling background click-to-navigate via notificationclick), falling back to window.Notification.
 */
export async function showBrowserPushNotification(params: {
  title: string;
  body: string;
  articleSlug?: string;
  tag?: string;
}): Promise<boolean> {
  if (getWebPushPermissionState() !== 'granted') {
    return false;
  }

  const cleanSlug = params.articleSlug ? params.articleSlug.trim().replace(/\s+/g, '_') : '';
  const targetUrl = cleanSlug ? `/#/wiki/${encodeURIComponent(cleanSlug)}` : '/';
  const options: NotificationOptions & { renotify?: boolean } = {
    body: params.body,
    icon: '/assets/aistudio/image_370f9ede.png',
    badge: '/assets/aistudio/image_370f9ede.png',
    tag: params.tag || (cleanSlug ? `article-edit-${cleanSlug}` : 'notmediawiki-alert'),
    renotify: true,
    data: {
      articleSlug: cleanSlug,
      url: targetUrl,
      timestamp: Date.now(),
    },
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const existingReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      const reg =
        existingReg ||
        (await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 1200)),
        ]));

      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(params.title, options);
        return true;
      }
    } catch {
      // Fall back to direct Notification constructor below
    }
  }

  try {
    const notif = new window.Notification(params.title, options);
    notif.onclick = () => {
      try {
        window.focus();
        if (cleanSlug) {
          window.location.hash = `#/wiki/${encodeURIComponent(cleanSlug)}`;
        }
        notif.close();
      } catch {
        // ignore focus restriction
      }
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates an audio chime using Web Audio API for push alerts
 */
export function playNotificationChime(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2); // D6

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

/**
 * Requests Web Push API permission, registers the Service Worker, obtains the FCM token,
 * persists it in Firestore (`fcm_tokens`), and attaches the foreground FCM message listener.
 */
export async function requestWebPushPermissionAndRegister(userId: string): Promise<WebPushSetupResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      permission: 'unsupported',
      fcmToken: null,
      serviceWorkerReady: false,
      fcmSupported: false,
      message: 'Este navegador não suporta a Web Push API (Notification API).',
    };
  }

  let permission: WebPushPermissionStatus = Notification.permission as WebPushPermissionStatus;

  if (permission === 'default') {
    try {
      permission = (await Notification.requestPermission()) as WebPushPermissionStatus;
    } catch {
      permission = Notification.permission as WebPushPermissionStatus;
    }
  }

  if (permission === 'denied') {
    return {
      permission: 'denied',
      fcmToken: null,
      serviceWorkerReady: false,
      fcmSupported: false,
      message: 'Permissão bloqueada no navegador. Libere as notificações nas configurações do site.',
    };
  }

  if (permission !== 'granted') {
    return {
      permission,
      fcmToken: null,
      serviceWorkerReady: false,
      fcmSupported: false,
      message: 'Permissão de notificação não concedida.',
    };
  }

  // Register Service Worker for background Web Push and FCM messages
  let swRegistration: ServiceWorkerRegistration | undefined;
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (swErr) {
      console.warn('Registro do Service Worker FCM em background falhou:', swErr);
    }
  }

  const serviceWorkerReady = Boolean(swRegistration);
  let fcmSupported = false;
  let token: string | null = null;

  try {
    fcmSupported = await isSupported();
    if (fcmSupported) {
      const messaging = getMessaging(app);
      const vapidKey =
        typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY
          ? (import.meta as any).env.VITE_FIREBASE_VAPID_KEY
          : undefined;

      try {
        token = await getToken(messaging, {
          ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
          ...(vapidKey ? { vapidKey } : {}),
        });
      } catch {
        try {
          token = await getToken(messaging);
        } catch (tokenErr) {
          console.warn('Não foi possível obter token FCM:', tokenErr);
        }
      }

      if (token && userId && auth.currentUser?.uid === userId) {
        const tokenId = `${userId}_${token.substring(0, 16)}`;
        const tokenDoc: FcmTokenRegistration = {
          id: tokenId,
          userId,
          token,
          platform: 'web',
          updatedAt: new Date().toISOString(),
          userAgent: navigator.userAgent.substring(0, 200),
        };

        try {
          await setDoc(doc(db, PATH_FCM_TOKENS, tokenId), tokenDoc);
        } catch (err) {
          console.warn('Notice: Could not persist FCM token in Firestore:', err);
        }
      }

      if (!foregroundFcmListenerAttached) {
        foregroundFcmListenerAttached = true;
        onMessage(messaging, payload => {
          playNotificationChime();
          const title = payload.notification?.title || payload.data?.title || 'NotMediaWiki - Artigo Alterado';
          const body = payload.notification?.body || payload.data?.body || 'Um artigo seguido foi atualizado.';
          const slug = payload.data?.articleSlug;
          showBrowserPushNotification({
            title,
            body,
            articleSlug: slug,
            tag: slug ? `article-edit-${slug}` : undefined,
          }).catch(() => {});
        });
      }
    }
  } catch (err) {
    console.warn('Erro ao configurar Firebase Cloud Messaging:', err);
  }

  const message = token
    ? 'Notificações Web Push e token FCM ativados neste dispositivo!'
    : serviceWorkerReady
      ? 'Web Push API ativada via Service Worker! Você receberá alertas de artigos seguidos no navegador.'
      : 'Notificações do navegador ativadas para artigos seguidos.';

  return {
    permission: 'granted',
    fcmToken: token,
    serviceWorkerReady,
    fcmSupported,
    message,
  };
}

/**
 * Automatically syncs Service Worker & FCM registration when notification permission is already granted.
 */
export async function syncExistingFcmRegistration(userId: string): Promise<WebPushSetupResult | null> {
  if (!userId || getWebPushPermissionState() !== 'granted') {
    return null;
  }
  return requestWebPushPermissionAndRegister(userId);
}

/**
 * Initializes Firebase Cloud Messaging in the browser and registers the device token
 */
export async function initializeFCM(userId: string): Promise<string | null> {
  const result = await requestWebPushPermissionAndRegister(userId);
  return result.fcmToken;
}

/**
 * Checks whether an article is followed/watched by the user
 */
export async function isArticleWatched(userId: string, slug: string): Promise<boolean> {
  if (!userId || !slug) return false;
  try {
    const cleanSlug = slug.trim().replace(/\s+/g, '_');
    const subId = `${userId}_${cleanSlug}`;
    const snap = await getDoc(doc(db, PATH_WATCHLIST, subId));
    return snap.exists();
  } catch (err) {
    console.warn('Erro ao verificar watchlist:', err);
    return false;
  }
}

/**
 * Toggles following/watching status of an article in Firestore
 */
export async function toggleWatchArticle(
  userId: string,
  article: { slug: string; title: string },
  notifyPush = true
): Promise<{ isWatched: boolean }> {
  if (!userId) {
    throw new Error('Você precisa estar autenticado para seguir ou vigiar artigos.');
  }

  const cleanSlug = article.slug.trim().replace(/\s+/g, '_');
  const subId = `${userId}_${cleanSlug}`;
  const subRef = doc(db, PATH_WATCHLIST, subId);

  let existing;
  try {
    existing = await getDoc(subRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${PATH_WATCHLIST}/${subId}`);
  }

  if (existing.exists()) {
    // Unwatch
    try {
      await deleteDoc(subRef);
      return { isWatched: false };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${PATH_WATCHLIST}/${subId}`);
    }
  } else {
    // Watch
    const newSub: WatchlistSubscription = {
      id: subId,
      userId,
      articleSlug: cleanSlug,
      articleTitle: article.title || cleanSlug.replace(/_/g, ' '),
      createdAt: new Date().toISOString(),
      notifyPush,
    };
    try {
      await setDoc(subRef, newSub);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${PATH_WATCHLIST}/${subId}`);
    }

    // Initialize FCM when user starts following articles
    initializeFCM(userId).catch(console.warn);

    return { isWatched: true };
  }
}

/**
 * Subscribes to real-time updates of the user's watched articles
 */
export function subscribeToUserWatchlist(
  userId: string,
  callback: (watchlist: WatchlistSubscription[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, PATH_WATCHLIST), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: WatchlistSubscription[] = [];
      snapshot.forEach((d) => items.push(d.data() as WatchlistSubscription));
      callback(items);
    },
    (err) => {
      console.warn('Erro ao escutar watchlist do usuário:', err);
      callback([]);
    }
  );
}

/**
 * Subscribes in real time (via Firestore onSnapshot) to the user's followed articles
 * AND attaches a live Firestore document listener (`articles/{slug}`) for each followed article.
 * Whenever any followed article is edited in Firestore by another user, emits an alert notification.
 */
export function subscribeToFollowedArticlesEdits(
  userId: string,
  onArticleEdited: (notification: ArticleNotification) => void,
  onWatchlistUpdate?: (watchlist: WatchlistSubscription[]) => void
): () => void {
  if (!userId) {
    onWatchlistUpdate?.([]);
    return () => {};
  }

  const articleUnsubs = new Map<string, () => void>();
  const baselines = new Map<string, ArticleSnapshotBaseline>();
  const emittedKeys = new Set<string>();
  let isDisposed = false;

  const q = query(collection(db, PATH_WATCHLIST), where('userId', '==', userId));
  const unsubWatchlist = onSnapshot(
    q,
    (snapshot) => {
      if (isDisposed) return;

      const items: WatchlistSubscription[] = [];
      const activeSlugs = new Set<string>();

      snapshot.forEach((d) => {
        const sub = d.data() as WatchlistSubscription;
        items.push(sub);
        const cleanSlug = sub.articleSlug.trim().replace(/\s+/g, '_');
        if (cleanSlug) activeSlugs.add(cleanSlug);
      });

      onWatchlistUpdate?.(items);

      // Remove listeners for articles no longer followed
      for (const [slug, unsubArticle] of articleUnsubs.entries()) {
        if (!activeSlugs.has(slug)) {
          unsubArticle();
          articleUnsubs.delete(slug);
          baselines.delete(slug);
        }
      }

      // Attach real-time onSnapshot listeners for newly followed articles
      for (const sub of items) {
        const cleanSlug = sub.articleSlug.trim().replace(/\s+/g, '_');
        if (!cleanSlug || articleUnsubs.has(cleanSlug)) continue;

        const articleRef = doc(db, PATH_ARTICLES, cleanSlug);
        const unsubArticle = onSnapshot(
          articleRef,
          (docSnap) => {
            if (isDisposed || !docSnap.exists()) return;
            const articleData = docSnap.data() as Partial<Article> & {
              authorUid?: string;
              lastEditedBy?: string;
            };

            const res = detectFollowedArticleChange({
              userId,
              articleSlug: cleanSlug,
              articleTitleFallback: sub.articleTitle,
              previous: baselines.get(cleanSlug),
              current: articleData,
            });

            baselines.set(cleanSlug, res.nextBaseline);

            if (res.changed && res.notification) {
              const dedupeKey = `${res.notification.articleSlug}::${res.notification.revisionId}`;
              if (emittedKeys.has(dedupeKey)) return;
              emittedKeys.add(dedupeKey);

              onArticleEdited(res.notification);

              // Persist notification for this user if authenticated so unread state survives reload
              if (auth.currentUser?.uid === userId) {
                setDoc(doc(db, PATH_NOTIFICATIONS, res.notification.id), res.notification).catch((persistErr) => {
                  console.warn('Notice: Could not persist live followed-article notification:', persistErr);
                });
              }
            }
          },
          (err) => {
            console.warn(`Notice: Real-time listener for followed article "${cleanSlug}":`, err);
          }
        );

        articleUnsubs.set(cleanSlug, unsubArticle);
      }
    },
    (err) => {
      console.warn('Erro ao monitorar artigos seguidos no Firestore:', err);
      onWatchlistUpdate?.([]);
    }
  );

  return () => {
    isDisposed = true;
    unsubWatchlist();
    for (const unsubArticle of articleUnsubs.values()) {
      unsubArticle();
    }
    articleUnsubs.clear();
    baselines.clear();
  };
}

/**
 * Dispatches push notification records to all users watching an edited article
 */
export async function notifyArticleWatchers(params: {
  articleSlug: string;
  articleTitle: string;
  changeSummary: string;
  editorName: string;
  editorId: string;
  revisionId: string;
}): Promise<number> {
  const cleanSlug = params.articleSlug.trim().replace(/\s+/g, '_');
  const q = query(collection(db, PATH_WATCHLIST), where('articleSlug', '==', cleanSlug));

  try {
    const snap = await getDocs(q);
    let notifiedCount = 0;
    const timestamp = new Date().toISOString();

    for (const docSnap of snap.docs) {
      const sub = docSnap.data() as WatchlistSubscription;
      // Do not notify the editor who made the change
      if (sub.userId === params.editorId) continue;

      const notifId = `notif_${sub.userId}_${cleanSlug}_${params.revisionId || Date.now()}`;
      const notifDoc: ArticleNotification = {
        id: notifId,
        userId: sub.userId,
        articleSlug: cleanSlug,
        articleTitle: params.articleTitle || cleanSlug.replace(/_/g, ' '),
        changeSummary: params.changeSummary || 'Atualização no wikitexto do verbete',
        editorName: params.editorName,
        editorId: params.editorId,
        timestamp,
        isRead: false,
        revisionId: params.revisionId,
      };

      await setDoc(doc(db, PATH_NOTIFICATIONS, notifId), notifDoc).catch(console.warn);
      notifiedCount++;

      // Trigger local browser Web Push notification if current client is the watcher
      const currentAuthUid = auth.currentUser?.uid;
      if (currentAuthUid === sub.userId && getWebPushPermissionState() === 'granted') {
        playNotificationChime();
        showBrowserPushNotification({
          title: `NotMediaWiki: ${notifDoc.articleTitle} foi editado`,
          body: `${params.editorName} fez alterações: "${params.changeSummary}"`,
          articleSlug: cleanSlug,
          tag: `article-edit-${cleanSlug}`,
        }).catch(() => {});
      }
    }

    return notifiedCount;
  } catch (err) {
    console.warn('Erro ao notificar seguidores do artigo:', err);
    return 0;
  }
}

/**
 * Subscribes to the user's notifications in real time (without requiring composite index)
 */
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: ArticleNotification[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, PATH_NOTIFICATIONS), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const notifs: ArticleNotification[] = [];
      snapshot.forEach((d) => notifs.push(d.data() as ArticleNotification));
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(notifs.slice(0, 40));
    },
    (err) => {
      console.warn('Erro ao escutar notificações no Firestore:', err);
      callback([]);
    }
  );
}

/**
 * Marks a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    await updateDoc(doc(db, PATH_NOTIFICATIONS, notificationId), {
      isRead: true,
    });
  } catch (err) {
    console.warn('Erro ao marcar notificação como lida:', err);
  }
}

/**
 * Marks all notifications of a user as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const q = query(
      collection(db, PATH_NOTIFICATIONS),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snap = await getDocs(q);
    const updates = snap.docs.map((d) => updateDoc(d.ref, { isRead: true }));
    await Promise.all(updates);
  } catch (err) {
    console.warn('Erro ao marcar todas notificações como lidas:', err);
  }
}

/**
 * Deletes a notification document
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    await deleteDoc(doc(db, PATH_NOTIFICATIONS, notificationId));
  } catch (err) {
    console.warn('Erro ao excluir notificação:', err);
  }
}
