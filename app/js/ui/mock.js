// DỮ LIỆU GIẢ — chỉ để xem giao diện (GĐ1). Từ GĐ2 sẽ thay bằng dữ liệu thật trong IndexedDB.
// Dạng bản ghi theo docs/KIEN-TRUC.md mục 4 (thêm imageUrl để hiện ảnh giả).

export const DOC_TYPES = ["CO/CQ", "Hoá đơn", "Hợp đồng", "Báo giá", "Email", "Tin nhắn", "Biên bản", "Khác"];

const PALETTE = {
  "CO/CQ": ["#ffb347", "#ff7e5f"],
  "Hoá đơn": ["#7ee8a8", "#2bb673"],
  "Hợp đồng": ["#8ec5ff", "#5b7cfa"],
  "Báo giá": ["#ffd86b", "#f59e0b"],
  "Email": ["#c4b5fd", "#8b5cf6"],
  "Tin nhắn": ["#a7f3d0", "#14b8a6"],
  "Biên bản": ["#fbcfe8", "#ec4899"],
  "Khác": ["#d1d5db", "#6b7280"],
};

/** Vẽ ảnh giả (giống tờ giấy) bằng SVG → data URL. Chỉ dùng chữ cố định của mock. */
function fakeDoc(docType, title) {
  const w = 640, h = 480;
  const [c1, c2] = PALETTE[docType] || PALETTE["Khác"];
  const lines = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => `<rect x="150" y="${150 + i * 34}" width="${i % 3 === 2 ? 240 : 340}" height="9" rx="4.5" fill="#1f2937" opacity="${0.12 + (i % 2) * 0.06}"/>`)
    .join("");
  const safe = title.replace(/[<>&"]/g, "").slice(0, 28);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/><rect x="110" y="48" width="420" height="400" rx="14" fill="#fff" opacity=".93"/>` +
    `<rect x="150" y="84" width="150" height="14" rx="7" fill="${c2}"/>` +
    `<text x="150" y="132" font-family="sans-serif" font-size="17" font-weight="700" fill="#111827">${safe}</text>${lines}` +
    `<circle cx="470" cy="388" r="26" fill="none" stroke="${c2}" stroke-width="4" opacity=".7"/></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function rec(i, o) {
  const created = new Date(Date.UTC(2026, 10, 10 - i, 8, 30)).toISOString();
  return {
    id: "mock" + String(i).padStart(3, "0"),
    schema: 1,
    kind: "image",
    createdAt: created,
    updatedAt: created,
    deleted: false,
    itemCodes: [], lotNumbers: [], subjects: [], situations: [], tags: [], note: "", text: "", ocrText: "",
    ocrStatus: "done",
    imageUrl: o.kind === "text" ? null : fakeDoc(o.docType, o.title),
    ...o,
  };
}

export const MOCK_RECORDS = [
  rec(0, { title: "CO/CQ kim điện cực lô 2410", docType: "CO/CQ", itemCodes: ["KDC-0.8"], lotNumbers: ["2410"], subjects: ["Bệnh viện A"], situations: ["Đấu thầu 2026 BV A"], docDate: "2026-10-05", note: "Bản gốc có dấu đỏ của nhà sản xuất.", ocrText: "CERTIFICATE OF ORIGIN — Electrode needle KDC-0.8 — Lot 2410 — Made in Germany" }),
  rec(1, { title: "Hoá đơn VAT số 00231 — kim điện cực", docType: "Hoá đơn", itemCodes: ["KDC-0.8"], lotNumbers: ["2410"], subjects: ["Công ty Minh Phát"], situations: ["Nhập hàng tháng 10"], docDate: "2026-10-12", ocrText: "HOÁ ĐƠN GTGT số 00231 — Tổng cộng 48.500.000 đồng" }),
  rec(2, { title: "Hợp đồng cung cấp vật tư y tế 2026", docType: "Hợp đồng", subjects: ["Bệnh viện A"], situations: ["Đấu thầu 2026 BV A"], docDate: "2026-09-20", note: "Hiệu lực 12 tháng, có phụ lục giá.", ocrText: "HỢP ĐỒNG KINH TẾ số 15/2026/HĐ-VTYT" }),
  rec(3, { title: "Báo giá máy thở VT-300", docType: "Báo giá", itemCodes: ["VT-300"], subjects: ["Công ty Hoàng Long"], situations: ["Chào giá khoa ICU"], docDate: "2026-10-28", ocrText: "BÁO GIÁ — Máy thở VT-300 — 1 bộ — 385.000.000 đ" }),
  rec(4, { title: "Email xác nhận giao hàng đợt 2", docType: "Email", kind: "text", subjects: ["Chị Lan (Minh Phát)"], situations: ["Nhập hàng tháng 10"], docDate: "2026-10-14", text: "Chào anh, em xác nhận lô hàng đợt 2 sẽ giao ngày 16/10. Kèm theo là CO/CQ bản scan.\nThân, Lan." }),
  rec(5, { title: "Tin nhắn Zalo: đồng ý giảm giá 5%", docType: "Tin nhắn", kind: "text", subjects: ["Anh Tuấn (BV A)"], situations: ["Đấu thầu 2026 BV A"], docDate: "2026-10-18", text: "Tuấn: OK em, bên anh đồng ý giảm 5% nếu đặt trên 20 bộ nhé." }),
  rec(6, { title: "Biên bản bàn giao thiết bị khoa ICU", docType: "Biên bản", itemCodes: ["VT-300"], subjects: ["Bệnh viện A", "Khoa ICU"], situations: ["Bàn giao Q4"], docDate: "2026-11-02", note: "Có chữ ký 3 bên.", ocrText: "BIÊN BẢN BÀN GIAO — Máy thở VT-300 — Khoa ICU" }),
  rec(7, { title: "CO/CQ dây thở người lớn lô 2408", docType: "CO/CQ", itemCodes: ["DT-AD-22"], lotNumbers: ["2408"], subjects: ["Bệnh viện B"], situations: ["Đấu thầu 2026 BV B"], docDate: "2026-08-30", ocrText: "Certificate of Quality — Breathing circuit adult — Lot 2408" }),
  rec(8, { title: "Hoá đơn vận chuyển hàng đợt 2", docType: "Hoá đơn", subjects: ["Vận tải Nam Việt"], situations: ["Nhập hàng tháng 10"], docDate: "2026-10-16", ocrText: "Cước vận chuyển 2.300.000 đ" }),
  rec(9, { title: "Báo giá kim điện cực đối thủ", docType: "Báo giá", itemCodes: ["KDC-0.8"], subjects: ["Công ty Đại Phát"], situations: ["Đấu thầu 2026 BV A"], docDate: "2026-10-01", note: "Giá thấp hơn nhưng không có CO.", ocrText: "BÁO GIÁ kim điện cực KDC-0.8 — 12.000 đ/cái" }),
  rec(10, { title: "Email hỏi thông số kỹ thuật máy thở", docType: "Email", kind: "text", itemCodes: ["VT-300"], subjects: ["Bệnh viện B"], situations: ["Đấu thầu 2026 BV B"], docDate: "2026-09-02", text: "Kính gửi quý công ty, đề nghị cung cấp thông số kỹ thuật chi tiết máy thở VT-300 để hoàn thiện hồ sơ." }),
  rec(11, { title: "Giấy phép lưu hành dây thở", docType: "Khác", itemCodes: ["DT-AD-22"], subjects: ["Bộ Y tế"], situations: ["Hồ sơ năng lực"], docDate: "2025-12-15", ocrText: "GIẤY PHÉP LƯU HÀNH TRANG THIẾT BỊ Y TẾ" }),
];

export function getMock(id) {
  return MOCK_RECORDS.find((r) => r.id === id) || null;
}

/** Lọc đơn giản bằng includes (có bỏ dấu cơ bản). Việc tìm thật dùng MiniSearch ở GĐ2. */
const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
export function mockSearch(query, docType) {
  const q = strip(query.trim());
  return MOCK_RECORDS.filter((r) => {
    if (docType && r.docType !== docType) return false;
    if (!q) return true;
    const hay = strip([r.title, r.docType, ...r.itemCodes, ...r.lotNumbers, ...r.subjects, ...r.situations, r.note, r.text, r.ocrText].join(" "));
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
