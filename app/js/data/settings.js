// Cài đặt lưu trong localStorage (có dự phòng bộ nhớ tạm nếu bị chặn).
import { SETTINGS_PREFIX } from "../core/config.js";

const fallback = new Map();

export function getSetting(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(SETTINGS_PREFIX + key);
    if (raw === null) return fallback.has(key) ? fallback.get(key) : defaultValue;
    return JSON.parse(raw);
  } catch {
    return fallback.has(key) ? fallback.get(key) : defaultValue;
  }
}

export function setSetting(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(SETTINGS_PREFIX + key);
    else localStorage.setItem(SETTINGS_PREFIX + key, JSON.stringify(value));
  } catch {
    fallback.set(key, value);
  }
}
