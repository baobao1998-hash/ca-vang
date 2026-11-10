"""Gắn số phiên bản vào đường dẫn file code khi đưa app lên mạng (chạy trong GitHub Actions, KHÔNG chạy trên máy).

Vì sao: Chrome giữ file JS/CSS trong bộ nhớ tạm và có lúc dùng lại mà không hỏi service worker,
nên app kẹt ở bản cũ. Đổi "js/main.js" thành "js/main.js?v=0.5.3" ở mỗi phiên bản → trình duyệt buộc tải mới.

Cách dùng: python3 scripts/stamp_version.py app
Chỉ sửa bản sao trong máy chủ build; code gốc trong kho giữ nguyên.
"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "app")
ver_text = (root / "js/core/version.js").read_text(encoding="utf-8")
m = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', ver_text)
if not m:
    sys.exit("APP_VERSION not found")
ver = m.group(1)
q = "?v=" + ver

# import ... from "./x.js" | import "./x.js" | export ... from "./x.js"
IMPORT_RE = re.compile(r'(\b(?:from|import)\s*)(["\'])(\.{1,2}/[^"\'?]+\.js)\2')
count = 0
for f in (root / "js").rglob("*.js"):
    s = f.read_text(encoding="utf-8")
    new, n = IMPORT_RE.subn(lambda mm: f"{mm.group(1)}{mm.group(2)}{mm.group(3)}{q}{mm.group(2)}", s)
    if n:
        f.write_text(new, encoding="utf-8")
        count += n

# index.html: file CSS + main.js
idx = root / "index.html"
s = idx.read_text(encoding="utf-8")
s, n1 = re.subn(r'(href="css/[^"?]+\.css)"', r'\1' + q + '"', s)
s, n2 = re.subn(r'(src="js/main\.js)"', r'\1' + q + '"', s)
idx.write_text(s, encoding="utf-8")

# sw.js: file nạp kèm của service worker
sw = root / "sw.js"
s = sw.read_text(encoding="utf-8")
s, n3 = re.subn(r'importScripts\("sw-outbox\.js"\)', f'importScripts("sw-outbox.js{q}")', s)
sw.write_text(s, encoding="utf-8")

print(f"stamped {q}: {count} js imports, {n1} css, {n2} main.js, {n3} importScripts")
if n2 != 1 or n3 != 1 or count == 0:
    sys.exit("stamp incomplete - stop to avoid deploying a broken build")
