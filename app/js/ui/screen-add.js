// Màn Thêm: nhiều ảnh (chọn/chụp/kéo thả/Ctrl+V) hoặc dán văn bản + các ô thông tin → lưu IndexedDB.
import { h, icon, mount, toast } from "./dom.js";
import { DOC_TYPES, collectValues, formatDate } from "./common.js";
import { tagInput } from "./components/tag-input.js";
import { fileListToImages, makeThumb, readClipboardImage } from "../services/image.js";
import { saveRecord, listRecords } from "../data/records.js";

// Ảnh dán ở màn khác được chuyển sang đây (xem main.js).
let stash = [];
export function stashImages(files) { stash = stash.concat(files); }

export function renderAdd(root) {
  let alive = true;
  let busy = false;
  const pics = []; // { id, blob, width, height, file, url }
  let seq = 0;

  const grid = h("div", { class: "pic-grid", hidden: true });
  const status = h("p", { class: "hint", "aria-live": "polite" });
  const fileInput = h("input", { type: "file", accept: "image/*", multiple: true, class: "sr-only", tabindex: "-1", onchange: () => { take(fileInput.files); fileInput.value = ""; } });
  const camInput = h("input", { type: "file", accept: "image/*", capture: "environment", class: "sr-only", tabindex: "-1", onchange: () => { take(camInput.files); camInput.value = ""; } });
  const pasteText = h("textarea", { class: "field", id: "paste-text", placeholder: "Hoặc dán nội dung email / tin nhắn vào đây…", rows: 4 });
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
  }

  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => take(e.dataTransfer.files));

  // Các ô thông tin (có gợi ý từ giá trị đã dùng; nạp xong mới có gợi ý)
  const items = tagInput({ name: "ma-hang", label: "Mã hàng", placeholder: "VD: KDC-0.8", hint: "Nhập nhiều mã: Enter sau mỗi mã." });
  const lots = tagInput({ name: "so-lo", label: "Số lô", placeholder: "VD: 2410" });
  const subjects = tagInput({ name: "doi-tuong", label: "Đối tượng", placeholder: "Khách hàng / NCC / người", hint: "Ai liên quan tới bằng chứng này?" });
  const situations = tagInput({ name: "tinh-huong", label: "Tình huống", placeholder: "VD: Đấu thầu 2026 BV A", hint: "Dùng cho việc gì?" });
  const fTitle = h("input", { class: "field", id: "f-title", placeholder: "VD: CO/CQ kim điện cực lô 2410 (bỏ trống cũng được)" });
  const fType = h("select", { class: "field", id: "f-type" }, ...DOC_TYPES.map((t) => h("option", { value: t }, t)));
  const fDate = h("input", { class: "field", id: "f-date", type: "date" });
  const fNote = h("textarea", { class: "field", id: "f-note", rows: 3, placeholder: "Ghi chú tự do…" });
  const saveBtn = h("button", { type: "submit", class: "btn btn-primary" }, icon("save", 18), "Lưu");

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
    busy = true;
    saveBtn.disabled = true;
    const common = {
      docType: fType.value, docDate: fDate.value || "", note: fNote.value.trim(),
      itemCodes: items.getValues(), lotNumbers: lots.getValues(),
      subjects: subjects.getValues(), situations: situations.getValues(),
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
          file: { driveId: null, mime: "image/jpeg", width: p.width, height: p.height, bytes: p.blob.size, originalName: p.file?.name || "" },
        }, { blob: { full: p.blob, thumb } });
        saved++; lastId = rec.id;
      }
      if (text) {
        const rec = await saveRecord({ ...common, kind: "text", title: titleFor(0, 1, null, text), text });
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

  const form = h("form", { class: "panel glass", novalidate: true, onsubmit: onSubmit },
    h("div", { class: "form-grid two" },
      h("div", { class: "span2" }, h("label", { class: "label", for: "f-title" }, "Tiêu đề"), fTitle),
      h("div", null, h("label", { class: "label", for: "f-type" }, "Loại giấy tờ"), fType),
      h("div", null, h("label", { class: "label", for: "f-date" }, "Ngày trên giấy tờ"), fDate),
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
        h("div", { class: "panel glass" }, drop, grid, status, h("div", null, h("label", { class: "label", for: "paste-text" }, "Văn bản (lưu thành một bằng chứng riêng)"), pasteText)),
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

  if (stash.length) { const f = stash; stash = []; take(f); }

  return {
    destroy: () => { alive = false; document.removeEventListener("paste", onPaste); for (const p of pics) URL.revokeObjectURL(p.url); },
  };
}
