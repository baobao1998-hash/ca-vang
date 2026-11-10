// Màn Cài đặt: các mục để trống (sẽ nối ở GĐ3, GĐ4). Phiên bản đọc từ core/version.js.
import { h, icon, mount } from "./dom.js";
import { listRecords } from "../data/records.js";
import { APP_VERSION, SCHEMA_VERSION } from "../core/version.js";

function section(ico, title, desc, status, ...body) {
  return h("section", { class: "setting glass" },
    h("div", { class: "setting-head" },
      h("div", { class: "ico" }, icon(ico, 22)),
      h("div", null, h("h2", null, title), h("p", null, desc)),
      status && h("span", { class: "status-pill" }, status)),
    ...body);
}

export function renderSettings(root) {
  const counts = h("p", { class: "soon" }, "Đang đếm…");
  listRecords({ includeDeleted: true }).then((all) => {
    const trash = all.filter((r) => r.deleted).length;
    counts.textContent = `${all.length - trash} bằng chứng trên máy này · ${trash} trong thùng rác`;
  }).catch(() => { counts.textContent = ""; });
  mount(root,
    h("section", { class: "screen" },
      h("div", { class: "topbar" }, h("h1", null, "Cài đặt")),
      h("div", { class: "settings" },
        section("key", "Gemini (đọc chữ trên ảnh)", "Dán key để app tự đọc chữ từ ảnh.", "Sắp có",
          h("input", { class: "field", type: "password", placeholder: "Dán Gemini API key…", disabled: true, autocomplete: "off", "aria-label": "Gemini API key" }),
          h("p", { class: "soon" }, "Chưa dùng được — sẽ bật ở giai đoạn 3.")),
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
