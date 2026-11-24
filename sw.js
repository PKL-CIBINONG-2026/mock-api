/**
 * sw.js — Service Worker Interceptor (Mode 1).
 * Didaftarkan sebagai module worker: navigator.serviceWorker.register('./sw.js', { type: 'module' }).
 * Hanya mencegat request ke `<scope>api/v1...`; file statis diteruskan ke jaringan seperti biasa.
 */
import { handleApiRequest } from './src/core/router.js';

const API_BASE = new URL('api/v1', self.registration.scope).href;

function isApiRequest(url) {
  return url === API_BASE || url.startsWith(`${API_BASE}/`) || url.startsWith(`${API_BASE}?`);
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (isApiRequest(event.request.url)) {
    event.respondWith(handleApiRequest(event.request));
  }
});
