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
  orderBy,
  limit,
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db, auth } from '../firebase';
import { WatchlistSubscription, ArticleNotification, FcmTokenRegistration } from '../types';

const PATH_WATCHLIST = 'watchlist_subscriptions';
const PATH_NOTIFICATIONS = 'article_notifications';
const PATH_FCM_TOKENS = 'fcm_tokens';

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
 * Initializes Firebase Cloud Messaging in the browser and registers the device token
 */
export async function initializeFCM(userId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('Firebase Cloud Messaging não é suportado neste navegador.');
      return null;
    }

    // Register Service Worker for background FCM messages
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (swErr) {
        console.warn('Registro do Service Worker FCM em background falhou:', swErr);
      }
    }

    const messaging = getMessaging(app);

    // Request notification permission if not yet decided
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return null;
      }
    }

    if (Notification.permission !== 'granted') {
      return null;
    }

    // Retrieve registration token
    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js'),
      });
    } catch {
      // Token without explicit SW registration fallback
      try {
        token = await getToken(messaging);
      } catch (tokenErr) {
        console.warn('Não foi possível obter token FCM:', tokenErr);
      }
    }

    if (token && userId) {
      const tokenId = `${userId}_${token.substring(0, 16)}`;
      const tokenDoc: FcmTokenRegistration = {
        id: tokenId,
        userId,
        token,
        platform: 'web',
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 200),
      };

      await setDoc(doc(db, PATH_FCM_TOKENS, tokenId), tokenDoc).catch(console.warn);
    }

    // Listen to foreground FCM messages
    onMessage(messaging, (payload) => {
      console.log('FCM Foreground Notification received:', payload);
      playNotificationChime();

      const title = payload.notification?.title || payload.data?.title || 'NotMediaWiki - Artigo Alterado';
      const body = payload.notification?.body || payload.data?.body || 'Um artigo seguido foi atualizado.';

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/assets/aistudio/image_370f9ede.png',
            tag: payload.data?.articleSlug ? `edit-${payload.data.articleSlug}` : undefined,
          });
        } catch {
          // Window notification fallback
        }
      }
    });

    return token;
  } catch (err) {
    console.warn('Erro ao configurar Firebase Cloud Messaging:', err);
    return null;
  }
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

  const existing = await getDoc(subRef);
  if (existing.exists()) {
    // Unwatch
    await deleteDoc(subRef);
    return { isWatched: false };
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
    await setDoc(subRef, newSub);

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

      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

      // Trigger local browser notification if current client is the watcher
      const currentAuthUid = auth.currentUser?.uid;
      if (currentAuthUid === sub.userId && 'Notification' in window && Notification.permission === 'granted') {
        playNotificationChime();
        try {
          new Notification(`NotMediaWiki: ${notifDoc.articleTitle} foi editado`, {
            body: `${params.editorName} fez alterações: "${params.changeSummary}"`,
            icon: '/assets/aistudio/image_370f9ede.png',
            tag: `edit-${cleanSlug}`,
          });
        } catch {
          // Window notification fallback
        }
      }
    }

    return notifiedCount;
  } catch (err) {
    console.warn('Erro ao notificar seguidores do artigo:', err);
    return 0;
  }
}

/**
 * Subscribes to the user's notifications in real time
 */
export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: ArticleNotification[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, PATH_NOTIFICATIONS),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifs: ArticleNotification[] = [];
      snapshot.forEach((d) => notifs.push(d.data() as ArticleNotification));
      callback(notifs);
    },
    (err) => {
      // Fallback query without orderBy if composite index is pending
      console.warn('Listener com orderBy falhou, tentando fallback sem ordenação:', err);
      const fallbackQuery = query(collection(db, PATH_NOTIFICATIONS), where('userId', '==', userId));
      return onSnapshot(fallbackQuery, (snap) => {
        const notifs: ArticleNotification[] = [];
        snap.forEach((d) => notifs.push(d.data() as ArticleNotification));
        notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        callback(notifs);
      });
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
