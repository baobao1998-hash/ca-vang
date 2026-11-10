// Khởi động app + router bằng #hash: #/tim · #/them · #/chi-tiet/<id> · #/thung-rac · #/cai-dat
import { h, icon, mount, toast } from "./ui/dom.js";
import { renderSearch } from "./ui/screen-search.js";
import { renderAdd, stashImages } from "./ui/screen-add.js";
import { renderDetail } from "./ui/screen-detail.js";
import { renderTrash } from "./ui/screen-trash.js";
import { renderSettings } from "./ui/screen-settings.js";
import { openDb } from "./data/db.js";
import { listRecords, purgeOld } from "./data/records.js";
import { initSearch, indexRecord, unindexRecord } from "./data/search.js";
import { on } from "./core/events.js";
import { APP_VERSION } from "./core/version.js";
import { readClipboardImage } from "./services/image.js";

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

async function start() {
  try {
    await openDb();
    await purgeOld(); // tự xoá hẳn bản ghi nằm trong thùng rác quá 30 ngày
    initSearch(await listRecords());
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
}

start().catch((err) => { console.error(err); toast("Có lỗi khi khởi động app.", "error"); });

// Offline: đăng ký service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v=" + APP_VERSION)
    .catch(() => navigator.serviceWorker.register("sw.js")) // dự phòng nếu trình duyệt chặn địa chỉ có "?v="
    .catch((err) => console.warn("Không bật được chế độ offline:", err));
}
