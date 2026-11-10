// Xem ảnh phóng to: chụm 2 ngón để zoom, kéo để di chuyển, lăn chuột / nhấp đúp để zoom, phím Esc để đóng.
import { h, icon } from "../dom.js";

export function openLightbox(src, alt) {
  let scale = 1, x = 0, y = 0;
  const pointers = new Map();
  let startDist = 0, startScale = 1, lastTap = 0;

  const img = h("img", { src, alt, draggable: "false" });
  const stage = h("div", { class: "lb-stage" }, img);

  function apply() {
    // Không cho kéo ảnh ra quá xa khỏi màn hình.
    const maxX = (stage.clientWidth * (scale - 1)) / 2 + 40;
    const maxY = (stage.clientHeight * (scale - 1)) / 2 + 40;
    x = Math.max(-maxX, Math.min(maxX, x));
    y = Math.max(-maxY, Math.min(maxY, y));
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    img.style.cursor = scale > 1 ? "grab" : "zoom-in";
  }
  function setScale(s, fx = 0, fy = 0) {
    const next = Math.max(1, Math.min(6, s));
    const k = next / scale;
    // Giữ điểm đang chụm/nhấp đứng yên (fx, fy tính từ tâm khung).
    x = fx - (fx - x) * k;
    y = fy - (fy - y) * k;
    scale = next;
    if (scale === 1) { x = 0; y = 0; }
    apply();
  }
  const centre = (e) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
  };
  const dist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { startDist = dist(); startScale = scale; }
    const now = Date.now();
    if (pointers.size === 1 && now - lastTap < 300) { // nhấp đúp
      const [fx, fy] = centre(e);
      setScale(scale > 1 ? 1 : 2.5, fx, fy);
      lastTap = 0;
    } else lastTap = now;
  });
  stage.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const r = stage.getBoundingClientRect();
      setScale(startScale * (dist() / startDist), (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2);
    } else if (pointers.size === 1 && scale > 1) {
      x += e.clientX - p.x; y += e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      apply();
    }
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size === 1) { const [p] = pointers.values(); startDist = 0; startScale = scale; void p; } };
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [fx, fy] = centre(e);
    setScale(scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), fx, fy);
  }, { passive: false });

  const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "+" || e.key === "=") setScale(scale * 1.3); else if (e.key === "-") setScale(scale / 1.3); };
  const zoomBtn = (label, ico, fn) => h("button", { type: "button", class: "btn btn-icon", "aria-label": label, onclick: fn }, ico);

  const box = h("div", { class: "lightbox", role: "dialog", "aria-modal": "true", "aria-label": "Xem ảnh lớn" },
    stage,
    h("div", { class: "lb-bar glass-strong" },
      zoomBtn("Thu nhỏ", h("span", { class: "lb-sym" }, "−"), () => setScale(scale / 1.4)),
      zoomBtn("Vừa khung", h("span", { class: "lb-sym lb-fit" }, "1×"), () => setScale(1)),
      zoomBtn("Phóng to", h("span", { class: "lb-sym" }, "+"), () => setScale(scale * 1.4)),
    ),
    h("button", { type: "button", class: "btn btn-icon lb-close", "aria-label": "Đóng", onclick: close }, icon("close", 22)),
  );
  document.addEventListener("keydown", onKey);
  document.body.append(box);
  apply();
  return close;
}
