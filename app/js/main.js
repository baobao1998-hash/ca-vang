// Khởi động app + router bằng #hash: #/tim · #/them · #/chi-tiet/<id> · #/cai-dat
import { h, icon } from "./ui/dom.js";
import { renderSearch } from "./ui/screen-search.js";
import { renderAdd } from "./ui/screen-add.js";
import { renderDetail } from "./ui/screen-detail.js";
import { renderSettings } from "./ui/screen-settings.js";

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
  const key = name === "chi-tiet" ? "#/tim" : "#/" + name;
  for (const a of tabs.querySelectorAll("a")) {
    if (a.dataset.route === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  switch (name) {
    case "them": current = renderAdd(view); break;
    case "chi-tiet": renderDetail(view, decodeURIComponent(arg || "")); break;
    case "cai-dat": renderSettings(view); break;
    default: current = renderSearch(view);
  }
  window.scrollTo(0, 0);
}

// Phím tắt "/" để nhảy vào ô tìm
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (e.key === "/" && !(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)) {
    e.preventDefault();
    if (!location.hash.startsWith("#/tim") && location.hash !== "") location.hash = "#/tim";
    setTimeout(() => (current?.focus ? current.focus() : document.getElementById("q")?.focus()), 0);
  }
});

buildTabs();
window.addEventListener("hashchange", route);
route();

// Offline: đăng ký service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Không bật được chế độ offline:", err));
}
