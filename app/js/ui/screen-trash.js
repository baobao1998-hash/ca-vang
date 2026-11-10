// Màn Thùng rác: các bằng chứng đã xoá, khôi phục được trong 30 ngày (sau đó app tự xoá hẳn).
import { h, icon, mount, toast } from "./dom.js";
import { thumbImg } from "./common.js";
import { listRecords, restore } from "../data/records.js";
import { TRASH_DAYS } from "../core/config.js";

const daysLeft = (r) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / 86400000));

export function renderTrash(root) {
  let alive = true;
  const list = h("div", { class: "trash-list" });

  function draw(items) {
    if (!items.length) {
      mount(list, h("div", { class: "empty glass" }, icon("trash", 32), h("h2", null, "Thùng rác trống"), h("p", null, "Bằng chứng bị xoá sẽ nằm ở đây " + TRASH_DAYS + " ngày để bạn khôi phục.")));
      return;
    }
    mount(list, ...items.map((r) => h("div", { class: "trash-row glass" },
      r.kind === "image" ? thumbImg(r, "trash-thumb") : h("div", { class: "trash-thumb thumb-text" }, r.text),
      h("div", { class: "trash-info" },
        h("h3", { class: "card-title" }, r.title),
        h("p", { class: "soon" }, `Còn ${daysLeft(r)} ngày trước khi xoá hẳn`)),
      h("button", { type: "button", class: "btn", onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { await restore(r.id); toast("Đã khôi phục"); draw(items.filter((x) => x.id !== r.id)); items = items.filter((x) => x.id !== r.id); }
        catch (err) { console.error(err); toast("Không khôi phục được: " + (err.message || "lỗi không rõ"), "error"); e.currentTarget.disabled = false; }
      } }, "Khôi phục"),
    )));
  }
  let items = [];

  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("a", { class: "btn btn-icon", href: "#/cai-dat", "aria-label": "Quay lại" }, icon("back", 22)), h("h1", null, "Thùng rác")),
      list));

  listRecords({ includeDeleted: true }).then((all) => {
    if (!alive) return;
    items = all.filter((r) => r.deleted).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    draw(items);
  }).catch((err) => { console.error(err); toast("Không đọc được thùng rác.", "error"); });

  return { destroy: () => { alive = false; } };
}
