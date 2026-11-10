# NHẬT KÝ PHIÊN BẢN

Mới nhất ở trên. Mỗi dòng: phiên bản · ngày · việc · tóm tắt (tiếng Việt dễ hiểu).

## v0.5.0 · 2026-11-10 · GĐ5 — Việc 5.1: đưa lên mạng + cài trên Android
- GitHub Actions (`.github/workflows/pages.yml`): mỗi lần đẩy lên nhánh `main` tự đưa thư mục `app/` lên GitHub Pages.
- Mọi đường dẫn trong app đã là tương đối nên chạy đúng dưới `https://<user>.github.io/<repo>/` (manifest `start_url`/`scope` = `./`, service worker đăng ký tương đối).
- `share_target` (POST multipart: ảnh + chữ) trong manifest; `sw.js` nhận, cất tạm vào cache `cavang-share`, chuyển về `./?shared=1#/them`; `main.js` lấy ra, màn Thêm mở sẵn ảnh/chữ và Gemini tự đọc. `sw.js` giờ chỉ xoá cache vỏ app cũ (`cavang-shell-v*`), không đụng cache chia sẻ.
- ĐÃ thử thật (Chrome máy tính, localhost): giả lập chia sẻ 1 ảnh + 1 đoạn chữ qua POST → vào đúng màn Thêm, cache dọn sạch.

## v0.4.0 · 2026-11-10 · GĐ4 — Việc 4.1: đồng bộ Google Drive
- Đăng nhập Google (Google Identity Services, quyền `drive.file`: app chỉ thấy file do chính nó tạo). Token chỉ giữ trong bộ nhớ, không lưu ra ổ đĩa; không dùng client secret. Client ID công khai nằm ở `core/config.js`.
- Drive: `CaVang/records/<id>.json` (mỗi bằng chứng 1 file), `CaVang/files/YYYY-MM/<id>.jpg` + `<id>.thumb.jpg`, `CaVang/snapshots/index-YYYY-MM-DD.json` (mỗi ngày 1 bản, giữ 30 bản).
- Đồng bộ: thay đổi vào outbox, đẩy lên khi có mạng; kéo về khi mở app, mỗi 5 phút, khi quay lại tab, khi có mạng lại. Bản `updatedAt` mới hơn thắng. Thiết bị mới: tải snapshot rồi chỉ lấy phần chênh; ảnh nhỏ tải sẵn, ảnh đầy đủ tải khi mở xem (hook `setFullLoader` trong `data/records.js`).
- Bản ghi "Không gửi AI" vẫn đồng bộ Drive bình thường (Drive là kho riêng của chủ).
- Giao diện: chấm trạng thái góc trên phải (xám = chưa kết nối, xanh lá = đã đồng bộ, xanh dương nháy = đang đồng bộ, cam = chờ mạng/cần đăng nhập lại, đỏ = lỗi). Cài đặt: Đăng nhập/Đăng xuất Google, Đồng bộ ngay, Xuất sao lưu (JSON, kèm ảnh), Nhập sao lưu.
- CSP: thêm `accounts.google.com/gsi/*` (script, style, frame, connect) và hash style của công cụ đăng nhập Google. `sw.js`: thêm 4 file mới vào SHELL; request tới Google đi thẳng, không cache.
- Thêm trường `file.thumbDriveId` (id ảnh nhỏ trên Drive) vào bản ghi ảnh; CHƯA ghi vào `docs/KIEN-TRUC.md` (ngoài phạm vi 4.1) — cần việc riêng.
- Đã thử THẬT với Google Drive của chủ dự án: đăng nhập, tạo thư mục CaVang, đẩy 3 bằng chứng (3 json, 3 ảnh gốc, 3 ảnh nhỏ), xoá dữ liệu trang rồi đăng nhập lại → 3 bằng chứng về đủ, mở được ảnh đầy đủ.
- CHƯA thử thật: xuất/nhập sao lưu JSON, mất mạng rồi có mạng lại (outbox), đồng bộ 2 thiết bị cùng lúc / sửa xung đột, snapshot 30 bản, điện thoại Android. Trong khung xem thử của Claude, service worker lỗi gây trang trắng (lỗi cũ của khung xem thử); trình duyệt thường chạy bình thường.
- Ghi chú: sau khi tải lại trang, token Google mất; chạm đầu tiên vào trang sẽ tự xin lại (hoặc bấm chấm cam / "Đăng nhập lại Google").

## v0.3.2 · 2026-11-10 · Việc 3.3
- Thông báo "Đã lưu bằng chứng" trên máy tính không còn che menu Tìm/Thêm/Cài đặt (chuyển xuống đáy màn hình). Điện thoại giữ nguyên (thông báo ở trên, menu ở dưới).
- Thêm cấu hình xem thử thứ hai `cavang-review` (cổng 5600) để phiên kiểm tra không tranh cổng 5500 với phiên đang code.

## v0.3.1 · 2026-11-10 · Việc 3.2 — sửa sau v0.3.0
- NGUYÊN NHÂN lỗi "2 ảnh khác nhau ra y hệt kết quả CO/CQ kim điện cực": khi kiểm thử v0.3.0, phiên làm việc đã gắn một Gemini GIẢ LẬP vào tab xem thử và quên gỡ; tab đó vẫn trả kết quả giả. KHÔNG phải lỗi của app (các chuỗi đó không có trong code app). Đã tải lại hẳn tab, kiểm tra `fetch` là bản gốc rồi thử lại với Gemini thật.
- Thử Gemini THẬT: ảnh tài liệu PDF → "Tài liệu/Sách", ngày 19/01/2026, Công việc; ảnh đơn Shopee → "Đơn hàng", Cá nhân, đối tượng "Huawei Flagship Store", ngày để trống.
- Prompt Gemini trung tính (công việc lẫn cá nhân), bỏ ví dụ y tế. Thêm loại "Giấy tờ cá nhân", "Ảnh chụp màn hình".
- Thêm trường Lĩnh vực `area` (Công việc / Cá nhân): Gemini đoán, sửa được ở màn Thêm/Sửa, có chip lọc ở màn Tìm. Cấu trúc dữ liệu lên SCHEMA 2; bản ghi cũ đọc lên mặc định "Công việc" (`migrateRecord`).
- Service worker: danh sách file offline đúng với file hiện có (bỏ `ui/mock.js`, đã xoá), tên cache gắn với phiên bản app, có mạng thì luôn hỏi lại máy chủ để lấy bản mới. Cài đặt: nút "Kiểm tra bản mới" và "Tải lại bản mới".
- Ghi chú: cửa sổ xem thử của Claude không chạy ổn service worker (lỗi khi tải sw.js), nên phần "Tải lại bản mới" CHƯA thử trọn vẹn; đã kiểm tra danh sách file offline (34/34 tải được) và nút báo đúng khi chưa có service worker. Máy đang dùng bản cũ có thể cần đóng hết tab Cá Vàng rồi mở lại một lần để nhận bản mới.

## v0.3.0 · 2026-11-10 · GĐ3 — Việc 3.1: máy tự đọc chữ và điền các ô (Gemini)
- `services/gemini.js`: gọi Gemini bằng REST, trả JSON có cấu trúc, tối đa 30 giây, báo lỗi tiếng Việt (sai key / hết hạn mức / mất mạng / model sai). Model mặc định đổi sang `gemini-3.5-flash-lite` vì Google đã ngừng `gemini-2.5-flash` (tra tài liệu ngày 2026-11-10); đổi được trong Cài đặt.
- Cài đặt: ô key (ẩn ký tự), "Kiểm tra key", chọn model, công tắc "Tự đọc chữ khi thêm ảnh" (mặc định bật), "Đọc lại các ảnh chưa đọc".
- Màn Thêm: chọn/dán ảnh hoặc văn bản → máy tự điền Tiêu đề, Loại, Ngày, Mã hàng, Số lô, Đối tượng, Tình huống (nếu suy ra được) + chữ đọc từ ảnh. Ô máy điền có dấu "✨ gợi ý", sửa là mất dấu; ô bạn đã gõ không bị ghi đè. Công tắc "Không gửi AI (riêng tư)".
- Mất mạng/hết hạn mức → lưu "chờ đọc" (`ocrStatus: pending`), tự thử lại khi có mạng (và mỗi 3 phút).
- Danh mục loại giấy tờ thêm: Đơn hàng, Chứng từ thanh toán, Tài liệu/Sách; chọn "＋ Loại mới…" để gõ loại riêng, được nhớ cho lần sau; Gemini cũng có thể đề xuất loại mới.
- Ô ngày hiện dd/mm/yyyy kiểu Việt Nam trên mọi trình duyệt (vẫn lưu yyyy-mm-dd).
- Đã thử bằng Gemini GIẢ LẬP (mock): kiểm tra key đúng/sai/mất mạng, tự điền, không ghi đè ô đã gõ, mất mạng → chờ → đọc lại. CHƯA thử với Gemini thật (cần key của chủ dự án).

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
