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

export const DOC_TYPES = ["CO/CQ", "Hoá đơn", "Hợp đồng", "Báo giá", "Đơn hàng", "Chứng từ thanh toán", "Tài liệu/Sách", "Giấy tờ cá nhân", "Ảnh chụp màn hình", "Email", "Tin nhắn", "Biên bản", "Khác"];

// Lĩnh vực của bằng chứng (schema 2). Bản ghi cũ mặc định "work".
export const AREAS = [["work", "Công việc"], ["personal", "Cá nhân"]];
export const AREA_LABEL = Object.fromEntries(AREAS);

// Google Drive (GĐ4). Client ID là thông tin CÔNG KHAI theo thiết kế của Google (không phải bí mật). Tuyệt đối không dùng client secret.
export const GOOGLE_CLIENT_ID = "52248784861-n8cdav9t9pebijkuecb3pos161l6doha.apps.googleusercontent.com";
// drive.file: app chỉ thấy các file do chính app tạo, không đọc được file khác trong Drive.
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
