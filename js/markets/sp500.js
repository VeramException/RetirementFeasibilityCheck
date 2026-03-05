// js/markets/sp500.js
// Template for adding S&P500 later — change `path` to your S&P CSV when ready.

import { fetchCSV, parseDailyPricesFromCSV, computeOneYearReturns } from '../dataLoader.js';

export async function loadSP500() {
  const path = 'SP500_with_indicators_.csv'; // replace with your file
  const csv = await fetchCSV(path);
  const daily = parseDailyPricesFromCSV(csv);
  const returns = computeOneYearReturns(daily);
  return returns;
}