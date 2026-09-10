// 싯다르타 PWA - 최소 서비스 워커
// 목적: "설치 가능" 조건 충족 + 네트워크 끊겼을 때만 캐시 폴백.
// 항상 네트워크 응답을 우선하므로, 평소 사용(온라인)에는 캐시가 새 코드/데이터를 가리는 일이 없음.

const CACHE_NAME = 'siddhartha-shell-v1';
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 앱 셸(HTML)만 최신본으로 캐시 갱신
        if (event.request.mode === 'navigate') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, resClone));
        }
        return res;
      })
      .catch(() => caches.match(event.request.mode === 'navigate' ? SHELL_URL : event.request))
  );
});
