// 모눈 오프라인 지원: 한 번 열면 인터넷 없이도 실행된다.
// 화면(index.html)은 인터넷이 되면 항상 새 버전을 받아 오고, 안 되면 저장해 둔 것을 쓴다.
const CACHE = 'monun-v2';
const SHELL = ['./', 'index.html', 'exceljs.min.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', e => {
  // 파일 하나를 못 받아도 나머지는 저장해서 설치가 멈추지 않게
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'monun-share').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // 안드로이드 공유(카톡 → 공유 → 모눈): 파일을 잠깐 보관하고 화면을 연다. 화면이 받아서 연 뒤 지운다.
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')){
    e.respondWith((async () => {
      try {
        const form = await req.formData(), f = form.get('file');
        if (f && typeof f !== 'string'){
          const c = await caches.open('monun-share');
          await c.put('shared-file', new Response(f, {headers: {'X-Name': encodeURIComponent(f.name || '공유받은 파일.monun')}}));
        }
      } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  // 화면: 인터넷 먼저
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')){
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // 나머지(엑셀 부품, 아이콘, 구글 글꼴): 저장해 둔 것 먼저, 없으면 받아서 저장
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque'){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
