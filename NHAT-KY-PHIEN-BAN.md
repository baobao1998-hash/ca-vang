# NHẬT KÝ PHIÊN BẢN

Mới nhất ở trên. Mỗi dòng: phiên bản · ngày · việc · tóm tắt (tiếng Việt dễ hiểu).

## Việc 1.2 · 2026-11-10 · (chưa gắn số phiên bản — chờ chốt GĐ1)
- Lõi dữ liệu không giao diện: `core/*` (bỏ dấu tiếng Việt, tạo id, sự kiện, hằng số), `data/*` (kho IndexedDB, bản ghi + thùng rác 30 ngày, tìm kiếm MiniSearch, cài đặt).
- Tải MiniSearch 7.1.2 vào `app/vendor/`. Trang tự kiểm tra `app/dev/test.html`: 15 bài đều PASS, tìm trong 5.000 bản ghi trung bình ~2 ms.

## v0.0.1 · 2026-11-10 · Việc 0.1
- Lập kế hoạch, kiến trúc (`docs/KIEN-TRUC.md`), quy tắc cho các phiên (`CLAUDE.md`), bảng việc (`TIEN-DO.md`), prompt giao việc (`docs/GIAO-VIEC.md`), hướng dẫn cho chủ dự án.
- Cài Git, tạo kho lưu phiên bản.
