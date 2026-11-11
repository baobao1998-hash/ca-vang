# SỔ RÀ SOÁT — prompt, luật, hiệu năng

Cách rà soát: skill `khoi-dong-du-an` → `references/ra-soat-prompt.md`. Mới nhất ở trên.
Khi nào: sau mỗi đợt ~3 việc, khi chốt giai đoạn, hoặc ngay khi một phiên làm lan man / sai luật.

## 2026-11-11 · Rà soát lần đầu (GĐ0 → v1.0.1)
Kiểm tra: 38 commit, 15 tag — **mọi tag khớp số trong `version.js`**; mọi việc trong bảng đều có commit "nhận việc".

| Phát hiện | Nguyên nhân (prompt/luật nào) | Đã sửa |
|---|---|---|
| Phiên 3.1 để sót mock fetch trong tab thử → kết quả Gemini giả, tưởng thật (v0.3.0) | Luật chưa nói gì về mock | Đã thêm luật gỡ mock (v0.3.1). Nay thêm bước "tự đối chiếu với prompt" (CLAUDE.md 5b) |
| Thông báo nổi che nút 2 lần (máy tính v0.3.2, điện thoại v0.5.4) | Prompt chỉ ghi "đẹp trên 360px và máy tính", không ghi phải thử chỗ nào | Khuôn prompt mới có "Kiểm tra trước khi bàn giao" ghi thao tác cụ thể |
| Việc 5.1 cần 3 lần sửa sau bàn giao; việc 4.2 (không 🔀) commit `(viec 4.2)` không tăng phiên bản | Prompt 5.1 thiếu tiêu chí "xong" đo được trên điện thoại thật; luật chưa nói việc thêm giữa giai đoạn đánh số thế nào | Khuôn prompt mới: mỗi yêu cầu kiểm được đúng/sai + "Không làm". Việc thêm giữa giai đoạn → tăng PATCH như sửa lỗi |
| Sửa nhanh do Opus (v0.3.2, v0.5.4, v1.0.1) không có commit "nhận việc" | Luật chỉ viết cho phiên Sonnet | Thêm vào CLAUDE.md: "Sửa nhanh do phiên chính" |
| Chưa có ngân sách hiệu năng chính thức (chỉ đo 1 lần ở việc 6.1) | Kiến trúc chưa có mục hiệu năng | Thêm `docs/KIEN-TRUC.md` mục 8b + luật tiết kiệm RAM/bộ nhớ trong CLAUDE.md |

**Số đo hiệu năng** (chi tiết ở `docs/KIEN-TRUC.md` mục 8b): mở app 451 ms / 10.000 bản ghi; tìm trung bình 9,1 ms; code ≈ 296 KB. **Chưa đo:** RAM trên điện thoại → làm ở lần rà soát sau.
