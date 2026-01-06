// public/sw.js
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('fetch', (event) => {
  // Required by Chrome to trigger the install prompt
  event.respondWith(fetch(event.request));
});