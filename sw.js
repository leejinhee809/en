// ===== 학습 앱 오프라인용 서비스워커 =====
// 앱 파일을 수정해서 다시 올릴 때는 아래 버전 숫자를 하나 올려 주세요 (v1 → v2).
const CACHE_NAME = 'hakseup-offline-v2';

// 처음 설치할 때 미리 저장해 둘 파일들
const APP_FILES = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'
];
const CDN_FILES = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// 설치: 앱 파일 + 외부 라이브러리 저장 (하나가 실패해도 나머지는 저장)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(APP_FILES.map(url =>
        cache.add(url).catch(err => console.log('저장 실패:', url, err))
      ));
      await Promise.all(CDN_FILES.map(url =>
        fetch(new Request(url, { mode: 'no-cors' }))
          .then(res => cache.put(url, res))
          .catch(err => console.log('저장 실패:', url, err))
      ));
    })
  );
  self.skipWaiting();
});

// 활성화: 예전 버전 저장소 정리
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // 저장하면 안 되는 요청은 그냥 통과 (AI 분석 요청, POST 등)
  if (req.method !== 'GET' || req.url.includes('generativelanguage.googleapis.com')) return;

  // 앱 화면: 인터넷 되면 최신 버전, 안 되면 저장된 버전
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 나머지(아이콘, 라이브러리, 글꼴): 저장된 것 먼저, 없으면 받아서 저장
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached);
    })
  );
});
