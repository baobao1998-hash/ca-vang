// Tạo id dạng ULID (26 ký tự, sắp xếp được theo thời gian).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let lastTime = -1;
let lastRand = [];

function randomDigits() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b % 32);
}

export function newId() {
  let now = Date.now();
  if (now === lastTime) {
    // Cùng một mili-giây: tăng phần ngẫu nhiên lên 1 để vẫn đúng thứ tự.
    for (let i = lastRand.length - 1; i >= 0; i--) {
      if (lastRand[i] < 31) { lastRand[i]++; break; }
      lastRand[i] = 0;
    }
  } else {
    lastTime = now;
    lastRand = randomDigits();
  }
  let t = "";
  for (let i = 0; i < 10; i++) {
    t = ALPHABET[now % 32] + t;
    now = Math.floor(now / 32);
  }
  return t + lastRand.map((d) => ALPHABET[d]).join("");
}
