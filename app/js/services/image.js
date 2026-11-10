// Xử lý ảnh: nén, tạo ảnh nhỏ (thumbnail), lấy ảnh từ dán/chọn/chụp.
// Không phụ thuộc module khác. Mọi lỗi đều là Error với message tiếng Việt.

const MSG_HEIC =
  "Máy này chưa đọc được ảnh định dạng HEIC/HEIF. Hãy chụp lại ở chế độ JPEG, hoặc chụp màn hình ảnh rồi thêm vào.";
const MSG_BAD = "Không đọc được ảnh này. File có thể bị hỏng hoặc không phải ảnh.";

function isHeic(file) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return t.includes("heic") || t.includes("heif") || /\.(heic|heif)$/.test(n);
}

// Mở ảnh thành bitmap, tự xoay đúng chiều theo EXIF.
async function decode(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch (e) {
    if (isHeic(blob)) throw new Error(MSG_HEIC);
    throw new Error(MSG_BAD);
  }
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function canvasToJpeg(canvas, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(MSG_BAD))), "image/jpeg", quality)
  );
}

async function render(bitmap, maxSide, quality) {
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long > maxSide ? maxSide / long : 1; // không phóng to ảnh nhỏ
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // ảnh PNG nền trong suốt -> nền trắng (JPEG không có trong suốt)
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high"; // giữ nét chữ khi thu nhỏ
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvasToJpeg(canvas, quality);
  return { blob, width, height };
}

/** Nén ảnh: cạnh dài ≤ maxSide, JPEG, xoay đúng chiều. */
export async function compressImage(fileOrBlob, { maxSide = 2000, quality = 0.85 } = {}) {
  const bitmap = await decode(fileOrBlob);
  try {
    return await render(bitmap, maxSide, quality);
  } finally {
    bitmap.close?.();
  }
}

/** Ảnh nhỏ cho danh sách (cạnh dài `size` px, chất lượng 0.7). */
export async function makeThumb(blob, size = 320) {
  const bitmap = await decode(blob);
  try {
    return (await render(bitmap, size, 0.7)).blob;
  } finally {
    bitmap.close?.();
  }
}

/** Lấy ảnh (File) từ sự kiện dán (Ctrl+V). Trả về mảng, rỗng nếu không có ảnh. */
export function readClipboardImage(event) {
  const items = event?.clipboardData?.items || [];
  const out = [];
  for (const it of items) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

/**
 * Chuyển danh sách file (chọn/chụp/kéo thả) thành ảnh đã nén.
 * Trả về { images: [{file, blob, width, height}], errors: ["thông báo tiếng Việt", ...] }
 */
export async function fileListToImages(fileList, opts) {
  const images = [];
  const errors = [];
  for (const file of Array.from(fileList || [])) {
    const name = file.name || "ảnh";
    if (!isHeic(file) && !(file.type || "").startsWith("image/")) {
      errors.push(`"${name}": không phải file ảnh nên bỏ qua.`);
      continue;
    }
    try {
      const r = await compressImage(file, opts);
      images.push({ file, ...r });
    } catch (e) {
      errors.push(`"${name}": ${e.message}`);
    }
  }
  return { images, errors };
}
