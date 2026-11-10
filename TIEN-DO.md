# TIẾN ĐỘ — Bảng việc Cá Vàng

Trạng thái: `⬜ CHƯA LÀM` · `🔒 ĐANG LÀM — <ngày>` · `✅ XONG — vX.Y.Z` · `⛔ TẠM DỪNG`

**Luật song song:** chỉ chạy cùng lúc các việc có ký hiệu 🔀 trong **cùng một giai đoạn** (vì chúng sửa các file khác nhau). Việc không có 🔀 → chạy một mình.
Prompt giao việc: xem `docs/GIAO-VIEC.md`.

---

## GĐ0 — Nền móng (Opus lập kế hoạch)
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 0.1 | Kiến trúc, quy tắc, bảng việc, Git | `CLAUDE.md`, `docs/*`, `TIEN-DO.md`, `NHAT-KY-PHIEN-BAN.md`, `.gitignore`, `scripts/*`, `.claude/*`, `app/js/core/version.js` | ✅ XONG — v0.0.1 |

## GĐ1 — Khung app + giao diện kính mờ (dữ liệu giả) → v0.1.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 1.1 🔀 | Khung PWA + giao diện Liquid Glass 4 màn (Tìm, Thêm, Chi tiết, Cài đặt) với dữ liệu giả | `app/index.html`, `app/manifest.webmanifest`, `app/sw.js`, `app/icons/*`, `app/css/*`, `app/js/main.js`, `app/js/ui/*` | ✅ XONG — v0.1.0 |
| 1.2 🔀 | Lõi dữ liệu: core/*, IndexedDB, records, search (MiniSearch, bỏ dấu), settings + trang test `app/dev/test.html` | `app/js/core/*` (trừ version.js), `app/js/data/*`, `app/vendor/*`, `app/dev/*` | ✅ XONG — v0.1.0 |
| 1.3 🔀 | Xử lý ảnh: nén, thumbnail, đọc ảnh từ dán/chọn/chụp | `app/js/services/image.js` | ✅ XONG — v0.1.0 |

## GĐ2 — Ghép nối: app chạy thật trên 1 máy (offline) → v0.2.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 2.1 | Nối UI với dữ liệu thật: thêm/sửa/xoá mềm/thùng rác, tìm tức thì, bộ lọc chip, xem ảnh phóng to, dán ảnh Ctrl+V | `app/js/ui/*`, `app/js/main.js`, `app/css/*` | ✅ XONG — v0.2.0 |

## GĐ3 — Đọc chữ trên ảnh bằng Gemini → v0.3.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 3.1 | `services/gemini.js` + màn Cài đặt nhập/kiểm tra key + gợi ý thẻ ở màn Thêm + hàng đợi OCR "pending" | `app/js/services/gemini.js`, `app/js/ui/*`, `app/css/*`, `app/index.html` (CSP), `app/js/core/config.js` (danh mục), `docs/KIEN-TRUC.md` (dòng danh mục) | ✅ XONG — v0.3.0 |
| 3.2 | Sửa sau v0.3.0: bỏ giả lập còn sót khi thử, prompt Gemini trung tính (việc + cá nhân), trường `area` (schema 2), loại mới, sửa service worker + nút "Tải lại bản mới" | `app/js/services/gemini.js`, `app/js/ui/*`, `app/css/*`, `app/js/core/*`, `app/js/data/records.js`, `app/js/data/search.js`, `app/sw.js`, `app/js/main.js` (chỉ dòng đăng ký sw), `docs/KIEN-TRUC.md` | ✅ XONG — v0.3.1 |
| 3.3 | Thông báo "Đã lưu" che menu trên máy tính → chuyển xuống đáy màn hình (máy tính) | `app/css/app.css` | ✅ XONG — v0.3.2 |
| 3.T | 👤 **Việc của chủ dự án:** tạo Gemini API key (có hướng dẫn) | — | ✅ XONG |

## GĐ4 — Đồng bộ Google Drive → v0.4.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 4.T | 👤 **Việc của chủ dự án:** tạo Google Cloud project + OAuth Client ID (phiên 4.1 sẽ hướng dẫn từng bước) | — | ✅ XONG |
| 4.1 | auth.js + drive.js + sync.js + backup.js (snapshot ngày), trạng thái đồng bộ trong UI | `app/js/services/auth.js`, `drive.js`, `sync.js`, `backup.js`, `app/js/ui/screen-settings.js`, `app/js/main.js`, `app/js/core/config.js`, `app/index.html` (chỉ CSP), `app/sw.js` (chỉ SHELL + không chặn request Google), `app/css/*` (chấm trạng thái), `app/js/data/records.js` (chỉ hook tải ảnh đầy đủ từ Drive) | ✅ XONG — v0.4.0 |
| 4.2 | Sửa đăng nhập Google hay bị hỏi lại (nhớ token tới hết hạn, xin lại khi chạm, báo lỗi dễ hiểu) + đồng bộ 2 máy nhanh hơn (kéo khi mở/quay lại, nhịp ngắn khi đang mở) | `app/js/services/auth.js`, `app/js/services/sync.js`, `app/js/ui/screen-settings.js`, `docs/KIEN-TRUC.md` (dòng auth) | ✅ XONG — v0.5.0 |

## GĐ5 — Đưa lên mạng + cài trên Android → v0.5.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 5.T | 👤 **Việc của chủ dự án:** tạo tài khoản GitHub | — | ✅ XONG |
| 5.1 | GitHub repo + GitHub Actions deploy `app/` lên Pages, nút "Chia sẻ → Cá Vàng" trên Android (share_target), cập nhật Client ID/referrer | `.github/*`, `app/manifest.webmanifest`, `app/sw.js`, `app/index.html`, `app/js/main.js`, `app/js/ui/screen-add.js`, `app/js/core/config.js`, `docs/HUONG-DAN-CHO-CHU.md` | ✅ XONG — v0.5.0 |

## GĐ6 — Hoàn thiện → v1.0.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 6.1 | Rà soát bảo mật (CSP, XSS, key) + hiệu năng tìm kiếm 10.000 bản ghi | toàn bộ (chỉ sửa lỗi) | ✅ XONG — v0.5.1 (Phần C: xem nhật ký) |
| 6.2 | Xuất "hồ sơ trình bày": chọn nhiều bằng chứng → in/xuất PDF kèm ghi chú | `app/js/ui/*`, `app/css/*` | ✅ XONG — v0.6.0 |
| 6.3 | Tải sẵn ảnh đầy đủ khi có Wi-Fi (công tắc) + Background Sync một lần cho outbox khi app đã đóng (không làm Periodic Sync) + đo tốc độ mở app | `app/js/services/prefetch.js` (mới), `app/js/services/sync.js`, `auth.js`, `drive.js`, `app/js/data/records.js`, `app/js/ui/screen-settings.js`, `app/js/main.js`, `app/sw.js`, `app/css/*`, `docs/KIEN-TRUC.md` | ✅ XONG — v0.5.2 |
| 6.4 | Sửa cập nhật app: nút "Tải lại bản mới" luôn hiện (thiếu CSS `[hidden]`), so phiên bản với máy chủ, cập nhật cưỡng bức + báo có bản mới khi mở app | `app/css/glass.css`, `app/js/ui/updater.js` (mới), `app/js/ui/screen-settings.js`, `app/js/main.js`, `app/sw.js`, `scripts/stamp_version.py` (mới), `.github/workflows/pages.yml` | ✅ XONG — v0.5.3 |
| 6.5 | Điện thoại: thông báo "Đã lưu" che nút quay lại → chuyển xuống ngay trên thanh menu dưới, gọn hơn | `app/css/app.css` | ✅ XONG — v0.5.4 |

---
## Ý tưởng để sau (chưa duyệt)
- Nhắc "bằng chứng hết hạn" (CO/CQ có hạn).
- Liên kết các bằng chứng cùng một lô/vụ việc.
- Tìm bằng giọng nói.
