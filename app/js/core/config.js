// Hằng số dùng chung.
export const DB_NAME = "cavang";
export const DB_VERSION = 1;
export const SETTINGS_PREFIX = "cavang.";

export const DRIVE_ROOT_NAME = "CaVang";
export const DRIVE_SUBFOLDERS = { files: "files", records: "records", snapshots: "snapshots" };
export const SNAPSHOT_KEEP = 30;

export const IMAGE_MAX_SIDE = 2000;
export const IMAGE_QUALITY = 0.85;
export const THUMB_SIDE = 320;
export const THUMB_QUALITY = 0.7;

export const TRASH_DAYS = 30;
export const SEARCH_DEBOUNCE_MS = 80;
// Model mặc định: gói miễn phí, ổn định (tra tài liệu Google ngày 2026-11-10; gemini-2.5-flash đã bị ngừng).
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
// Các model gợi ý trong Cài đặt (đều có gói miễn phí). Người dùng vẫn gõ được tên model khác.
export const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash", "gemini-2.5-flash-lite"];
export const GEMINI_TIMEOUT_MS = 30000;
// Loại giấy tờ do người dùng tự thêm được lưu ở cài đặt này (mảng chữ).
export const CUSTOM_DOCTYPES_KEY = "customDocTypes";

export const DOC_TYPES = ["CO/CQ", "Hoá đơn", "Hợp đồng", "Báo giá", "Đơn hàng", "Chứng từ thanh toán", "Tài liệu/Sách", "Email", "Tin nhắn", "Biên bản", "Khác"];
