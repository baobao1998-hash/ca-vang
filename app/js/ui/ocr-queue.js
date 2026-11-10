// Hàng đợi đọc chữ: các bằng chứng có ocrStatus "pending" (lúc đó mất mạng/hết hạn mức) được đọc lại khi có mạng.
import { listRecords, getRecord, saveRecord, getFullBlob } from "../data/records.js";
import { analyzeImage, analyzeText, hasKey, isRetryable } from "../services/gemini.js";
import { rememberDocType } from "./common.js";
import { toast } from "./dom.js";

let started = false;
let running = false;

const isAutoTitle = (r) => !r.title || /^Ảnh ngày /.test(r.title) || (r.file?.originalName && r.title.startsWith(r.file.originalName.replace(/\.[^.]+$/, "")));

/** Chỉ điền vào ô còn trống (không ghi đè điều người dùng đã nhập). */
export function fillEmpty(r, a) {
  const patch = {};
  if (isAutoTitle(r) && a.title) patch.title = a.title;
  if ((!r.docType || r.docType === "Khác") && a.docType && a.docType !== "Khác") { patch.docType = a.docType; rememberDocType(a.docType); if (a.area) patch.area = a.area; }
  if (!r.docDate && a.docDate) patch.docDate = a.docDate;
  for (const f of ["itemCodes", "lotNumbers", "subjects", "situations"]) {
    if (!(r[f] || []).length && a[f]?.length) patch[f] = a[f];
  }
  return patch;
}

export async function pendingCount() {
  try { return (await listRecords()).filter((r) => r.ocrStatus === "pending").length; } catch { return 0; }
}

/**
 * Đọc lại các bằng chứng chưa đọc. includeError: cả những cái từng báo lỗi (nút "Đọc lại" trong Cài đặt).
 * Trả về { done, left, error? } — dừng ngay khi gặp lỗi tạm thời (mất mạng/hết hạn mức) để thử lại sau.
 */
export async function runOcrQueue({ includeError = false } = {}) {
  if (running || !hasKey()) return { done: 0, left: 0 };
  running = true;
  let done = 0, left = 0, error = null;
  try {
    const todo = (await listRecords()).filter((r) => r.ocrStatus === "pending" || (includeError && r.ocrStatus === "error"));
    left = todo.length;
    for (const r of todo) {
      try {
        let a;
        if (r.kind === "text") a = await analyzeText(r.text || "");
        else {
          const blob = await getFullBlob(r.id);
          if (!blob) { await saveRecord({ id: r.id, ocrStatus: "error" }); left--; continue; }
          a = await analyzeImage(blob);
        }
        const fresh = (await getRecord(r.id)) || r; // người dùng có thể vừa sửa trong lúc chờ
        await saveRecord({ id: r.id, ...fillEmpty(fresh, a), ...(r.kind === "image" ? { ocrText: a.ocrText } : {}), ocrStatus: "done" });
        done++; left--;
      } catch (err) {
        error = err;
        if (isRetryable(err)) break; // thử lại sau, giữ "pending"
        await saveRecord({ id: r.id, ocrStatus: "error" });
        left--;
        if (err.code === "BAD_KEY" || err.code === "MODEL" || err.code === "NO_KEY") break;
      }
    }
  } catch (err) { console.error(err); error = err; }
  finally { running = false; }
  return { done, left, error };
}

/** Bật tự thử lại: khi có mạng trở lại, và mỗi 3 phút nếu còn việc chờ. Gọi nhiều lần cũng chỉ bật một lần. */
export function startOcrQueue() {
  if (started) return;
  started = true;
  const tick = async (quiet) => {
    if (!navigator.onLine) return;
    const r = await runOcrQueue();
    if (r.done && !quiet) toast(`Đã đọc chữ xong ${r.done} bằng chứng đang chờ`);
  };
  window.addEventListener("online", () => tick(false));
  setInterval(() => tick(true), 180000);
  setTimeout(() => tick(false), 4000);
}
