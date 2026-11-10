# NHẬT KÝ PHIÊN BẢN

Mới nhất ở trên. Mỗi dòng: phiên bản · ngày · việc · tóm tắt (tiếng Việt dễ hiểu).

## v0.5.3 · 2026-11-10 · Việc 6.4 — sửa lỗi app kẹt ở bản cũ
- **Nguyên nhân (đã dựng lại được):** khi tải lại trang, Chrome lấy file code (JS/CSS) từ bộ nhớ tạm của chính nó mà KHÔNG hỏi service worker; tên file không đổi giữa các phiên bản nên máy cứ chạy bản cũ (chủ thấy mãi v0.5.1 dù trên mạng đã là v0.5.2). Thêm lỗi phụ: nút "Tải lại bản mới" LUÔN hiện (thiếu CSS cho thuộc tính `hidden`), bấm vào chỉ tải lại trang nên vẫn bản cũ.
- **Sửa:** khi đưa lên mạng, GitHub Actions chạy `scripts/stamp_version.py` gắn `?v=<phiên bản>` vào mọi đường dẫn file code (import JS, CSS, main.js, sw-outbox.js) → mỗi bản có địa chỉ file mới, trình duyệt buộc tải mới. Code gốc trong kho không đổi; chạy thử trên máy (localhost) không gắn số → khi thử cục bộ dùng Ctrl+Shift+R.
- Service worker: mất mạng thì tìm file trong bộ nhớ bỏ qua `?v=` (offline vẫn chạy).
- Cài đặt → Phiên bản: tự so số phiên bản với máy chủ; nút đổi thành "Cập nhật ngay", CHỈ hiện khi thật sự có bản mới; cập nhật = nạp service worker mới + xoá vỏ app cũ + tải lại (không đụng dữ liệu, đăng nhập, ảnh chia sẻ). Mở app / quay lại app (tối đa 30 phút/lần) có bản mới → thông báo.
- `[hidden] { display:none !important }` cho toàn app.
- **ĐÃ thử thật** (Chrome trong khung xem thử, có service worker, bản dựng giống hệt GitHub): đang chạy 0.5.3 → thay máy chủ bằng 0.5.4 → tải lại thường → hiện ngay 0.5.4; tắt máy chủ → app vẫn mở offline. Bản cũ (không gắn số) dựng lại đúng lỗi: tải lại vẫn hiện bản cũ. **CHƯA thử:** trên trang GitHub thật và S25+ (máy đang kẹt 0.5.1 cần bấm Ctrl+Shift+R một lần, hoặc đóng hẳn app mở lại, để nhận bản 0.5.3 có cơ chế mới).

## v0.5.2 · 2026-11-10 · Việc 6.3 — tải sẵn ảnh khi có Wi-Fi + đẩy nốt khi đã tắt app
- **Tải sẵn ảnh đầy đủ** (Cài đặt → "Ảnh tải sẵn"): công tắc mặc định BẬT; hiện "Đã tải sẵn X/Y ảnh · Z MB" + nút "Xoá ảnh tải sẵn" (xoá bản đầy đủ trên máy, giữ ảnh nhỏ, Drive không đổi; chỉ xoá ảnh đã chắc chắn có trên Drive; xong thì tắt công tắc). Chỉ chạy khi: đăng nhập, có Wi-Fi (máy tính: không báo loại mạng thì coi là được), không tiết kiệm dữ liệu, pin ≥ 20% hoặc đang sạc, app đang mở, không đang đồng bộ, còn trống ≥ 10%. Từng ảnh một, mới nhất trước, nghỉ giữa các ảnh. Đóng app là dừng → không hao pin.
- **Đẩy nốt lên Drive khi đã tắt app** (Background Sync MỘT LẦN, Chrome/Android + Chrome/Edge máy tính): `sw-outbox.js` mới. Token Google nay được chép thêm sang IndexedDB (`meta.swToken`), đăng xuất/hết hạn xoá cả hai nơi. Token hết hạn thì bỏ qua, chờ lần mở app sau. Khoá Web Locks tránh app và nền đẩy trùng. KHÔNG làm Periodic Sync (lý do trong KIEN-TRUC mục 6b).
- **Mở app nhanh:** dọn thùng rác chuyển sang sau khi danh sách đã hiện; đồng bộ/tải sẵn khởi động sau khi vẽ. Đo (10.000 bản ghi, Chrome máy tính): lúc danh sách bắt đầu vẽ 641 ms → 451 ms (-30%). Cài đặt → Phiên bản hiện "Lần mở app gần nhất".
- **ĐÃ thử thật** (Chrome trong khung xem thử, localhost, Drive GIẢ LẬP bằng mock fetch): vòng tải sẵn (đúng thứ tự mới→cũ, 4/4 ảnh, hiện số liệu), nút xoá, chặn khi 4G/tiết kiệm dữ liệu/chưa đăng nhập; logic `sw-outbox.js` chạy trong trang với Drive giả: tạo thư mục tháng, đẩy ảnh+thumbnail+json, outbox sạch, token hết hạn không gọi mạng, mất mạng giữ outbox và báo thử lại. **CHƯA thử:** đăng ký service worker thật + sự kiện `sync` (khung xem thử không cho đăng ký service worker), Drive thật, pin/loại mạng thật, S25+. Cần chủ thử: (a) Wi-Fi, mở app 1–2 phút → Cài đặt thấy số ảnh tăng; tắt Wi-Fi dùng 4G → mở ảnh cũ hiện ngay. (b) tắt mạng → thêm bằng chứng → đóng hẳn app → bật mạng → chờ 1–2 phút → xem trên máy tính.

## v0.5.1 · 2026-11-10 · Việc 6.1 — rà soát bảo mật + hiệu năng
**Bảo mật — đã sửa**
- (Vừa) Nhập file sao lưu JSON và dữ liệu kéo từ Drive trước đây tin hoàn toàn nội dung. Nay mọi bản ghi đi qua `sanitizeRecord` (data/records.js): chỉ giữ trường đã biết, ép đúng kiểu, cắt độ dài (tiêu đề 500, ghi chú 20.000…), từ chối id lạ (có `../`, dấu nháy, `__proto__`), loại ảnh khác jpeg/png/webp/gif, ảnh hỏng chỉ bỏ ảnh. Giới hạn 200.000 bản ghi/file.
- (Vừa) Mã file Drive (`driveId`, `thumbDriveId`) lấy từ dữ liệu bên ngoài được chèn vào đường dẫn gọi Drive API → thêm kiểm tra chỉ chữ/số/`_`/`-` (drive.js + sanitizeRecord).
- (Vừa) CSP siết: bỏ ký tự đại diện `https://*.googleapis.com` (chỉ còn `www.googleapis.com`, `oauth2.googleapis.com`, `generativelanguage.googleapis.com`), thêm `object-src 'none'`, `worker-src 'self'`, `manifest-src 'self'`. Vẫn không có `unsafe-inline`/`unsafe-eval`.
- (Thấp) Đăng xuất Google nay thu hồi token ở phía Google ngay cả khi công cụ Google chưa tải; token trong localStorage bị xoá như cũ.
- Nút đổi tên thành "Xoá key Gemini khỏi máy này" (có hỏi lại trước khi xoá).
**Bảo mật — đã kiểm tra, không có vấn đề**: không còn `innerHTML`/`insertAdjacentHTML`/`eval`/`href` động trong `app/` (mọi chữ qua `textContent`/`h()`); toàn bộ lịch sử git (27 commit, mọi file) không có API key, token, client secret, email cá nhân (chỉ có email ẩn của GitHub); Client ID công khai theo thiết kế. Gemini key gửi qua header `x-goog-api-key`, không nằm trên địa chỉ.
**Bảo mật — còn lại, chấp nhận**: token Google + key Gemini nằm trong localStorage (script cùng trang đọc được nhưng CSP không cho script lạ chạy; token chỉ sống ~1 giờ, quyền `drive.file`); GitHub Pages không cho đặt header nên không có `frame-ancestors` (chỉ chống nhúng trang, rủi ro thấp); trang `/dev/test.html` vẫn được đưa lên mạng (chỉ động vào kho test riêng, vô hại).
**Hiệu năng (10.000 bản ghi, máy Windows của chủ, Chrome)**: tìm trung bình 9,1 ms / lần (chậm nhất 31 ms); dựng chỉ mục 0,46–0,7 giây; đọc 10.000 bản ghi 0,13 giây; vỏ app lưu offline 38 file ≈ 380 KB. LỖI TÌM THẤY & SỬA: màn Tìm vẽ cả 10.000 thẻ một lúc (mở app ~6,3 giây) → nay vẽ 60 thẻ/trang + nút "Xem thêm (còn N)" (~3,4 giây trong khung xem thử, gồm cả nạp mã).
- `app/dev/test.html`: thêm `?n=10000` để đổi số bản ghi; thêm 2 bài kiểm tra (làm sạch bản ghi, nhập file sao lưu độc hại). 17/17 PASS.
**Phần C — chủ thử thật trên máy (2026-11-10)**: (1) tắt mạng → thêm → có mạng: ĐÃ tự đẩy lên Drive; bên máy tính phải bấm F5 mới thấy (app kéo thay đổi mỗi 60 giây khi đang mở và khi quay lại tab, chưa có cơ chế đẩy tức thì — giới hạn của PWA không máy chủ). (2) Nút "Tải lại bản mới": chạy tốt. (3) Snapshot hằng ngày trong Drive/CaVang/snapshots: có. Xuất/nhập JSON và thùng rác 30 ngày: đã thử bằng hàm/test ở trên.

## v0.5.0 (cùng bản) · 2026-11-10 · Việc 4.2 — đăng nhập Google đỡ phiền + đồng bộ 2 máy nhanh hơn
- NGUYÊN NHÂN hay bị hỏi lại: token Google chỉ nằm trong biến, mất mỗi lần mở lại/tải lại app; hết 1 giờ cũng mất. Trên Android PWA, cửa sổ đăng nhập tự bật (không do người dùng chạm) bị đóng → "popup_closed".
- Sửa: token + giờ hết hạn được nhớ trong localStorage của thiết bị (quyền chỉ `drive.file`, sống ~1 giờ; đánh đổi bảo mật: mã này đọc được bởi script cùng trang, nhưng CSP chặn script lạ và Google tự vô hiệu sau 1 giờ). Đăng xuất / bị Google từ chối thì xoá ngay.
- Không còn tự bật cửa sổ đăng nhập ở nền: chỉ xin lại khi người dùng chạm vào app (mỗi lần chạm nếu token sắp hết hạn/đã mất, hạ nhiệt 30 giây) hoặc bấm chấm trạng thái/nút. Công cụ đăng nhập Google được tải sẵn để cửa sổ mở kịp lúc chạm. Thông báo lỗi tiếng Việt rõ hơn.
- Đồng bộ: kéo thay đổi khi mở app, quay lại tab/cửa sổ (focus, visibilitychange, pageshow), và mỗi 60 giây khi app đang mở (trước là 5 phút). PWA KHÔNG đồng bộ nền khi app đóng được (khác OneDrive); chỉ cập nhật khi app đang mở hoặc vừa mở.
- ĐÃ thử thật (Chrome, localhost): token nhớ qua tải lại trang; token bị Google từ chối (401) thì xoá, hiện "cần đăng nhập lại", không bật cửa sổ. CHƯA thử: đăng nhập Google thật, xin lại yên lặng, Android S25+, 2 thiết bị.

## v0.5.0 · 2026-11-10 · GĐ5 — Việc 5.1: đưa lên mạng + cài trên Android
- App chạy trên mạng: https://baobao1998-hash.github.io/ca-vang/ (GitHub Pages, kho công khai `baobao1998-hash/ca-vang`). GitHub Actions (`.github/workflows/pages.yml`) tự đưa thư mục `app/` lên mạng mỗi lần đẩy lên `main`.
- Lịch sử commit đã đổi email tác giả sang email ẩn của GitHub trước khi đẩy lên (chủ đồng ý); nhánh sao lưu `sao-luu-truoc-doi-email` chỉ nằm trên máy.
- Mọi đường dẫn trong app là tương đối nên chạy đúng dưới `/ca-vang/` (manifest `start_url`/`scope` = `./`, service worker đăng ký tương đối).
- `share_target` (POST multipart: ảnh + chữ): `sw.js` nhận, cất vào cache `cavang-share` (có đường đọc dự phòng + thông tin chẩn đoán khi lỗi), chuyển về `./?shared=1#/them`; `main.js` lấy ra, màn Thêm mở sẵn ảnh/chữ, Gemini tự đọc. `sw.js` chỉ xoá cache vỏ app cũ (`cavang-shell-v*`).
- Chủ đã thêm `https://baobao1998-hash.github.io` vào Authorized JavaScript origins của OAuth Client ID. Giới hạn Gemini key theo tên miền: BỎ QUA (tài khoản chủ không có mục này); key vẫn chỉ lưu trên từng thiết bị.
- ĐÃ thử thật: trang Pages trên Chrome máy tính; đăng nhập Google thật trên trang mới (tải về 3, đẩy lên 3); cài trên Samsung S25+ bằng Chrome; chủ báo đã thử đủ các bài: chia sẻ ảnh từ Thư viện, chụp ảnh, chọn ảnh, đồng bộ máy tính ↔ điện thoại. Đồng bộ trên máy tính hơi chậm (tab nền chỉ kéo về khi bấm vào tab).
- LƯU Ý: cài bằng Samsung Internet thì không chọn được ảnh từ Thư viện và chia sẻ ảnh bị lỗi → phải cài bằng Chrome.
- CHƯA kiểm chứng riêng: mất mạng rồi có mạng lại (outbox), nút "Tải lại bản mới" sau khi deploy, xuất sao lưu JSON (chủ nói đã thử xong nhưng chưa ghi lại kết quả từng bài).

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
