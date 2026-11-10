// Service worker: cache "vỏ app" để mở được khi không có mạng.
// Đổi CACHE khi sửa file để máy cũ tải bản mới.
const CACHE = "cavang-shell-v1";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/tokens.css", "css/glass.css", "css/app.css",
  "js/main.js", "js/core/version.js",
  "js/ui/dom.js", "js/ui/mock.js",
  "js/ui/screen-search.js", "js/ui/screen-add.js", "js/ui/screen-detail.js", "js/ui/screen-settings.js",
  "js/ui/components/tag-input.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Ưu tiên mạng (luôn mới), mất mạng thì dùng bản đã lưu.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))),
  );
});
