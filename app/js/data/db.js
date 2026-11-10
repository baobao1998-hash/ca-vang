// Bọc IndexedDB: 4 kho records, blobs, outbox, meta.
import { DB_NAME, DB_VERSION } from "../core/config.js";

let dbName = DB_NAME;
let dbPromise = null;

// Chỉ dùng cho trang test (để không đụng dữ liệu thật). Gọi TRƯỚC openDb().
export async function useDbName(name) {
  await closeDb();
  dbName = name;
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [store, keyPath] of [["records", "id"], ["blobs", "id"], ["outbox", "id"], ["meta", "key"]]) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(new Error("Không mở được kho dữ liệu trên máy này.")); };
    req.onblocked = () => { dbPromise = null; reject(new Error("Kho dữ liệu đang bị tab khác giữ. Hãy đóng các tab Cá Vàng khác.")); };
  });
  return dbPromise;
}

export async function closeDb() {
  if (!dbPromise) return;
  const p = dbPromise;
  dbPromise = null;
  try { (await p).close(); } catch { /* bỏ qua */ }
}

export function deleteDatabase(name = dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function run(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Giao dịch dữ liệu bị huỷ."));
    const r = fn(tx.objectStore(store));
    if (r && "onsuccess" in r) r.onsuccess = () => { result = r.result; };
  });
}

export const dbGet = (store, key) => run(store, "readonly", (s) => s.get(key)).then((v) => v ?? null);
export const dbPut = (store, value) => run(store, "readwrite", (s) => s.put(value));
export const dbDelete = (store, key) => run(store, "readwrite", (s) => s.delete(key));
export const dbAll = (store) => run(store, "readonly", (s) => s.getAll());

// Thêm: ghi nhiều bản ghi trong một giao dịch (nhanh hơn nhiều).
export async function dbPutMany(store, values) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const s = tx.objectStore(store);
    for (const v of values) s.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const dbClear = (store) => run(store, "readwrite", (s) => s.clear());
