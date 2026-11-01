// Firebase Cloud Messaging Service Worker for NotMediaWiki
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "wzzm-ce3fc",
  appId: "1:249427877153:web:a423c9abb1ef0016deb260",
  apiKey: "AIzaSyAL_MsRuFE8BGjOZU8MK-4n25iJllS-Nmc",
  authDomain: "wzzm-ce3fc.firebaseapp.com",
  messagingSenderId: "249427877153"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano:', payload);
    const notificationTitle =
      payload.notification?.title ||
      payload.data?.title ||
      'NotMediaWiki - Artigo Seguido Atualizado';

    const notificationOptions = {
      body:
        payload.notification?.body ||
        payload.data?.body ||
        'Um artigo da sua lista de páginas vigiadas foi alterado.',
      icon: '/assets/aistudio/image_370f9ede.png',
      badge: '/assets/aistudio/image_370f9ede.png',
      tag: payload.data?.articleSlug ? `article-edit-${payload.data.articleSlug}` : 'article-edit',
      data: {
        url: payload.data?.url || (payload.data?.articleSlug ? `/#/wiki/${payload.data.articleSlug}` : '/'),
        articleSlug: payload.data?.articleSlug,
        timestamp: Date.now()
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Falha ao inicializar FCM no Service Worker:', err);
}

// Fallback listener for standard Web Push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.notification?.title || data.data?.title || data.title || 'NotMediaWiki - Artigo Seguido Atualizado';
    const body = data.notification?.body || data.data?.body || data.body || 'Um artigo vigiado foi alterado.';
    const slug = data.data?.articleSlug || data.articleSlug;
    const options = {
      body,
      icon: '/assets/aistudio/image_370f9ede.png',
      badge: '/assets/aistudio/image_370f9ede.png',
      tag: slug ? `article-edit-${slug}` : 'article-edit',
      data: {
        url: data.data?.url || (slug ? `/#/wiki/${slug}` : '/'),
        articleSlug: slug,
        timestamp: Date.now(),
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('NotMediaWiki - Artigo Alterado', {
        body: text || 'Um artigo seguido sofreu alterações.',
        icon: '/assets/aistudio/image_370f9ede.png',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
