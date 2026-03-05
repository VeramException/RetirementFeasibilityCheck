// js/dataLoader.js
// Generic CSV loader + CSV -> market returns processor

import { parseDate } from './utils.js';

// fetch CSV at path and return text
export async function fetchCSV(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to fetch ${path}: HTTP ${resp.status}`);
  return await resp.text();
}

// process CSV of date,price into array of daily {date,price}
export function parseDailyPricesFromCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV file is empty');
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < 2) continue;
    const dateStr = cols[0].trim();
    const close = parseFloat(cols[1].trim());
    if (isNaN(close)) continue;
    try {
      const date = parseDate(dateStr);
      data.push({ date, price: close });
    } catch (e) {
      console.warn(`Skipping line ${i+1}: ${e.message}`);
    }
  }
  data.sort((a,b) => a.date - b.date);
  return data;
}

// convert daily price series into 1-year returns array: {startDate,endDate,ret}
export function computeOneYearReturns(dailyData) {
  const results = [];
  const msPerDay = 24*60*60*1000;
  for (let i = 0; i < dailyData.length; i++) {
    const target = dailyData[i].date.getTime() + 365 * msPerDay;
    let lo = i+1, hi = dailyData.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo+hi)/2);
      if (dailyData[mid].date.getTime() < target) lo = mid+1;
      else hi = mid-1;
    }
    if (lo < dailyData.length) {
      const ret = (dailyData[lo].price - dailyData[i].price) / dailyData[i].price;
      results.push({ startDate: dailyData[i].date, endDate: dailyData[lo].date, ret });
    }
  }
  if (results.length === 0) throw new Error('No 1-year returns could be computed.');
  return results;
}