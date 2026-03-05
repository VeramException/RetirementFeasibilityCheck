// js/markets/nifty50.js
// Loads the Nifty CSV and returns processed 1-year returns array.

import { fetchCSV, parseDailyPricesFromCSV, computeOneYearReturns } from '../dataLoader.js';

export async function loadNifty50() {
  const path = 'Nifty_50_with_indicators_.csv'; // user-provided file in project root
  const csv = await fetchCSV(path);
  const daily = parseDailyPricesFromCSV(csv);
  const returns = computeOneYearReturns(daily);
  return returns; // array of {startDate,endDate,ret}
}