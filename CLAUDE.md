# CLAUDE.md — Quy tắc BẮT BUỘC cho mọi phiên làm việc

Dự án: **Cá Vàng** — app lưu "bằng chứng" (ảnh/văn bản) kèm tình huống + đối tượng, tìm lại thật nhanh.
Chủ dự án là người **không rành kỹ thuật** → luôn giải thích bằng tiếng Việt, ngắn gọn, không thuật ngữ khó.

## 0. Đọc trước khi làm bất cứ điều gì
1. `docs/KIEN-TRUC.md` — kiến trúc, mô hình dữ liệu, hợp đồng giữa các module. **Không tự ý đổi.**
2. `TIEN-DO.md` — bảng việc. Chỉ làm việc được giao, đúng phạm vi file được liệt kê.
3. `NHAT-KY-PHIEN-BAN.md` — các phiên bản đã có.

## 1. Quy trình mỗi phiên (không được bỏ bước)
1. Chạy `git status`. Nếu có thay đổi chưa lưu (không phải của mình) → **DỪNG, báo chủ dự án**, không xoá, không commit hộ.
2. Mở `TIEN-DO.md`, tìm việc được giao. Nếu việc đang ghi `🔒 ĐANG LÀM` bởi phiên khác → DỪNG, báo chủ.
3. Đánh dấu việc: `🔒 ĐANG LÀM — <ngày>` rồi commit ngay: `git commit -am "chore: nhan viec <mã việc>"`.
4. Chỉ sửa các file nằm trong cột **"File được sửa"** của việc đó. Cần sửa file ngoài phạm vi → hỏi chủ trước.
5. Làm xong: tự kiểm tra (mở app trong trình duyệt, thử chức năng, xem console không lỗi).
6. Cập nhật:
   - `app/js/core/version.js` → tăng số phiên bản (xem mục 3).
   - `NHAT-KY-PHIEN-BAN.md` → thêm dòng mới trên cùng.
   - `TIEN-DO.md` → đổi trạng thái thành `✅ XONG — <phiên bản>`.
7. Lưu phiên bản — **chỉ add đúng file của mình** (vì có thể có phiên khác đang làm song song trong cùng thư mục):
   ```
   git add <cac file trong pham vi> TIEN-DO.md NHAT-KY-PHIEN-BAN.md app/js/core/version.js
   git commit -m "<loai>: <mo ta ngan> (vX.Y.Z)"
   git tag vX.Y.Z
   ```
   - Không bao giờ dùng `git add -A` / `git add .`.
   - **Việc song song (🔀):** KHÔNG sửa `version.js`, KHÔNG tag; commit ghi `(viec 1.2)`. Khi tất cả việc 🔀 của giai đoạn đã ✅, phiên cuối cùng (hoặc phiên "chốt giai đoạn") mới tăng version + tag + ghi nhật ký tổng.
   - Nếu `git commit` báo `index.lock` → đợi 5 giây rồi thử lại, không xoá file lock khi phiên khác đang chạy.
8. Báo chủ dự án bằng tiếng Việt: đã làm gì, thử thế nào, phiên bản mới là gì, còn gì chưa xong.

## 2. Điều CẤM
- ❌ Không ghi API key, client secret, token, mật khẩu vào code hay bất kỳ file nào được commit. Key Gemini do người dùng nhập trong màn Cài đặt và chỉ lưu trên thiết bị.
- ❌ Không `git push --force`, `git reset --hard`, `git rebase`, xoá tag, xoá nhánh, xoá file dữ liệu — trừ khi chủ dự án yêu cầu rõ ràng.
- ❌ Không đổi cấu trúc dữ liệu (schema) trong `docs/KIEN-TRUC.md` mà không có việc riêng cho nó; nếu đổi phải tăng `SCHEMA_VERSION` và viết hàm chuyển đổi dữ liệu cũ.
- ❌ Không thêm framework/bước build (React, Vite, npm build...). App là HTML + CSS + JavaScript thuần (ES modules), mở là chạy.
- ❌ Không tải thư viện từ CDN lúc chạy. Thư viện phải tải về `app/vendor/` (ghi rõ phiên bản + nguồn trong `app/vendor/README.md`).
- ❌ Không dùng `innerHTML` với dữ liệu người dùng/OCR (chống chèn mã độc) — dùng `textContent` hoặc hàm `h()` trong `app/js/ui/dom.js`.

## 3. Đánh số phiên bản
`vMAJOR.MINOR.PATCH` — ví dụ `v0.3.1`.
- Xong 1 giai đoạn (GĐ) → tăng MINOR: v0.2.0 → v0.3.0.
- Sửa lỗi / việc nhỏ trong giai đoạn → tăng PATCH: v0.3.0 → v0.3.1.
- v1.0.0 = bản hoàn chỉnh đầu tiên (do chủ dự án quyết).
Số phiên bản nằm duy nhất ở `app/js/core/version.js` và phải khớp tag git.

## 4. Quy ước code
- Tiếng Việt cho giao diện và comment; tên biến/hàm tiếng Anh.
- Mỗi module một trách nhiệm, chỉ giao tiếp qua các hàm export đã ghi trong `docs/KIEN-TRUC.md` mục "Hợp đồng module".
- Mọi thao tác mạng phải có xử lý lỗi + thông báo tiếng Việt dễ hiểu cho người dùng.
- Giao diện phải dùng tốt trên điện thoại (màn 360px) và máy tính.
- Chạy thử cục bộ: `python -m http.server 5500 -d app` hoặc dùng preview của Claude (cấu hình trong `.claude/launch.json`).

## 5. Khi chủ dự án nói "quay về bản cũ"
1. `git tag` để liệt kê phiên bản; hỏi lại chủ muốn bản nào.
2. **Không xoá lịch sử.** Dùng: `git revert --no-edit <tag-moi>..HEAD` hoặc tạo nhánh `git switch -c khoi-phuc-vX.Y.Z vX.Y.Z` rồi giải thích cho chủ.
3. Ghi lại vào `NHAT-KY-PHIEN-BAN.md`.
