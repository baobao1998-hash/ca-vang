// Đồng bộ nền MỘT LẦN: khi app đã đóng mà còn thay đổi chưa đẩy lên Drive, trình duyệt đánh thức service worker (sự kiện "sync",
// tag "cavang-outbox") đúng lúc có mạng; ở đây đẩy nốt "outbox" lên Drive rồi thôi. Không chạy định kỳ → không tốn pin.
// - Dùng token Google đã được app chép sang IndexedDB (kho "meta", khoá "swToken"). Token hết hạn/không có → bỏ qua, chờ lần mở app sau
//   (token chỉ sống ~1 giờ và không xin lại được khi không có người chạm, nên không cố xin trong nền).
// - Chỉ ĐẨY (không kéo về). Logic đẩy phản chiếu services/sync.js (pushOne) nhưng gọn hơn; đổi một nơi nhớ xem nơi kia.
// - Khoá "cavang-sync" (Web Locks) chung với app: app đang đồng bộ thì bỏ qua, khỏi tạo file trùng.
// Nạp bằng importScripts trong sw.js (script thường, không phải module).
(function () {
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
  const FOLDER_MIME = "application/vnd.google-apps.folder";
  const DRIVE_ID_OK = /^[0-9A-Za-z_-]{10,128}$/;

  class Skip extends Error {}      // dừng êm, không thử lại (chưa đăng nhập / token hết hạn / thiếu dữ liệu)
  class Retry extends Error {}     // lỗi mạng / máy chủ → để trình duyệt thử lại sau

  // ---- IndexedDB thô (không tạo kho mới nếu app chưa từng chạy) ----
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("cavang");
      req.onupgradeneeded = () => { try { req.transaction.abort(); } catch (e) { /* bỏ qua */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Skip("Không mở được kho dữ liệu"));
    });
  }
  const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = (db, name, mode) => db.transaction(name, mode || "readonly").objectStore(name);
  const get = (db, name, key) => wrap(store(db, name).get(key)).then((v) => v === undefined ? null : v);
  const put = (db, name, v) => wrap(store(db, name, "readwrite").put(v));
  const del = (db, name, key) => wrap(store(db, name, "readwrite").delete(key));
  const all = (db, name) => wrap(store(db, name).getAll());

  // ---- Drive ----
  let token = "";
  async function api(url, init) {
    let res;
    try { res = await fetch(url, Object.assign({}, init, { headers: Object.assign({}, init && init.headers, { Authorization: "Bearer " + token }) })); }
    catch (e) { throw new Retry("offline"); }
    if (res.ok) return res;
    if (res.status === 401 || res.status === 403) throw new Skip("token không dùng được");
    if (res.status === 404) { const e = new Error("notfound"); e.notfound = true; throw e; }
    if (res.status === 429 || res.status >= 500) throw new Retry("server " + res.status);
    throw new Error("Drive " + res.status);
  }
  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const checkId = (id) => { if (typeof id !== "string" || !DRIVE_ID_OK.test(id)) throw new Error("id lạ"); return id; };

  async function list(q) {
    const p = new URLSearchParams({ q, fields: "files(id,name,modifiedTime)", pageSize: "100", spaces: "drive", orderBy: "createdTime" });
    return (await (await api(API + "/files?" + p)).json()).files || [];
  }
  const findByName = (name, parentId) => list("name='" + esc(name) + "' and trashed=false" + (parentId ? " and '" + parentId + "' in parents" : ""));

  async function monthFolder(filesId, ym) {
    const found = await list("name='" + esc(ym) + "' and mimeType='" + FOLDER_MIME + "' and trashed=false and '" + filesId + "' in parents");
    if (found.length) return found[0].id;
    const res = await api(API + "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ym, mimeType: FOLDER_MIME, parents: [filesId] }) });
    return (await res.json()).id;
  }

  function multipart(meta, blob) {
    const b = "cavang" + Math.random().toString(36).slice(2);
    const body = new Blob(["--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n", JSON.stringify(meta),
      "\r\n--" + b + "\r\nContent-Type: " + (blob.type || "application/octet-stream") + "\r\n\r\n", blob, "\r\n--" + b + "--"]);
    return { body, headers: { "Content-Type": "multipart/related; boundary=" + b } };
  }
  async function upload(blob, name, parentId, existingId) {
    if (existingId) {
      checkId(existingId);
      const m = multipart({ name }, blob);
      try { return await (await api(UPLOAD + "/files/" + existingId + "?uploadType=multipart&fields=id,modifiedTime", { method: "PATCH", headers: m.headers, body: m.body })).json(); }
      catch (e) { if (!e.notfound) throw e; }
    }
    const m = multipart({ name, parents: [parentId] }, blob);
    return (await api(UPLOAD + "/files?uploadType=multipart&fields=id,modifiedTime", { method: "POST", headers: m.headers, body: m.body })).json();
  }
  async function remove(id) {
    try { await api(API + "/files/" + checkId(id), { method: "DELETE" }); } catch (e) { if (!e.notfound) throw e; }
  }

  // ---- Đẩy 1 việc trong outbox ----
  async function pushOne(db, entry, folders) {
    if (entry.op === "delete") {
      for (const f of await findByName(entry.recordId + ".json", folders.records)) await remove(f.id);
      for (const nm of [entry.recordId + ".jpg", entry.recordId + ".thumb.jpg"]) for (const f of await findByName(nm)) await remove(f.id);
      await del(db, "outbox", entry.id);
      return;
    }
    const rec = await get(db, "records", entry.recordId);
    if (!rec) { await del(db, "outbox", entry.id); return; }
    const stamp = rec.updatedAt;
    const file = rec.file ? Object.assign({}, rec.file) : null;
    if (rec.kind === "image" && file) {
      const blobs = await get(db, "blobs", rec.id);
      const ym = String(rec.createdAt).slice(0, 7);
      if (blobs && blobs.full && !file.driveId) file.driveId = (await upload(blobs.full, rec.id + ".jpg", await monthFolder(folders.files, ym))).id;
      if (blobs && blobs.thumb && !file.thumbDriveId) file.thumbDriveId = (await upload(blobs.thumb, rec.id + ".thumb.jpg", await monthFolder(folders.files, ym))).id;
    }
    const body = Object.assign({}, rec, { file });
    delete body.sync;
    let existing = rec.sync && rec.sync.driveRecordId;
    if (!existing) { const f = await findByName(rec.id + ".json", folders.records); existing = f[0] && f[0].id; }
    const res = await upload(new Blob([JSON.stringify(body)], { type: "application/json" }), rec.id + ".json", folders.records, existing);

    const fresh = await get(db, "records", rec.id); // app có thể đã sửa tiếp trong lúc đẩy
    if (!fresh) return;
    const unchanged = fresh.updatedAt === stamp;
    const sync = Object.assign({}, fresh.sync, { driveRecordId: res.id, driveModified: res.modifiedTime });
    if (unchanged) { sync.dirty = false; sync.lastSyncedAt = new Date().toISOString(); }
    const next = Object.assign({}, fresh, { sync });
    if (fresh.file && file) next.file = Object.assign({}, fresh.file, { driveId: file.driveId || fresh.file.driveId, thumbDriveId: file.thumbDriveId || fresh.file.thumbDriveId });
    await put(db, "records", next);
    if (unchanged) await del(db, "outbox", entry.id);
  }

  async function runOutbox() {
    const db = await openDb();
    try {
      const row = await get(db, "meta", "swToken");
      const t = row && row.value;
      if (!t || typeof t.t !== "string" || !(Number(t.exp) > Date.now() + 60000)) throw new Skip("không có token còn hạn");
      token = t.t;
      const fRow = await get(db, "meta", "driveFolderIds");
      const folders = fRow && fRow.value;
      if (!folders || !folders.records || !folders.files) throw new Skip("chưa có thư mục Drive");
      const outbox = await all(db, "outbox");
      for (const entry of outbox) {
        try { await pushOne(db, entry, folders); }
        catch (e) {
          if (e instanceof Skip || e instanceof Retry) throw e;
          await put(db, "outbox", Object.assign({}, entry, { tries: (entry.tries || 0) + 1 })); // lỗi riêng của việc này: để app xử lý khi mở
        }
      }
    } finally { token = ""; db.close(); }
  }

  // Gọi từ sw.js. Skip → kết thúc êm; Retry → ném lại để trình duyệt hẹn thử lần sau.
  self.cavangRunOutbox = function () {
    const run = () => runOutbox().catch((e) => { if (!(e instanceof Skip)) throw e; });
    if (self.navigator && navigator.locks && navigator.locks.request) {
      return navigator.locks.request("cavang-sync", { ifAvailable: true }, (lock) => (lock ? run() : undefined));
    }
    return run();
  };
})();
