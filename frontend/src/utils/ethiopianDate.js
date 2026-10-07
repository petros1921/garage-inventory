// Ethiopian ↔ Gregorian calendar conversion
// Algorithm based on Dershowitz & Reingold, "Calendrical Calculations"

const ET_EPOCH = 1724221; // JDN of 1 Meskerem 1 E.C. (Amete Mihret)

export const ET_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
];

export const ET_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
];

// --- JDN helpers ---
function gregorianToJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy +
    Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

function jdnToEthiopian(jdn) {
  const r = (jdn - ET_EPOCH) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - ET_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1,
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

function ethiopianToJDN(y, m, d) {
  return ET_EPOCH - 1 + 365 * (y - 1) + Math.floor(y / 4) + 30 * (m - 1) + d;
}

// ===== Public API =====
export function toEthiopian(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return jdnToEthiopian(gregorianToJDN(d.getFullYear(), d.getMonth() + 1, d.getDate()));
}

export function toGregorian(ethYear, ethMonth, ethDay) {
  return jdnToGregorian(ethiopianToJDN(ethYear, ethMonth, ethDay));
}

export function formatEthiopian(dateInput, { amharic = true, includeTime = false } = {}) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const eth = toEthiopian(d);
  const months = amharic ? ET_MONTHS_AM : ET_MONTHS_EN;
  let out = `${months[eth.month - 1]} ${eth.day}, ${eth.year}`;
  if (amharic) out += ' ዓ.ም';
  if (includeTime) {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    out += ` · ${h12}:${m} ${ampm}`;
  }
  return out;
}