// Gọi Google Drive API v3 bằng fetch. Lỗi luôn là DriveError/AuthError với thông báo tiếng Việt.
import { DRIVE_ROOT_NAME, DRIVE_SUBFOLDERS } from "../core/config.js";
import { getToken, invalidateToken, AuthError } from "./auth.js";
import { dbGet, dbPut } from "../data/db.js";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveError extends Error {
  // code: "offline" | "quota" | "notfound" | "api-off" | "server" | "other"
  constructor(message, code, status) { super(message); this.name = "DriveError"; this.code = code; this.status = status; }
}

// ---- Bộ nhớ nhỏ trong kho "meta" (IndexedDB) ----
export async function getMeta(key, fallback = null) {
  const row = await dbGet("meta", key);
  return row ? row.value : fallback;
}
export const setMeta = (key, value) => dbPut("meta", { key, value });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function request(url, init = {}) {
  let authRetried = false;
  for (let attempt = 0; ; attempt++) {
    const tk = await getToken();
    let res;
    try {
      res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + tk } });
    } catch {
      throw new DriveError("Không kết nối được tới Google Drive. Kiểm tra mạng rồi thử lại.", "offline");
    }
    if (res.ok) return res;
    if (res.status === 401) {
      if (!authRetried) { authRetried = true; invalidateToken(); continue; }
      throw new AuthError("Phiên đăng nhập Google đã hết hạn. Hãy đăng nhập lại.", "expired");
    }
    let reason = "";
    try { const j = await res.json(); reason = j?.error?.errors?.[0]?.reason || j?.error?.status || ""; } catch { /* không có nội dung */ }
    const rate = res.status === 429 || reason === "rateLimitExceeded" || reason === "userRateLimitExceeded";
    if ((rate || res.status >= 500) && attempt < 3) { await sleep(800 * 2 ** attempt); continue; }
    if (res.status === 404) throw new DriveError("Không tìm thấy file trên Google Drive.", "notfound", 404);
    if (reason === "storageQuotaExceeded") throw new DriveError("Google Drive của bạn đã đầy dung lượng.", "quota", res.status);
    if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED") throw new DriveError("Google Drive API chưa được bật trong dự án Google Cloud.", "api-off", res.status);
    if (res.status === 403) {
      if (rate) throw new DriveError("Google đang giới hạn tốc độ. Thử lại sau ít phút.", "server", res.status);
      throw new AuthError("Google không cho phép truy cập Drive. Hãy đăng xuất rồi đăng nhập lại, nhớ tích đủ các ô cho phép.", "forbidden");
    }
    throw new DriveError(`Google Drive báo lỗi (${res.status}). Thử lại sau.`, res.status >= 500 ? "server" : "other", res.status);
  }
}

async function listFiles(q, fields = "id,name,modifiedTime,createdTime", { orderBy } = {}) {
  const out = [];
  let pageToken = "";
  do {
    const p = new URLSearchParams({ q, fields: `nextPageToken,files(${fields})`, pageSize: "1000", spaces: "drive" });
    if (orderBy) p.set("orderBy", orderBy);
    if (pageToken) p.set("pageToken", pageToken);
    const j = await (await request(`${API}/files?${p}`)).json();
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return out;
}

// ---- Thư mục ----
const folderMemo = new Map();
let verifiedRoot = null;

function findOrCreateFolder(name, parentId) {
  const key = parentId + "/" + name;
  if (folderMemo.has(key)) return folderMemo.get(key);
  const p = (async () => {
    const q = `name='${esc(name)}' and mimeType='${FOLDER_MIME}' and trashed=false and '${parentId}' in parents`;
    const found = await listFiles(q, "id,createdTime", { orderBy: "createdTime" });
    if (found.length) return found[0].id; // nếu 2 thiết bị cùng tạo, lấy thư mục cũ nhất
    const res = await request(`${API}/files?fields=id`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return (await res.json()).id;
  })();
  folderMemo.set(key, p);
  p.catch(() => folderMemo.delete(key));
  return p;
}

export function forgetFolders() { folderMemo.clear(); verifiedRoot = null; return setMeta("driveFolderIds", null); }

// -> { root, files, records, snapshots }
export async function ensureFolders() {
  const cached = await getMeta("driveFolderIds");
  if (cached && cached.root) {
    if (verifiedRoot === cached.root) return cached;
    try {
      const j = await (await request(`${API}/files/${cached.root}?fields=id,trashed`)).json();
      if (!j.trashed) { verifiedRoot = cached.root; return cached; }
    } catch (e) { if (e.code !== "notfound") throw e; }
    folderMemo.clear();
  }
  const root = await findOrCreateFolder(DRIVE_ROOT_NAME, "root");
  const [files, records, snapshots] = await Promise.all(
    [DRIVE_SUBFOLDERS.files, DRIVE_SUBFOLDERS.records, DRIVE_SUBFOLDERS.snapshots].map((n) => findOrCreateFolder(n, root)));
  const ids = { root, files, records, snapshots };
  await setMeta("driveFolderIds", ids);
  verifiedRoot = root;
  return ids;
}

// Thư mục con theo tháng "YYYY-MM" trong files/
export function monthFolder(filesId, ym) { return findOrCreateFolder(ym, filesId); }

// ---- File ----
function multipart(meta, blob) {
  const b = "cavang" + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify(meta),
    `\r\n--${b}\r\nContent-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`, blob, `\r\n--${b}--`,
  ]);
  return { body, headers: { "Content-Type": `multipart/related; boundary=${b}` } };
}

// Tạo mới, hoặc ghi đè nếu có existingId (nếu file cũ đã mất thì tạo lại). -> { id, modifiedTime }
async function upload(blob, name, parentId, existingId) {
  if (existingId) {
    const { body, headers } = multipart({ name }, blob);
    try {
      return await (await request(`${UPLOAD}/files/${existingId}?uploadType=multipart&fields=id,modifiedTime`, { method: "PATCH", headers, body })).json();
    } catch (e) { if (e.code !== "notfound") throw e; }
  }
  const { body, headers } = multipart({ name, parents: [parentId] }, blob);
  return (await request(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, { method: "POST", headers, body })).json();
}

export async function uploadFile(blob, name, parentId, existingId) { return (await upload(blob, name, parentId, existingId)).id; }
export const uploadFileFull = upload;

export async function downloadFile(driveId) {
  return (await request(`${API}/files/${driveId}?alt=media`)).blob();
}

export function putJsonFull(name, obj, parentId, existingId) {
  return upload(new Blob([JSON.stringify(obj)], { type: "application/json" }), name, parentId, existingId);
}
export async function putJson(name, obj, parentId, existingId) { return (await putJsonFull(name, obj, parentId, existingId)).id; }

export async function getJson(driveId) { return (await request(`${API}/files/${driveId}?alt=media`)).json(); }

// Các file trong thư mục `parentId` có modifiedTime > sinceIso (không truyền = tất cả).
export function listChanged(parentId, sinceIso) {
  let q = `'${parentId}' in parents and trashed=false`;
  if (sinceIso) q += ` and modifiedTime > '${sinceIso}'`;
  return listFiles(q, "id,name,modifiedTime");
}

// Tìm file theo tên (trong 1 thư mục nếu có parentId, không thì trong mọi file app đã tạo).
export function findByName(name, parentId) {
  let q = `name='${esc(name)}' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  return listFiles(q, "id,name,modifiedTime", { orderBy: "createdTime" });
}

export async function deleteFile(driveId) {
  try { await request(`${API}/files/${driveId}`, { method: "DELETE" }); }
  catch (e) { if (e.code !== "notfound") throw e; }
}

export async function driveExists(driveId) {
  try { const j = await (await request(`${API}/files/${driveId}?fields=id,trashed`)).json(); return !j.trashed; }
  catch (e) { if (e.code === "notfound") return false; throw e; }
}
