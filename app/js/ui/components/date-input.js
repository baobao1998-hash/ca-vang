// Ô ngày kiểu Việt Nam: luôn hiện dd/mm/yyyy trên mọi trình duyệt, nhưng đọc/ghi dạng ISO yyyy-mm-dd.
import { h } from "../dom.js";

export function isoToVn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "05/10/2026" (hoặc 5-10-2026, 5.10.2026) → "2026-10-05"; sai ngày → null; rỗng → "". */
export function vnToIso(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t);
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function dateInput({ id, value = "", onchange } = {}) {
  const input = h("input", { class: "field", id, type: "text", inputmode: "numeric", placeholder: "dd/mm/yyyy", maxlength: "10", autocomplete: "off", "aria-label": "Ngày (ngày/tháng/năm)" });
  input.value = isoToVn(value);
  const check = () => input.classList.toggle("invalid", vnToIso(input.value) === null);
  input.addEventListener("input", (e) => {
    // Tự thêm dấu "/" khi gõ liền số (05102026 → 05/10/2026); không can thiệp khi đang xoá.
    if (e.inputType && e.inputType.startsWith("delete")) { check(); onchange?.(); return; }
    const digits = input.value.replace(/\D/g, "");
    if (/^\d+$/.test(input.value.replace(/\//g, ""))) {
      const p = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
      input.value = p.join("/") + (digits.length === 2 || digits.length === 4 ? "/" : "");
    }
    check(); onchange?.();
  });
  input.addEventListener("blur", () => { const iso = vnToIso(input.value); if (iso) input.value = isoToVn(iso); check(); });
  return {
    el: input,
    /** ISO "yyyy-mm-dd", "" nếu để trống, null nếu gõ sai. */
    getIso: () => vnToIso(input.value),
    setIso: (iso) => { input.value = isoToVn(iso); check(); },
    isEmpty: () => !input.value.trim(),
    focus: () => input.focus(),
  };
}
