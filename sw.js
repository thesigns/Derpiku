// Service worker: the whole app works offline. Bump VERSION whenever files change.
// The domain (thesigns.github.io) is shared with other apps, so only caches prefixed with CACHE_PREFIX are touched.
const CACHE_PREFIX = 'derpiku-';
const VERSION = CACHE_PREFIX + 'v12';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'src/style.css',
  'src/orbits.js',
  'src/spirits.js',
  'src/main.js',
  'src/store.js',
  'src/walk.js',
  'src/texts.js',
  'src/creature.js',
  'src/globe.js',
  'src/spirit-art.js',
  'src/spirit-view.js',
  'src/radar.js',
  'src/data/haiku.json',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(VERSION)
      .then(cache => cache.match(event.request, { ignoreSearch: true }))
      .then(hit => hit || fetch(event.request)),
  );
});
