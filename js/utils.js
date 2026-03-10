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

/**
 * XIRR calculation using Newton's method.
 * @param {Array<number>} values Cash flow values.
 * @param {Array<Date>} dates Cash flow dates.
 * @param {number} guess Initial guess for the rate.
 */
export function xirr(values, dates, guess = 0.1) {
  if (values.length !== dates.length) return NaN;

  const firstDate = dates[0].getTime();
  const dayFactor = 365.25 * 24 * 60 * 60 * 1000;

  function f(rate) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      const days = (dates[i].getTime() - firstDate) / dayFactor;
      sum += values[i] / Math.pow(1 + rate, days);
    }
    return sum;
  }

  function df(rate) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      const days = (dates[i].getTime() - firstDate) / dayFactor;
      sum -= days * values[i] / Math.pow(1 + rate, days + 1);
    }
    return sum;
  }

  let rate = guess;
  for (let i = 0; i < 50; i++) {
    const y = f(rate);
    const dy = df(rate);
    if (Math.abs(dy) < 1e-12) break;
    const nextRate = rate - y / dy;
    if (Math.abs(nextRate - rate) < 1e-7) return nextRate;
    rate = nextRate;
  }
  return rate;
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

export function showToast(message, type = 'error', duration = 5000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', (e) => {
      if (e.animationName === 'fadeOut') {
        toast.remove();
      }
    });
  }, duration);
}