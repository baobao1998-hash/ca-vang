// Ô nhập nhiều giá trị dạng chip (Mã hàng, Số lô, Đối tượng...). Gõ rồi Enter hoặc dấu phẩy để thêm.
// suggestions: các giá trị đã dùng trước đó → hiện gợi ý khi gõ (không phân biệt dấu).
import { h, icon } from "../dom.js";
import { normalizeVi } from "../../core/text.js";

export function tagInput({ name, label, placeholder = "Gõ rồi nhấn Enter", values = [], hint = "", suggestions: initial = [] }) {
  let suggestions = initial;
  const items = [...values];
  const list = h("div", { class: "tag-input field", onclick: () => input.focus() });
  const id = "ti-" + name;
  const input = h("input", { id, type: "text", placeholder, autocomplete: "off", enterkeyhint: "done", role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false" });
  const menu = h("ul", { class: "suggest glass-strong", role: "listbox", hidden: true });
  let shown = [];
  let active = -1;

  function render() {
    list.replaceChildren(
      ...items.map((v, i) =>
        h("span", { class: "chip chip-static" }, v,
          h("button", { type: "button", class: "chip-x", "aria-label": "Xoá " + v, onclick: (e) => { e.stopPropagation(); items.splice(i, 1); render(); } }, icon("close", 14))),
      ),
      input,
    );
  }
  function add(v) {
    v = String(v).replace(/,$/, "").trim();
    if (v && !items.includes(v)) items.push(v);
    input.value = "";
    closeMenu();
    render();
    input.focus();
  }
  function closeMenu() { menu.hidden = true; shown = []; active = -1; input.setAttribute("aria-expanded", "false"); }
  function drawMenu() {
    const q = normalizeVi(input.value.trim());
    shown = suggestions.filter((s) => !items.includes(s) && (!q || normalizeVi(s).includes(q))).slice(0, 6);
    if (!shown.length) { closeMenu(); return; }
    active = -1;
    menu.replaceChildren(...shown.map((s, i) =>
      h("li", { role: "option", onpointerdown: (e) => { e.preventDefault(); add(s); } }, s)));
    menu.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function mark() {
    [...menu.children].forEach((li, i) => li.classList.toggle("on", i === active));
  }
  input.addEventListener("input", drawMenu);
  input.addEventListener("focus", drawMenu);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && shown.length) { e.preventDefault(); active = (active + 1) % shown.length; mark(); }
    else if (e.key === "ArrowUp" && shown.length) { e.preventDefault(); active = (active - 1 + shown.length) % shown.length; mark(); }
    else if (e.key === "Escape") closeMenu();
    else if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(active >= 0 ? shown[active] : input.value); }
    else if (e.key === "Backspace" && !input.value && items.length) { items.pop(); render(); input.focus(); }
  });
  input.addEventListener("blur", () => { closeMenu(); if (input.value.trim()) add(input.value); });
  render();

  const el = h("div", { class: "ti-wrap" },
    h("label", { class: "label", for: id }, label),
    list,
    menu,
    hint && h("p", { class: "hint" }, hint),
  );
  el.getValues = () => [...items];
  el.setSuggestions = (arr) => { suggestions = arr || []; };
  el.reset = () => { items.length = 0; input.value = ""; render(); };
  return el;
}
