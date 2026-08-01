// FIGHT READY サービスワーカー（最小）。
// 記録アプリなのでキャッシュは薄く。オフライン時に自前の案内を返すだけ。
const CACHE = "fight-ready-v1";
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});
// ネットワーク優先（記録は常に最新を取りに行く）
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
