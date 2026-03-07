// js/markets/nifty500.js
// Loads the Nifty 500 CSV and returns processed 1-year returns array.

import { fetchCSV, parseDailyPricesFromCSV, computeOneYearReturns } from '../dataLoader.js';

export async function loadNifty500() {
  const path = './data/Nifty_500_daily_historical_values.csv'; // user-provided file in project root
  const csv = await fetchCSV(path);
  const daily = parseDailyPricesFromCSV(csv);
  const returns = computeOneYearReturns(daily);
  return returns; // array of {startDate,endDate,ret}
}
