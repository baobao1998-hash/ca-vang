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
| 2.1 | Nối UI với dữ liệu thật: thêm/sửa/xoá mềm/thùng rác, tìm tức thì, bộ lọc chip, xem ảnh phóng to, dán ảnh Ctrl+V | `app/js/ui/*`, `app/js/main.js`, `app/css/*` | 🔒 ĐANG LÀM — 2026-11-10 |

## GĐ3 — Đọc chữ trên ảnh bằng Gemini → v0.3.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 3.1 | `services/gemini.js` + màn Cài đặt nhập/kiểm tra key + gợi ý thẻ ở màn Thêm + hàng đợi OCR "pending" | `app/js/services/gemini.js`, `app/js/ui/screen-add.js`, `app/js/ui/screen-settings.js`, `app/js/ui/components/*` | ⬜ CHƯA LÀM |
| 3.T | 👤 **Việc của chủ dự án:** tạo Gemini API key (có hướng dẫn) | — | ⬜ CHƯA LÀM |

## GĐ4 — Đồng bộ Google Drive → v0.4.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 4.T | 👤 **Việc của chủ dự án:** tạo Google Cloud project + OAuth Client ID (phiên 4.1 sẽ hướng dẫn từng bước) | — | ⬜ CHƯA LÀM |
| 4.1 | auth.js + drive.js + sync.js + backup.js (snapshot ngày), trạng thái đồng bộ trong UI | `app/js/services/auth.js`, `drive.js`, `sync.js`, `backup.js`, `app/js/ui/screen-settings.js`, `app/js/main.js`, `app/js/core/config.js` | ⬜ CHƯA LÀM |

## GĐ5 — Đưa lên mạng + cài trên Android → v0.5.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 5.T | 👤 **Việc của chủ dự án:** tạo tài khoản GitHub | — | ⬜ CHƯA LÀM |
| 5.1 | GitHub repo + GitHub Actions deploy `app/` lên Pages, nút "Chia sẻ → Cá Vàng" trên Android (share_target), cập nhật Client ID/referrer | `.github/*`, `app/manifest.webmanifest`, `app/sw.js`, `app/js/ui/screen-add.js` | ⬜ CHƯA LÀM |

## GĐ6 — Hoàn thiện → v1.0.0
| Mã | Việc | File được sửa | Trạng thái |
|---|---|---|---|
| 6.1 | Rà soát bảo mật (CSP, XSS, key) + hiệu năng tìm kiếm 10.000 bản ghi | toàn bộ (chỉ sửa lỗi) | ⬜ CHƯA LÀM |
| 6.2 | Xuất "hồ sơ trình bày": chọn nhiều bằng chứng → in/xuất PDF kèm ghi chú | `app/js/ui/*`, `app/css/*` | ⬜ CHƯA LÀM |

---
## Ý tưởng để sau (chưa duyệt)
- Nhắc "bằng chứng hết hạn" (CO/CQ có hạn).
- Liên kết các bằng chứng cùng một lô/vụ việc.
- Tìm bằng giọng nói.
