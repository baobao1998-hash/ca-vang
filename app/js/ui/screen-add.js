// Màn Thêm: nhiều ảnh (chọn/chụp/kéo thả/Ctrl+V) hoặc dán văn bản + các ô thông tin → lưu IndexedDB.
import { h, icon, mount, toast } from "./dom.js";
import { collectValues, formatDate } from "./common.js";
import { tagInput } from "./components/tag-input.js";
import { AREAS } from "../core/config.js";
import { dateInput } from "./components/date-input.js";
import { docTypeInput } from "./components/doc-type.js";
import { analyzeImage, analyzeText, hasKey, isRetryable } from "../services/gemini.js";
import { getSetting } from "../data/settings.js";
import { startOcrQueue } from "./ocr-queue.js";
import { fileListToImages, makeThumb, readClipboardImage } from "../services/image.js";
import { saveRecord, listRecords } from "../data/records.js";

// Ảnh dán ở màn khác được chuyển sang đây (xem main.js).
let stash = [];
export function stashImages(files) { stash = stash.concat(files); }
// Văn bản được chia sẻ từ app khác (Android "Chia sẻ → Cá Vàng") → điền sẵn vào ô văn bản.
let stashedText = "";
export function stashText(text) { stashedText = text; }

export function renderAdd(root) {
  let alive = true;
  let busy = false;
  startOcrQueue();
  const autoOn = () => getSetting("aiAuto", true) !== false;
  // Ô người dùng đã tự sửa → máy không ghi đè. Ô máy điền → có dấu "✨ gợi ý" cho tới khi người dùng sửa.
  const touched = new Set();
  const aiSet = new Set();
  const labelOf = {};
  let privacy = false;
  let textJob = null, textAnalysis = null, textFor = "";
  const pics = []; // { id, blob, width, height, file, url }
  let seq = 0;

  const grid = h("div", { class: "pic-grid", hidden: true });
  const status = h("p", { class: "hint", "aria-live": "polite" });
  const fileInput = h("input", { type: "file", accept: "image/*", multiple: true, class: "sr-only", tabindex: "-1", onchange: () => { take(fileInput.files); fileInput.value = ""; } });
  const camInput = h("input", { type: "file", accept: "image/*", capture: "environment", class: "sr-only", tabindex: "-1", onchange: () => { take(camInput.files); camInput.value = ""; } });
  const pasteText = h("textarea", { class: "field", id: "paste-text", placeholder: "Hoặc dán nội dung email / tin nhắn vào đây…", rows: 4, onchange: () => { if (autoOn()) analyzeTextNow(); }, oninput: drawAi });
  const drop = h("div", { class: "dropzone" },
    icon("image", 36),
    h("p", null, "Kéo ảnh thả vào đây, hoặc"),
    h("div", { class: "dz-actions" },
      h("button", { type: "button", class: "btn", onclick: () => fileInput.click() }, icon("image", 18), "Chọn ảnh"),
      h("button", { type: "button", class: "btn", onclick: () => camInput.click() }, icon("camera", 18), "Chụp ảnh"),
    ),
    h("p", { class: "hint" }, "Chọn được nhiều ảnh một lúc. Máy tính: nhấn Ctrl+V để dán ảnh chụp màn hình."),
    fileInput, camInput,
  );

  function drawPics() {
    grid.hidden = pics.length === 0;
    grid.replaceChildren(...pics.map((p) => h("div", { class: "pic" },
      h("img", { src: p.url, alt: "Ảnh đã chọn" }),
      h("button", { type: "button", class: "pic-x", "aria-label": "Bỏ ảnh này", onclick: () => { URL.revokeObjectURL(p.url); pics.splice(pics.indexOf(p), 1); drawPics(); } }, icon("close", 14)))));
    drawAi();
    status.textContent = pics.length ? `Đã chọn ${pics.length} ảnh. Mỗi ảnh sẽ lưu thành 1 bằng chứng, dùng chung thông tin bên cạnh.` : "";
  }

  async function take(files) {
    const list = [...(files || [])];
    if (!list.length) return;
    status.textContent = "Đang xử lý ảnh…";
    const { images, errors } = await fileListToImages(list);
    if (!alive) return;
    for (const im of images) pics.push({ id: ++seq, ...im, url: URL.createObjectURL(im.blob) });
    drawPics();
    for (const e of errors) toast(e, "error", 4500);
    readAll();
  }

  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => take(e.dataTransfer.files));

  // Các ô thông tin (có gợi ý từ giá trị đã dùng; nạp xong mới có gợi ý)
  const userEdit = (key) => () => { touched.add(key); clearAi(key); };
  const items = tagInput({ name: "ma-hang", label: "Mã hàng", placeholder: "VD: KDC-0.8", hint: "Nhập nhiều mã: Enter sau mỗi mã.", onchange: userEdit("itemCodes") });
  const lots = tagInput({ name: "so-lo", label: "Số lô", placeholder: "VD: 2410", onchange: userEdit("lotNumbers") });
  const subjects = tagInput({ name: "doi-tuong", label: "Đối tượng", placeholder: "Khách hàng / NCC / người", hint: "Ai liên quan tới bằng chứng này?", onchange: userEdit("subjects") });
  const situations = tagInput({ name: "tinh-huong", label: "Tình huống", placeholder: "VD: Đấu thầu 2026 BV A", hint: "Dùng cho việc gì?", onchange: userEdit("situations") });
  const fTitle = h("input", { class: "field", id: "f-title", placeholder: "VD: CO/CQ kim điện cực lô 2410 (bỏ trống cũng được)", oninput: userEdit("title") });
  const fType = docTypeInput({ id: "f-type", onchange: userEdit("docType") });
  const fDate = dateInput({ id: "f-date", onchange: userEdit("docDate") });
  const fArea = h("select", { class: "field", id: "f-area", onchange: userEdit("area") }, ...AREAS.map(([v, t]) => h("option", { value: v }, t)));
  const fNote = h("textarea", { class: "field", id: "f-note", rows: 3, placeholder: "Ghi chú tự do…" });
  const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, icon("save", 18), "Lưu");
  const aiBox = h("div", { class: "ai-box" });
  const privacyBox = h("input", { type: "checkbox", id: "f-private", onchange: () => { privacy = privacyBox.checked; drawAi(); } });
  const readBtn = h("button", { type: "button", class: "btn", onclick: () => readAll(true) }, "✨ Đọc chữ bằng AI");
  const aiNote = h("p", { class: "hint", "aria-live": "polite" });
  aiBox.append(
    h("label", { class: "switch-row" }, privacyBox, h("span", null, "Không gửi AI (riêng tư) — giữ bằng chứng này chỉ trên máy")),
    readBtn, aiNote);

  function setAi(key, labelEl) {
    labelOf[key] = labelEl;
    const old = labelEl.querySelector(".ai-badge"); if (old) old.remove();
  }
  function markAi(key) {
    aiSet.add(key);
    const l = labelOf[key];
    if (l && !l.querySelector(".ai-badge")) l.append(h("span", { class: "ai-badge", title: "Máy tự điền, bạn sửa được" }, "✨ gợi ý"));
  }
  function clearAi(key) {
    aiSet.delete(key);
    labelOf[key]?.querySelector(".ai-badge")?.remove();
  }
  function drawAi() {
    const hasInput = pics.length > 0 || pasteText.value.trim().length > 0;
    aiBox.hidden = !hasInput;
    readBtn.hidden = privacy || !hasKey();
    readBtn.disabled = inflight() > 0;
    aiNote.textContent = privacy ? "Bằng chứng này sẽ KHÔNG gửi cho AI (riêng tư)."
      : !hasKey() ? "Chưa có key Gemini nên máy chưa tự đọc được — vào Cài đặt để dán key (có thể bỏ qua, vẫn lưu bình thường)."
      : inflight() > 0 ? "Đang đọc chữ…" : autoOn() ? "Máy sẽ tự đọc chữ và điền gợi ý; ô nào bạn đã gõ thì máy không ghi đè." : "Tự đọc đang tắt (Cài đặt). Bấm “Đọc chữ bằng AI” nếu muốn.";
  }

  // ----- Điền kết quả của Gemini vào các ô, tôn trọng ô người dùng đã gõ -----
  function applyResult(a) {
    if (!touched.has("title") && a.title && !fTitle.value.trim()) { fTitle.value = a.title; markAi("title"); }
    if (!touched.has("docType") && a.docType && !aiSet.has("docType")) { fType.setValue(a.docType); if (a.docType !== "Khác") markAi("docType"); }
    if (!touched.has("area") && a.area && !aiSet.has("area")) { fArea.value = a.area; markAi("area"); }
    if (!touched.has("docDate") && a.docDate && fDate.isEmpty()) { fDate.setIso(a.docDate); markAi("docDate"); }
    for (const [key, comp] of [["itemCodes", items], ["lotNumbers", lots], ["subjects", subjects], ["situations", situations]]) {
      if (touched.has(key) || !a[key]?.length) continue;
      const merged = [...new Set([...comp.getValues(), ...a[key]])];
      if (merged.length !== comp.getValues().length) { comp.setValues(merged); markAi(key); }
    }
  }

  async function analyzePic(p, force) {
    if (privacy || !hasKey() || p.job || (p.analysis && !force) ) return;
    p.analysis = null; p.error = null;
    p.job = analyzeImage(p.blob).then((a) => { p.analysis = a; if (alive) applyResult(a); })
      .catch((err) => { p.error = err; if (alive && !isRetryable(err)) toast(err.message, "error", 5000); })
      .finally(() => { p.job = null; if (alive) { drawAi(); } });
    drawAi();
    return p.job;
  }
  const inflight = () => pics.filter((p) => p.job).length + (textJob ? 1 : 0);

  async function analyzeTextNow() {
    const t = pasteText.value.trim();
    if (privacy || !hasKey() || t.length < 15 || textJob || (t === textFor && textAnalysis)) return;
    textFor = t; textAnalysis = null;
    textJob = analyzeText(t).then((a) => { textAnalysis = a; if (alive) applyResult(a); })
      .catch((err) => { textFor = ""; if (alive && !isRetryable(err)) toast(err.message, "error", 5000); })
      .finally(() => { textJob = null; if (alive) drawAi(); });
    drawAi();
    return textJob;
  }
  function readAll(force = false) {
    if (!force && !autoOn()) return;
    for (const p of pics) analyzePic(p, force);
    analyzeTextNow();
  }

  // Gợi ý từ các giá trị đã dùng trước đó
  listRecords().then((all) => {
    if (!alive) return;
    items.setSuggestions(collectValues(all, "itemCodes"));
    lots.setSuggestions(collectValues(all, "lotNumbers"));
    subjects.setSuggestions(collectValues(all, "subjects"));
    situations.setSuggestions(collectValues(all, "situations"));
  }).catch(() => {});

  function titleFor(index, total, pic, text) {
    const base = fTitle.value.trim();
    if (pic) {
      const name = (pic.file?.name || "").replace(/\.[^.]+$/, "");
      const t = base || (name && !/^image\d*$/i.test(name) ? name : `Ảnh ngày ${formatDate(new Date().toISOString())}`);
      return total > 1 ? `${t} (${index + 1}/${total})` : t;
    }
    return base || text.split(/\r?\n/)[0].slice(0, 60);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const text = pasteText.value.trim();
    if (!pics.length && !text) { toast("Hãy chọn ảnh hoặc dán văn bản trước khi lưu.", "error"); return; }
    const docDate = fDate.getIso();
    if (docDate === null) { toast("Ngày chưa đúng. Hãy gõ dạng ngày/tháng/năm, ví dụ 05/10/2026.", "error"); fDate.focus(); return; }
    busy = true;
    saveBtn.disabled = true;
    if (inflight() > 0) { status.textContent = "Đang đợi máy đọc chữ xong (tối đa 30 giây)…"; await Promise.allSettled([...pics.map((p) => p.job), textJob]); }
    const docType = fType.commit();
    const common = {
      docType, docDate, area: fArea.value, note: fNote.value.trim(),
      itemCodes: items.getValues(), lotNumbers: lots.getValues(),
      subjects: subjects.getValues(), situations: situations.getValues(),
    };
    // Trạng thái đọc chữ: đã đọc → "done"; lỗi tạm thời (mất mạng/hết hạn mức) → "pending" để máy tự thử lại; còn lại "none"/"error".
    const ocrOf = (analysis, error, wantAi) => {
      if (privacy || !wantAi) return { ocrStatus: "none" };
      if (analysis) return { ocrStatus: "done" };
      if (error) return { ocrStatus: isRetryable(error) ? "pending" : "error" };
      return { ocrStatus: hasKey() && autoOn() ? "pending" : "none" };
    };
    const total = pics.length + (text ? 1 : 0);
    const imgTotal = pics.length;
    let saved = 0, lastId = null;
    try {
      for (let i = 0; i < pics.length; i++) {
        const p = pics[i];
        status.textContent = `Đang lưu ${saved + 1}/${total}…`;
        const thumb = await makeThumb(p.blob, 320);
        const rec = await saveRecord({
          ...common, kind: "image", title: titleFor(i, imgTotal, p),
          ocrText: p.analysis?.ocrText || "", ...ocrOf(p.analysis, p.error, true),
          file: { driveId: null, mime: "image/jpeg", width: p.width, height: p.height, bytes: p.blob.size, originalName: p.file?.name || "" },
        }, { blob: { full: p.blob, thumb } });
        saved++; lastId = rec.id;
      }
      if (text) {
        const ta = textFor === text ? textAnalysis : null;
        const rec = await saveRecord({ ...common, kind: "text", title: titleFor(0, 1, null, text), text, ...ocrOf(ta, null, text.length >= 15) });
        saved++; lastId = rec.id;
      }
    } catch (err) {
      console.error(err);
      toast(saved ? `Chỉ lưu được ${saved}/${total} bằng chứng. Lỗi: ${err.message}` : `Không lưu được: ${err.message || "lỗi không rõ"}`, "error", 5000);
      busy = false; saveBtn.disabled = false; status.textContent = "";
      return;
    }
    toast(saved === 1 ? "Đã lưu bằng chứng" : `Đã lưu ${saved} bằng chứng`);
    location.hash = saved === 1 ? "#/chi-tiet/" + encodeURIComponent(lastId) : "#/tim";
  }

  function lbl(key, forId, text) { const l = h("label", { class: "label", for: forId }, text); setAi(key, l); return l; }
  for (const [k, c] of [["itemCodes", items], ["lotNumbers", lots], ["subjects", subjects], ["situations", situations]]) setAi(k, c.querySelector(".label"));

  const form = h("form", { class: "panel glass", novalidate: true, onsubmit: onSubmit },
    h("div", { class: "form-grid two" },
      h("div", { class: "span2" }, lbl("title", "f-title", "Tiêu đề"), fTitle),
      h("div", null, lbl("docType", "f-type", "Loại giấy tờ"), fType.el),
      h("div", null, lbl("area", "f-area", "Lĩnh vực"), fArea),
      h("div", null, lbl("docDate", "f-date", "Ngày trên giấy tờ"), fDate.el),
      h("div", null, items), h("div", null, lots),
      h("div", null, subjects), h("div", null, situations),
      h("div", { class: "span2" }, h("label", { class: "label", for: "f-note" }, "Ghi chú"), fNote),
    ),
    h("div", { class: "actions" },
      h("a", { class: "btn", href: "#/tim" }, "Huỷ"),
      saveBtn,
    ),
  );

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("h1", null, "Thêm bằng chứng")),
      h("div", { class: "form-layout" },
        h("div", { class: "panel glass" }, drop, grid, status, aiBox, h("div", null, h("label", { class: "label", for: "paste-text" }, "Văn bản (lưu thành một bằng chứng riêng)"), pasteText)),
        form,
      ),
    ),
  );

  // Dán ảnh bằng Ctrl+V
  const onPaste = (e) => {
    const files = readClipboardImage(e);
    if (files.length) { e.preventDefault(); take(files); toast(files.length > 1 ? `Đã dán ${files.length} ảnh` : "Đã dán ảnh"); }
  };
  document.addEventListener("paste", onPaste);

  drawAi();
  if (stash.length) { const f = stash; stash = []; take(f); }
  if (stashedText) { pasteText.value = stashedText; stashedText = ""; drawAi(); if (autoOn()) analyzeTextNow(); }

  return {
    destroy: () => { alive = false; document.removeEventListener("paste", onPaste); for (const p of pics) URL.revokeObjectURL(p.url); },
  };
}
