// ============================================
// Service Worker - 학원 업무관리 PWA
// ============================================
const CACHE_NAME = 'hakwon-v1';
const CACHE_VERSION = 1; // 새 버전 배포 시 이 숫자를 올리세요

// 오프라인에서도 열 수 있도록 캐시할 파일 목록
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap'
];

// ===== Install: 정적 파일 캐싱 =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 폰트는 실패해도 설치 계속
      return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('fonts.googleapis')))
        .then(() => cache.add('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap').catch(() => {}));
    }).then(() => self.skipWaiting())
  );
});

// ===== Activate: 오래된 캐시 삭제 =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ===== Fetch: 캐시 우선, 없으면 네트워크 =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase API 요청은 캐시하지 않음 (항상 네트워크)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // GET 요청만 캐시
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // 캐시에 있으면 즉시 반환 + 백그라운드에서 업데이트
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {});
        return cachedResponse;
      }

      // 캐시에 없으면 네트워크 요청
      return fetch(request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // 오프라인 & 캐시 없음: index.html 반환
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ===== 새 버전 감지 시 클라이언트에 알림 =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
