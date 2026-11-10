// Màn Cài đặt: các mục để trống (sẽ nối ở GĐ3, GĐ4). Phiên bản đọc từ core/version.js.
import { h, icon, mount, toast } from "./dom.js";
import { listRecords } from "../data/records.js";
import { APP_VERSION, SCHEMA_VERSION } from "../core/version.js";
import { GEMINI_MODELS, GEMINI_DEFAULT_MODEL } from "../core/config.js";
import { getSetting, setSetting } from "../data/settings.js";
import { testKey, getKey, getModel } from "../services/gemini.js";
import { runOcrQueue, pendingCount, startOcrQueue } from "./ocr-queue.js";
import { on } from "../core/events.js";
import { signIn, signOut, wasSignedIn } from "../services/auth.js";
import { syncNow, getStatus, getSyncInfo, resetConnection } from "../services/sync.js";
import { exportJson, importJson, todayStr } from "../services/backup.js";
import { isPrefetchEnabled, setPrefetchEnabled, getPrefetchStats, clearPrefetched } from "../services/prefetch.js";

function section(ico, title, desc, status, ...body) {
  return h("section", { class: "setting glass" },
    h("div", { class: "setting-head" },
      h("div", { class: "ico" }, icon(ico, 22)),
      h("div", null, h("h2", null, title), h("p", null, desc)),
      status && h("span", { class: "status-pill" }, status)),
    ...body);
}

const CUSTOM = "__custom__";

// Khối Gemini: key (ẩn), kiểm tra key, chọn model, công tắc tự đọc, đọc lại ảnh chưa đọc.
function geminiSection() {
  const result = h("p", { class: "soon", "aria-live": "polite" });
  const pill = h("span", { class: "status-pill" });
  const say = (msg, ok) => { result.textContent = msg; result.className = "soon " + (ok === true ? "ok-text" : ok === false ? "err-text" : ""); };
  const refreshPill = () => { pill.textContent = getKey() ? "Đã có key" : "Chưa có key"; };

  const keyInput = h("input", { class: "field", type: "password", placeholder: getKey() ? "Đã lưu key (dán key mới để thay)" : "Dán Gemini API key…", autocomplete: "off", spellcheck: "false", "aria-label": "Gemini API key" });
  const testBtn = h("button", { type: "button", class: "btn btn-primary", onclick: onTest }, icon("check", 18), "Kiểm tra key");
  const clearBtn = h("button", { type: "button", class: "btn", onclick: () => { if (!getKey()) { say("Máy này chưa lưu key nào."); return; } if (!confirm("Xoá key Gemini khỏi máy này? (Key vẫn còn ở Google AI Studio, bạn có thể dán lại.)")) return; setSetting("geminiKey", null); keyInput.value = ""; keyInput.placeholder = "Dán Gemini API key…"; refreshPill(); say("Đã xoá key khỏi máy này."); } }, "Xoá key Gemini khỏi máy này");

  const cur = getModel();
  const modelSel = h("select", { class: "field", "aria-label": "Model Gemini" },
    ...GEMINI_MODELS.map((m) => h("option", { value: m }, m + (m === GEMINI_DEFAULT_MODEL ? " (mặc định)" : ""))),
    h("option", { value: CUSTOM }, "Tên model khác…"));
  const modelTxt = h("input", { class: "field", type: "text", placeholder: "Gõ tên model, VD: gemini-3.6-flash", autocomplete: "off", spellcheck: "false", hidden: true });
  if (GEMINI_MODELS.includes(cur)) modelSel.value = cur; else { modelSel.value = CUSTOM; modelTxt.hidden = false; modelTxt.value = cur; }
  const saveModel = () => {
    const v = modelSel.value === CUSTOM ? modelTxt.value.trim() : modelSel.value;
    setSetting("geminiModel", v && v !== GEMINI_DEFAULT_MODEL ? v : null);
  };
  modelSel.addEventListener("change", () => { modelTxt.hidden = modelSel.value !== CUSTOM; if (!modelTxt.hidden) modelTxt.focus(); saveModel(); });
  modelTxt.addEventListener("change", saveModel);

  const auto = h("input", { type: "checkbox", checked: getSetting("aiAuto", true) !== false, onchange: () => setSetting("aiAuto", auto.checked) });
  const pendingInfo = h("p", { class: "soon" });
  const rereadBtn = h("button", { type: "button", class: "btn", onclick: onReread }, "Đọc lại các ảnh chưa đọc");
  const showPending = async () => { const n = await pendingCount(); pendingInfo.textContent = n ? `${n} bằng chứng đang chờ đọc chữ.` : "Không có bằng chứng nào đang chờ đọc chữ."; };

  async function onTest() {
    const typed = keyInput.value.trim();
    const key = typed || getKey();
    if (!key) { say("Hãy dán key vào ô trên trước.", false); return; }
    testBtn.disabled = true; say("Đang kiểm tra…");
    try {
      saveModel();
      const ok = await testKey(key, getModel());
      if (ok) {
        if (typed) { setSetting("geminiKey", typed); keyInput.value = ""; keyInput.placeholder = "Đã lưu key (dán key mới để thay)"; }
        say("Key dùng được ✓ — đã lưu trên máy này.", true);
      } else say("Key không đúng hoặc đã bị tắt. Hãy tạo/dán lại key.", false);
    } catch (err) { say(err.message, false); }
    finally { testBtn.disabled = false; refreshPill(); }
  }
  async function onReread() {
    if (!getKey()) { say("Chưa có key — hãy dán và kiểm tra key trước.", false); return; }
    rereadBtn.disabled = true; say("Đang đọc lại…");
    const r = await runOcrQueue({ includeError: true });
    say(r.error ? `Đã đọc ${r.done}, còn ${r.left}. ${r.error.message}` : r.done ? `Đã đọc xong ${r.done} bằng chứng.` : "Không có gì cần đọc lại.", r.error ? false : true);
    rereadBtn.disabled = false; showPending();
  }
  refreshPill(); showPending();

  return h("section", { class: "setting glass" },
    h("div", { class: "setting-head" }, h("div", { class: "ico" }, icon("key", 22)), h("div", null, h("h2", null, "Gemini (đọc chữ trên ảnh)"), h("p", null, "Máy tự đọc chữ và điền các ô khi bạn thêm ảnh.")), pill),
    h("p", { class: "soon" }, "Chưa có key? Tạo miễn phí tại ", h("a", { href: "https://aistudio.google.com/apikey", target: "_blank", rel: "noopener noreferrer" }, "aistudio.google.com/apikey"), ". Key chỉ lưu trên máy này."),
    keyInput,
    h("div", { class: "actions" }, clearBtn, testBtn),
    result,
    h("label", { class: "label" }, "Model"), modelSel, modelTxt,
    h("label", { class: "switch-row" }, auto, h("span", null, "Tự đọc chữ khi thêm ảnh")),
    pendingInfo, rereadBtn,
  );
}

// Khối Google Drive: đăng nhập / đăng xuất / đồng bộ ngay + trạng thái.
function driveSection(cleanups) {
  const pill = h("span", { class: "status-pill" });
  const info = h("p", { class: "soon", "aria-live": "polite" });
  const msg = h("p", { class: "soon", "aria-live": "polite" });
  const signBtn = h("button", { type: "button", class: "btn btn-primary" });
  const syncBtn = h("button", { type: "button", class: "btn" }, "Đồng bộ ngay");
  const say = (t, ok) => { msg.textContent = t; msg.className = "soon " + (ok === true ? "ok-text" : ok === false ? "err-text" : ""); };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN", { hour12: false }) : "chưa lần nào");
  async function render() {
    const { state, message } = getStatus();
    const connected = wasSignedIn();
    pill.textContent = !connected ? "Chưa kết nối" : state === "syncing" ? "Đang đồng bộ" : state === "idle" ? "Đã đồng bộ" : state === "offline" ? "Chờ mạng" : state === "auth" ? "Cần đăng nhập lại" : state === "error" ? "Lỗi" : "Đã kết nối";
    const relogin = connected && state === "auth";
    signBtn.textContent = relogin ? "Đăng nhập lại Google" : connected ? "Đăng xuất Google" : "Đăng nhập Google";
    signBtn.className = connected && !relogin ? "btn" : "btn btn-primary";
    syncBtn.disabled = !connected || state === "syncing";
    try {
      const i = await getSyncInfo();
      info.textContent = connected
        ? `${message} · Đồng bộ thành công gần nhất: ${fmt(i.lastOkAt)} · ${i.pending} thay đổi đang chờ đẩy lên`
        : "Đăng nhập để lưu bằng chứng lên Google Drive của bạn và dùng được trên nhiều máy.";
    } catch { info.textContent = message; }
  }

  const report = (r) => say(`Xong: tải về ${r.pulled}, đẩy lên ${r.pushed} bản ghi.`, true);
  signBtn.addEventListener("click", async () => {
    signBtn.disabled = true;
    try {
      if (wasSignedIn() && getStatus().state !== "auth") {
        if (!confirm("Đăng xuất Google? Dữ liệu trên máy này vẫn còn, chỉ ngừng đồng bộ.")) return;
        signOut(); await resetConnection(); say("Đã đăng xuất.", true);
      } else {
        await signIn(); say("Đã đăng nhập. Đang đồng bộ…");
        syncNow({ manual: true }).then(report).catch((e) => say(e.message, false));
      }
    } catch (e) { say(e.message, false); }
    finally { signBtn.disabled = false; render(); }
  });
  syncBtn.addEventListener("click", async () => {
    syncBtn.disabled = true; say("Đang đồng bộ…");
    try { report(await syncNow({ manual: true })); }
    catch (e) { say(e.message || "Đồng bộ gặp lỗi.", false); }
    render();
  });
  cleanups.push(on("sync:status", render), on("auth:changed", render));
  render();

  return h("section", { class: "setting glass" },
    h("div", { class: "setting-head" }, h("div", { class: "ico" }, icon("cloud", 22)), h("div", null, h("h2", null, "Google Drive"), h("p", null, "Đồng bộ giữa điện thoại và máy tính.")), pill),
    info, h("div", { class: "actions" }, signBtn, syncBtn), msg,
    h("p", { class: "soon" }, "Cá Vàng chỉ thấy các file do chính nó tạo trong thư mục “CaVang” trên Drive, không đọc được file khác của bạn."));
}

// Khối tải sẵn ảnh đầy đủ khi có Wi-Fi: công tắc + số ảnh đã tải + nút xoá bản tải sẵn.
function prefetchSection(cleanups) {
  const info = h("p", { class: "soon", "aria-live": "polite" }, "Đang đếm…");
  const why = h("p", { class: "soon" });
  const msg = h("p", { class: "soon", "aria-live": "polite" });
  const sw = h("input", { type: "checkbox", checked: isPrefetchEnabled(), onchange: () => { setPrefetchEnabled(sw.checked); refresh(); } });
  const clearBtn = h("button", { type: "button", class: "btn", onclick: onClear }, "Xoá ảnh tải sẵn");
  let alive = true, busy = false;
  const mb = (b) => (b / 1048576 >= 10 ? Math.round(b / 1048576) : Math.round(b / 104857.6) / 10).toLocaleString("vi-VN");
  async function refresh() {
    if (!alive) return;
    try {
      const s = await getPrefetchStats();
      info.textContent = `Đã tải sẵn ${s.done}/${s.total} ảnh · ${mb(s.bytes)} MB`;
      why.textContent = !sw.checked ? "Đang tắt: ảnh cũ chỉ tải khi bạn mở xem."
        : s.running ? "Đang tải thêm ảnh…"
        : s.done >= s.total ? "Đã đủ — mở ảnh nào cũng hiện ngay, kể cả khi dùng 4G hoặc mất mạng."
        : s.reason ? `Tạm dừng: ${s.reason}.` : "Sẽ tự tải khi có Wi-Fi và app đang mở.";
      clearBtn.disabled = busy || s.done === 0;
    } catch { info.textContent = ""; }
  }
  async function onClear() {
    if (!confirm("Xoá các ảnh đầy đủ đã tải sẵn trên máy này? Ảnh nhỏ vẫn còn, ảnh trên Google Drive không bị ảnh hưởng (mở ảnh nào sẽ tải lại ảnh đó). Công tắc tải sẵn sẽ được tắt.")) return;
    busy = true; clearBtn.disabled = true; msg.textContent = "Đang xoá…";
    try {
      const n = await clearPrefetched();
      sw.checked = false;
      msg.textContent = `Đã xoá ${n} ảnh tải sẵn. Bật lại công tắc nếu muốn tải lại.`;
    } catch (e) { msg.textContent = "Không xoá được: " + (e.message || e); }
    busy = false; refresh();
  }
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(refresh, 800); };
  cleanups.push(on("prefetch:progress", later), on("prefetch:state", later), on("sync:status", later), () => { alive = false; clearTimeout(t); });
  refresh();
  return h("section", { class: "setting glass" },
    h("div", { class: "setting-head" }, h("div", { class: "ico" }, icon("image", 22)), h("div", null, h("h2", null, "Ảnh tải sẵn"), h("p", null, "Mở ảnh cũ nhanh, dùng được cả khi mất mạng."))),
    h("label", { class: "switch-row" }, sw, h("span", null, "Tải sẵn ảnh đầy đủ khi dùng Wi‑Fi")),
    info, why,
    h("p", { class: "soon" }, "Chỉ tải khi app đang mở, có Wi‑Fi, pin từ 20% (hoặc đang sạc) và máy còn trống bộ nhớ. Không tải khi đóng app nên không hao pin."),
    h("div", { class: "actions" }, clearBtn), msg);
}

// Khối sao lưu: xuất / nhập file JSON.
function backupSection() {
  const msg = h("p", { class: "soon", "aria-live": "polite" });
  const say = (t, ok) => { msg.textContent = t; msg.className = "soon " + (ok === true ? "ok-text" : ok === false ? "err-text" : ""); };
  const fileInput = h("input", { type: "file", accept: ".json,application/json", hidden: true });
  const exportBtn = h("button", { type: "button", class: "btn", onclick: onExport }, "Xuất sao lưu (JSON)");
  const importBtn = h("button", { type: "button", class: "btn", onclick: () => fileInput.click() }, "Nhập sao lưu");
  async function onExport() {
    exportBtn.disabled = true; say("Đang gom dữ liệu…");
    try {
      const r = await exportJson({ onProgress: (d, t) => say(`Đang gom dữ liệu… ${d}/${t}`) });
      const url = URL.createObjectURL(r.blob);
      const a = h("a", { href: url, download: `cavang-sao-luu-${todayStr()}.json` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      say(`Đã xuất ${r.records} bằng chứng, ${r.images} ảnh.` + (r.missing ? ` ${r.missing} ảnh chưa tải về máy này nên chưa có trong file (đăng nhập Google rồi xuất lại).` : ""), r.missing ? undefined : true);
    } catch (e) { say("Không xuất được: " + e.message, false); }
    finally { exportBtn.disabled = false; }
  }
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0]; fileInput.value = "";
    if (!f) return;
    importBtn.disabled = true; say("Đang nhập…");
    try {
      const r = await importJson(f, { onProgress: (d, t) => say(`Đang nhập… ${d}/${t}`) });
      say(`Xong: thêm ${r.added}, cập nhật ${r.updated}, bỏ qua ${r.skipped} (đã có bản mới hơn).`, true);
      toast("Đã nhập sao lưu");
    } catch (e) { say(e.message, false); }
    finally { importBtn.disabled = false; }
  });
  return h("section", { class: "setting glass" },
    h("div", { class: "setting-head" }, h("div", { class: "ico" }, icon("save", 22)), h("div", null, h("h2", null, "Sao lưu"), h("p", null, "Xuất / nhập dữ liệu để phòng mất máy."))),
    h("div", { class: "actions" }, exportBtn, importBtn), fileInput, msg);
}


// Phiên bản + nút "Tải lại bản mới" khi service worker đã tải xong bản mới đang chờ.
function versionSection() {
  const msg = h("p", { class: "soon", "aria-live": "polite" });
  const reloadBtn = h("button", { type: "button", class: "btn btn-primary", hidden: true, onclick: () => {
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    setTimeout(() => location.reload(), 1500); // dự phòng nếu không có controllerchange
  } }, "Tải lại bản mới");
  const checkBtn = h("button", { type: "button", class: "btn", onclick: check }, "Kiểm tra bản mới");
  let reg = null;
  const show = () => {
    const waiting = !!reg?.waiting;
    reloadBtn.hidden = !waiting;
    if (waiting) msg.textContent = "Đã tải xong bản mới. Bấm “Tải lại bản mới” để dùng (hãy lưu việc đang nhập dở trước).";
  };
  async function check() {
    if (!("serviceWorker" in navigator)) { msg.textContent = "Trình duyệt này không hỗ trợ cập nhật tự động."; return; }
    msg.textContent = "Đang kiểm tra…";
    try {
      reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { msg.textContent = "Chưa bật chế độ offline nên chưa có gì để cập nhật."; return; }
      await reg.update();
      if (reg.installing) await new Promise((res) => { reg.installing.addEventListener("statechange", function f() { if (this.state !== "installing") { this.removeEventListener("statechange", f); res(); } }); });
      show();
      if (!reg.waiting) msg.textContent = `Bạn đang dùng bản mới nhất (v${APP_VERSION}).`;
    } catch { msg.textContent = "Không kiểm tra được (có thể đang mất mạng)."; }
  }
  if ("serviceWorker" in navigator) {
    const had = !!navigator.serviceWorker.controller; // lần đầu cài (chưa có bản cũ) thì không cần tải lại
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) location.reload(); });
    navigator.serviceWorker.getRegistration().then((r) => { reg = r; show(); r?.addEventListener("updatefound", () => r.installing?.addEventListener("statechange", show)); }).catch(() => {});
  }
  return section("info", "Phiên bản", "Thông tin app.", null,
    h("p", null, `Cá Vàng v${APP_VERSION}`),
    getSetting("lastOpenMs") && h("p", { class: "soon" }, `Lần mở app gần nhất: thấy danh sách sau ${(getSetting("lastOpenMs") / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giây`),
    h("p", { class: "soon" }, `Cấu trúc dữ liệu: ${SCHEMA_VERSION} · Dữ liệu lưu trên máy này, và lên Google Drive nếu bạn đã đăng nhập`),
    msg, h("div", { class: "actions" }, checkBtn, reloadBtn));
}

export function renderSettings(root) {
  startOcrQueue();
  const cleanups = [];
  const counts = h("p", { class: "soon" }, "Đang đếm…");
  listRecords({ includeDeleted: true }).then((all) => {
    const trash = all.filter((r) => r.deleted).length;
    counts.textContent = `${all.length - trash} bằng chứng trên máy này · ${trash} trong thùng rác`;
  }).catch(() => { counts.textContent = ""; });
  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("h1", null, "Cài đặt")),
      h("div", { class: "settings" },
        geminiSection(),
        driveSection(cleanups),
        prefetchSection(cleanups),
        backupSection(),
        section("trash", "Thùng rác", "Khôi phục bằng chứng đã xoá (giữ 30 ngày).", null,
          counts,
          h("a", { class: "btn", href: "#/thung-rac" }, icon("trash", 18), "Mở thùng rác")),
        versionSection(),
      ),
    ),
  );
  return { destroy() { cleanups.forEach((f) => f()); } };
}
