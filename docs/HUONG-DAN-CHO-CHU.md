# Hướng dẫn cho chủ dự án (đọc 3 phút)

## Mỗi lần muốn làm tiếp
1. Mở `TIEN-DO.md` → tìm việc `⬜ CHƯA LÀM` đầu tiên.
2. Mở `docs/GIAO-VIEC.md` → copy prompt của việc đó.
3. Tạo **phiên mới** trong Claude (tab Code) → thư mục `5. APP CA VANG` → model **Sonnet** → dán prompt.
4. Làm xong, phiên sẽ báo "phiên bản mới vX.Y.Z". Xong!

**Mẹo:**
- Mỗi phiên chỉ làm **một việc**. Đừng giao thêm việc khác trong cùng phiên. Có ý mới thì ghi vào cuối `TIEN-DO.md` mục "Ý tưởng để sau".
- Chạy nhiều phiên cùng lúc **chỉ khi** các việc đều có 🔀 và cùng giai đoạn (ví dụ 1.1, 1.2 và 1.3).
- Thấy việc cứ báo `🔒 ĐANG LÀM` mà không có phiên nào chạy (phiên bị tắt giữa chừng) → mở phiên mới, nói: *"Việc X bị bỏ dở, kiểm tra git status và làm tiếp theo CLAUDE.md"*.

## Link app và cài lên điện thoại
- **Link app:** https://baobao1998-hash.github.io/ca-vang/ (dùng được trên máy tính và điện thoại).
- **Mã nguồn (GitHub):** https://github.com/baobao1998-hash/ca-vang
- **Cài lên Android — BẮT BUỘC dùng Chrome** (không dùng Samsung Internet, vì không chọn được ảnh từ Thư viện):
  1. Mở Chrome, vào link app → menu ⋮ → *Thêm vào màn hình chính* → *Cài đặt*.
  2. Mở app từ biểu tượng, vào *Cài đặt*: dán key Gemini + bấm *Đăng nhập Google*. (Key chỉ lưu trên từng thiết bị nên mỗi máy phải dán một lần.)
- **Gửi ảnh vào app từ Thư viện:** chọn ảnh → *Chia sẻ* → *Cá Vàng*.
- **Đồng bộ:** app chỉ cập nhật khi đang mở hoặc vừa mở lại (app web không chạy ngầm được như OneDrive). Muốn thấy ngay thì bấm vào app / chấm trạng thái / *Đồng bộ ngay*.

## Cập nhật app lên bản mới
- Khi Claude làm xong một việc, mã tự lên mạng sau khoảng 2 phút (qua GitHub).
- Trong app: *Cài đặt* → *Kiểm tra bản mới* → *Tải lại bản mới*. Nếu vẫn thấy bản cũ, đóng hẳn app (vuốt tắt) rồi mở lại.
- Nếu một tính năng Android chưa chạy, kiểm tra app có cài bằng Chrome không.

## Khi app bị hỏng sau một lần cập nhật
Mở phiên mới, gõ:
> Đọc CLAUDE.md mục 5. App bị lỗi sau bản vX.Y.Z (mô tả lỗi...). Liệt kê các phiên bản và giúp tôi quay về bản trước đó, không xoá lịch sử.

Mọi phiên bản đều được giữ, nên quay lại bản nào cũng được.

## Sao lưu
- **Code:** chuột phải `scripts/sao-luu.ps1` → *Run with PowerShell*. File zip nằm trong `_sao-luu/`. Nên làm trước mỗi giai đoạn lớn và copy bản zip sang Google Drive.
- Từ GĐ5, code còn được lưu trên GitHub (thêm một bản dự phòng online).
- **Dữ liệu bằng chứng** (từ GĐ4): ảnh và thông tin nằm trong thư mục `CaVang` trên Google Drive. Mỗi ngày app tự chụp một bản mục lục, giữ 30 ngày. Trong Cài đặt có nút "Xuất sao lưu".

## Những thứ chỉ anh/chị làm được (Claude sẽ hướng dẫn từng bước)
| Khi nào | Việc | Chi phí |
|---|---|---|
| GĐ3 | Tạo Gemini API key ở Google AI Studio | Miễn phí |
| GĐ4 | Tạo Google Cloud project + OAuth Client ID | Miễn phí, không cần thẻ |
| GĐ5 | Tạo tài khoản GitHub (đã xong) | Miễn phí |

## Bảo mật: 3 điều cần nhớ
1. **Không dán API key vào khung chat với Claude.** Key chỉ nhập vào màn Cài đặt của app.
2. Ai có điện thoại/máy tính đã mở khoá của anh/chị thì xem được app. Hãy để máy có mật khẩu màn hình.
3. Ảnh gửi Gemini bản miễn phí có thể được Google dùng để cải thiện AI. Với giấy tờ nhạy cảm, bật công tắc **"Không gửi AI"** khi thêm.
