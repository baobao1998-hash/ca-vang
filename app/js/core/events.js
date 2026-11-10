// Bus sự kiện nhỏ. Sự kiện: "record:saved" {record}, "record:deleted" {id}, "sync:status" {state, message}
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  for (const fn of [...(listeners.get(event) || [])]) {
    try { fn(payload); } catch (err) { console.error("Lỗi trong bộ nghe sự kiện", event, err); }
  }
}
