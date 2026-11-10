// Cập nhật app: so phiên bản đang chạy với phiên bản trên máy chủ, và cập nhật cưỡng bức khi cần.
// Không dựa hoàn toàn vào service worker tự phát hiện (có lúc máy giữ bản cũ tới 10 phút do bộ nhớ đệm của GitHub).
import { APP_VERSION } from "../core/version.js";

// Đọc số phiên bản trên máy chủ, bỏ qua mọi bộ nhớ đệm. Trả về null khi mất mạng/lỗi.
export async function serverVersion() {
  try {
    const res = await fetch(`js/core/version.js?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const m = /APP_VERSION\s*=\s*"([^"]+)"/.exec(await res.text());
    return m ? m[1] : null;
  } catch { return null; }
}

// a mới hơn b? (so kiểu 0.5.10 > 0.5.9)
export function isNewer(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

// Có bản mới trên máy chủ không? → chuỗi phiên bản mới, hoặc null.
export async function findUpdate() {
  const v = await serverVersion();
  return v && isNewer(v, APP_VERSION) ? v : null;
}

// Cập nhật cưỡng bức: tải service worker mới, cho nó chạy ngay, xoá "vỏ app" cũ đã lưu, rồi tải lại trang.
// Dữ liệu bằng chứng (IndexedDB), ảnh vừa chia sẻ (cache "cavang-share") và đăng nhập KHÔNG bị ảnh hưởng.
export async function applyUpdate() {
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) {
      await reg.update().catch(() => {});
      if (reg.installing) {
        await new Promise((res) => {
          const w = reg.installing;
          const t = setTimeout(res, 8000);
          w.addEventListener("statechange", () => { if (w.state !== "installing") { clearTimeout(t); res(); } });
        });
      }
      reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    }
    if (self.caches) {
      for (const k of await caches.keys()) if (k.startsWith("cavang-shell-v")) await caches.delete(k);
    }
  } catch (err) {
    console.warn("Cập nhật gặp lỗi, vẫn tải lại trang:", err);
  }
  location.reload();
}
