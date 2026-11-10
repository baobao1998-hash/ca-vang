// Trang tự kiểm tra lõi dữ liệu. Mở /dev/test.html.
import { normalizeVi } from "../js/core/text.js";
import { newId } from "../js/core/ids.js";
import { on } from "../js/core/events.js";
import { useDbName, openDb, closeDb, deleteDatabase, dbPutMany, dbAll, dbClear } from "../js/data/db.js";
import { saveRecord, getRecord, listRecords, softDelete, restore, purgeOld, getThumbUrl, getFullBlob, sanitizeRecord } from "../js/data/records.js";
import { initSearch, indexRecord, unindexRecord, search, suggest } from "../js/data/search.js";
import { getSetting, setSetting } from "../js/data/settings.js";
import { importJson } from "../js/services/backup.js";

const TEST_DB = "cavang-test";
const resultsEl = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const results = [];

function report(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""));
  const row = document.createElement("div");
  row.className = "row " + (ok ? "PASS" : "FAIL");
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = ok ? "PASS" : "FAIL";
  const body = document.createElement("div");
  body.textContent = name;
  if (detail) {
    const d = document.createElement("div");
    d.className = "detail";
    d.textContent = detail;
    body.append(d);
  }
  row.append(tag, body);
  resultsEl.append(row);
}

async function test(name, fn) {
  try {
    const detail = await fn();
    report(name, true, detail || "");
  } catch (err) {
    report(name, false, String(err && err.message ? err.message : err));
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "Sai"); }

// ---- Dữ liệu giả ----
const SUBJECTS = ["Bệnh viện A", "Bệnh viện B", "Công ty Minh Phát", "Nhà cung cấp Hòa Bình", "Phòng Vật tư", "Anh Tuấn", "Chị Lan", "Sở Y tế"];
const DOCTYPES = ["CO/CQ", "Hoá đơn", "Hợp đồng", "Báo giá", "Email", "Tin nhắn", "Biên bản", "Khác"];
const THINGS = ["Ống thông", "Găng tay", "Bơm tiêm", "Kim châm cứu", "Dây truyền dịch", "Máy đo huyết áp", "Khẩu trang", "Bông băng", "Kìm cắt", "Đầu dò"];
const SITUATIONS = ["Đấu thầu 2026", "Bảo hành", "Giao hàng đợt 2", "Khiếu nại chất lượng", "Thanh toán", "Nhập kho"];
const SEED = 12345;
let rng = SEED;
const rand = () => { rng = (rng * 1664525 + 1013904223) % 4294967296; return rng / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];

function fakeRecord(i) {
  const now = new Date(Date.now() - Math.floor(rand() * 365) * 86400000).toISOString();
  const code = "X" + String.fromCharCode(65 + (i % 26)) + "-" + (i % 97) + "." + (i % 9);
  return {
    id: newId(), schema: 1, kind: "text", createdAt: now, updatedAt: now, deleted: false,
    title: `${pick(THINGS)} ${pick(THINGS)} lô ${1000 + (i % 900)}`,
    docType: pick(DOCTYPES), itemCodes: [code], lotNumbers: [String(2000 + (i % 500))],
    subjects: [pick(SUBJECTS)], situations: [pick(SITUATIONS)],
    note: `Ghi chú số ${i}`, tags: [], docDate: now.slice(0, 10),
    text: "", ocrText: i % 3 === 0 ? `Nội dung đọc từ ảnh số ${i} ${pick(THINGS)}` : "", ocrStatus: "none",
    file: null, sync: { driveRecordId: null, dirty: false, lastSyncedAt: null },
  };
}

function fakeBlob(text) {
  return new Blob([text], { type: "image/jpeg" });
}

async function main() {
  await useDbName(TEST_DB);
  await deleteDatabase(TEST_DB);
  await openDb();
  await dbClear("records");

  await test("normalizeVi: bỏ dấu, đ→d, chữ thường", () => {
    assert(normalizeVi("Kim điện cực") === "kim dien cuc", normalizeVi("Kim điện cực"));
    assert(normalizeVi("ĐẶNG Thị Ưu") === "dang thi uu", normalizeVi("ĐẶNG Thị Ưu"));
    assert(normalizeVi(null) === "", "null");
  });

  await test("newId: 26 ký tự, không trùng, tăng dần", () => {
    const ids = Array.from({ length: 2000 }, newId);
    assert(ids.every((x) => x.length === 26), "độ dài");
    assert(new Set(ids).size === 2000, "trùng id");
    const sorted = [...ids].sort();
    assert(sorted.every((x, i) => x === ids[i]), "không tăng dần");
  });

  await test("settings: ghi rồi đọc lại, có giá trị mặc định", () => {
    setSetting("__test", { a: 1 });
    assert(getSetting("__test").a === 1, "đọc lại");
    setSetting("__test", null);
    assert(getSetting("__test", "mac-dinh") === "mac-dinh", "mặc định");
  });

  // Hai bản ghi "mồi" có đáp án rõ ràng + 5.000 bản ghi giả.
  let kdcRecord;
  await test("saveRecord: lưu bản ghi + ảnh, phát sự kiện record:saved", async () => {
    let fired = 0;
    const off = on("record:saved", () => fired++);
    kdcRecord = await saveRecord(
      {
        title: "Kim điện cực", docType: "CO/CQ", itemCodes: ["KDC-0.8"], lotNumbers: ["2410"],
        subjects: ["Bệnh viện A"], situations: ["Đấu thầu 2026 BV A"],
      },
      { blob: { full: fakeBlob("full"), thumb: fakeBlob("thumb") } },
    );
    off();
    assert(fired === 1, "sự kiện phát " + fired + " lần");
    const got = await getRecord(kdcRecord.id);
    assert(got && got.title === "Kim điện cực" && got.kind === "image" && got.sync.dirty === true, "đọc lại sai");
    assert((await getFullBlob(kdcRecord.id)).size === 4, "blob full");
    const url = await getThumbUrl(kdcRecord.id);
    assert(url && url.startsWith("blob:"), "thumb url");
  });

  const N = Math.min(50000, Number(new URLSearchParams(location.search).get("n")) || 5000); // thêm ?n=10000 vào địa chỉ để thử số lượng khác
  await test(`Tạo ${N} bản ghi giả`, async () => {
    const t0 = performance.now();
    const batch = Array.from({ length: N }, (_, i) => fakeRecord(i));
    await dbPutMany("records", batch);
    const all = await listRecords();
    assert(all.length === N + 1, "đếm được " + all.length);
    return `Ghi + đọc ${all.length} bản ghi mất ${Math.round(performance.now() - t0)} ms`;
  });

  let all;
  await test("initSearch: dựng chỉ mục", async () => {
    all = await listRecords();
    const t0 = performance.now();
    initSearch(all);
    return `Dựng chỉ mục ${all.length} bản ghi mất ${Math.round(performance.now() - t0)} ms`;
  });

  await test('Tìm "kim dien cuc" (không dấu) ra "Kim điện cực"', () => {
    const r = search("kim dien cuc");
    assert(r.length > 0 && r[0].id === kdcRecord.id, "kết quả đầu không phải Kim điện cực (" + r.length + " kết quả)");
    const r2 = search("Kim điện cực");
    assert(r2[0].id === kdcRecord.id, "gõ có dấu cũng phải ra");
  });

  await test('Tìm "kdc08" ra "KDC-0.8"', () => {
    const r = search("kdc08");
    assert(r.some((x) => x.id === kdcRecord.id), "không thấy KDC-0.8");
    assert(r[0].id === kdcRecord.id, "không đứng đầu");
    assert(search("kdc-0.8").some((x) => x.id === kdcRecord.id), "gõ có gạch cũng phải ra");
  });

  await test("Gõ sai nhẹ (fuzzy) và gõ dở (prefix)", () => {
    assert(search("kim dien cuk").some((x) => x.id === kdcRecord.id), "fuzzy");
    assert(search("kim dien cu").some((x) => x.id === kdcRecord.id), "prefix");
  });

  await test("Tìm theo số lô và đối tượng + suggest", () => {
    assert(search("2410").some((x) => x.id === kdcRecord.id), "số lô");
    assert(search("benh vien a kim").some((x) => x.id === kdcRecord.id), "đối tượng + từ khoá");
    assert(suggest("kim di").length > 0, "suggest rỗng");
  });

  await test("Bộ lọc loại giấy tờ / đối tượng", () => {
    const r = search("kim", { filters: { docType: "CO/CQ", subject: "Bệnh viện A" } });
    assert(r.length > 0, "lọc rỗng");
    assert(r.some((x) => x.id === kdcRecord.id), "mất bản ghi cần có");
    assert(search("kim dien cuc", { filters: { docType: "Email" } }).every((x) => x.id !== kdcRecord.id), "lọc sai loại");
  });

  await test("Tốc độ tìm: trung bình mỗi lần tìm", () => {
    const queries = ["kim dien cuc", "kdc08", "benh vien", "gang tay", "2410", "bom tiem lo", "dau do", "dau thau", "xa-12", "khau trang"];
    search("warmup");
    const times = [];
    for (let round = 0; round < 5; round++) {
      for (const q of queries) {
        const t0 = performance.now();
        search(q);
        times.push(performance.now() - t0);
      }
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const detail = `Trung bình ${avg.toFixed(1)} ms, chậm nhất ${max.toFixed(1)} ms (${times.length} lần tìm, ${all.length} bản ghi)`;
    assert(avg < 50, "quá chậm (cần < 50 ms). " + detail);
    return detail;
  });

  await test("Xoá mềm → biến khỏi kết quả, khôi phục → hiện lại", async () => {
    let deletedEvt = 0;
    const off = on("record:deleted", ({ id }) => { if (id === kdcRecord.id) { deletedEvt++; unindexRecord(id); } });
    await softDelete(kdcRecord.id);
    off();
    assert(deletedEvt === 1, "sự kiện record:deleted");
    assert((await getRecord(kdcRecord.id)).deleted === true, "chưa đánh dấu xoá");
    assert(!(await listRecords()).some((r) => r.id === kdcRecord.id), "vẫn còn trong danh sách");
    assert((await listRecords({ includeDeleted: true })).some((r) => r.id === kdcRecord.id), "thùng rác mất");
    assert(!search("kdc08").some((x) => x.id === kdcRecord.id), "xoá rồi mà vẫn tìm ra");

    const off2 = on("record:saved", ({ record }) => indexRecord(record));
    const back = await restore(kdcRecord.id);
    off2();
    assert(back.deleted === false, "chưa khôi phục");
    assert(search("kdc08")[0].id === kdcRecord.id, "khôi phục rồi mà không tìm ra");
  });

  await test("purgeOld: chỉ xoá hẳn bản ghi trong thùng rác quá 30 ngày", async () => {
    const old = await saveRecord({ title: "Cũ lắm" });
    const recent = await saveRecord({ title: "Mới xoá" });
    const live = await saveRecord({ title: "Còn dùng" });
    await softDelete(old.id);
    await softDelete(recent.id);
    // Giả lập: bản "old" đã nằm trong thùng rác 40 ngày.
    const o = await getRecord(old.id);
    o.updatedAt = new Date(Date.now() - 40 * 86400000).toISOString();
    await dbPutMany("records", [o]);
    const n = await purgeOld(30);
    assert(n === 1, "xoá hẳn " + n + " bản ghi (đúng ra là 1)");
    assert((await getRecord(old.id)) === null, "bản cũ vẫn còn");
    assert((await getRecord(recent.id)) !== null, "bản mới xoá bị mất");
    assert((await getRecord(live.id)) !== null, "bản còn dùng bị mất");
  });


  await test("sanitizeRecord: loại id lạ, ép kiểu, cắt chuỗi dài, bỏ trường lạ", () => {
    const now = new Date().toISOString();
    assert(sanitizeRecord({ id: "../../etc/passwd", updatedAt: now }) === null, "id có ../ lọt qua");
    assert(sanitizeRecord({ id: "x'y\"z<script>alert(1)</script>", updatedAt: now }) === null, "id có ký tự lạ lọt qua");
    assert(sanitizeRecord({ id: "__proto__", updatedAt: now }) === null, "id __proto__");
    assert(sanitizeRecord({ id: "01JC9X0000000000000000AAAA", updatedAt: "không phải ngày" }) === null, "ngày rác lọt qua");
    const c = sanitizeRecord({ id: "01JC9X0000000000000000AAAA", updatedAt: now, title: "a".repeat(100000), tags: "không phải mảng", subjects: [1, "ok", { x: 1 }], evil: "<img onerror=1>", file: null, kind: "image",
      area: "lạ", ocrStatus: "lạ" });
    assert(c.title.length === 500, "title chưa bị cắt: " + c.title.length);
    assert(Array.isArray(c.tags) && c.tags.length === 0, "tags");
    assert(c.subjects.length === 1 && c.subjects[0] === "ok", "subjects");
    assert(!("evil" in c) && c.area === "work" && c.ocrStatus === "none", "trường lạ/enum");
    const f = sanitizeRecord({ id: "01JC9X0000000000000000AAAA", updatedAt: now, kind: "image", file: { driveId: "../about", thumbDriveId: "1AbCdEfGhIjKlMn", mime: "text/html" } });
    assert(f.file.driveId === null && f.file.thumbDriveId === "1AbCdEfGhIjKlMn" && f.file.mime === "image/jpeg", "file: " + JSON.stringify(f.file));
  });

  await test("importJson: file sao lưu độc hại không làm hỏng dữ liệu", async () => {
    const now = new Date().toISOString();
    const bad = { app: "cavang", schema: 2, records: [
      { id: "../../x", updatedAt: now, title: "id xấu" },
      { id: "01JC9X0000000000000000BBBB", updatedAt: now, title: "<img src=x onerror=alert(1)>".repeat(20000), subjects: ["<b>x</b>"], file: { driveId: "a/b/c" } },
      null, 5, "chuỗi", { id: 7 },
    ], images: { "__proto__": { data: "x" }, "01JC9X0000000000000000BBBB": { type: "text/html", data: "%%%không-phải-base64" } } };
    const before = (await dbAll("records")).length;
    const r = await importJson(new File([JSON.stringify(bad)], "x.json"));
    const after = await dbAll("records");
    assert(after.length === before + 1, `đúng ra thêm 1 bản ghi, thực tế thêm ${after.length - before}`);
    const got = after.find((x) => x.id === "01JC9X0000000000000000BBBB");
    assert(got && got.title.length === 500 && got.kind === "text", "bản ghi nhập chưa được làm sạch");
    assert(r.skipped >= 5, "bỏ qua " + r.skipped);
    let threw = false;
    try { await importJson(new File(["{không phải json"], "x.json")); } catch { threw = true; }
    assert(threw, "file hỏng phải báo lỗi");
  });

  await test("Hàng đợi đồng bộ (outbox) ghi nhận thay đổi", async () => {
    const box = await dbAll("outbox");
    assert(box.some((x) => x.recordId === kdcRecord.id && x.op === "put"), "thiếu put");
    assert(box.some((x) => x.op === "delete"), "thiếu delete");
  });

  // Dọn dẹp
  await closeDb();
  await deleteDatabase(TEST_DB);

  const failed = results.filter((r) => !r.ok).length;
  summaryEl.textContent = failed === 0
    ? `TẤT CẢ ĐỀU PASS (${results.length}/${results.length})`
    : `CÓ ${failed} BÀI FAIL / ${results.length}`;
  summaryEl.className = failed === 0 ? "pass" : "fail";
  window.__testDone = { total: results.length, failed };
}

main().catch((err) => {
  report("Lỗi nghiêm trọng khi chạy test", false, String(err && err.message ? err.message : err));
  summaryEl.textContent = "LỖI NGHIÊM TRỌNG";
  summaryEl.className = "fail";
  window.__testDone = { total: results.length, failed: results.length || 1 };
});
