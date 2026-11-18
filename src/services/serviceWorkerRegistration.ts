/**
 * Registers the NotMediaWiki offline caching Service Worker (/sw.js)
 * without interfering with Firebase Cloud Messaging (/firebase-messaging-sw.js).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service Worker (/sw.js) registration notice:', err);
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration) {
      return await registration.unregister();
    }
    return false;
  } catch {
    return false;
  }
}
