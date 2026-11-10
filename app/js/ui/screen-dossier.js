// Màn Hồ sơ (#/ho-so): từ các bằng chứng đã chọn ở màn Tìm → soạn tiêu đề, ghi chú trình bày, sắp thứ tự → xem trước / "Lưu PDF / In".
// Không lưu lại hồ sơ (tạo xong là xong). Mọi chữ đi qua h() (không innerHTML).
import { h, icon, mount, toast } from "./dom.js";
import { formatDate, daysAgoIso } from "./common.js";
import { AREA_LABEL } from "../core/config.js";
import { getRecord, getFullBlob, getThumbUrl } from "../data/records.js";

// Danh sách id đã chọn + nội dung form được giữ ở mức module để quay lại màn Tìm rồi vào lại không mất.
let pending = [];
let form = { title: "", note: "", ocr: false, touched: false };

/** Màn Tìm gọi hàm này trước khi chuyển sang #/ho-so. */
export function setDossierSelection(ids) {
  pending = [...ids];
  form = { title: "", note: "", ocr: false, touched: false };
}

/** Gợi ý tiêu đề: tình huống phổ biến nhất; thêm đối tượng nếu cả bộ cùng một đối tượng. */
function suggestTitle(items) {
  const count = (field) => {
    const m = new Map();
    for (const r of items) for (const v of new Set(r[field] || [])) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sit = count("situations")[0];
  const sub = count("subjects")[0];
  const parts = [];
  if (sit) parts.push(sit[0]);
  if (sub && (sub[1] === items.length || !sit)) parts.push(sub[0]);
  return parts.length ? "Hồ sơ " + parts.join(" – ") : "Hồ sơ bằng chứng";
}

function metaRows(r) {
  const rows = [
    ["Loại giấy tờ", r.docType],
    ["Lĩnh vực", AREA_LABEL[r.area] || "Công việc"],
    ["Ngày trên giấy tờ", r.docDate ? formatDate(r.docDate) : ""],
    ["Mã hàng", (r.itemCodes || []).join(", ")],
    ["Số lô", (r.lotNumbers || []).join(", ")],
    ["Đối tượng", (r.subjects || []).join(", ")],
    ["Tình huống", (r.situations || []).join(", ")],
    ["Ghi chú", r.note],
  ];
  return rows.filter(([, v]) => v);
}

export function renderDossier(root) {
  let alive = true;
  let items = [];
  const prepared = new Map(); // id -> { url, low, missing, own }
  let shown = false;
  let busy = false;
  let rebuildTimer = 0;

  const titleInput = h("input", { class: "field", id: "dos-title", type: "text", maxlength: "200", autocomplete: "off", placeholder: "Ví dụ: Hồ sơ căn cứ lô 2410" });
  const noteInput = h("textarea", { class: "field", id: "dos-note", rows: "4", maxlength: "3000", placeholder: "Ví dụ: Kính gửi anh/chị… Dưới đây là các giấy tờ làm căn cứ cho kết quả ngày…" });
  const ocrBox = h("input", { type: "checkbox" });
  const list = h("div", { class: "dos-list" });
  const count = h("p", { class: "hint" });
  const progress = h("div", { class: "dos-progress", hidden: true, role: "status", "aria-live": "polite" });
  const preview = h("div", { class: "dos-preview" });
  const btnPreview = h("button", { type: "button", class: "btn", onclick: () => run(false) }, "Xem trước");
  const btnPrint = h("button", { type: "button", class: "btn btn-primary", onclick: () => run(true) }, icon("save", 18), "Lưu PDF / In");

  titleInput.addEventListener("input", () => { form.title = titleInput.value; form.touched = true; scheduleRebuild(); });
  noteInput.addEventListener("input", () => { form.note = noteInput.value; scheduleRebuild(); });
  ocrBox.addEventListener("change", () => { form.ocr = ocrBox.checked; scheduleRebuild(); });

  function scheduleRebuild() {
    if (!shown) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(buildPreview, 200);
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    pending = items.map((r) => r.id);
    drawList();
    scheduleRebuild();
  }
  function removeAt(i) {
    items.splice(i, 1);
    pending = items.map((r) => r.id);
    if (!items.length) { drawAll(); return; }
    if (!form.touched) { form.title = suggestTitle(items); titleInput.value = form.title; }
    drawList();
    scheduleRebuild();
  }

  function drawList() {
    count.textContent = `${items.length} bằng chứng — dùng nút mũi tên để đổi thứ tự, dấu × để bỏ khỏi hồ sơ.`;
    list.replaceChildren(...items.map((r, i) => h("div", { class: "dos-row glass" },
      h("span", { class: "dos-num" }, String(i + 1)),
      h("div", { class: "dos-row-info" },
        h("strong", null, r.title),
        h("span", null, [r.docType, r.docDate ? formatDate(r.docDate) : ""].filter(Boolean).join(" · "))),
      h("div", { class: "dos-row-btns" },
        h("button", { type: "button", class: "btn btn-icon btn-ghost", "aria-label": `Đưa “${r.title}” lên`, disabled: i === 0, onclick: () => move(i, -1) }, icon("up", 20)),
        h("button", { type: "button", class: "btn btn-icon btn-ghost", "aria-label": `Đưa “${r.title}” xuống`, disabled: i === items.length - 1, onclick: () => move(i, 1) }, icon("down", 20)),
        h("button", { type: "button", class: "btn btn-icon btn-ghost btn-danger", "aria-label": `Bỏ “${r.title}” khỏi hồ sơ`, onclick: () => removeAt(i) }, icon("close", 20))),
    )));
  }

  // ----- Chuẩn bị ảnh đầy đủ (tải từ Drive nếu chưa có trên máy) -----
  async function prepareImages() {
    const need = items.filter((r) => r.kind === "image" && !prepared.has(r.id));
    let low = 0;
    for (let i = 0; i < need.length; i++) {
      const r = need[i];
      progress.hidden = false;
      mount(progress, h("p", null, `Đang chuẩn bị ảnh ${i + 1}/${need.length}…`), h("progress", { max: String(need.length), value: String(i) }));
      const entry = { url: "", low: false, missing: false, own: false };
      try {
        const blob = await getFullBlob(r.id);
        if (blob) { entry.url = URL.createObjectURL(blob); entry.own = true; }
      } catch (e) { console.warn("Không lấy được ảnh đầy đủ:", e); }
      if (!entry.url) {
        entry.url = (await getThumbUrl(r.id).catch(() => null)) || "";
        entry.low = !!entry.url;
        entry.missing = !entry.url;
        low++;
      }
      if (!alive) { if (entry.own) URL.revokeObjectURL(entry.url); return 0; }
      prepared.set(r.id, entry);
    }
    progress.hidden = true;
    return low;
  }

  // ----- Trang hồ sơ (dùng chung cho xem trước và in) -----
  function itemPage(r, n) {
    const pic = prepared.get(r.id);
    const rows = metaRows(r);
    return h("section", { class: "dos-page dos-item" },
      h("h2", { class: "dos-h2" }, `${n}. ${r.title}`),
      rows.length > 0 && h("dl", { class: "dos-meta" }, rows.map(([k, v]) => [h("dt", null, k), h("dd", null, v)])),
      r.kind === "image" && (pic && pic.url
        ? h("img", { class: "dos-img", src: pic.url, alt: "Ảnh: " + r.title })
        : h("p", { class: "dos-warn" }, "Không có ảnh của bằng chứng này trên máy.")),
      r.kind === "image" && pic && pic.low && h("p", { class: "dos-warn" }, "Lưu ý: đây là ảnh nhỏ (chưa tải được ảnh đầy đủ từ Google Drive)."),
      r.kind === "text" && h("div", { class: "dos-text" }, r.text),
      form.ocr && r.kind === "image" && r.ocrText && h("div", { class: "dos-ocr" }, h("strong", null, "Chữ đọc từ ảnh"), h("div", null, r.ocrText)),
    );
  }

  function buildPreview() {
    if (!alive || !items.length) return;
    const title = form.title.trim() || "Hồ sơ bằng chứng";
    const note = form.note.trim();
    mount(preview,
      h("section", { class: "dos-page dos-cover" },
        h("h1", { class: "dos-title" }, title),
        h("p", { class: "dos-sub" }, `Ngày lập: ${formatDate(daysAgoIso(0))} · ${items.length} bằng chứng`),
        note && h("div", { class: "dos-notebox" }, h("h2", { class: "dos-h2" }, "Ghi chú trình bày"), h("p", null, note)),
        h("h2", { class: "dos-h2" }, "Mục lục"),
        h("ol", { class: "dos-toc" }, items.map((r, i) => h("li", null,
          h("span", { class: "dos-toc-n" }, `${i + 1}.`),
          h("span", null, r.title, h("small", null, [r.docType, r.docDate ? formatDate(r.docDate) : ""].filter(Boolean).join(" · "))))))),
      ...items.map((r, i) => itemPage(r, i + 1)));
    shown = true;
  }

  async function run(print) {
    if (busy || !items.length) return;
    busy = true;
    btnPreview.disabled = btnPrint.disabled = true;
    try {
      const low = await prepareImages();
      if (!alive) return;
      buildPreview();
      if (low > 0) toast(`${low} ảnh chưa tải được bản đầy đủ — dùng ảnh nhỏ và đã ghi chú trong hồ sơ.`, "error", 6000);
      if (print) {
        // Chờ ảnh giải mã xong rồi mới mở hộp thoại in, tránh in ra trang trắng.
        await Promise.all([...preview.querySelectorAll("img")].map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
        const old = document.title;
        document.title = (form.title.trim() || "Hồ sơ bằng chứng").slice(0, 100); // tên gợi ý cho file PDF
        const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
        window.addEventListener("afterprint", restore);
        window.print();
        setTimeout(restore, 60000);
      } else {
        preview.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e) {
      console.error(e);
      toast("Không tạo được hồ sơ. Hãy thử lại.", "error");
    } finally {
      busy = false;
      btnPreview.disabled = btnPrint.disabled = false;
    }
  }

  function drawAll() {
    if (!items.length) {
      mount(root, h("section", { class: "screen" },
        h("div", { class: "topbar" }, h("a", { class: "btn btn-icon", href: "#/tim", "aria-label": "Quay lại" }, icon("back", 22)), h("h1", null, "Hồ sơ")),
        h("div", { class: "empty glass" }, icon("info", 32), h("h2", null, "Chưa chọn bằng chứng nào"),
          h("p", null, "Ở màn Tìm, bấm “Chọn nhiều”, tick các bằng chứng cần đưa vào hồ sơ rồi bấm “Tạo hồ sơ”."),
          h("p", null, h("a", { class: "btn btn-primary", href: "#/tim", style: { marginTop: "14px" } }, "Về trang tìm")))));
      return;
    }
    titleInput.value = form.title;
    noteInput.value = form.note;
    ocrBox.checked = form.ocr;
    drawList();
    mount(root, h("section", { class: "screen dossier" },
      h("div", { class: "dos-controls no-print" },
        h("div", { class: "topbar" }, h("a", { class: "btn btn-icon", href: "#/tim", "aria-label": "Quay lại" }, icon("back", 22)), h("h1", null, "Hồ sơ trình bày")),
        h("div", { class: "panel glass" },
          h("div", null, h("label", { class: "label", for: "dos-title" }, "Tiêu đề hồ sơ"), titleInput, h("p", { class: "hint" }, "Gợi ý từ tình huống/đối tượng chung của các bằng chứng; sửa tuỳ ý.")),
          h("div", null, h("label", { class: "label", for: "dos-note" }, "Ghi chú trình bày"), noteInput, h("p", { class: "hint" }, "Người đọc sẽ thấy ngay ở đầu hồ sơ. Có thể để trống.")),
          h("label", { class: "switch-row" }, ocrBox, "Kèm chữ đọc từ ảnh (dưới mỗi ảnh)"),
          h("div", null, h("span", { class: "label" }, "Thứ tự các bằng chứng"), count, list),
          h("div", { class: "actions" }, btnPreview, btnPrint),
          progress,
          h("p", { class: "hint" }, "“Lưu PDF / In” mở hộp thoại in của trình duyệt: chọn máy in, hoặc chọn “Lưu dưới dạng PDF”. Ảnh đầy đủ chưa có trên máy sẽ được tải từ Google Drive trước."),
        )),
      preview));
    if (shown) buildPreview();
  }

  (async () => {
    try {
      const recs = await Promise.all(pending.map((id) => getRecord(id).catch(() => null)));
      if (!alive) return;
      items = recs.filter((r) => r && !r.deleted);
      pending = items.map((r) => r.id);
      if (!form.touched) form.title = suggestTitle(items);
      drawAll();
    } catch (e) {
      console.error(e);
      drawAll();
    }
  })();

  return {
    destroy: () => {
      alive = false;
      clearTimeout(rebuildTimer);
      for (const p of prepared.values()) if (p.own) URL.revokeObjectURL(p.url);
    },
  };
}
