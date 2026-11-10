// Màn Tìm: ô tìm tức thì (debounce 80ms) + chip lọc loại giấy tờ / đối tượng / thời gian + lưới thẻ có tô sáng.
import { h, icon, mount } from "./dom.js";
import { startOcrQueue } from "./ocr-queue.js";
import { getDocTypes, formatDate, highlight, thumbImg, daysAgoIso, collectValues } from "./common.js";
import { listRecords } from "../data/records.js";
import { search } from "../data/search.js";
import { AREAS, SEARCH_DEBOUNCE_MS } from "../core/config.js";

// Giữ lại cách tìm khi quay lại từ màn Chi tiết.
const state = { q: "", type: "", subject: "", area: "", days: 0 };
const TIME_CHIPS = [[0, "Mọi lúc"], [7, "7 ngày"], [30, "30 ngày"], [365, "1 năm"]];

function card(r, q) {
  const thumb = r.kind === "image"
    ? thumbImg(r)
    : h("div", { class: "thumb-text" }, r.text);
  return h("a", { class: "card glass", href: "#/chi-tiet/" + encodeURIComponent(r.id) },
    h("div", { class: "thumb-wrap" }, h("span", { class: "badge" }, r.docType), thumb),
    h("div", { class: "card-body" },
      h("h3", { class: "card-title" }, highlight(r.title, q)),
      r.itemCodes.length > 0 && h("div", { class: "card-line" }, icon("text", 14), h("span", null, highlight(r.itemCodes.join(", "), q))),
      r.subjects.length > 0 && h("div", { class: "card-line" }, icon("user", 14), h("span", null, highlight(r.subjects.join(", "), q))),
      r.situations.length > 0 && h("div", { class: "card-line" }, icon("info", 14), h("span", null, highlight(r.situations.join(", "), q))),
      (r.docDate || r.createdAt) && h("div", { class: "card-line" }, icon("calendar", 14), h("span", null, formatDate(r.docDate || r.createdAt))),
    ),
  );
}

export function renderSearch(root) {
  startOcrQueue();
  let alive = true;
  let records = [];
  let byId = new Map();
  let timer = 0;

  const input = h("input", {
    class: "field", id: "q", type: "search", placeholder: "Tìm mã hàng, đối tượng, tình huống…",
    autocomplete: "off", "aria-label": "Tìm bằng chứng", value: state.q,
  });
  const areaBox = h("div", { class: "chips", role: "group", "aria-label": "Lọc theo lĩnh vực" });
  const typeBox = h("div", { class: "chips", role: "group", "aria-label": "Lọc theo loại giấy tờ" });
  const subjBox = h("div", { class: "chips", role: "group", "aria-label": "Lọc theo đối tượng" });
  const timeBox = h("div", { class: "chips", role: "group", "aria-label": "Lọc theo thời gian" });
  const meta = h("p", { class: "result-meta", "aria-live": "polite" });
  const grid = h("div", { class: "grid" });

  const chip = (text, on, fn) => h("button", { type: "button", class: "chip", "aria-pressed": String(on), onclick: fn }, text);

  function drawChips() {
    const none = !records.length;
    areaBox.hidden = typeBox.hidden = subjBox.hidden = timeBox.hidden = none;
    if (none) return;
    areaBox.replaceChildren(h("span", { class: "chip-label" }, "Lĩnh vực"), chip("Tất cả", !state.area, () => { state.area = ""; refresh(); }),
      ...AREAS.map(([v, t]) => chip(t, state.area === v, () => { state.area = state.area === v ? "" : v; refresh(); })));
    const presentTypes = new Set(records.map((r) => r.docType));
    const types = [...new Set([...getDocTypes(), ...presentTypes])].filter((t) => presentTypes.has(t) || state.type === t);
    typeBox.replaceChildren(chip("Tất cả loại", !state.type, () => { state.type = ""; refresh(); }),
      ...types.map((t) => chip(t, state.type === t, () => { state.type = state.type === t ? "" : t; refresh(); })));
    const subjects = collectValues(records, "subjects").slice(0, 12);
    if (state.subject && !subjects.includes(state.subject)) subjects.unshift(state.subject);
    subjBox.hidden = !subjects.length;
    subjBox.replaceChildren(h("span", { class: "chip-label" }, "Đối tượng"), ...subjects.map((s) => chip(s, state.subject === s, () => { state.subject = state.subject === s ? "" : s; refresh(); })));
    timeBox.replaceChildren(h("span", { class: "chip-label" }, "Thời gian"), ...TIME_CHIPS.map(([d, t]) => chip(t, state.days === d, () => { state.days = d; refresh(); })));
  }

  function matches(r) {
    if (state.type && r.docType !== state.type) return false;
    if (state.area && (r.area || "work") !== state.area) return false;
    if (state.subject && !r.subjects.includes(state.subject)) return false;
    if (state.days && (r.docDate || r.createdAt.slice(0, 10)) < daysAgoIso(state.days)) return false;
    return true;
  }

  function drawResults() {
    const q = state.q.trim();
    const filtering = q || state.area || state.type || state.subject || state.days;
    let list;
    if (q) {
      const filters = { area: state.area, docType: state.type, subject: state.subject, from: state.days ? daysAgoIso(state.days) : "" };
      list = search(q, { filters }).map((x) => byId.get(x.id)).filter(Boolean);
    } else {
      list = records.filter(matches).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    if (!records.length) {
      meta.textContent = "";
      mount(grid, h("div", { class: "empty glass", style: { gridColumn: "1 / -1" } },
        h("div", { class: "empty-fish", "aria-hidden": "true" }, "🐟"),
        h("h2", null, "Chưa có bằng chứng nào"),
        h("p", null, "Chụp ảnh giấy tờ, dán ảnh màn hình hoặc dán tin nhắn — Cá Vàng sẽ giữ giúp bạn và tìm lại trong tích tắc."),
        h("p", null, h("a", { class: "btn btn-primary", href: "#/them", style: { marginTop: "16px" } }, icon("plus", 18), "Thêm bằng chứng đầu tiên"))));
      return;
    }
    meta.textContent = filtering ? `Tìm thấy ${list.length} bằng chứng` : `${list.length} bằng chứng gần đây`;
    if (!list.length) {
      mount(grid, h("div", { class: "empty glass", style: { gridColumn: "1 / -1" } }, icon("search", 32), h("h2", null, "Không thấy kết quả"), h("p", null, "Thử gõ ít chữ hơn, hoặc bỏ bớt bộ lọc.")));
      return;
    }
    mount(grid, ...list.map((r) => card(r, q)));
  }

  function refresh() { drawChips(); drawResults(); }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = input.value; drawResults(); }, SEARCH_DEBOUNCE_MS);
  });

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("div", { class: "brand" }, h("img", { src: "icons/icon-192.png", alt: "", width: 36, height: 36 }), h("h1", null, "Cá Vàng"))),
      h("div", { class: "searchbox glass-strong" }, icon("search", 24), input, h("span", { class: "kbd-hint", "aria-hidden": "true" }, "/")),
      areaBox, typeBox, subjBox, timeBox, meta, grid,
    ),
  );

  listRecords().then((all) => {
    if (!alive) return;
    records = all;
    byId = new Map(all.map((r) => [r.id, r]));
    refresh();
  }).catch((err) => {
    console.error(err);
    meta.textContent = "Không đọc được dữ liệu trên máy. Hãy tải lại trang.";
  });

  return { focus: () => { input.focus(); input.select(); }, destroy: () => { alive = false; clearTimeout(timer); } };
}
