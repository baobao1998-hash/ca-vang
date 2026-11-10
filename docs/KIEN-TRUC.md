# Kiến trúc Cá Vàng

> Tài liệu "luật gốc". Mọi phiên code phải tuân theo. Muốn đổi → tạo việc riêng trong `TIEN-DO.md`.

## 1. Tổng quan

```
 Điện thoại Android / Máy tính (trình duyệt Chrome/Edge)
 ┌────────────────────────────────────────────────────┐
 │  PWA "Cá Vàng" (HTML+CSS+JS thuần, cài như app)    │
 │   ├─ UI kính mờ (Liquid Glass)                     │
 │   ├─ IndexedDB: bản ghi + ảnh thu nhỏ (offline)    │
 │   ├─ MiniSearch: tìm tức thì, không dấu, gõ sai nhẹ│
 │   └─ Service Worker: chạy offline + nhận "Chia sẻ" │
 └──────────┬──────────────────────────┬──────────────┘
            │ (đồng bộ)                │ (đọc chữ ảnh)
   Google Drive (scope drive.file)    Gemini API (free tier)
   /CaVang/...                        key do người dùng nhập
```

- **Không có máy chủ riêng.** Hosting tĩnh miễn phí: GitHub Pages.
- **Nguồn sự thật = Google Drive.** IndexedDB chỉ là bản sao để tìm nhanh + dùng offline.
- **Tìm kiếm chạy trên máy** → kết quả hiện ngay khi gõ (< 50ms với vài chục nghìn bản ghi).

## 2. Công nghệ (miễn phí)
| Phần | Chọn | Ghi chú |
|---|---|---|
| Giao diện | HTML + CSS + JS ES modules | Không build, không framework |
| Tìm kiếm | MiniSearch (vendor) | fuzzy + prefix, bỏ dấu tiếng Việt |
| Lưu cục bộ | IndexedDB (tự viết wrapper nhỏ) | |
| Đăng nhập | Google Identity Services (token client) | scope `https://www.googleapis.com/auth/drive.file` — app chỉ thấy file do chính nó tạo |
| Lưu trữ | Google Drive API v3 (REST, fetch) | |
| Đọc chữ ảnh | Gemini API, model cấu hình được (mặc định `gemini-3.5-flash-lite`) | trả JSON có cấu trúc |
| Hosting | GitHub Pages (deploy thư mục `app/` bằng GitHub Actions) | |

## 3. Cấu trúc thư mục

```
app/
  index.html               ← khung app (1 trang, điều hướng bằng #hash)
  manifest.webmanifest     ← cài PWA + share_target (Android)
  sw.js                    ← service worker: cache offline + nhận ảnh chia sẻ
  icons/                   ← icon 192, 512, maskable
  css/
    tokens.css             ← biến màu, bo góc, độ mờ (sáng/tối)
    glass.css              ← các lớp kính: .glass, .glass-strong, nút, ô nhập
    app.css                ← bố cục từng màn
  js/
    main.js                ← khởi động, router
    core/
      version.js           ← APP_VERSION, SCHEMA_VERSION
      config.js            ← hằng số (tên thư mục Drive, kích thước ảnh...)
      events.js            ← bus sự kiện nhỏ (on/emit)
      ids.js               ← tạo id dạng ULID (sắp theo thời gian)
      text.js              ← normalizeVi(): bỏ dấu, đ→d, lowercase
    data/
      db.js                ← IndexedDB wrapper
      records.js           ← CRUD bản ghi (gọi db + phát sự kiện)
      search.js            ← MiniSearch: build, add, remove, query
      settings.js          ← đọc/ghi cài đặt (localStorage)
    services/
      image.js             ← nén ảnh, tạo thumbnail
      gemini.js            ← gọi Gemini OCR + gợi ý thẻ
      auth.js              ← đăng nhập Google, lấy access token
      drive.js             ← gọi Drive API thô (upload, list, get, update)
      sync.js              ← đồng bộ IndexedDB ⇄ Drive
      backup.js            ← xuất/nhập file sao lưu, snapshot theo ngày
    ui/
      dom.js               ← h() tạo phần tử an toàn, toast()
      screen-search.js     ← màn chính: ô tìm + danh sách kết quả
      screen-add.js        ← thêm bằng chứng (ảnh/chụp/dán/text)
      screen-detail.js     ← xem chi tiết, sửa, xoá (vào thùng rác)
      screen-settings.js   ← key Gemini, đăng nhập Drive, sao lưu, phiên bản
      components/          ← chip, card, sheet, tag-input...
  vendor/                  ← thư viện tải sẵn + README ghi nguồn/phiên bản
docs/                      ← tài liệu
scripts/                   ← script PowerShell tiện ích (sao lưu dự án)
```

## 4. Mô hình dữ liệu (SCHEMA_VERSION = 1)

### Bản ghi bằng chứng `Evidence`
```js
{
  id: "01JC9X...",          // ULID
  schema: 1,
  kind: "image" | "text",
  createdAt: "2026-11-10T08:30:00.000Z",
  updatedAt: "...",
  deleted: false,           // xoá mềm → thùng rác (khôi phục được 30 ngày)

  // Người dùng nhập (có gợi ý từ Gemini)
  title: "CO/CQ kim điện cực lô 2410",
  docType: "CO/CQ",         // danh mục: CO/CQ, Hoá đơn, Hợp đồng, Báo giá, Đơn hàng, Chứng từ thanh toán, Tài liệu/Sách, Email, Tin nhắn, Biên bản, Khác (người dùng gõ thêm loại mới được)
  itemCodes: ["KDC-0.8"],   // mã hàng
  lotNumbers: ["2410"],     // số lô
  subjects: ["Bệnh viện A"],// ĐỐI TƯỢNG: khách hàng/NCC/người/phòng ban
  situations: ["Đấu thầu 2026 BV A"], // TÌNH HUỐNG: dùng cho việc gì
  note: "Ghi chú tự do",
  tags: [],
  docDate: "2026-10-05",    // ngày trên giấy tờ (nếu có)

  // Nội dung
  text: "",                 // nội dung khi kind = "text"
  ocrText: "",              // chữ đọc từ ảnh
  ocrStatus: "none" | "pending" | "done" | "error",

  // File (kind = image)
  file: {
    driveId: "1AbC...",     // null khi chưa đồng bộ
    mime: "image/jpeg",
    width: 2000, height: 1500, bytes: 412345,
    originalName: "IMG_1234.jpg"
  },

  // Đồng bộ
  sync: { driveRecordId: "1XyZ...", dirty: true, lastSyncedAt: null }
}
```

### IndexedDB `cavang` (version 1)
| Store | Khoá | Nội dung |
|---|---|---|
| `records` | `id` | Evidence |
| `blobs` | `id` | `{ id, full: Blob, thumb: Blob }` — ảnh nén + thumbnail ~320px |
| `outbox` | `id` | việc chờ đồng bộ `{ id, op: "put"|"delete", recordId, tries }` |
| `meta` | `key` | `lastSyncAt`, `driveFolderIds`, ... |

### Google Drive
```
/CaVang/
  files/2026-11/<id>.jpg          ← ảnh đã nén (≤ 2000px, JPEG ~0.85)
  records/<id>.json               ← 1 bản ghi = 1 file (tránh xung đột giữa 2 thiết bị)
  snapshots/index-2026-11-10.json ← ảnh chụp toàn bộ bản ghi mỗi ngày (giữ 30 bản)
```
- Đồng bộ: lấy các file trong `records/` có `modifiedTime > lastSyncAt`; bản nào `updatedAt` mới hơn thì thắng.
- Thiết bị mới: tải snapshot mới nhất rồi đồng bộ phần chênh → nhanh.

## 5. Tìm kiếm
- Trường & trọng số: `itemCodes ×5, lotNumbers ×4, subjects ×3, situations ×3, title ×3, docType ×2, tags ×2, note ×1, ocrText ×1, text ×1`.
- `processTerm` = `normalizeVi()` → gõ có dấu hay không dấu đều ra.
- `fuzzy: 0.2`, `prefix: true`, `combineWith: "AND"`.
- Mã hàng: tách thêm biến thể bỏ dấu gạch/chấm (`KDC-0.8` ⇒ `kdc08`) để gõ "kdc08" vẫn ra.
- Bộ lọc nhanh dạng chip: loại giấy tờ, đối tượng, khoảng thời gian.
- Gõ ô tìm → debounce 80ms.

## 6. Gemini (đọc chữ + gợi ý)
- Gửi ảnh đã nén (base64) + prompt yêu cầu trả JSON:
  `{ ocrText, title, docType, itemCodes[], lotNumbers[], subjects[], docDate }`
  (dùng `responseMimeType: "application/json"` + `responseSchema`).
- Kết quả chỉ là **gợi ý** → người dùng xác nhận/sửa rồi mới lưu.
- Không có mạng/hết hạn mức → lưu bản ghi với `ocrStatus: "pending"`, tự thử lại sau.
- Key lưu `localStorage` trên thiết bị; hướng dẫn người dùng giới hạn key theo HTTP referrer (tên miền GitHub Pages).

## 7. Hợp đồng module (chữ ký hàm export — không tự đổi)
```js
// core/text.js
normalizeVi(str) -> string
// core/ids.js
newId() -> string
// core/events.js
on(event, fn) -> unsubscribe ; emit(event, payload)
//   sự kiện: "record:saved" {record}, "record:deleted" {id}, "sync:status" {state, message}

// data/db.js
openDb() -> Promise<IDBDatabase>
dbGet(store, key), dbPut(store, value), dbDelete(store, key), dbAll(store) -> Promise
// data/records.js
saveRecord(partial, {blob}?) -> Promise<Evidence>   // tạo mới hoặc cập nhật, set updatedAt, dirty
getRecord(id) -> Promise<Evidence|null>
listRecords({includeDeleted}?) -> Promise<Evidence[]>
softDelete(id), restore(id), purgeOld(days=30)
getThumbUrl(id), getFullBlob(id)
// data/search.js
initSearch(records), indexRecord(record), unindexRecord(id)
search(query, {filters}?) -> [{id, score, match}]
suggest(query) -> string[]
// data/settings.js
getSetting(key, fallback), setSetting(key, value)

// services/image.js
compressImage(fileOrBlob, {maxSide=2000, quality=0.85}) -> Promise<{blob,width,height}>
makeThumb(blob, 320) -> Promise<Blob>
// services/gemini.js
analyzeImage(blob) -> Promise<{ocrText,title,docType,itemCodes,lotNumbers,subjects,docDate}>
analyzeText(text) -> Promise<cùng dạng, ocrText="">
testKey(key) -> Promise<boolean>
// services/auth.js
signIn(), signOut(), getToken() -> Promise<string>, isSignedIn() -> boolean
// services/drive.js
ensureFolders() -> {root, files, records, snapshots}
uploadFile(blob, name, parentId) -> driveId ; downloadFile(driveId) -> Blob
putJson(name, obj, parentId, existingId?) -> driveId ; getJson(driveId)
listChanged(parentId, sinceIso) -> [{id, name, modifiedTime}]
// services/sync.js
syncNow() -> Promise<{pushed, pulled}> ; startAutoSync() ; stopAutoSync()
// services/backup.js
exportZip() / exportJson() -> Blob ; importJson(file) ; writeDailySnapshot()
```

## 8. Bảo mật
- Scope Drive `drive.file`: app **không đọc được** các file khác trong Drive của bạn.
- Không có secret nào trong mã nguồn (Client ID của Google là công khai theo thiết kế).
- Content-Security-Policy trong `index.html`: chỉ cho phép kết nối tới `googleapis.com`, `accounts.google.com`, `generativelanguage.googleapis.com`.
- Không `innerHTML` với dữ liệu người dùng / OCR.
- Ảnh gửi Gemini (gói miễn phí) có thể được Google dùng để cải thiện sản phẩm — chủ dự án đã đồng ý. Có công tắc "Không gửi AI" cho từng bằng chứng nhạy cảm.

## 9. Giao diện Liquid Glass
- Nền: gradient màu mềm chuyển động chậm (có thể tắt — `prefers-reduced-motion`).
- Thẻ/thanh: `background: rgba(255,255,255,.12–.22)`, `backdrop-filter: blur(20–28px) saturate(180%)`, viền 1px sáng mờ, bóng mềm, bo góc 20–28px, ánh sáng phản chiếu nhẹ ở cạnh trên.
- Sáng/tối theo hệ thống; chữ luôn đạt độ tương phản đọc được.
- Điện thoại: thanh tab nổi kính mờ ở dưới (Tìm · Thêm · Cài đặt); nút "+" lớn ở giữa.
- Máy tính: lưới thẻ 3–4 cột, ô tìm lớn ở trên, phím tắt `/` để tìm, `Ctrl+V` dán ảnh để thêm nhanh.
