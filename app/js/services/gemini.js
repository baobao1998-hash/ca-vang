// Gọi Gemini (REST, fetch) để đọc chữ trên ảnh / phân tích văn bản và gợi ý các ô thông tin.
// Key do người dùng nhập ở Cài đặt, chỉ lưu trên máy (localStorage). KHÔNG ghi key vào code.
import { getSetting } from "../data/settings.js";
import { normalizeVi } from "../core/text.js";
import { DOC_TYPES, CUSTOM_DOCTYPES_KEY, GEMINI_DEFAULT_MODEL, GEMINI_TIMEOUT_MS } from "../core/config.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Lỗi có mã để giao diện quyết định (thử lại / báo người dùng). */
export class GeminiError extends Error {
  constructor(code, message) { super(message); this.name = "GeminiError"; this.code = code; }
}
// Lỗi tạm thời → nên để "pending" và thử lại sau.
export const isRetryable = (err) => ["NETWORK", "TIMEOUT", "QUOTA", "SERVER"].includes(err?.code);

export const getKey = () => String(getSetting("geminiKey", "") || "").trim();
export const getModel = () => String(getSetting("geminiModel", "") || "").trim() || GEMINI_DEFAULT_MODEL;
export const hasKey = () => !!getKey();

const MSG = {
  NO_KEY: "Chưa có key Gemini. Vào Cài đặt để dán key.",
  BAD_KEY: "Key Gemini không đúng hoặc đã bị tắt. Vào Cài đặt kiểm tra lại key.",
  QUOTA: "Đã dùng hết hạn mức miễn phí của Gemini (tạm thời). Hãy thử lại sau ít phút hoặc sang ngày mai.",
  NETWORK: "Không có mạng hoặc không kết nối được tới Gemini.",
  TIMEOUT: "Gemini trả lời quá lâu (quá 30 giây). Sẽ thử lại sau.",
  SERVER: "Máy chủ Gemini đang bận hoặc lỗi. Sẽ thử lại sau.",
  MODEL: "Tên model không đúng hoặc không còn dùng được. Vào Cài đặt chọn model khác.",
  BLOCKED: "Gemini từ chối đọc nội dung này.",
  BAD_RESPONSE: "Gemini trả về kết quả khó hiểu. Hãy thử lại.",
};
const fail = (code, extra) => new GeminiError(code, extra ? `${MSG[code]} (${extra})` : MSG[code]);

/** Gọi REST có timeout; chuyển lỗi HTTP/mạng thành GeminiError tiếng Việt. */
async function call(path, { key, method = "GET", body } = {}) {
  const k = key ?? getKey();
  if (!k) throw fail("NO_KEY");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BASE + path, {
      method, signal: ctrl.signal,
      headers: { "x-goog-api-key": k, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw err?.name === "AbortError" ? fail("TIMEOUT") : fail("NETWORK");
  } finally { clearTimeout(timer); }

  if (res.ok) {
    try { return await res.json(); } catch { throw fail("BAD_RESPONSE"); }
  }
  let detail = "";
  try { detail = (await res.json())?.error?.message || ""; } catch { /* bỏ qua */ }
  const d = detail.toLowerCase();
  if (res.status === 429) throw fail("QUOTA");
  if (res.status === 401 || res.status === 403 || (res.status === 400 && (d.includes("api key") || d.includes("api_key")))) throw fail("BAD_KEY");
  if (res.status === 404) throw fail("MODEL");
  if (res.status >= 500) throw fail("SERVER");
  throw fail("BAD_RESPONSE", `HTTP ${res.status}`);
}

/**
 * Kiểm tra key (và model đang chọn) mà không tốn hạn mức đọc ảnh.
 * true = ổn · false = key sai · ném GeminiError nếu mất mạng / hết hạn mức / model sai.
 */
export async function testKey(key, model = getModel()) {
  try {
    await call(`/models/${encodeURIComponent(model)}`, { key: String(key || "").trim() });
    return true;
  } catch (err) {
    if (err.code === "BAD_KEY" || err.code === "NO_KEY") return false;
    throw err;
  }
}

// ---------- Phân tích ----------

const SCHEMA = {
  type: "object",
  properties: {
    ocrText: { type: "string", description: "Toàn bộ chữ đọc được trên ảnh, giữ xuống dòng" },
    title: { type: "string", description: "Tiêu đề ngắn gọn, dễ tìm" },
    docType: { type: "string" },
    area: { type: "string", enum: ["work", "personal"], description: "work = công việc, personal = cá nhân/gia đình" },
    docDate: { type: "string", description: "Ngày trên giấy tờ dạng YYYY-MM-DD, không có thì để chuỗi rỗng" },
    itemCodes: { type: "array", items: { type: "string" } },
    lotNumbers: { type: "array", items: { type: "string" } },
    subjects: { type: "array", items: { type: "string" } },
    situations: { type: "array", items: { type: "string" } },
  },
  required: ["ocrText", "title", "docType", "area", "docDate", "itemCodes", "lotNumbers", "subjects", "situations"],
};

function docTypeList() {
  const custom = getSetting(CUSTOM_DOCTYPES_KEY, []);
  return [...new Set([...DOC_TYPES, ...(Array.isArray(custom) ? custom : [])])];
}

function buildPrompt(isImage) {
  const types = docTypeList().join(", ");
  return [
    isImage ? "Đây là ảnh một giấy tờ, tài liệu, đơn hàng, tin nhắn hoặc ảnh chụp màn hình (tiếng Việt hoặc tiếng Anh). Người dùng lưu để tìm lại sau, cho cả công việc lẫn đời sống cá nhân. Hãy đọc kỹ rồi trả về JSON." : "Đây là một đoạn văn bản (email, tin nhắn, tài liệu). Người dùng lưu để tìm lại sau, cho cả công việc lẫn đời sống cá nhân. Hãy phân tích rồi trả về JSON.",
    isImage ? "- ocrText: chép lại toàn bộ chữ đọc được, giữ xuống dòng, không bịa thêm." : "- ocrText: luôn để chuỗi rỗng.",
    "- title: tiêu đề ngắn (dưới 80 ký tự) nêu rõ đây là gì, dựa đúng vào nội dung thấy được.",
    `- docType: chọn ĐÚNG MỘT loại trong danh sách theo nội dung: ${types}. Chỉ chọn "Ảnh chụp màn hình" khi không xác định được loại cụ thể hơn. Nếu không loại nào hợp, đề xuất một tên loại mới ngắn gọn (tiếng Việt, tối đa 4 từ).`,
    "- area: \"work\" nếu liên quan công việc/kinh doanh/học tập nghề nghiệp, \"personal\" nếu là việc riêng, mua sắm cá nhân, gia đình, giấy tờ tuỳ thân. Không chắc thì chọn \"work\".",
    "- docDate: ngày ghi trên giấy tờ (không phải hôm nay), định dạng YYYY-MM-DD. Không thấy thì để rỗng. Ngày Việt Nam viết ngày/tháng/năm.",
    "- itemCodes: mã hàng, mã sản phẩm, model, mã đơn hàng, số hoá đơn / số chứng từ có trong nội dung; giữ nguyên cách viết.",
    "- lotNumbers: số lô (LOT, Batch), nếu có.",
    "- subjects: người, cửa hàng, công ty hoặc tổ chức liên quan (người bán, người mua, khách hàng, nhà cung cấp, cơ quan ban hành), ghi đúng tên như trong nội dung.",
    "- situations: CHỈ đề xuất khi suy ra được rõ việc này dùng cho gì; không chắc thì để mảng rỗng.",
    "Chỉ dùng thông tin thấy được trong nội dung. Không có thì để chuỗi rỗng hoặc mảng rỗng. Không đoán bừa, không lấy ví dụ nào làm dữ liệu.",
  ].join("\n");
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(new Error("Không đọc được file ảnh."));
    fr.readAsDataURL(blob);
  });
}

const cleanList = (v) => {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const x of v) {
    const s = String(x ?? "").trim().slice(0, 120);
    const k = s.toLowerCase();
    if (s && !seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out.slice(0, 12);
};

function cleanDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || "").trim());
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const ok = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  return ok && +m[1] >= 1990 && +m[1] <= 2100 ? m[0] : "";
}

/** Đưa loại giấy tờ về đúng tên trong danh mục (không phân biệt dấu/hoa thường); loại mới giữ nguyên. */
function cleanDocType(v) {
  const s = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!s) return "Khác";
  const hit = docTypeList().find((t) => normalizeVi(t) === normalizeVi(s));
  return hit || s;
}

function normalize(raw, isImage) {
  return {
    ocrText: isImage ? String(raw.ocrText ?? "").slice(0, 30000) : "",
    title: String(raw.title ?? "").trim().slice(0, 120),
    docType: cleanDocType(raw.docType),
    itemCodes: cleanList(raw.itemCodes),
    lotNumbers: cleanList(raw.lotNumbers),
    subjects: cleanList(raw.subjects),
    situations: cleanList(raw.situations),
    docDate: cleanDate(raw.docDate),
    area: raw.area === "personal" ? "personal" : "work",
  };
}

async function generate(parts, isImage) {
  const data = await call(`/models/${encodeURIComponent(getModel())}:generateContent`, {
    method: "POST",
    body: {
      contents: [{ role: "user", parts: [...parts, { text: buildPrompt(isImage) }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: SCHEMA },
    },
  });
  const cand = data?.candidates?.[0];
  if (!cand) throw fail("BLOCKED");
  const text = (cand.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw fail(cand.finishReason && cand.finishReason !== "STOP" ? "BLOCKED" : "BAD_RESPONSE");
  let raw;
  try { raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { throw fail("BAD_RESPONSE"); }
  if (!raw || typeof raw !== "object") throw fail("BAD_RESPONSE");
  return normalize(raw, isImage);
}

/** Đọc chữ + gợi ý thông tin từ ảnh (đã nén). */
export async function analyzeImage(blob) {
  const data = await blobToBase64(blob);
  return generate([{ inlineData: { mimeType: blob.type || "image/jpeg", data } }], true);
}

/** Phân tích đoạn văn bản dán vào (ocrText luôn rỗng). */
export async function analyzeText(text) {
  return generate([{ text: "VĂN BẢN:\n" + String(text).slice(0, 20000) }], false);
}
