// Màn Tìm: ô tìm tức thì (debounce 80ms) + chip lọc loại giấy tờ / đối tượng / thời gian + lưới thẻ có tô sáng.
import { h, icon, mount } from "./dom.js";
import { startOcrQueue } from "./ocr-queue.js";
import { getDocTypes, formatDate, highlight, thumbImg, daysAgoIso, collectValues } from "./common.js";
import { listRecords } from "../data/records.js";
import { search } from "../data/search.js";
import { setDossierSelection } from "./screen-dossier.js";
import { AREAS, SEARCH_DEBOUNCE_MS } from "../core/config.js";

// Giữ lại cách tìm khi quay lại từ màn Chi tiết.
const state = { q: "", type: "", subject: "", area: "", days: 0 };
const PAGE_SIZE = 60;
const TIME_CHIPS = [[0, "Mọi lúc"], [7, "7 ngày"], [30, "30 ngày"], [365, "1 năm"]];

// Chế độ "Chọn nhiều" (để tạo hồ sơ trình bày). Giữ ở mức module để quay lại từ màn Hồ sơ vẫn còn tick.
const sel = { on: false, ids: new Set() };
const LONG_PRESS_MS = 500;

function card(r, q) {
  const thumb = r.kind === "image"
    ? thumbImg(r)
    : h("div", { class: "thumb-text" }, r.text);
  return h("a", { class: "card glass" + (sel.ids.has(r.id) ? " selected" : ""), href: "#/chi-tiet/" + encodeURIComponent(r.id), dataset: { id: r.id }, draggable: "false" },
    h("div", { class: "thumb-wrap" }, h("span", { class: "badge" }, r.docType), h("span", { class: "sel-mark", "aria-hidden": "true" }, icon("check", 16)), thumb),
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
  let currentList = []; // kết quả đang lọc (đủ, không chỉ phần đã vẽ)

  // ----- Chọn nhiều -----
  const selToggle = h("button", { type: "button", class: "btn sel-toggle", onclick: () => setSelectMode(!sel.on) });
  const selCount = h("strong", null);
  const selAll = h("button", { type: "button", class: "btn btn-ghost sel-link", onclick: () => { for (const r of currentList) sel.ids.add(r.id); updateSelUi(); } });
  const selNone = h("button", { type: "button", class: "btn btn-ghost sel-link", onclick: () => { sel.ids.clear(); updateSelUi(); } }, "Bỏ chọn");
  const selMake = h("button", { type: "button", class: "btn btn-primary sel-make", onclick: () => {
    setDossierSelection([...sel.ids]);
    location.hash = "#/ho-so";
  } }, "Tạo hồ sơ");
  const selBar = h("div", { class: "selbar glass-strong", role: "region", "aria-label": "Thanh chọn nhiều" },
    h("div", { class: "selbar-row" }, selCount, h("span", { class: "selbar-links" }, selAll, selNone)), selMake);

  function setSelectMode(on) {
    sel.on = on;
    if (!on) sel.ids.clear();
    updateSelUi();
  }
  function toggleId(id) {
    if (sel.ids.has(id)) sel.ids.delete(id); else sel.ids.add(id);
    updateSelUi();
  }
  function updateSelUi() {
    grid.classList.toggle("selecting", sel.on);
    selBar.hidden = !sel.on;
    selToggle.replaceChildren(icon("check", 18), sel.on ? "Xong" : "Chọn nhiều");
    selToggle.setAttribute("aria-pressed", String(sel.on));
    for (const el of grid.querySelectorAll(".card")) el.classList.toggle("selected", sel.ids.has(el.dataset.id));
    const n = sel.ids.size;
    selCount.textContent = n ? `Đã chọn ${n}` : "Chạm vào thẻ để chọn";
    selAll.textContent = `Chọn tất cả ${currentList.length} kết quả đang lọc`;
    selAll.hidden = !currentList.length || n >= currentList.length;
    selNone.hidden = !n;
    selMake.disabled = !n;
    selMake.textContent = n ? `Tạo hồ sơ (${n})` : "Tạo hồ sơ";
  }

  grid.addEventListener("click", (e) => {
    if (longFired) { e.preventDefault(); longFired = false; return; }
    const c = e.target.closest?.(".card");
    if (!c || !sel.on) return;
    e.preventDefault();
    toggleId(c.dataset.id);
  });
  // Nhấn giữ một thẻ (điện thoại/cảm ứng) → vào chế độ chọn và tick thẻ đó.
  let longFired = false, pressTimer = 0, pressX = 0, pressY = 0, touchy = false;
  const cancelPress = () => clearTimeout(pressTimer);
  grid.addEventListener("pointerdown", (e) => {
    touchy = e.pointerType !== "mouse";
    const c = e.target.closest?.(".card");
    if (!touchy || !c) return;
    pressX = e.clientX; pressY = e.clientY;
    cancelPress();
    pressTimer = setTimeout(() => {
      longFired = true;
      setTimeout(() => { longFired = false; }, 700);
      sel.on = true;
      sel.ids.add(c.dataset.id);
      updateSelUi();
      try { navigator.vibrate?.(25); } catch { /* không hỗ trợ rung */ }
    }, LONG_PRESS_MS);
  });
  grid.addEventListener("pointermove", (e) => { if (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10) cancelPress(); });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) grid.addEventListener(ev, cancelPress);
  grid.addEventListener("contextmenu", (e) => { if (touchy && e.target.closest?.(".card")) e.preventDefault(); }); // chặn menu "mở liên kết" của Chrome khi nhấn giữ

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
    currentList = list;
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
    // Chỉ vẽ từng trang nhỏ (có hàng chục nghìn bằng chứng thì vẽ hết sẽ làm máy đứng hình); bấm "Xem thêm" để vẽ tiếp.
    let shown = 0;
    const more = h("button", { type: "button", class: "btn", style: { gridColumn: "1 / -1", justifySelf: "center" } });
    const drawMore = () => {
      const next = list.slice(shown, shown + PAGE_SIZE);
      shown += next.length;
      more.remove();
      grid.append(...next.map((r) => card(r, q)));
      if (shown < list.length) { more.textContent = `Xem thêm (còn ${list.length - shown})`; grid.append(more); }
    };
    more.addEventListener("click", drawMore);
    grid.replaceChildren();
    drawMore();
  }

  function refresh() { drawChips(); drawResults(); updateSelUi(); }

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = input.value; drawResults(); updateSelUi(); }, SEARCH_DEBOUNCE_MS);
  });

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("div", { class: "brand" }, h("img", { src: "icons/icon-192.png", alt: "", width: 36, height: 36 }), h("h1", null, "Cá Vàng")), selToggle),
      h("div", { class: "searchbox glass-strong" }, icon("search", 24), input, h("span", { class: "kbd-hint", "aria-hidden": "true" }, "/")),
      areaBox, typeBox, subjBox, timeBox, meta, grid,
    ),
    selBar, // nằm ngoài .screen: khung có hiệu ứng (transform) sẽ làm "fixed" bị lệch
  );
  updateSelUi();

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
