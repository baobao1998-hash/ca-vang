// Màn Cài đặt: các mục để trống (sẽ nối ở GĐ3, GĐ4). Phiên bản đọc từ core/version.js.
import { h, icon, mount } from "./dom.js";
import { listRecords } from "../data/records.js";
import { APP_VERSION, SCHEMA_VERSION } from "../core/version.js";
import { GEMINI_MODELS, GEMINI_DEFAULT_MODEL } from "../core/config.js";
import { getSetting, setSetting } from "../data/settings.js";
import { testKey, getKey, getModel } from "../services/gemini.js";
import { runOcrQueue, pendingCount, startOcrQueue } from "./ocr-queue.js";

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
  const clearBtn = h("button", { type: "button", class: "btn", onclick: () => { setSetting("geminiKey", null); keyInput.value = ""; keyInput.placeholder = "Dán Gemini API key…"; refreshPill(); say("Đã xoá key khỏi máy này."); } }, "Xoá key");

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

export function renderSettings(root) {
  startOcrQueue();
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
        section("cloud", "Google Drive", "Đồng bộ giữa điện thoại và máy tính.", "Chưa kết nối",
          h("button", { type: "button", class: "btn", disabled: true }, "Đăng nhập Google"),
          h("p", { class: "soon" }, "Chưa dùng được — sẽ bật ở giai đoạn 4.")),
        section("save", "Sao lưu", "Xuất / nhập dữ liệu để phòng mất máy.", "Sắp có",
          h("div", { class: "actions" },
            h("button", { type: "button", class: "btn", disabled: true }, "Xuất sao lưu"),
            h("button", { type: "button", class: "btn", disabled: true }, "Nhập sao lưu"))),
        section("trash", "Thùng rác", "Khôi phục bằng chứng đã xoá (giữ 30 ngày).", null,
          counts,
          h("a", { class: "btn", href: "#/thung-rac" }, icon("trash", 18), "Mở thùng rác")),
        section("info", "Phiên bản", "Thông tin app.", null,
          h("p", null, `Cá Vàng v${APP_VERSION}`),
          h("p", { class: "soon" }, `Cấu trúc dữ liệu: ${SCHEMA_VERSION} · Dữ liệu lưu trên máy này (chưa đồng bộ)`)),
      ),
    ),
  );
}
