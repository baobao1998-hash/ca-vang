// Tải sẵn ảnh đầy đủ từ Drive khi đang dùng Wi-Fi, để mở ảnh cũ là thấy ngay (kể cả khi dùng 4G / mất mạng).
// Nguyên tắc "không hao pin, không tốn data": chỉ chạy khi app đang MỞ và HIỂN THỊ, có Wi-Fi, không bật tiết kiệm dữ liệu,
// pin >= 20% hoặc đang sạc, còn trống >= 10% bộ nhớ, và không trùng với lúc đang đồng bộ. Mỗi lần 1 ảnh, nghỉ giữa các ảnh.
// Chống giật (1.0.1): người dùng đang chạm/cuộn/gõ thì tạm dừng, rảnh tay vài giây mới tải tiếp; tải ở mức ưu tiên thấp;
// đã tải đủ thì không quét lại kho ảnh mỗi phút nữa, chỉ quét khi có ảnh mới.
// Không dùng service worker / chạy nền: đóng app là dừng hẳn.
import { on, emit } from "../core/events.js";
import { getSetting, setSetting } from "../data/settings.js";
import { dbGet, dbPut, dbAll, openDb } from "../data/db.js";
import { listRecords, getFullBlob } from "../data/records.js";
import { isSignedIn, wasSignedIn } from "./auth.js";
import { getStatus } from "./sync.js";

const SETTING = "prefetchWifi";
const MIN_BATTERY = 0.2;
const MIN_FREE_RATIO = 0.1;
const GAP_MS = 1500;         // nghỉ giữa 2 ảnh
const QUIET_MS = 4000;       // người dùng rảnh tay bao lâu thì mới tải tiếp
const MAX_FAILS = 3;         // lỗi liên tiếp thì dừng tới lần kích hoạt sau

export const isPrefetchEnabled = () => getSetting(SETTING, true) !== false;
export function setPrefetchEnabled(v) {
  setSetting(SETTING, !!v);
  emit("prefetch:state", { enabled: !!v });
  if (v) { allDone = false; kick(0); } else stopFlag = true;
}

let started = false;
let running = false;
let stopFlag = false;
let timer = null;
let battery = null; // đối tượng Battery nếu trình duyệt có
let lastReason = "";
let allDone = false;     // lần quét trước đã thấy đủ ảnh → khỏi quét lại tới khi có ảnh mới
let lastInputAt = 0;     // lần cuối người dùng chạm / cuộn / gõ

// ---------- Điều kiện chạy ----------
function networkReason() {
  if (!navigator.onLine) return "đang mất mạng";
  const c = navigator.connection;
  if (c) {
    if (c.saveData) return "đang bật chế độ tiết kiệm dữ liệu";
    // Điện thoại có báo loại mạng; máy tính thường không báo → coi như được.
    if (c.type !== undefined && c.type !== "wifi" && c.type !== "ethernet") return "đang không dùng Wi-Fi";
  }
  return "";
}

async function storageReason() {
  try {
    if (!navigator.storage?.estimate) return "";
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (quota && (quota - usage) / quota < MIN_FREE_RATIO) return "bộ nhớ trên máy còn dưới 10%";
  } catch { /* không đo được thì cứ chạy */ }
  return "";
}

// Trả về lý do KHÔNG chạy (chuỗi rỗng = được chạy). checkStorage=false: bỏ qua bước đo bộ nhớ (đã đo đầu vòng).
export async function blockedReason({ checkStorage = true } = {}) {
  if (!isPrefetchEnabled()) return "công tắc đang tắt";
  if (!wasSignedIn()) return "chưa đăng nhập Google";
  if (!isSignedIn()) return "cần đăng nhập lại Google";
  if (document.visibilityState !== "visible") return "app đang ở nền";
  const net = networkReason(); if (net) return net;
  if (battery && !battery.charging && battery.level < MIN_BATTERY) return "pin dưới 20% và chưa cắm sạc";
  if (getStatus().state === "syncing") return "đang đồng bộ";
  return checkStorage ? storageReason() : "";
}

// ---------- Vòng tải ----------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const idle = () => new Promise((res) => {
  const go = () => setTimeout(res, GAP_MS);
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 3000 }); else go();
});
// Chờ tới khi người dùng rảnh tay QUIET_MS (hoặc vòng tải bị dừng).
async function waitQuiet() {
  while (!stopFlag && Date.now() - lastInputAt < QUIET_MS) await sleep(1000);
}
const markInput = () => { lastInputAt = Date.now(); };

async function pickTodo() {
  const recs = (await listRecords()).filter((r) => r.kind === "image" && r.file?.driveId);
  recs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // mới nhất trước
  const sizes = await blobSizes();
  return recs.filter((r) => !sizes.has(r.id) || !sizes.get(r.id).full);
}

async function run() {
  if (running) return;
  running = true; stopFlag = false;
  try {
    if (allDone) { lastReason = "đã tải sẵn hết"; return; }
    const first = await blockedReason();
    if (first) { lastReason = first; return; }
    if (!getSetting("persistAsked", false)) { // xin trình duyệt đừng tự xoá dữ liệu khi máy đầy (chỉ hỏi 1 lần)
      setSetting("persistAsked", true);
      try { await navigator.storage?.persist?.(); } catch { /* bỏ qua */ }
    }
    const todo = await pickTodo();
    lastReason = todo.length ? "" : "đã tải sẵn hết";
    if (!todo.length) allDone = true;
    let fails = 0, got = 0;
    for (const r of todo) {
      await waitQuiet();
      const why = await blockedReason({ checkStorage: false });
      if (stopFlag || why) { lastReason = why || "đã dừng"; break; }
      const had = await dbGet("blobs", r.id);
      if (had?.full) continue;
      // dùng đúng đường tải ảnh đầy đủ có sẵn (sync.js → loadFull), ưu tiên thấp để không giành mạng
      const blob = await getFullBlob(r.id, { priority: "low" });
      if (blob) { fails = 0; got++; emit("prefetch:progress", { id: r.id }); }
      else if (++fails >= MAX_FAILS) { lastReason = "tải lỗi nhiều lần, sẽ thử lại sau"; break; }
      await idle();
    }
    if (got) emit("prefetch:progress", { done: true });
  } catch (e) {
    lastReason = "gặp lỗi";
    console.warn("Tải sẵn ảnh dừng:", e);
  } finally {
    running = false;
    emit("prefetch:state", { running: false });
  }
}

function kick(ms = 3000) {
  if (!started) return;
  clearTimeout(timer);
  timer = setTimeout(() => { run(); }, ms);
}

export function startPrefetch() {
  if (started) return;
  started = true;
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      battery = b;
      b.addEventListener("chargingchange", () => kick());
      b.addEventListener("levelchange", () => { if (b.level >= MIN_BATTERY) kick(); });
    }).catch(() => {});
  }
  navigator.connection?.addEventListener?.("change", () => kick());
  window.addEventListener("online", () => kick());
  window.addEventListener("offline", () => { stopFlag = true; });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") kick(); else stopFlag = true; });
  on("auth:changed", () => kick());
  // Có ảnh mới (chụp trên máy này hoặc kéo từ máy kia về) → lần quét sau mới cần chạy lại.
  on("record:saved", ({ record } = {}) => { if (record?.kind === "image") allDone = false; });
  // Ghi nhận lúc người dùng thao tác để vòng tải nhường máy (passive: không làm chậm cuộn).
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) window.addEventListener(ev, markInput, { passive: true, capture: true });
  // Đồng bộ xong (rảnh) thì mới tải ảnh; đồng bộ bắt đầu thì vòng tải tự dừng ở ảnh kế tiếp.
  on("sync:status", ({ state }) => { if (state === "idle") kick(4000); });
  kick(6000); // chờ app mở xong, đồng bộ đầu tiên chạy trước
}

// ---------- Thống kê + xoá (cho màn Cài đặt) ----------
// Đọc kích thước ảnh trong kho "blobs" bằng con trỏ (không nạp cả ảnh vào bộ nhớ).
async function blobSizes() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out = new Map();
    const req = db.transaction("blobs", "readonly").objectStore("blobs").openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(out);
      const v = cur.value;
      out.set(cur.key, { full: v?.full ? Math.max(v.full.size || 0, 1) : 0, thumb: !!v?.thumb });
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPrefetchStats() {
  const recs = (await listRecords()).filter((r) => r.kind === "image");
  const sizes = await blobSizes();
  let done = 0, bytes = 0;
  for (const r of recs) { const s = sizes.get(r.id); if (s?.full) { done++; bytes += s.full; } }
  return { done, total: recs.length, bytes, reason: running ? "" : lastReason, running };
}

// Xoá bản đầy đủ trên máy (giữ ảnh nhỏ). CHỈ xoá ảnh đã chắc chắn có trên Drive và không còn thay đổi chờ đẩy.
export async function clearPrefetched() {
  stopFlag = true;
  const queued = new Set((await dbAll("outbox")).map((o) => o.id));
  let cleared = 0;
  for (const r of await listRecords({ includeDeleted: true })) {
    if (r.kind !== "image" || !r.file?.driveId || r.sync?.dirty || queued.has(r.id)) continue;
    const b = await dbGet("blobs", r.id);
    if (!b?.full || !b.thumb) continue;
    await dbPut("blobs", { id: r.id, full: undefined, thumb: b.thumb });
    cleared++;
  }
  allDone = false;
  setPrefetchEnabled(false); // tắt công tắc để app không tự tải lại ngay
  return cleared;
}
