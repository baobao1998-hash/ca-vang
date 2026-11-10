// Ô nhập nhiều giá trị dạng chip (Mã hàng, Số lô, Đối tượng...). Gõ rồi Enter hoặc dấu phẩy để thêm.
import { h, icon } from "../dom.js";

export function tagInput({ name, label, placeholder = "Gõ rồi nhấn Enter", values = [], hint = "" }) {
  const items = [...values];
  const list = h("div", { class: "tag-input field", onclick: () => input.focus() });
  const id = "ti-" + name;
  const input = h("input", { id, type: "text", placeholder, autocomplete: "off", enterkeyhint: "done" });

  function render() {
    list.replaceChildren(
      ...items.map((v, i) =>
        h("span", { class: "chip chip-static" }, v,
          h("button", { type: "button", class: "chip-x", "aria-label": "Xoá " + v, onclick: (e) => { e.stopPropagation(); items.splice(i, 1); render(); } }, icon("close", 14))),
      ),
      input,
    );
  }
  function commit() {
    const v = input.value.replace(/,$/, "").trim();
    if (v && !items.includes(v)) items.push(v);
    input.value = "";
    render();
    input.focus();
  }
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
    else if (e.key === "Backspace" && !input.value && items.length) { items.pop(); render(); input.focus(); }
  });
  input.addEventListener("blur", () => { if (input.value.trim()) commit(); });
  render();

  const el = h("div", null,
    h("label", { class: "label", for: id }, label),
    list,
    hint && h("p", { class: "hint" }, hint),
  );
  el.getValues = () => [...items];
  return el;
}
