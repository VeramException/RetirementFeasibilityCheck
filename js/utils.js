// js/utils.js
// small utilities used across modules

export function parseNumber(str){ return parseFloat((str||'').replace(/,/g,''))||0; }
export function formatIndian(num){ return Number.isFinite(num)? num.toLocaleString('en-IN',{maximumFractionDigits:0}) : ''; }
export function formatNumber(num) { return num.toLocaleString('en-IN', {maximumFractionDigits: 0}); }

export function toIndianWords(num) {
  if (isNaN(num) || num < 0) return '';
  if (num >= 1e7) { let val = num / 1e7; val = Math.round(val * 100) / 100; return val + ' crore'; }
  if (num >= 1e5) { let val = num / 1e5; val = Math.round(val * 100) / 100; return val + ' lakh'; }
  if (num >= 1e3) { let val = num / 1e3; val = Math.round(val * 100) / 100; return val + ' thousand'; }
  return num.toString();
}

export function parseDate(dateStr) {
  dateStr = dateStr.trim();
  const parts = dateStr.split('-');
  if (parts.length !== 3) throw new Error(`Invalid date format: ${dateStr}`);
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1];
  const yearShort = parseInt(parts[2], 10);
  // Pivot: years 00-29 are 2000+, years 30-99 are 1900+
  const year = yearShort < 30 ? 2000 + yearShort : 1900 + yearShort;
  const months = {Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11};
  const month = months[monthStr];
  if (month === undefined) throw new Error(`Invalid month abbreviation: ${monthStr}`);
  return new Date(year, month, day);
}

export function formatDate(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/* ===== Seeded PRNG (mulberry32) =====
   Use seed (number) to get deterministic randomness in [0,1).
   Example: const rnd = mulberry32(12345); rnd() -> 0..1
*/
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}