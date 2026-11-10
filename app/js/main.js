// Khởi động app + router bằng #hash: #/tim · #/them · #/chi-tiet/<id> · #/thung-rac · #/cai-dat
import { h, icon, mount, toast } from "./ui/dom.js";
import { renderSearch } from "./ui/screen-search.js";
import { renderAdd, stashImages, stashText } from "./ui/screen-add.js";
import { renderDetail } from "./ui/screen-detail.js";
import { renderTrash } from "./ui/screen-trash.js";
import { renderSettings } from "./ui/screen-settings.js";
import { openDb } from "./data/db.js";
import { listRecords, purgeOld } from "./data/records.js";
import { initSearch, indexRecord, unindexRecord } from "./data/search.js";
import { on } from "./core/events.js";
import { APP_VERSION } from "./core/version.js";
import { findUpdate } from "./ui/updater.js";
import { readClipboardImage } from "./services/image.js";
import { startAutoSync, getStatus, syncNow } from "./services/sync.js";
import { startPrefetch } from "./services/prefetch.js";
import { setSetting } from "./data/settings.js";

const view = document.getElementById("view");
const tabs = document.getElementById("tabs");
let current = null; // màn đang mở (có thể có destroy/focus)

function buildTabs() {
  const tab = (href, ico, text, cls = "") => h("a", { href, class: cls, "data-route": href }, icon(ico, 22), h("span", null, text));
  tabs.replaceChildren(tab("#/tim", "search", "Tìm"), tab("#/them", "plus", "Thêm", "tab-add"), tab("#/cai-dat", "settings", "Cài đặt"));
}

function route() {
  const [, name = "tim", arg] = location.hash.split("/");
  current?.destroy?.();
  current = null;
  const key = name === "chi-tiet" ? "#/tim" : name === "thung-rac" ? "#/cai-dat" : "#/" + name;
  for (const a of tabs.querySelectorAll("a")) {
    if (a.dataset.route === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  switch (name) {
    case "them": current = renderAdd(view); break;
    case "chi-tiet": current = renderDetail(view, decodeURIComponent(arg || "")); break;
    case "thung-rac": current = renderTrash(view); break;
    case "cai-dat": current = renderSettings(view); break;
    default: current = renderSearch(view);
  }
  window.scrollTo(0, 0);
}

// Phím tắt "/" để nhảy vào ô tìm
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (e.key === "/" && !e.ctrlKey && !e.metaKey && !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)) {
    e.preventDefault();
    const onSearch = location.hash === "" || location.hash.startsWith("#/tim");
    if (!onSearch) location.hash = "#/tim";
    setTimeout(() => (current?.focus ? current.focus() : document.getElementById("q")?.focus()), onSearch ? 0 : 60);
  }
});

// Ctrl+V dán ảnh ở bất kỳ màn nào (trừ màn Thêm tự xử lý) → chuyển sang màn Thêm kèm ảnh.
document.addEventListener("paste", (e) => {
  if (location.hash.startsWith("#/them")) return;
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
  const files = readClipboardImage(e);
  if (!files.length) return;
  e.preventDefault();
  stashImages(files);
  location.hash = "#/them";
});

// Lấy ảnh/văn bản vừa được chia sẻ vào app (service worker cất trong cache "cavang-share") → chuyển sang màn Thêm.
async function takeShared() {
  if (!new URLSearchParams(location.search).has("shared")) return;
  history.replaceState(null, "", location.pathname + "#/them"); // bỏ "?shared=1" để tải lại trang không nhận lần nữa
  try {
    const c = await caches.open("cavang-share");
    const files = [];
    let text = "", debug = "";
    for (const req of await c.keys()) {
      const res = await c.match(req);
      if (req.url.endsWith("/share/debug")) { debug = await res.text(); }
      else if (req.url.endsWith("/share/text")) text = await res.text();
      else {
        const blob = await res.blob();
        files.push(new File([blob], decodeURIComponent(res.headers.get("X-Name") || "") || "image", { type: blob.type || "image/jpeg" }));
      }
      await c.delete(req);
    }
    if (files.length) stashImages(files);
    if (text) stashText(text);
    if (!files.length && !text) {
      console.warn("Chia sẻ trống:", debug);
      // Kèm thông tin kỹ thuật ngắn để chủ dự án chụp màn hình gửi lại khi cần.
      let info = "không có dữ liệu";
      try { const d = JSON.parse(debug); delete d.type; info = JSON.stringify(d); } catch { /* giữ mặc định */ }
      toast("Không nhận được nội dung chia sẻ. Hãy thử chia sẻ lại hoặc chọn ảnh trong app. [" + info.slice(0, 220) + "]", "error", 15000);
    }
  } catch (err) { console.warn("Không đọc được nội dung chia sẻ:", err); }
}

async function start() {
  try {
    await openDb();
    await takeShared();
    initSearch(await listRecords());
    performance.mark("cv-indexed");
    on("record:saved", ({ record }) => indexRecord(record));
    on("record:deleted", ({ id }) => unindexRecord(id));
  } catch (err) {
    console.error(err);
    mount(view, h("section", { class: "screen" }, h("div", { class: "empty glass" }, icon("info", 32),
      h("h2", null, "Không mở được kho dữ liệu"),
      h("p", null, "Trình duyệt đang chặn lưu dữ liệu (có thể do chế độ ẩn danh). Hãy mở bằng cửa sổ thường rồi tải lại trang."))));
    return;
  }
  buildTabs();
  window.addEventListener("hashchange", route);
  route();
  // Đo "mở app → thấy danh sách" (đến khung hình đầu tiên sau khi vẽ xong). Hiện ở Cài đặt → Phiên bản.
  performance.mark("cv-route");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (document.visibilityState !== "visible") return; // tab ẩn thì số đo vô nghĩa
    const ms = Math.round(performance.now());
    window.__openMs = ms;
    setSetting("lastOpenMs", ms);
  }));
  buildSyncDot();
  // Đồng bộ + tải sẵn ảnh chạy SAU khi danh sách đã hiện, không chặn giao diện (màn Tìm đọc thẳng từ IndexedDB trên máy).
  setTimeout(() => { startAutoSync(); startPrefetch(); }, 0);
  // Dọn thùng rác quá 30 ngày: để sau khi danh sách đã hiện (bản ghi đó vốn không nằm trong danh sách/chỉ mục).
  const later = window.requestIdleCallback || ((f) => setTimeout(f, 500));
  later(() => { purgeOld().catch((e) => console.warn("Không dọn được thùng rác:", e)); }, { timeout: 5000 });
  // Báo có bản mới: kiểm tra lúc mở app và khi quay lại app (tối đa 30 phút/lần). Chỉ báo, không tự tải lại (tránh mất việc đang nhập).
  let lastCheck = 0;
  const checkUpdate = async () => {
    if (!navigator.onLine || Date.now() - lastCheck < 30 * 60000) return;
    lastCheck = Date.now();
    const v = await findUpdate();
    if (v) toast(`Có bản mới v${v} — vào Cài đặt → Phiên bản → “Cập nhật ngay”.`, "ok", 8000);
  };
  setTimeout(checkUpdate, 4000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(); });
}

// Chấm trạng thái đồng bộ ở góc trên bên phải: xám = chưa kết nối, xanh = đã đồng bộ, xanh dương nhấp nháy = đang đồng bộ, cam = chờ mạng / cần đăng nhập lại, đỏ = lỗi.
function buildSyncDot() {
  const dot = h("button", { id: "sync-dot", type: "button", class: "sync-dot", "aria-live": "polite" }, h("span", { class: "sync-dot-core" }));
  const paint = ({ state, message }) => {
    dot.dataset.state = state;
    dot.title = message;
    dot.setAttribute("aria-label", "Đồng bộ: " + message);
  };
  dot.addEventListener("click", () => {
    const { state } = getStatus();
    if (state === "off") { location.hash = "#/cai-dat"; return; }
    if (state !== "syncing") syncNow({ manual: true }).catch((e) => toast(e.message || "Đồng bộ gặp lỗi.", "error", 4000));
  });
  document.body.append(dot);
  on("sync:status", paint);
  paint(getStatus());
}

start().catch((err) => { console.error(err); toast("Có lỗi khi khởi động app.", "error"); });

// Offline: đăng ký service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v=" + APP_VERSION)
    .catch(() => navigator.serviceWorker.register("sw.js")) // dự phòng nếu trình duyệt chặn địa chỉ có "?v="
    .catch((err) => console.warn("Không bật được chế độ offline:", err));
}
