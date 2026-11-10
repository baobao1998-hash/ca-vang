# NHẬT KÝ PHIÊN BẢN

Mới nhất ở trên. Mỗi dòng: phiên bản · ngày · việc · tóm tắt (tiếng Việt dễ hiểu).

## v0.2.0 · 2026-11-10 · GĐ2 — Việc 2.1: app chạy thật trên 1 máy (offline)
- Bỏ dữ liệu giả; nối giao diện với kho dữ liệu thật (IndexedDB) + tìm kiếm MiniSearch.
- Thêm bằng chứng: chọn / chụp / kéo thả / Ctrl+V (dán ở màn nào cũng được) nhiều ảnh một lúc, hoặc dán văn bản. Mỗi ảnh thành 1 bản ghi, dùng chung thông tin đã nhập.
- Ô Mã hàng / Số lô / Đối tượng / Tình huống: gợi ý từ các giá trị đã dùng (gõ không dấu vẫn ra).
- Tìm tức thì (trễ 80ms), tô sáng từ khớp (cả "kdc08" khớp "KDC-0.8"), chip lọc loại giấy tờ / đối tượng / thời gian, phím "/" để tìm.
- Chi tiết: sửa, xoá mềm; màn Thùng rác (khôi phục, tự xoá hẳn sau 30 ngày); xem ảnh phóng to (chụm 2 ngón, lăn chuột, nhấp đúp, nút +/−).
- Màn hình trống thân thiện khi chưa có dữ liệu.
- Kiểm tra EXIF: ảnh JPEG có thẻ Orientation=6 (200x100) ra đúng 100x200, khối đỏ góc trên-trái nằm đúng góc trên-phải → `services/image.js` đúng, KHÔNG phải sửa.
- Ghi chú: `ui/mock.js` chỉ còn là file rỗng (vì `sw.js` còn liệt kê nó); cần dọn `sw.js` ở một việc riêng.

## v0.1.0 · 2026-11-10 · GĐ1 — Khung app + giao diện kính mờ + lõi dữ liệu + xử lý ảnh
- Việc 1.1: khung PWA (mở offline, cài được), giao diện Liquid Glass 4 màn (Tìm, Thêm, Chi tiết, Cài đặt) chạy bằng dữ liệu giả, sáng/tối, đẹp trên điện thoại và máy tính.
- Việc 1.2: lõi dữ liệu không giao diện: `core/*`, `data/*` (IndexedDB, thùng rác 30 ngày, tìm kiếm MiniSearch 7.1.2 không dấu). Trang tự kiểm tra `app/dev/test.html`: 15/15 PASS, tìm trong 5.000 bản ghi trung bình ~2 ms.
- Việc 1.3: `services/image.js` — nén ảnh (xoay đúng chiều, cạnh dài ≤2000px, JPEG 0.85, không phóng to ảnh nhỏ), ảnh nhỏ 320px, lấy ảnh từ Ctrl+V, lọc file ảnh khi chọn/chụp và báo lỗi tiếng Việt cho ảnh HEIC máy không đọc được.

## v0.0.1 · 2026-11-10 · Việc 0.1
- Lập kế hoạch, kiến trúc (`docs/KIEN-TRUC.md`), quy tắc cho các phiên (`CLAUDE.md`), bảng việc (`TIEN-DO.md`), prompt giao việc (`docs/GIAO-VIEC.md`), hướng dẫn cho chủ dự án.
- Cài Git, tạo kho lưu phiên bản.
