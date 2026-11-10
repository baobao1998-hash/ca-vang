// Màn Chi tiết: ảnh lớn (bấm để phóng to), toàn bộ thông tin, nút Sửa/Xoá.
import { h, icon, mount, toast } from "./dom.js";
import { getMock, formatDate } from "./mock.js";

function row(label, values) {
  const list = (Array.isArray(values) ? values : [values]).filter(Boolean);
  if (!list.length) return null;
  return h("div", { class: "kv" }, h("dt", null, label), h("dd", null, ...list.map((v) => h("span", { class: "chip chip-static" }, v))));
}

function openLightbox(src, alt) {
  const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const box = h("div", { class: "lightbox", role: "dialog", "aria-label": "Xem ảnh lớn", onclick: close },
    h("img", { src, alt }),
    h("button", { type: "button", class: "btn btn-icon", "aria-label": "Đóng", onclick: close }, icon("close", 22)));
  document.addEventListener("keydown", onKey);
  document.body.append(box);
}

function confirmDelete(title) {
  const close = () => back.remove();
  const back = h("div", { class: "modal-back", onclick: (e) => { if (e.target === back) close(); } },
    h("div", { class: "modal glass-strong", role: "dialog", "aria-modal": "true", "aria-label": "Xác nhận xoá" },
      h("h2", null, "Xoá bằng chứng này?"),
      h("p", { class: "soon" }, `“${title}” sẽ vào thùng rác, khôi phục được trong 30 ngày.`),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn", onclick: close }, "Giữ lại"),
        h("button", { type: "button", class: "btn btn-danger", onclick: () => { close(); toast("Đã chuyển vào thùng rác (giả)"); location.hash = "#/tim"; } }, icon("trash", 18), "Xoá"),
      )));
  document.body.append(back);
}

export function renderDetail(root, id) {
  const r = getMock(id);
  if (!r) {
    mount(root, h("section", { class: "screen" }, h("div", { class: "empty glass" }, icon("info", 32), h("h2", null, "Không tìm thấy bằng chứng"), h("p", null, "Có thể nó đã bị xoá."), h("p", null, h("a", { class: "btn btn-primary", href: "#/tim", style: { marginTop: "14px" } }, "Về trang tìm")))));
    return;
  }
  const media = r.imageUrl
    ? h("div", { class: "detail-img glass" }, h("button", { type: "button", "aria-label": "Phóng to ảnh", onclick: () => openLightbox(r.imageUrl, r.title) }, h("img", { src: r.imageUrl, alt: "Ảnh: " + r.title })))
    : h("div", { class: "detail-text glass" }, r.text);

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" },
        h("a", { class: "btn btn-icon", href: "#/tim", "aria-label": "Quay lại" }, icon("back", 22)),
        h("h1", null, "Chi tiết")),
      h("div", { class: "detail" },
        media,
        h("div", { class: "info glass" },
          h("h2", null, r.title),
          h("dl", { class: "kv-list" },
            row("Loại giấy tờ", r.docType), row("Mã hàng", r.itemCodes), row("Số lô", r.lotNumbers),
            row("Đối tượng", r.subjects), row("Tình huống", r.situations),
            row("Ngày trên giấy tờ", r.docDate && formatDate(r.docDate)), row("Ghi chú", r.note),
          ),
          r.ocrText && h("div", null, h("span", { class: "label" }, "Chữ đọc từ ảnh"), h("p", { class: "ocr" }, r.ocrText)),
          h("div", { class: "actions" },
            h("button", { type: "button", class: "btn", onclick: () => toast("Sửa sẽ có ở bản sau (giả)") }, icon("edit", 18), "Sửa"),
            h("button", { type: "button", class: "btn btn-danger", onclick: () => confirmDelete(r.title) }, icon("trash", 18), "Xoá"),
          ),
        ),
      ),
    ),
  );
}
