// Hàm dùng chung cho các màn: danh mục, ngày tháng, tô sáng từ khớp, ảnh nhỏ, gợi ý giá trị đã dùng.
import { h } from "./dom.js";
import { normalizeVi } from "../core/text.js";
import { DOC_TYPES } from "../core/config.js";
import { getThumbUrl } from "../data/records.js";

export { DOC_TYPES };

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Ngày "YYYY-MM-DD" của N ngày trước (giờ máy). */
export function daysAgoIso(n) {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEP = /[\s\-._/\\]/;
const SEP_ALL = /[\s\-._/\\]+/g;

/**
 * Trả về mảng nút (chữ thường + <mark>) để tô sáng các từ khớp, không phân biệt dấu/hoa thường.
 * Không dùng innerHTML: chữ luôn đi qua text node.
 */
export function highlight(text, query) {
  const src = String(text ?? "");
  const terms = normalizeVi(query || "").split(/\s+/).filter(Boolean);
  if (!terms.length || !src) return [src];
  // Chuẩn hoá từng ký tự để giữ nguyên vị trí so với chuỗi gốc.
  let norm = "";
  const map = [];
  for (let i = 0; i < src.length; i++) {
    const n = normalizeVi(src[i]);
    for (const c of n) { norm += c; map.push(i); }
  }
  const hit = new Array(src.length).fill(false);
  for (const t of terms) {
    let from = 0, at;
    while ((at = norm.indexOf(t, from)) !== -1) {
      for (let k = at; k < at + t.length; k++) hit[map[k]] = true;
      from = at + t.length;
    }
  }
  // Lần 2: bỏ dấu gạch/chấm/khoảng trắng để "kdc08" khớp "KDC-0.8".
  let compact = "";
  const cmap = [];
  for (let k = 0; k < norm.length; k++) {
    if (SEP.test(norm[k])) continue;
    compact += norm[k]; cmap.push(map[k]);
  }
  for (const t of terms) {
    const ct = t.replace(SEP_ALL, "");
    if (ct.length < 3) continue;
    let from = 0, at;
    while ((at = compact.indexOf(ct, from)) !== -1) {
      for (let k = cmap[at]; k <= cmap[at + ct.length - 1]; k++) hit[k] = true;
      from = at + ct.length;
    }
  }
  const out = [];
  let i = 0;
  while (i < src.length) {
    let j = i;
    while (j < src.length && hit[j] === hit[i]) j++;
    const piece = src.slice(i, j);
    out.push(hit[i] ? h("mark", null, piece) : piece);
    i = j;
  }
  return out;
}

/** Tạo <img> hiện ảnh nhỏ của bản ghi (tải từ IndexedDB). */
export function thumbImg(record, cls = "thumb") {
  const img = h("img", { class: cls, alt: "Ảnh: " + record.title, loading: "lazy" });
  getThumbUrl(record.id).then((u) => { if (u) img.src = u; }).catch(() => {});
  return img;
}

/** Gom các giá trị đã dùng (mã hàng, đối tượng…) và xếp theo số lần dùng giảm dần. */
export function collectValues(records, field) {
  const count = new Map();
  for (const r of records) for (const v of r[field] || []) count.set(v, (count.get(v) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}
