// Đồng bộ IndexedDB ⇄ Google Drive. Mỗi bản ghi = 1 file records/<id>.json; ảnh ở files/YYYY-MM/<id>.jpg (+ <id>.thumb.jpg).
// Bản có updatedAt mới hơn thắng. Thay đổi trên máy đi qua "outbox"; mất mạng thì giữ lại và đẩy sau.
const POLL_MS = 60 * 1000; // nhịp kiểm tra khi app đang mở
import { on, emit } from "../core/events.js";
import { dbGet, dbPut, dbDelete, dbAll } from "../data/db.js";
import { migrateRecord, setFullLoader, sanitizeRecord, safeDriveId } from "../data/records.js";
import { isSignedIn, wasSignedIn, getToken, renewQuietly, preloadGis, needsRenewal, AuthError } from "./auth.js";
import {
  ensureFolders, forgetFolders, monthFolder, uploadFileFull, downloadFile, putJsonFull, getJson,
  listChanged, findByName, deleteFile, driveExists, getMeta, setMeta,
} from "./drive.js";
import { writeDailySnapshot, readLatestSnapshot } from "./backup.js";

const OVERLAP_MS = 2000;

// ---------- Trạng thái (cho chấm màu + màn Cài đặt) ----------
// state: "off" chưa kết nối · "idle" đã đồng bộ · "syncing" · "offline" chờ mạng · "auth" cần đăng nhập lại · "error"
let status = { state: "off", message: "Chưa kết nối Google Drive" };
export const getStatus = () => status;
function setStatus(state, message) {
  status = { state, message };
  emit("sync:status", status);
}

export async function getSyncInfo() {
  return { pending: (await dbAll("outbox")).length, lastOkAt: await getMeta("lastSyncOkAt") };
}

const pool = async (items, n, fn) => {
  let i = 0;
  const worker = async () => { while (i < items.length) { const item = items[i++]; await fn(item); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
};

// ---------- Kéo về ----------

// Ghi 1 bản ghi từ Drive vào máy nếu nó thắng. Trả về true nếu có ghi.
async function applyRemote(rawRemote, driveId, modifiedTime) {
  const remote = sanitizeRecord(rawRemote); // dữ liệu từ Drive cũng phải qua kiểm tra như file nhập
  if (!remote) return false;
  driveId = safeDriveId(driveId);
  const local = migrateRecord(await dbGet("records", remote.id));
  const rt = Date.parse(remote.updatedAt);
  if (local) {
    const lt = Date.parse(local.updatedAt);
    if (lt >= rt) {
      // Bản trên máy mới hơn hoặc bằng: giữ nguyên, chỉ ghi nhớ id file Drive nếu chưa có.
      if (!local.sync?.driveRecordId) {
        await dbPut("records", { ...local, sync: { ...local.sync, driveRecordId: driveId, driveModified: modifiedTime } });
      }
      return false;
    }
  }
  const rec = migrateRecord({ ...remote });
  // Ảnh nhỏ tải sẵn; ảnh đầy đủ chỉ tải khi cần xem.
  if (rec.kind === "image" && rec.file) {
    const prev = await dbGet("blobs", rec.id);
    const sameFull = prev?.full && local?.file?.driveId === rec.file.driveId;
    let thumb = prev?.thumb;
    if (rec.file.thumbDriveId && (!thumb || local?.file?.thumbDriveId !== rec.file.thumbDriveId)) {
      try { thumb = await downloadFile(rec.file.thumbDriveId); } catch (e) { if (e.code === "offline" || e instanceof AuthError) throw e; }
    }
    await dbPut("blobs", { id: rec.id, full: sameFull ? prev.full : undefined, thumb });
  }
  rec.sync = { driveRecordId: driveId || local?.sync?.driveRecordId || null, dirty: false, lastSyncedAt: new Date().toISOString(), driveModified: modifiedTime };
  await dbPut("records", rec);
  await dbDelete("outbox", rec.id); // bản trên Drive mới hơn → bỏ thay đổi cũ chờ đẩy
  if (rec.deleted) emit("record:deleted", { id: rec.id, remote: true });
  else emit("record:saved", { record: rec, remote: true });
  return true;
}

async function pull(folders, progress) {
  let since = await getMeta("lastPullAt");
  let pulled = 0;
  if (!since) {
    // Thiết bị mới: tải snapshot mới nhất trước, rồi chỉ lấy phần chênh sau đó.
    const snap = await readLatestSnapshot();
    if (snap) {
      snap.records = snap.records.slice(0, 200000);
      let n = 0;
      await pool(snap.records, 6, async (r) => {
        if (await applyRemote(r, r?.sync?.driveRecordId, undefined)) pulled++;
        progress?.(`Đang tải dữ liệu về… ${++n}/${snap.records.length}`);
      });
      const t = Date.parse(snap.createdAt);
      if (!Number.isNaN(t)) since = new Date(t - 10 * 60000).toISOString();
    }
  }
  const files = (await listChanged(folders.records, since)).filter((f) => f.name.endsWith(".json"));
  let maxMod = since || "";
  let n = 0;
  const todo = [];
  for (const f of files) {
    if (f.modifiedTime > maxMod) maxMod = f.modifiedTime;
    const id = f.name.slice(0, -5);
    const local = await dbGet("records", id);
    if (local?.sync?.driveModified === f.modifiedTime) continue; // chính máy này vừa đẩy lên
    todo.push(f);
  }
  await pool(todo, 6, async (f) => {
    const remote = await getJson(f.id);
    if (await applyRemote(remote, f.id, f.modifiedTime)) pulled++;
    progress?.(`Đang tải dữ liệu về… ${++n}/${todo.length}`);
  });
  if (maxMod) await setMeta("lastPullAt", new Date(Date.parse(maxMod) - OVERLAP_MS).toISOString());
  return pulled;
}

// ---------- Đẩy lên ----------

async function enqueueDirty(all) {
  const queued = new Set((await dbAll("outbox")).map((o) => o.id));
  for (const r of await dbAll("records")) {
    if ((all || r.sync?.dirty) && !queued.has(r.id)) await dbPut("outbox", { id: r.id, op: "put", recordId: r.id, tries: 0 });
  }
}

async function pushOne(entry, folders, fullPush) {
  if (entry.op === "delete") {
    for (const f of await findByName(entry.recordId + ".json", folders.records)) await deleteFile(f.id);
    for (const nm of [entry.recordId + ".jpg", entry.recordId + ".thumb.jpg"]) for (const f of await findByName(nm)) await deleteFile(f.id);
    await dbDelete("outbox", entry.id);
    return;
  }
  const rec = migrateRecord(await dbGet("records", entry.recordId));
  if (!rec) { await dbDelete("outbox", entry.id); return; }
  const stamp = rec.updatedAt;
  let file = rec.file ? { ...rec.file } : null;

  if (rec.kind === "image" && file) {
    const blobs = await dbGet("blobs", rec.id);
    const ym = rec.createdAt.slice(0, 7);
    const needs = async (id) => !id || (fullPush && !(await driveExists(id)));
    if (blobs?.full && (await needs(file.driveId))) {
      file.driveId = (await uploadFileFull(blobs.full, rec.id + ".jpg", await monthFolder(folders.files, ym))).id;
    }
    if (blobs?.thumb && (await needs(file.thumbDriveId))) {
      file.thumbDriveId = (await uploadFileFull(blobs.thumb, rec.id + ".thumb.jpg", await monthFolder(folders.files, ym))).id;
    }
  }

  const body = { ...rec, file };
  delete body.sync;
  let existing = rec.sync?.driveRecordId;
  if (!existing) existing = (await findByName(rec.id + ".json", folders.records))[0]?.id;
  const res = await putJsonFull(rec.id + ".json", body, folders.records, existing);

  const fresh = migrateRecord(await dbGet("records", rec.id));
  if (!fresh) return;
  const unchanged = fresh.updatedAt === stamp;
  const next = {
    ...fresh,
    file: fresh.file ? { ...fresh.file, driveId: file?.driveId ?? fresh.file.driveId, thumbDriveId: file?.thumbDriveId ?? fresh.file.thumbDriveId } : fresh.file,
    sync: { ...fresh.sync, driveRecordId: res.id, driveModified: res.modifiedTime, ...(unchanged ? { dirty: false, lastSyncedAt: new Date().toISOString() } : {}) },
  };
  await dbPut("records", next);
  if (unchanged) await dbDelete("outbox", entry.id);
}

// ---------- Vòng đồng bộ ----------

let running = null;
let again = false;

const isNetworkOrAuth = (e) => e instanceof AuthError || e?.code === "offline";

async function doSync(manual) {
  if (!navigator.onLine) { setStatus("offline", "Đang mất mạng — thay đổi sẽ tự đẩy lên khi có mạng."); requestBackgroundSync(); return { pushed: 0, pulled: 0 }; }
  if (!isSignedIn()) {
    if (!manual) {
      if (wasSignedIn()) setStatus("auth", "Cần đăng nhập lại Google — chạm vào chấm trạng thái hoặc nút Đăng nhập lại.");
      else setStatus("off", "Chưa kết nối Google Drive");
      return { pushed: 0, pulled: 0 };
    }
    try { await getToken({ interactive: true }); } catch (e) { setStatus("auth", e.message); throw e; }
  }
  setStatus("syncing", "Đang đồng bộ…");
  let pushed = 0, pulled = 0, failed = 0, lastErr = null;
  try {
    const folders = await ensureFolders();
    const firstTime = !(await getMeta("connected"));
    pulled = await pull(folders, (m) => setStatus("syncing", m));
    await enqueueDirty(firstTime);
    const outbox = await dbAll("outbox");
    let n = 0;
    await pool(outbox, 3, async (entry) => {
      try { await pushOne(entry, folders, firstTime); pushed++; }
      catch (e) {
        if (isNetworkOrAuth(e)) throw e;
        failed++; lastErr = e;
        await dbPut("outbox", { ...entry, tries: (entry.tries || 0) + 1 });
        console.warn("Không đẩy được", entry, e);
      }
      setStatus("syncing", `Đang đẩy lên Drive… ${++n}/${outbox.length}`);
    });
    if (failed) throw lastErr;
    if (firstTime) await setMeta("connected", true);
    try { await writeDailySnapshot(); } catch (e) { if (isNetworkOrAuth(e)) throw e; console.warn("Không ghi được snapshot:", e); }
    await setMeta("lastSyncOkAt", new Date().toISOString());
    setStatus("idle", "Đã đồng bộ");
    return { pushed, pulled };
  } catch (e) {
    if (e?.code === "offline") { setStatus("offline", "Chờ mạng — thay đổi sẽ tự đẩy lên khi có mạng."); requestBackgroundSync(); }
    else if (e instanceof AuthError) setStatus("auth", e.message);
    else {
      if (e?.code === "notfound") await forgetFolders();
      setStatus("error", e?.message || "Đồng bộ gặp lỗi.");
    }
    throw e;
  }
}

// Đồng bộ ngay. manual=true (bấm nút) thì được mở cửa sổ đăng nhập nếu cần.
// Khoá "cavang-sync" (Web Locks) để app và service worker (đồng bộ nền) không đẩy cùng một bản ghi cùng lúc → khỏi tạo file trùng trên Drive.
const withLock = (fn) => (navigator.locks?.request ? navigator.locks.request("cavang-sync", fn) : fn());

// Đồng bộ nền MỘT LẦN khi app đã đóng: nhờ trình duyệt đánh thức service worker đúng lúc có mạng để đẩy nốt outbox.
// Không dùng Periodic Sync (xem docs/KIEN-TRUC.md mục 6b). Trình duyệt không hỗ trợ thì bỏ qua — vẫn đẩy khi mở app như cũ.
export async function requestBackgroundSync() {
  try {
    if (!wasSignedIn() || !("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.sync) return false;
    await reg.sync.register("cavang-outbox");
    return true;
  } catch { return false; }
}

export function syncNow({ manual = false } = {}) {
  if (running) { again = true; return running; }
  running = withLock(() => doSync(manual)).finally(() => {
    running = null;
    if (again) { again = false; schedule(1500); }
  });
  return running;
}

// ---------- Tự động ----------
let started = false;
let timer = null;
let interval = null;
let offs = [];

let scheduled = false; // có đợt đồng bộ đang hẹn giờ mà chưa chạy
function schedule(ms = 2500) {
  if (!wasSignedIn() && !isSignedIn()) return;
  clearTimeout(timer);
  scheduled = true;
  timer = setTimeout(() => { scheduled = false; syncNow().catch(() => {}); }, ms);
}

export function startAutoSync() {
  if (started) return;
  started = true;
  offs.push(on("record:saved", (p) => { if (!p?.remote) { schedule(); if (!navigator.onLine) requestBackgroundSync(); } }));
  offs.push(on("record:deleted", (p) => { if (!p?.remote) { schedule(); if (!navigator.onLine) requestBackgroundSync(); } }));
  const onVisible = () => {
    if (document.visibilityState === "visible") { schedule(500); return; }
    // Người dùng rời app: nếu còn việc chưa đẩy xong thì nhờ trình duyệt đẩy nốt khi app đã đóng.
    if (wasSignedIn() && (scheduled || running || again || getStatus().state !== "idle")) requestBackgroundSync();
  };
  const onOnline = () => schedule(500);
  const onOffline = () => { if (wasSignedIn()) setStatus("offline", "Đang mất mạng — thay đổi sẽ tự đẩy lên khi có mạng."); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  // Token hết hạn thì xin lại vào lúc người dùng chạm (không phải gõ mật khẩu), rồi đồng bộ luôn.
  const onGesture = () => {
    if (!wasSignedIn() || !needsRenewal()) return;
    renewQuietly().then((ok) => { if (ok) schedule(300); });
  };
  document.addEventListener("click", onGesture, { capture: true });
  // Quay lại app / cửa sổ được chú ý → kéo thay đổi từ máy kia ngay.
  const onFocus = () => schedule(300);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pageshow", onFocus);
  // Đang mở app thì kiểm tra máy kia mỗi 60 giây (app đóng thì PWA không chạy nền được).
  interval = setInterval(() => { if (document.visibilityState === "visible") schedule(0); }, POLL_MS);
  offs.push(() => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); document.removeEventListener("click", onGesture, true); window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onFocus); });
  if (wasSignedIn()) preloadGis();
  if (wasSignedIn() && !isSignedIn()) setStatus("auth", "Cần đăng nhập lại Google — chạm vào chấm trạng thái hoặc bất kỳ đâu trong app.");
  else if (!wasSignedIn()) setStatus("off", "Chưa kết nối Google Drive");
  schedule(800);
}

export function stopAutoSync() {
  clearTimeout(timer); clearInterval(interval);
  offs.forEach((f) => f()); offs = [];
  started = false;
}

// Gọi sau khi đăng xuất: quên trạng thái kết nối để lần đăng nhập sau (có thể là tài khoản khác) đẩy lại toàn bộ.
export async function resetConnection() {
  await forgetFolders();
  await setMeta("connected", null);
  await setMeta("lastPullAt", null);
  await setMeta("lastSnapshotDate", null);
  setStatus("off", "Chưa kết nối Google Drive");
}

// ---------- Ảnh đầy đủ tải khi cần xem ----------
async function loadFull(id, opts) {
  const rec = await dbGet("records", id);
  const driveId = rec?.file?.driveId;
  if (!driveId || !isSignedIn()) return null;
  try {
    const full = await downloadFile(driveId, opts);
    const prev = await dbGet("blobs", id);
    await dbPut("blobs", { id, full, thumb: prev?.thumb });
    return full;
  } catch (e) { console.warn("Không tải được ảnh đầy đủ:", e); return null; }
}
setFullLoader(loadFull);
