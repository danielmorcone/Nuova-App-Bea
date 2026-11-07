// Incrementa questa versione quando cambi i file memorizzati offline.
const CACHE_NAME = 'app-v11';
const appFile = path => new URL(path, self.registration.scope).href;
const ASSETS = [
  './',
  'index.html',
  'pages/calma.html',
  'assets/css/style.css',
  'assets/css/calma.css',
  'assets/js/app.js',
  'assets/js/calma.js',
  'assets/js/modules/pwa.js',
  'assets/js/modules/support.js',
  'assets/js/modules/navigation.js',
  'assets/js/modules/calma.js',
  'manifest.json',
  'assets/images/waves/wave1.png',
  'assets/images/waves/wave2.png',
  'assets/images/waves/wave3.png',
  'assets/images/illustrations/line.png',
  'assets/images/illustrations/heart.png',
  'assets/icons/icona.png',
  'assets/icons/icona-512.png'
].map(appFile);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
