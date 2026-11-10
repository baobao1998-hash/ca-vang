// Sao lưu: xuất/nhập file JSON (kèm ảnh) và snapshot theo ngày trên Drive (giữ 30 bản).
import { SNAPSHOT_KEEP } from "../core/config.js";
import { APP_VERSION, SCHEMA_VERSION } from "../core/version.js";
import { emit } from "../core/events.js";
import { dbAll, dbGet, dbPut } from "../data/db.js";
import { migrateRecord, getFullBlob, sanitizeRecord, safeImageMime } from "../data/records.js";
import { makeThumb } from "./image.js";
import { ensureFolders, findByName, listChanged, getJson, putJsonFull, deleteFile, getMeta, setMeta } from "./drive.js";

const pad = (n) => String(n).padStart(2, "0");
export function todayStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const SNAP_RE = /^index-\d{4}-\d{2}-\d{2}\.json$/;

// ---------- Snapshot trên Drive ----------

// Ghi snapshot của hôm nay (nếu chưa có) rồi xoá bớt, chỉ giữ SNAPSHOT_KEEP bản mới nhất. Trả về tên file hoặc null.
export async function writeDailySnapshot() {
  const today = todayStr();
  if ((await getMeta("lastSnapshotDate")) === today) return null;
  const folders = await ensureFolders();
  // Chỉ đưa vào các bản ghi đã có trên Drive (để máy khác dùng được ngay).
  const records = (await dbAll("records")).map(migrateRecord)
    .filter((r) => r.sync && r.sync.driveRecordId)
    .map((r) => ({ ...r, sync: { driveRecordId: r.sync.driveRecordId } }));
  const name = `index-${today}.json`;
  const existing = (await findByName(name, folders.snapshots))[0];
  await putJsonFull(name, { app: "cavang", schema: SCHEMA_VERSION, createdAt: new Date().toISOString(), records }, folders.snapshots, existing?.id);
  await setMeta("lastSnapshotDate", today);
  const all = (await listChanged(folders.snapshots)).filter((f) => SNAP_RE.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
  for (const old of all.slice(SNAPSHOT_KEEP)) await deleteFile(old.id);
  return name;
}

// Snapshot mới nhất: { createdAt, records } hoặc null nếu chưa có.
export async function readLatestSnapshot() {
  const folders = await ensureFolders();
  const all = (await listChanged(folders.snapshots)).filter((f) => SNAP_RE.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
  for (const f of all) {
    try {
      const j = await getJson(f.id);
      if (j && Array.isArray(j.records)) return j;
    } catch (e) { if (e.code === "offline" || e.name === "AuthError") throw e; /* snapshot hỏng → thử bản trước */ }
  }
  return null;
}

// ---------- Xuất / nhập file sao lưu ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Xuất toàn bộ bản ghi + ảnh đầy đủ thành 1 file JSON. onProgress(done, total). Trả về { blob, images, missing }.
export async function exportJson({ withImages = true, onProgress } = {}) {
  const records = (await dbAll("records")).map(migrateRecord);
  const parts = [`{"app":"cavang","backupVersion":1,"appVersion":${JSON.stringify(APP_VERSION)},"schema":${SCHEMA_VERSION},"exportedAt":${JSON.stringify(new Date().toISOString())},"records":`,
    JSON.stringify(records), ',"images":{'];
  let images = 0, missing = 0, first = true, done = 0;
  if (withImages) {
    for (const r of records) {
      if (r.kind === "image") {
        let full = null;
        try { full = await getFullBlob(r.id); } catch { /* bỏ qua */ }
        if (full) {
          parts.push((first ? "" : ",") + JSON.stringify(r.id) + ":" + JSON.stringify({ type: full.type || "image/jpeg", data: await blobToBase64(full) }));
          first = false; images++;
        } else missing++;
      }
      onProgress?.(++done, records.length);
    }
  }
  parts.push("}}");
  return { blob: new Blob(parts, { type: "application/json" }), images, missing, records: records.length };
}

// Nhập file sao lưu: bản ghi nào mới hơn (updatedAt) thì thắng. Bản ghi nhập vào sẽ tự đồng bộ lên Drive.
export async function importJson(file, { onProgress } = {}) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error("File này không đọc được. Hãy chọn đúng file sao lưu Cá Vàng (.json)."); }
  if (!data || data.app !== "cavang" || !Array.isArray(data.records)) throw new Error("Đây không phải file sao lưu của Cá Vàng.");
  if (typeof data.schema === "number" && data.schema > SCHEMA_VERSION) throw new Error("File sao lưu này tạo bởi bản Cá Vàng mới hơn. Hãy cập nhật app rồi nhập lại.");
  if (data.records.length > 200000) throw new Error("File sao lưu có quá nhiều bản ghi nên không nhập được.");
  const images = data.images && typeof data.images === "object" && !Array.isArray(data.images) ? data.images : {};
  let added = 0, updated = 0, skipped = 0, n = 0;
  for (const raw of data.records) {
    onProgress?.(++n, data.records.length);
    const clean = sanitizeRecord(raw); // bỏ trường lạ, ép kiểu, cắt độ dài, từ chối id lạ
    if (!clean) { skipped++; continue; }
    const rec = migrateRecord(clean);
    const local = await dbGet("records", rec.id);
    if (local && Date.parse(local.updatedAt) >= Date.parse(rec.updatedAt)) { skipped++; continue; }
    rec.sync = { driveRecordId: local?.sync?.driveRecordId || null, dirty: true, lastSyncedAt: null };
    const img = Object.hasOwn(images, rec.id) ? images[rec.id] : null;
    if (img && typeof img.data === "string" && img.data.length <= 60e6 && rec.kind === "image") {
      let full = null;
      try { full = base64ToBlob(img.data, safeImageMime(img.type)); } catch { /* ảnh hỏng: nhập bản ghi, bỏ ảnh */ }
      if (full) {
        let thumb;
        try { thumb = await makeThumb(full); } catch { thumb = undefined; }
        if (rec.file) rec.file = { ...rec.file, driveId: null, thumbDriveId: null }; // ảnh sẽ được tải lên Drive lần đồng bộ tới
        await dbPut("blobs", { id: rec.id, full, thumb });
      }
    }
    await dbPut("records", rec);
    await dbPut("outbox", { id: rec.id, op: "put", recordId: rec.id, tries: 0 });
    emit(rec.deleted ? "record:deleted" : "record:saved", rec.deleted ? { id: rec.id } : { record: rec });
    local ? updated++ : added++;
  }
  return { added, updated, skipped };
}
