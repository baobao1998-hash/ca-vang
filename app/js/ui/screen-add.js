// Màn Thêm: ảnh (thả/chọn/chụp) hoặc dán văn bản + các ô thông tin. Nút Lưu chỉ báo "giả" ở GĐ1.
import { h, icon, mount, toast } from "./dom.js";
import { DOC_TYPES } from "./mock.js";
import { tagInput } from "./components/tag-input.js";

export function renderAdd(root) {
  let previewUrl = null;
  const preview = h("img", { class: "preview", alt: "Ảnh đã chọn", hidden: true });
  const fileInput = h("input", { type: "file", accept: "image/*", class: "sr-only", tabindex: "-1", onchange: () => take(fileInput.files[0]) });
  const camInput = h("input", { type: "file", accept: "image/*", capture: "environment", class: "sr-only", tabindex: "-1", onchange: () => take(camInput.files[0]) });
  const pasteText = h("textarea", { class: "field", id: "paste-text", placeholder: "Hoặc dán nội dung email / tin nhắn vào đây…", rows: 4 });
  const drop = h("div", { class: "dropzone" },
    icon("image", 36),
    h("p", null, "Kéo ảnh thả vào đây, hoặc"),
    h("div", { class: "dz-actions" },
      h("button", { type: "button", class: "btn", onclick: () => fileInput.click() }, icon("image", 18), "Chọn ảnh"),
      h("button", { type: "button", class: "btn", onclick: () => camInput.click() }, icon("camera", 18), "Chụp ảnh"),
    ),
    h("p", { class: "hint" }, "Máy tính: nhấn Ctrl+V để dán ảnh chụp màn hình."),
    fileInput, camInput,
  );

  function take(file) {
    if (!file || !file.type.startsWith("image/")) { if (file) toast("Tệp này không phải ảnh.", "error"); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.hidden = false;
  }
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => take(e.dataTransfer.files[0]));

  const items = tagInput({ name: "ma-hang", label: "Mã hàng", placeholder: "VD: KDC-0.8", hint: "Nhập nhiều mã: Enter sau mỗi mã." });
  const lots = tagInput({ name: "so-lo", label: "Số lô", placeholder: "VD: 2410" });
  const subjects = tagInput({ name: "doi-tuong", label: "Đối tượng", placeholder: "Khách hàng / NCC / người", hint: "Ai liên quan tới bằng chứng này?" });
  const situations = tagInput({ name: "tinh-huong", label: "Tình huống", placeholder: "VD: Đấu thầu 2026 BV A", hint: "Dùng cho việc gì?" });

  const form = h("form", { class: "panel glass", novalidate: true, onsubmit: (e) => { e.preventDefault(); toast("Đã lưu (giả)"); } },
    h("div", { class: "form-grid two" },
      h("div", { class: "span2" }, h("label", { class: "label", for: "f-title" }, "Tiêu đề"), h("input", { class: "field", id: "f-title", placeholder: "VD: CO/CQ kim điện cực lô 2410" })),
      h("div", null, h("label", { class: "label", for: "f-type" }, "Loại giấy tờ"), h("select", { class: "field", id: "f-type" }, ...DOC_TYPES.map((t) => h("option", { value: t }, t)))),
      h("div", null, h("label", { class: "label", for: "f-date" }, "Ngày trên giấy tờ"), h("input", { class: "field", id: "f-date", type: "date" })),
      h("div", null, items), h("div", null, lots),
      h("div", null, subjects), h("div", null, situations),
      h("div", { class: "span2" }, h("label", { class: "label", for: "f-note" }, "Ghi chú"), h("textarea", { class: "field", id: "f-note", rows: 3, placeholder: "Ghi chú tự do…" })),
    ),
    h("div", { class: "actions" },
      h("a", { class: "btn", href: "#/tim" }, "Huỷ"),
      h("button", { type: "submit", class: "btn btn-primary" }, icon("save", 18), "Lưu"),
    ),
  );

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("h1", null, "Thêm bằng chứng")),
      h("div", { class: "form-layout" },
        h("div", { class: "panel glass" }, drop, preview, h("div", null, h("label", { class: "label", for: "paste-text" }, "Văn bản"), pasteText)),
        form,
      ),
    ),
  );

  // Dán ảnh bằng Ctrl+V
  const onPaste = (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) { take(f); toast("Đã dán ảnh"); }
  };
  document.addEventListener("paste", onPaste);
  return { destroy: () => { document.removeEventListener("paste", onPaste); if (previewUrl) URL.revokeObjectURL(previewUrl); } };
}
