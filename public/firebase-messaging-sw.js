// Firebase Cloud Messaging & Web Push Service Worker for NotMediaWiki
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "wzzm-ce3fc",
  appId: "1:249427877153:web:a423c9abb1ef0016deb260",
  apiKey: "AIzaSyAL_MsRuFE8BGjOZU8MK-4n25iJllS-Nmc",
  authDomain: "wzzm-ce3fc.firebaseapp.com",
  messagingSenderId: "249427877153"
};

function buildNotificationOptions(payload) {
  const data = payload?.data || {};
  const notif = payload?.notification || {};
  const slug = data.articleSlug || payload?.articleSlug || '';
  const url = data.url || (slug ? `/#/wiki/${encodeURIComponent(slug)}` : '/');

  return {
    title: notif.title || data.title || payload?.title || 'NotMediaWiki - Artigo Seguido Editado',
    options: {
      body: notif.body || data.body || payload?.body || 'Um artigo que você está seguindo foi atualizado.',
      icon: '/assets/aistudio/image_370f9ede.png',
      badge: '/assets/aistudio/image_370f9ede.png',
      tag: slug ? `article-edit-${slug}` : 'article-edit',
      renotify: true,
      data: {
        url,
        articleSlug: slug,
        timestamp: Date.now(),
      },
    },
  };
}

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensagem FCM recebida em segundo plano:', payload);
    const { title, options } = buildNotificationOptions(payload);
    return self.registration.showNotification(title, options);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Falha ao inicializar FCM no Service Worker:', err);
}

// Listener for standard Web Push events (outside the app / background)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const raw = event.data.json();
    // Skip duplicate display if FCM compat SDK handles notification payload automatically
    if (raw && raw.from && raw.notification) {
      return;
    }
    const { title, options } = buildNotificationOptions(raw);
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('NotMediaWiki - Artigo Alterado', {
        body: text || 'Um artigo seguido sofreu alterações.',
        icon: '/assets/aistudio/image_370f9ede.png',
        badge: '/assets/aistudio/image_370f9ede.png',
      })
    );
  }
});

// Focus open window or open the edited article when user clicks the browser notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || '/';
  const articleSlug = data.articleSlug || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if (articleSlug && client.postMessage) {
            client.postMessage({
              type: 'NAVIGATE_ARTICLE',
              articleSlug,
              url: targetUrl,
            });
          } else if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
