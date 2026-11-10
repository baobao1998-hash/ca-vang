// Ô "Loại giấy tờ": chọn trong danh sách, hoặc chọn "＋ Loại mới…" rồi gõ tên. Loại mới được nhớ cho lần sau.
import { h } from "../dom.js";
import { getDocTypes, rememberDocType } from "../common.js";

const NEW = "__new__";

export function docTypeInput({ id, value = "Khác", onchange } = {}) {
  const sel = h("select", { class: "field", id });
  const txt = h("input", { class: "field", type: "text", placeholder: "Gõ tên loại mới, VD: Phiếu bảo hành", maxlength: "40", hidden: true, "aria-label": "Tên loại giấy tờ mới" });
  const box = h("div", { class: "doctype" }, sel, txt);

  function fill(current) {
    const list = getDocTypes();
    if (current && !list.includes(current)) list.push(current); // loại lạ (từ bản ghi cũ / Gemini) vẫn hiện được
    sel.replaceChildren(...list.map((t) => h("option", { value: t }, t)), h("option", { value: NEW }, "＋ Loại mới…"));
    sel.value = current && list.includes(current) ? current : "Khác";
  }
  function showNew(on) { txt.hidden = !on; if (on) txt.focus(); }
  sel.addEventListener("change", () => { showNew(sel.value === NEW); onchange?.(); });
  txt.addEventListener("input", () => onchange?.());
  fill(value);

  return {
    el: box,
    getValue: () => (sel.value === NEW ? (txt.value.trim().replace(/\s+/g, " ") || "Khác") : sel.value),
    setValue: (v) => { fill(v); showNew(false); },
    /** Gọi khi lưu: nhớ loại mới để lần sau có trong danh sách. */
    commit() { const v = this.getValue(); rememberDocType(v); return v; },
  };
}
