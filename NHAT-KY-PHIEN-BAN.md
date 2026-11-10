# NHẬT KÝ PHIÊN BẢN

Mới nhất ở trên. Mỗi dòng: phiên bản · ngày · việc · tóm tắt (tiếng Việt dễ hiểu).

## v0.1.0 · 2026-11-10 · GĐ1 — Khung app + giao diện kính mờ + lõi dữ liệu + xử lý ảnh
- Việc 1.1: khung PWA (mở offline, cài được), giao diện Liquid Glass 4 màn (Tìm, Thêm, Chi tiết, Cài đặt) chạy bằng dữ liệu giả, sáng/tối, đẹp trên điện thoại và máy tính.
- Việc 1.2: lõi dữ liệu không giao diện: `core/*`, `data/*` (IndexedDB, thùng rác 30 ngày, tìm kiếm MiniSearch 7.1.2 không dấu). Trang tự kiểm tra `app/dev/test.html`: 15/15 PASS, tìm trong 5.000 bản ghi trung bình ~2 ms.
- Việc 1.3: `services/image.js` — nén ảnh (xoay đúng chiều, cạnh dài ≤2000px, JPEG 0.85, không phóng to ảnh nhỏ), ảnh nhỏ 320px, lấy ảnh từ Ctrl+V, lọc file ảnh khi chọn/chụp và báo lỗi tiếng Việt cho ảnh HEIC máy không đọc được.

## v0.0.1 · 2026-11-10 · Việc 0.1
- Lập kế hoạch, kiến trúc (`docs/KIEN-TRUC.md`), quy tắc cho các phiên (`CLAUDE.md`), bảng việc (`TIEN-DO.md`), prompt giao việc (`docs/GIAO-VIEC.md`), hướng dẫn cho chủ dự án.
- Cài Git, tạo kho lưu phiên bản.
