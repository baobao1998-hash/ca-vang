// Chuẩn hoá tiếng Việt để tìm kiếm: bỏ dấu, đ→d, chữ thường.
export function normalizeVi(str) {
  if (str == null) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}
