# GIAO VIỆC — Prompt copy-paste cho từng phiên Sonnet

Cách dùng:
1. Mở **phiên mới** trong Claude (tab Code), chọn thư mục `5. APP CA VANG`, chọn model **Sonnet**.
2. Copy nguyên khối prompt của việc cần làm → dán → gửi.
3. Làm xong, phiên sẽ báo phiên bản mới. Anh/chị mở `NHAT-KY-PHIEN-BAN.md` là thấy.
4. Muốn chạy song song: chỉ các việc có 🔀 trong cùng giai đoạn (xem `TIEN-DO.md`).

Từ v1.0.1, mọi prompt mới viết theo khuôn dưới đây (có "Không làm", "Hiệu năng", "Tự đối chiếu") để tránh làm lan man.

### Khuôn prompt việc mới
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md, docs/RA-SOAT.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC <mã> — <tên>.
Mục tiêu (chủ thấy được gì khi xong): ...
Phạm vi file: ... (khớp cột "File được sửa" trong TIEN-DO.md)
Yêu cầu (mỗi dòng kiểm được đúng/sai, tối đa ~15 dòng):
- ...
Không làm: ...
Hiệu năng: <ngân sách liên quan — docs/KIEN-TRUC.md mục 8b>
Kiểm tra trước khi bàn giao: mở app trong preview, thử <...>, console không lỗi, khổ 360px, đo <chỉ số> trước/sau; gỡ mock, tải lại tab, tắt server chạy thử.
Tự đối chiếu: đọc lại prompt này, đánh dấu từng yêu cầu ✅/❌; git diff --stat chỉ có file trong phạm vi.
Báo lại bằng tiếng Việt: bảng đối chiếu ✅/❌, thử thế nào (thật/giả lập), số đo, phiên bản mới, còn gì chưa xong.
```

### Rà soát prompt & luật (Opus — sau mỗi đợt việc, hoặc khi phiên con làm lan man/sai luật)
```
Rà soát quy trình theo skill khoi-dong-du-an (references/ra-soat-prompt.md): so kết quả các việc gần đây với prompt, tìm chỗ làm lan man / sai luật, sửa CLAUDE.md và docs/GIAO-VIEC.md, ghi docs/RA-SOAT.md. Báo tôi ngắn gọn đã sửa gì.
```

Câu mở đầu chung (các prompt cũ bên dưới):
> Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.

---

## Việc 1.1 🔀 — Khung PWA + giao diện Liquid Glass
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 1.1 (làm song song với 1.2 và 1.3 — chỉ sửa đúng file trong phạm vi).

Mục tiêu: dựng khung PWA "Cá Vàng" với giao diện Liquid Glass đẹp, chạy bằng DỮ LIỆU GIẢ (mảng mock trong app/js/ui/mock.js, ~12 bằng chứng: CO/CQ kim điện cực, hoá đơn, email, tin nhắn...).
- 4 màn: Tìm (mặc định), Thêm, Chi tiết, Cài đặt. Router bằng #hash trong app/js/main.js.
- Theo đúng mục 9 "Giao diện Liquid Glass" trong KIEN-TRUC.md. Sáng/tối theo hệ thống. Đẹp trên điện thoại 360px và máy tính.
- Màn Tìm: ô tìm lớn kính mờ, chip lọc (loại giấy tờ), lưới thẻ có thumbnail + tiêu đề + mã hàng + đối tượng + ngày. Lọc mock bằng includes đơn giản (việc thật làm ở GĐ2).
- Màn Thêm: vùng thả ảnh / chọn ảnh / chụp ảnh (input capture) / dán văn bản; các ô: Tiêu đề, Loại giấy tờ, Mã hàng (nhập nhiều dạng chip), Số lô, Đối tượng, Tình huống, Ghi chú, Ngày trên giấy tờ. Nút Lưu chỉ toast "Đã lưu (giả)".
- Màn Chi tiết: ảnh lớn (bấm để phóng to), toàn bộ thông tin, nút Sửa/Xoá.
- Màn Cài đặt: các mục để trống: Gemini key, Google Drive, Sao lưu, Phiên bản (đọc từ core/version.js).
- app/js/ui/dom.js: hàm h(tag, attrs, ...children) an toàn (không innerHTML) + toast().
- manifest.webmanifest (name "Cá Vàng", theme kính, icon tự vẽ SVG→PNG 192/512 + maskable), sw.js cache vỏ app để mở offline.
- Thêm .claude/launch.json nếu chưa có (python -m http.server 5500 -d app) và tự mở preview kiểm tra cả khổ mobile lẫn desktop, chụp màn hình cho tôi xem.
Commit theo luật việc song song.
```

## Việc 1.2 🔀 — Lõi dữ liệu + tìm kiếm
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 1.2 (làm song song với 1.1 và 1.3 — chỉ sửa đúng file trong phạm vi).

Mục tiêu: viết các module không giao diện đúng chữ ký ở mục 7 "Hợp đồng module":
core/text.js, core/ids.js, core/events.js, core/config.js, data/db.js, data/records.js, data/search.js, data/settings.js.
- Tải MiniSearch bản ES module (phiên bản ổn định mới nhất) vào app/vendor/, ghi nguồn + phiên bản + license vào app/vendor/README.md.
- normalizeVi: NFD, bỏ dấu, đ/Đ→d, lowercase. Search: theo mục 5 KIEN-TRUC.md (trọng số, fuzzy, prefix, biến thể mã hàng bỏ gạch/chấm).
- records.saveRecord lưu blob ảnh vào store blobs (full + thumb do nơi gọi truyền vào), phát sự kiện record:saved; softDelete/restore/purgeOld.
- Tạo trang app/dev/test.html + app/dev/test.js: tự chạy các bài kiểm tra (tạo 5.000 bản ghi giả, đo thời gian tìm, kiểm tra gõ không dấu "kim dien cuc" ra "Kim điện cực", "kdc08" ra "KDC-0.8", xoá mềm/khôi phục). In kết quả PASS/FAIL ra trang.
- Chạy trang test trong preview và báo kết quả + thời gian tìm trung bình.
Commit theo luật việc song song.
```

## Việc 1.3 🔀 — Xử lý ảnh
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 1.3 (làm song song với 1.1 và 1.2 — chỉ sửa đúng file trong phạm vi).

Viết app/js/services/image.js theo hợp đồng mục 7:
- compressImage: xoay đúng chiều theo EXIF (createImageBitmap imageOrientation:'from-image'), cạnh dài tối đa 2000px, JPEG 0.85; ảnh chụp màn hình nhiều chữ (PNG) vẫn giữ nét chữ đọc được; nếu ảnh gốc đã nhỏ hơn thì không phóng to.
- makeThumb: 320px, chất lượng 0.7.
- Thêm hàm tiện ích: readClipboardImage(event) lấy ảnh từ sự kiện paste; fileListToImages(fileList) lọc file ảnh (hỗ trợ HEIC: nếu trình duyệt không đọc được thì báo lỗi tiếng Việt dễ hiểu).
- Không sửa file khác. Kiểm tra nhanh bằng một file tạm trong scratchpad (không commit file tạm).
Commit theo luật việc song song. Nếu bạn là việc 🔀 cuối cùng của GĐ1 hoàn thành → chốt giai đoạn: version 0.1.0, tag v0.1.0, ghi nhật ký.
```

## Chốt giai đoạn (dùng khi các việc 🔀 xong mà chưa ai tag)
```
Đọc CLAUDE.md, TIEN-DO.md, NHAT-KY-PHIEN-BAN.md. Kiểm tra tất cả việc của giai đoạn <N> đã ✅. Mở app trong preview thử nhanh. Nếu ổn: cập nhật version.js thành v0.<N>.0, ghi nhật ký tổng, commit, tag. Báo tôi bằng tiếng Việt.
```

## Việc 2.1 — Ghép nối dữ liệu thật
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 2.1.
Bỏ dữ liệu giả, nối các màn UI với data/records.js, data/search.js, services/image.js:
- Thêm bằng chứng: chọn/chụp/kéo thả/Ctrl+V ảnh hoặc dán văn bản → nén → lưu IndexedDB. Hỗ trợ thêm nhiều ảnh một lúc (mỗi ảnh 1 bản ghi, dùng chung thông tin đã nhập).
- Ô "Mã hàng", "Đối tượng", "Tình huống": gợi ý tự động từ các giá trị đã dùng trước đó.
- Tìm tức thì khi gõ (debounce 80ms), tô sáng từ khớp, chip lọc loại giấy tờ/đối tượng/thời gian, phím "/" để tìm.
- Chi tiết: sửa, xoá mềm, thùng rác (khôi phục / tự xoá sau 30 ngày), xem ảnh phóng to có zoom bằng ngón tay.
- Màn hình trống thân thiện khi chưa có dữ liệu.
Thử đủ luồng trong preview (mobile + desktop), chụp màn hình báo tôi. Phiên bản: v0.2.0.
```

## Việc 3.1 — Gemini đọc chữ ảnh
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 3.1.
- Trước tiên hướng dẫn tôi (người không rành kỹ thuật) từng bước tạo Gemini API key miễn phí tại Google AI Studio. Tuyệt đối không ghi key vào file nào.
- Viết services/gemini.js theo mục 6 + hợp đồng mục 7 (REST fetch, responseSchema JSON, timeout 30s, báo lỗi tiếng Việt: sai key / hết hạn mức / mất mạng). Tra tài liệu Gemini API hiện hành để dùng đúng endpoint và tên model mới nhất của gói miễn phí; cho phép đổi model trong Cài đặt.
- Cài đặt: ô nhập key (ẩn ký tự), nút "Kiểm tra key", chọn model, công tắc "Tự đọc chữ khi thêm ảnh".
- Màn Thêm: sau khi chọn ảnh → hiện "Đang đọc chữ..." → điền gợi ý vào các ô (đánh dấu là gợi ý, người dùng sửa được). Có công tắc "Không gửi AI (riêng tư)" cho từng bằng chứng.
- Mất mạng/lỗi → lưu ocrStatus "pending", tự thử lại khi có mạng; màn Cài đặt có nút "Đọc lại các ảnh chưa đọc".
Phiên bản: v0.3.0.
```

## Việc 4.1 — Đồng bộ Google Drive
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 4.1.
- Trước tiên hướng dẫn tôi từng bước (kèm đường link) tạo Google Cloud project, bật Drive API, màn hình đồng ý OAuth (External, chế độ Testing, thêm email của tôi làm test user), tạo OAuth Client ID loại Web với origin http://localhost:5500 (sau này thêm tên miền GitHub Pages). Client ID ghi vào app/js/core/config.js (không phải bí mật). KHÔNG tạo client secret.
- Viết services/auth.js (Google Identity Services token client, scope drive.file), drive.js, sync.js, backup.js theo mục 4 + 7.
- Đồng bộ: khi lưu/sửa/xoá → vào outbox → đẩy lên Drive khi có mạng; mở app / mỗi 5 phút / khi quay lại tab → kéo thay đổi về. Snapshot mỗi ngày, giữ 30 bản.
- UI: trạng thái đồng bộ (đã đồng bộ / đang đồng bộ / chờ mạng / lỗi) dạng chấm màu nhỏ; Cài đặt: Đăng nhập/Đăng xuất Google, "Đồng bộ ngay", "Xuất sao lưu (JSON)", "Nhập sao lưu".
- Thử: thêm bằng chứng → thấy file trên Drive; xoá dữ liệu trình duyệt → đăng nhập lại → dữ liệu về đủ.
Phiên bản: v0.4.0.
```

## Việc 5.1 — Đưa lên mạng + Android
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 5.1.
- Hướng dẫn tôi tạo tài khoản GitHub (nếu chưa), cài GitHub CLI bằng winget, đăng nhập.
- Tạo repo, đẩy code lên, thêm GitHub Actions deploy thư mục app/ lên GitHub Pages. Hỏi tôi trước khi đặt repo công khai/riêng tư và giải thích khác biệt (Pages miễn phí cần repo công khai; code không chứa bí mật nên vẫn an toàn).
- Hướng dẫn tôi thêm tên miền Pages vào OAuth Client ID và giới hạn Gemini key theo tên miền.
- manifest share_target (POST multipart, nhận ảnh + text) + sw.js xử lý → mở màn Thêm với ảnh đã nhận.
- Hướng dẫn tôi cài app lên Android (Chrome → Thêm vào màn hình chính) và thử "Chia sẻ → Cá Vàng" từ thư viện ảnh.
Phiên bản: v0.5.0.
```

## Việc 6.1 — Rà soát bảo mật & hiệu năng
```
Đọc CLAUDE.md, docs/KIEN-TRUC.md, TIEN-DO.md trước. Tuân thủ tuyệt đối quy trình trong CLAUDE.md.
Bạn nhận VIỆC 6.1. Rà soát toàn bộ code: CSP, mọi chỗ chèn HTML, nơi lưu key/token, xử lý lỗi mạng, hiệu năng tìm với 10.000 bản ghi (dùng app/dev/test.html), dung lượng cache SW. Liệt kê vấn đề theo mức độ, sửa các lỗi rõ ràng, báo tôi phần cần quyết định. Phiên bản: tăng PATCH.
```
