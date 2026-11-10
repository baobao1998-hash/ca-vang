// Đăng nhập Google bằng Google Identity Services (token client), scope drive.file.
// Token (sống ~1 giờ, quyền chỉ drive.file) được nhớ trong localStorage của thiết bị tới khi hết hạn, để tải lại/mở lại app
// không phải đăng nhập lại. Hết hạn thì xin lại lúc người dùng chạm vào app (xin "yên lặng", không cần gõ mật khẩu).
// Không bao giờ tự bật cửa sổ đăng nhập khi người dùng chưa chạm (điện thoại sẽ chặn/đóng cửa sổ đó).
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from "../core/config.js";
import { getSetting, setSetting } from "../data/settings.js";
import { emit } from "../core/events.js";

export class AuthError extends Error {
  constructor(message, code) { super(message); this.name = "AuthError"; this.code = code; }
}

const TOKEN_KEY = "cavang.gtoken";
let token = null;
let expiresAt = 0;

function restoreToken() {
  try {
    const o = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    if (o && typeof o.t === "string" && Number(o.exp) > Date.now() + 30000) { token = o.t; expiresAt = Number(o.exp); }
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* bỏ qua */ }
}
function persistToken() {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: token, exp: expiresAt }));
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* bỏ qua */ }
}
restoreToken();
let gisPromise = null;
let pending = null;
let lastQuietFail = 0;

export function preloadGis() { loadGis().catch(() => {}); } // tải sẵn để cửa sổ đăng nhập mở kịp trong lúc người dùng chạm
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
          persistToken();
          setSetting("googleHint", true);
          resolve(token);
        },
        error_callback: (err) => {
          const t = err && err.type;
          if (t === "popup_closed") fail("Chưa đăng nhập xong (cửa sổ Google đã đóng). Bấm \"Đăng nhập lại Google\" rồi chọn tài khoản để tiếp tục.", "closed");
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

// Chỉ khi interactive=true (do người dùng bấm) mới được mở cửa sổ Google; nền thì báo "cần đăng nhập lại".
export async function getToken({ interactive = false } = {}) {
  if (isSignedIn()) return token;
  if (!interactive) throw new AuthError("Cần đăng nhập lại Google — chạm vào chấm trạng thái hoặc nút Đăng nhập lại.", "needlogin");
  return requestToken("");
}

// Token sắp hết hạn (dưới 5 phút) hoặc đã mất.
export function needsRenewal() { return !token || Date.now() > expiresAt - 5 * 60000; }

// Gọi trong lúc người dùng chạm: xin token mới yên lặng. Lỗi thì im lặng (có hạ nhiệt 30 giây để không bật cửa sổ liên tục).
export async function renewQuietly() {
  if (!wasSignedIn() || !needsRenewal() || pending || Date.now() - lastQuietFail < 30000) return false;
  try { await requestToken(""); emit("auth:changed", { signedIn: true }); return true; }
  catch { lastQuietFail = Date.now(); return false; }
}

// Gọi khi Google trả 401: bỏ token cũ để lần sau xin token mới.
export function invalidateToken() { token = null; expiresAt = 0; persistToken(); }

export function signOut() {
  const t = token;
  token = null; expiresAt = 0; persistToken();
  setSetting("googleHint", null);
  try { if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t, () => {}); } catch { /* bỏ qua */ }
  emit("auth:changed", { signedIn: false });
}
