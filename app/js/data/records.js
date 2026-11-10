// CRUD bản ghi bằng chứng: gọi db + phát sự kiện.
import { SCHEMA_VERSION } from "../core/version.js";
import { TRASH_DAYS } from "../core/config.js";
import { newId } from "../core/ids.js";
import { emit } from "../core/events.js";
import { dbGet, dbPut, dbDelete, dbAll } from "./db.js";

const thumbUrls = new Map();

// Chuyển bản ghi cũ lên cấu trúc mới khi đọc (schema 1 → 2: thêm area, mặc định "work"). Không ghi lại cho tới khi bản ghi được lưu.
export function migrateRecord(r) {
  if (r && !r.area) r.area = "work";
  return r;
}

function blankRecord() {
  const now = new Date().toISOString();
  return {
    id: newId(), schema: SCHEMA_VERSION, kind: "text",
    createdAt: now, updatedAt: now, deleted: false,
    title: "", docType: "Khác", area: "work", itemCodes: [], lotNumbers: [], subjects: [], situations: [],
    note: "", tags: [], docDate: "",
    text: "", ocrText: "", ocrStatus: "none",
    file: null,
    sync: { driveRecordId: null, dirty: true, lastSyncedAt: null },
  };
}

// Tạo mới hoặc cập nhật. opts.blob = { full: Blob, thumb: Blob } (do nơi gọi truyền vào).
export async function saveRecord(partial, opts = {}) {
  const existing = partial.id ? migrateRecord(await dbGet("records", partial.id)) : null;
  const base = existing || blankRecord();
  const now = new Date().toISOString();
  const record = {
    ...base, ...partial,
    id: base.id, schema: SCHEMA_VERSION,
    createdAt: base.createdAt, updatedAt: now,
    sync: { ...base.sync, ...(partial.sync || {}), dirty: true },
  };
  const blob = opts.blob;
  if (blob && (blob.full || blob.thumb)) {
    record.kind = "image";
    await dbPut("blobs", { id: record.id, full: blob.full, thumb: blob.thumb });
    revokeThumb(record.id);
  }
  await dbPut("records", record);
  await dbPut("outbox", { id: record.id, op: "put", recordId: record.id, tries: 0 });
  emit("record:saved", { record });
  return record;
}

export const getRecord = async (id) => migrateRecord(await dbGet("records", id));

export async function listRecords({ includeDeleted = false } = {}) {
  const all = (await dbAll("records")).map(migrateRecord);
  return includeDeleted ? all : all.filter((r) => !r.deleted);
}

async function setDeleted(id, deleted) {
  const rec = await dbGet("records", id);
  if (!rec) return null;
  // Lưu ý: updatedAt chính là thời điểm xoá (dùng để tính 30 ngày thùng rác).
  rec.deleted = deleted;
  rec.updatedAt = new Date().toISOString();
  rec.sync = { ...rec.sync, dirty: true };
  await dbPut("records", rec);
  await dbPut("outbox", { id, op: "put", recordId: id, tries: 0 });
  return rec;
}

export async function softDelete(id) {
  const rec = await setDeleted(id, true);
  if (rec) emit("record:deleted", { id });
  return rec;
}

export async function restore(id) {
  const rec = await setDeleted(id, false);
  if (rec) emit("record:saved", { record: rec });
  return rec;
}

// Xoá hẳn các bản ghi nằm trong thùng rác quá `days` ngày. Trả về số bản ghi đã xoá.
export async function purgeOld(days = TRASH_DAYS) {
  const limit = Date.now() - days * 86400000;
  const all = await dbAll("records");
  let count = 0;
  for (const r of all) {
    if (r.deleted && new Date(r.updatedAt).getTime() < limit) {
      await dbDelete("records", r.id);
      await dbDelete("blobs", r.id);
      await dbPut("outbox", { id: r.id, op: "delete", recordId: r.id, tries: 0 });
      revokeThumb(r.id);
      count++;
    }
  }
  return count;
}

function revokeThumb(id) {
  const url = thumbUrls.get(id);
  if (url) { URL.revokeObjectURL(url); thumbUrls.delete(id); }
}

export async function getThumbUrl(id) {
  if (thumbUrls.has(id)) return thumbUrls.get(id);
  const b = await dbGet("blobs", id);
  if (!b || !b.thumb) return null;
  const url = URL.createObjectURL(b.thumb);
  thumbUrls.set(id, url);
  return url;
}

// Thiết bị mới chỉ có ảnh nhỏ; ảnh đầy đủ tải từ Drive khi cần xem. sync.js đăng ký hàm tải này.
let fullLoader = null;
export function setFullLoader(fn) { fullLoader = fn; }

export async function getFullBlob(id) {
  const b = await dbGet("blobs", id);
  if (b && b.full) return b.full;
  return fullLoader ? fullLoader(id) : null;
}
