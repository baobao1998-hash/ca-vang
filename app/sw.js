// Service worker: lưu "vỏ app" để mở được khi không có mạng.
// - Tên cache gắn với phiên bản app (main.js đăng ký "sw.js?v=<APP_VERSION>") → đổi phiên bản = cache mới, cache cũ bị xoá.
// - Có mạng: luôn hỏi lại máy chủ ({cache:"no-cache"}) để lấy bản mới nhất; mất mạng mới dùng bản đã lưu.
// - Bản mới cài xong sẽ CHỜ; người dùng bấm "Tải lại bản mới" ở Cài đặt (tránh mất dữ liệu đang nhập dở).
// Phiên bản lấy từ "?v=" khi đăng ký; nếu không có thì đọc từ js/core/version.js.
const queryVersion = new URL(self.location.href).searchParams.get("v");
const cacheName = queryVersion
  ? Promise.resolve("cavang-shell-v" + queryVersion)
  : fetch("js/core/version.js", { cache: "no-store" }).then((r) => r.text())
      .then((t) => "cavang-shell-v" + (/APP_VERSION = "([^"]+)"/.exec(t) || [])[1]).catch(() => "cavang-shell-vdev");
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/tokens.css", "css/glass.css", "css/app.css",
  "js/main.js",
  "js/core/config.js", "js/core/events.js", "js/core/ids.js", "js/core/text.js", "js/core/version.js",
  "js/data/db.js", "js/data/records.js", "js/data/search.js", "js/data/settings.js",
  "js/services/auth.js", "js/services/backup.js", "js/services/drive.js", "js/services/gemini.js", "js/services/image.js", "js/services/sync.js",
  "js/ui/common.js", "js/ui/dom.js", "js/ui/ocr-queue.js",
  "js/ui/screen-add.js", "js/ui/screen-detail.js", "js/ui/screen-search.js", "js/ui/screen-settings.js", "js/ui/screen-trash.js",
  "js/ui/components/date-input.js", "js/ui/components/doc-type.js", "js/ui/components/lightbox.js", "js/ui/components/tag-input.js",
  "vendor/minisearch.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(cacheName.then((n) => caches.open(n)).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Chỉ xoá cache "vỏ app" của phiên bản cũ; giữ nguyên cache "cavang-share" (ảnh vừa được chia sẻ vào app).
    cacheName.then((n) => n === "cavang-shell-vdev" ? null : caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("cavang-shell-v") && k !== n).map((k) => caches.delete(k))))).then(() => self.clients.claim()),
  );
});

// "Chia sẻ → Cá Vàng" trên Android: trình duyệt gửi ảnh/văn bản bằng POST tới ./share-target.
// Ở đây cất tạm vào cache "cavang-share" rồi chuyển hướng về app (main.js sẽ lấy ra, mở màn Thêm).
const SHARE_CACHE = "cavang-share";
async function handleShare(req) {
  try {
    const fd = await req.formData();
    const c = await caches.open(SHARE_CACHE);
    for (const k of await c.keys()) await c.delete(k);
    let i = 0;
    for (const f of fd.getAll("media")) {
      if (typeof f === "string") continue;
      await c.put(new Request(new URL("share/file-" + i++, self.registration.scope).href),
        new Response(f, { headers: { "Content-Type": f.type || "image/jpeg", "X-Name": encodeURIComponent(f.name || "") } }));
    }
    const parts = [];
    for (const k of ["title", "text", "url"]) {
      const v = fd.get(k);
      if (typeof v === "string" && v.trim() && !parts.includes(v.trim())) parts.push(v.trim());
    }
    if (parts.length) await c.put(new Request(new URL("share/text", self.registration.scope).href), new Response(parts.join("\n"), { headers: { "Content-Type": "text/plain;charset=utf-8" } }));
  } catch (err) { console.warn("Không nhận được nội dung chia sẻ:", err); }
  return Response.redirect(new URL("./?shared=1#/them", self.registration.scope).href, 303);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method === "POST" && new URL(req.url).origin === location.origin && new URL(req.url).pathname.endsWith("/share-target")) {
    e.respondWith(handleShare(req));
    return;
  }
  // Chỉ xử lý file của chính app. Mọi request tới Google (Drive, đăng nhập, Gemini) đi thẳng, không cache, không chặn.
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); cacheName.then((n) => caches.open(n)).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))),
  );
});
