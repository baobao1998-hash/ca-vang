// Màn Tìm: ô tìm lớn + chip lọc loại giấy tờ + lưới thẻ. (Dữ liệu giả — GĐ2 nối dữ liệu thật.)
import { h, icon, mount } from "./dom.js";
import { DOC_TYPES, mockSearch, formatDate } from "./mock.js";

let state = { q: "", type: "" };

function card(r) {
  const thumb = r.imageUrl
    ? h("img", { class: "thumb", src: r.imageUrl, alt: "Ảnh: " + r.title, loading: "lazy" })
    : h("div", { class: "thumb-text" }, r.text);
  return h("a", { class: "card glass", href: "#/chi-tiet/" + r.id },
    h("div", { class: "thumb-wrap" }, h("span", { class: "badge" }, r.docType), thumb),
    h("div", { class: "card-body" },
      h("h3", { class: "card-title" }, r.title),
      r.itemCodes.length > 0 && h("div", { class: "card-line" }, icon("text", 14), h("span", null, r.itemCodes.join(", "))),
      r.subjects.length > 0 && h("div", { class: "card-line" }, icon("user", 14), h("span", null, r.subjects.join(", "))),
      r.docDate && h("div", { class: "card-line" }, icon("calendar", 14), h("span", null, formatDate(r.docDate))),
    ),
  );
}

export function renderSearch(root) {
  const input = h("input", {
    class: "field", id: "q", type: "search", placeholder: "Tìm mã hàng, đối tượng…",
    autocomplete: "off", "aria-label": "Tìm bằng chứng", value: state.q,
  });
  const chipsBox = h("div", { class: "chips", role: "group", "aria-label": "Lọc theo loại giấy tờ" });
  const meta = h("p", { class: "result-meta", "aria-live": "polite" });
  const grid = h("div", { class: "grid" });

  function drawChips() {
    const all = [["", "Tất cả"], ...DOC_TYPES.map((t) => [t, t])];
    chipsBox.replaceChildren(...all.map(([val, text]) =>
      h("button", { type: "button", class: "chip", "aria-pressed": String(state.type === val), onclick: () => { state.type = val; drawChips(); drawResults(); } }, text)));
  }
  function drawResults() {
    const list = mockSearch(state.q, state.type);
    meta.textContent = state.q || state.type ? `Tìm thấy ${list.length} bằng chứng` : `${list.length} bằng chứng gần đây`;
    if (!list.length) {
      mount(grid, h("div", { class: "empty glass", style: { gridColumn: "1 / -1" } }, icon("search", 32), h("h2", null, "Không thấy kết quả"), h("p", null, "Thử gõ ít chữ hơn, hoặc bỏ bộ lọc loại giấy tờ.")));
      return;
    }
    mount(grid, ...list.map(card));
  }

  input.addEventListener("input", () => { state.q = input.value; drawResults(); });

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("div", { class: "brand" }, h("img", { src: "icons/icon-192.png", alt: "", width: 36, height: 36 }), h("h1", null, "Cá Vàng"))),
      h("div", { class: "searchbox glass-strong" }, icon("search", 24), input, h("span", { class: "kbd-hint", "aria-hidden": "true" }, "/")),
      chipsBox, meta, grid,
    ),
  );
  drawChips();
  drawResults();
  return { focus: () => input.focus() };
}
