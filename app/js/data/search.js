// Tìm kiếm cục bộ bằng MiniSearch: không dấu, gõ sai nhẹ, khớp tiền tố.
import MiniSearch from "../../vendor/minisearch.js";
import { normalizeVi } from "../core/text.js";

const FIELD_BOOST = {
  itemCodes: 5, lotNumbers: 4, subjects: 3, situations: 3, title: 3,
  docType: 2, tags: 2, note: 1, ocrText: 1, text: 1,
};
const FIELDS = Object.keys(FIELD_BOOST);

// Mã hàng: thêm biến thể bỏ gạch/chấm/khoảng trắng (KDC-0.8 ⇒ kdc08).
function codeVariants(codes) {
  const out = [];
  for (const c of codes || []) {
    out.push(c);
    const stripped = String(c).replace(/[\s\-._/\\]+/g, "");
    if (stripped && stripped !== c) out.push(stripped);
  }
  return out.join(" ");
}

function extractField(doc, field) {
  const v = doc[field];
  if (field === "itemCodes" || field === "lotNumbers") return codeVariants(v);
  if (Array.isArray(v)) return v.join(" ");
  return v == null ? "" : String(v);
}

function create() {
  return new MiniSearch({
    idField: "id",
    fields: FIELDS,
    storeFields: ["docType", "subjects", "docDate", "createdAt"],
    extractField,
    processTerm: (term) => normalizeVi(term) || null,
    searchOptions: { boost: FIELD_BOOST, fuzzy: 0.2, prefix: true, combineWith: "AND" },
  });
}

let ms = create();
const indexed = new Set();

export function initSearch(records) {
  ms = create();
  indexed.clear();
  const live = (records || []).filter((r) => !r.deleted);
  ms.addAll(live);
  for (const r of live) indexed.add(r.id);
}

export function unindexRecord(id) {
  if (indexed.has(id)) { ms.discard(id); indexed.delete(id); }
}

export function indexRecord(record) {
  unindexRecord(record.id);
  if (record.deleted) return;
  ms.add(record);
  indexed.add(record.id);
}

// filters: { docType, subject, area, from, to }  (from/to dạng "YYYY-MM-DD", so với docDate hoặc ngày tạo)
export function search(query, { filters } = {}) {
  const q = (query || "").trim();
  if (!q) return [];
  const f = filters || {};
  const filter = (f.docType || f.subject || f.area || f.from || f.to)
    ? (r) => {
        if (f.docType && r.docType !== f.docType) return false;
        if (f.area && (r.area || "work") !== f.area) return false;
        if (f.subject && !(r.subjects || []).includes(f.subject)) return false;
        const d = r.docDate || (r.createdAt || "").slice(0, 10);
        if (f.from && d < f.from) return false;
        if (f.to && d > f.to) return false;
        return true;
      }
    : undefined;
  return ms.search(q, { filter }).map((x) => ({ id: x.id, score: x.score, match: x.match }));
}

export function suggest(query) {
  const q = (query || "").trim();
  if (!q) return [];
  return ms.autoSuggest(q).slice(0, 8).map((s) => s.suggestion);
}
