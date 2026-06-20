const CACHE = 'netz-control-shell-v1';
const SHELL = ['/brand/icono-negro.png', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Authenticated pages, functions and Supabase-backed data are always network-only.
  if (url.pathname.startsWith('/.netlify/') || request.headers.has('authorization') || request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }
  if (SHELL.includes(url.pathname)) event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});
