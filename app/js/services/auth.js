// Đăng nhập Google bằng Google Identity Services (token client), scope drive.file.
// Token chỉ giữ trong bộ nhớ (biến) — KHÔNG lưu localStorage. Chỉ nhớ một cờ "đã từng đăng nhập" để biết cần nhắc đăng nhập lại.
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from "../core/config.js";
import { getSetting, setSetting } from "../data/settings.js";
import { emit } from "../core/events.js";

export class AuthError extends Error {
  constructor(message, code) { super(message); this.name = "AuthError"; this.code = code; }
}

let token = null;
let expiresAt = 0;
let gisPromise = null;
let pending = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; s.remove(); reject(new AuthError("Không tải được công cụ đăng nhập Google. Kiểm tra mạng rồi thử lại.", "offline")); };
      document.head.append(s);
    });
  }
  return gisPromise;
}

function requestToken(prompt) {
  if (pending) return pending;
  pending = (async () => {
    await loadGis();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new AuthError("Hết thời gian chờ đăng nhập Google. Hãy thử lại.", "timeout")), 120000);
      const fail = (msg, code) => { clearTimeout(timer); reject(new AuthError(msg, code)); };
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPE,
        callback: (resp) => {
          if (resp.error) {
            if (resp.error === "access_denied") return fail("Bạn chưa cho phép Cá Vàng dùng Google Drive.", "denied");
            return fail("Google từ chối đăng nhập (" + resp.error + ").", "interaction");
          }
          if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, GOOGLE_SCOPE)) {
            return fail("Bạn chưa tích ô cho phép dùng Google Drive. Hãy đăng nhập lại và tích đủ các ô.", "scope");
          }
          clearTimeout(timer);
          token = resp.access_token;
          expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
          setSetting("googleHint", true);
          resolve(token);
        },
        error_callback: (err) => {
          const t = err && err.type;
          if (t === "popup_closed") fail("Bạn đã đóng cửa sổ đăng nhập Google.", "closed");
          else if (t === "popup_failed_to_open") fail("Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép cửa sổ bật lên rồi bấm lại.", "popup");
          else fail("Không đăng nhập được Google. Hãy thử lại.", "interaction");
        },
      });
      client.requestAccessToken({ prompt });
    });
  })().finally(() => { pending = null; });
  return pending;
}

export function isSignedIn() { return !!token && Date.now() < expiresAt - 30000; }
// Đã từng đăng nhập trên thiết bị này (nhưng token trong bộ nhớ có thể đã mất sau khi tải lại trang).
export function wasSignedIn() { return getSetting("googleHint", false) === true; }

export async function signIn() {
  const t = await requestToken(wasSignedIn() ? "" : "select_account");
  emit("auth:changed", { signedIn: true });
  return t;
}

export async function getToken() {
  if (isSignedIn()) return token;
  return requestToken("");
}

// Gọi khi Google trả 401: bỏ token cũ để lần sau xin token mới.
export function invalidateToken() { token = null; expiresAt = 0; }

export function signOut() {
  const t = token;
  token = null; expiresAt = 0;
  setSetting("googleHint", null);
  try { if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t, () => {}); } catch { /* bỏ qua */ }
  emit("auth:changed", { signedIn: false });
}
