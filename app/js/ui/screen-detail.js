// Màn Chi tiết: ảnh lớn (bấm để phóng to), thông tin, Sửa / Xoá (vào thùng rác).
import { h, icon, mount, toast } from "./dom.js";
import { DOC_TYPES, formatDate, collectValues } from "./common.js";
import { openLightbox } from "./components/lightbox.js";
import { tagInput } from "./components/tag-input.js";
import { getRecord, getFullBlob, listRecords, saveRecord, softDelete } from "../data/records.js";
import { TRASH_DAYS } from "../core/config.js";

function row(label, values) {
  const list = (Array.isArray(values) ? values : [values]).filter(Boolean);
  if (!list.length) return null;
  return h("div", { class: "kv" }, h("dt", null, label), h("dd", null, ...list.map((v) => h("span", { class: "chip chip-static" }, v))));
}

function confirmDelete(title, onYes) {
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const back = h("div", { class: "modal-back", onclick: (e) => { if (e.target === back) close(); } },
    h("div", { class: "modal glass-strong", role: "dialog", "aria-modal": "true", "aria-label": "Xác nhận xoá" },
      h("h2", null, "Xoá bằng chứng này?"),
      h("p", { class: "soon" }, `“${title}” sẽ vào thùng rác, khôi phục được trong ${TRASH_DAYS} ngày.`),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn", onclick: close }, "Giữ lại"),
        h("button", { type: "button", class: "btn btn-danger", onclick: () => { close(); onYes(); } }, icon("trash", 18), "Xoá"),
      )));
  document.addEventListener("keydown", onKey);
  document.body.append(back);
}

function notFound() {
  return h("section", { class: "screen" }, h("div", { class: "empty glass" }, icon("info", 32), h("h2", null, "Không tìm thấy bằng chứng"), h("p", null, "Có thể nó đã bị xoá hoặc nằm trong thùng rác."), h("p", null, h("a", { class: "btn btn-primary", href: "#/tim", style: { marginTop: "14px" } }, "Về trang tìm"))));
}

export function renderDetail(root, id) {
  let alive = true;
  let imgUrl = null;
  let r = null;

  async function load() {
    try {
      r = await getRecord(id);
      if (!alive) return;
      if (!r || r.deleted) { mount(root, notFound()); return; }
      if (r.kind === "image") {
        const blob = await getFullBlob(id);
        if (!alive) return;
        if (blob) imgUrl = URL.createObjectURL(blob);
      }
      view();
    } catch (err) {
      console.error(err);
      if (alive) mount(root, notFound());
    }
  }

  function media() {
    if (r.kind === "image") {
      return imgUrl
        ? h("div", { class: "detail-img glass" }, h("button", { type: "button", "aria-label": "Phóng to ảnh", onclick: () => openLightbox(imgUrl, r.title) }, h("img", { src: imgUrl, alt: "Ảnh: " + r.title })))
        : h("div", { class: "detail-text glass" }, "Không tìm thấy file ảnh trên máy này.");
    }
    return h("div", { class: "detail-text glass" }, r.text);
  }

  function view() {
    mount(root,
      h("section", { class: "screen" },
        h("div", { class: "topbar" },
          h("a", { class: "btn btn-icon", href: "#/tim", "aria-label": "Quay lại" }, icon("back", 22)),
          h("h1", null, "Chi tiết")),
        h("div", { class: "detail" },
          media(),
          h("div", { class: "info glass" },
            h("h2", null, r.title),
            h("dl", { class: "kv-list" },
              row("Loại giấy tờ", r.docType), row("Mã hàng", r.itemCodes), row("Số lô", r.lotNumbers),
              row("Đối tượng", r.subjects), row("Tình huống", r.situations),
              row("Ngày trên giấy tờ", r.docDate && formatDate(r.docDate)), row("Đã lưu lúc", formatDate(r.createdAt)), row("Ghi chú", r.note),
            ),
            r.ocrText && h("div", null, h("span", { class: "label" }, "Chữ đọc từ ảnh"), h("p", { class: "ocr" }, r.ocrText)),
            h("div", { class: "actions" },
              h("button", { type: "button", class: "btn", onclick: edit }, icon("edit", 18), "Sửa"),
              h("button", { type: "button", class: "btn btn-danger", onclick: () => confirmDelete(r.title, remove) }, icon("trash", 18), "Xoá"),
            ),
          ),
        ),
      ),
    );
  }

  async function remove() {
    try {
      await softDelete(id);
      toast(`Đã chuyển vào thùng rác (khôi phục trong ${TRASH_DAYS} ngày)`);
      location.hash = "#/tim";
    } catch (err) { console.error(err); toast("Không xoá được: " + (err.message || "lỗi không rõ"), "error"); }
  }

  async function edit() {
    const all = await listRecords().catch(() => []);
    const sug = (f) => collectValues(all, f);
    const fTitle = h("input", { class: "field", id: "e-title", value: r.title });
    const fType = h("select", { class: "field", id: "e-type" }, ...[...new Set([...DOC_TYPES, r.docType])].map((t) => h("option", { value: t, selected: t === r.docType }, t)));
    const fDate = h("input", { class: "field", id: "e-date", type: "date", value: r.docDate || "" });
    const fNote = h("textarea", { class: "field", id: "e-note", rows: 3 }); fNote.value = r.note || "";
    const items = tagInput({ name: "e-ma", label: "Mã hàng", values: r.itemCodes, suggestions: sug("itemCodes") });
    const lots = tagInput({ name: "e-lo", label: "Số lô", values: r.lotNumbers, suggestions: sug("lotNumbers") });
    const subjects = tagInput({ name: "e-dt", label: "Đối tượng", values: r.subjects, suggestions: sug("subjects") });
    const situations = tagInput({ name: "e-th", label: "Tình huống", values: r.situations, suggestions: sug("situations") });
    const fText = r.kind === "text" ? h("textarea", { class: "field", id: "e-text", rows: 6 }) : null;
    if (fText) fText.value = r.text || "";
    const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, icon("save", 18), "Lưu thay đổi");

    const form = h("form", { class: "panel glass", novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const title = fTitle.value.trim();
      if (!title) { toast("Tiêu đề không được để trống.", "error"); fTitle.focus(); return; }
      saveBtn.disabled = true;
      try {
        r = await saveRecord({
          id, title, docType: fType.value, docDate: fDate.value || "", note: fNote.value.trim(),
          itemCodes: items.getValues(), lotNumbers: lots.getValues(), subjects: subjects.getValues(), situations: situations.getValues(),
          ...(fText ? { text: fText.value } : {}),
        });
        toast("Đã lưu thay đổi");
        if (alive) view();
      } catch (err) { console.error(err); saveBtn.disabled = false; toast("Không lưu được: " + (err.message || "lỗi không rõ"), "error"); }
    } },
      h("div", { class: "form-grid two" },
        h("div", { class: "span2" }, h("label", { class: "label", for: "e-title" }, "Tiêu đề"), fTitle),
        h("div", null, h("label", { class: "label", for: "e-type" }, "Loại giấy tờ"), fType),
        h("div", null, h("label", { class: "label", for: "e-date" }, "Ngày trên giấy tờ"), fDate),
        h("div", null, items), h("div", null, lots), h("div", null, subjects), h("div", null, situations),
        fText && h("div", { class: "span2" }, h("label", { class: "label", for: "e-text" }, "Nội dung"), fText),
        h("div", { class: "span2" }, h("label", { class: "label", for: "e-note" }, "Ghi chú"), fNote),
      ),
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn", onclick: view }, "Huỷ"), saveBtn),
    );
    mount(root,
      h("section", { class: "screen" },
        h("div", { class: "topbar" }, h("button", { type: "button", class: "btn btn-icon", "aria-label": "Huỷ sửa", onclick: view }, icon("back", 22)), h("h1", null, "Sửa thông tin")),
        h("div", { class: "detail" }, media(), form)));
    fTitle.focus();
  }

  mount(root, h("section", { class: "screen" }, h("div", { class: "empty glass" }, h("p", null, "Đang mở…"))));
  load();
  return { destroy: () => { alive = false; if (imgUrl) URL.revokeObjectURL(imgUrl); } };
}
