// js/sequences.js
// Produce sequences of indices into marketReturns using block bootstrap sampling
import { mulberry32 } from './utils.js';

// Helper: Group marketReturns by start month/day to create annual series
// Returns: { seriesKey -> [{ yearKey, indices_in_this_series_that_start_on_this_date }] }
function buildAnnualSeries(marketReturns) {
  const seriesByMonthDay = {}; // "MM-DD" -> { yearKey -> arrayOfIndices }

  for (let i = 0; i < marketReturns.length; i++) {
    const startDate = marketReturns[i].startDate;
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const year = startDate.getFullYear();
    const monthDay = `${month}-${day}`;
    const yearKey = year;

    if (!seriesByMonthDay[monthDay]) {
      seriesByMonthDay[monthDay] = {};
    }
    if (!seriesByMonthDay[monthDay][yearKey]) {
      seriesByMonthDay[monthDay][yearKey] = [];
    }
    seriesByMonthDay[monthDay][yearKey].push(i);
  }

  // Convert year map to sorted array and filter out series with < 5 consecutive years
  const result = [];
  for (const monthDay in seriesByMonthDay) {
    const yearMap = seriesByMonthDay[monthDay];
    const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b);

    // Find groups of consecutive years
    let i = 0;
    while (i < years.length) {
      let consecutiveYears = [years[i]];
      let j = i + 1;
      while (j < years.length && years[j] === years[j - 1] + 1) {
        consecutiveYears.push(years[j]);
        j++;
      }

      // Only use groups with at least 5 consecutive years
      if (consecutiveYears.length >= 5) {
        const indicesSequence = consecutiveYears.map(year => yearMap[year][0]); // Take first index for that year
        result.push(indicesSequence);
      }

      i = j;
    }
  }

  return result;
}

// marketReturns: array (length N) ; runs: integer ; requiredYears: integer
// returns: array of sequences, each is array of indices (0..N-1)
// Uses block bootstrap: randomly samples 5-6 year blocks from proper annual series
export function getSequencesFromMarket(marketReturns, runs, requiredYears, seed = null) {
  if (marketReturns.length === 0) throw new Error('marketReturns is empty');

  // Build annual series (groups of consecutive years with same start month/day)
  const annualSeries = buildAnnualSeries(marketReturns);
  if (annualSeries.length === 0) throw new Error('No sufficient annual series found in market returns');

  const prng = (seed === null) ? Math.random : mulberry32(Number(seed) || 1);
  const sequences = new Array(runs);

  for (let r = 0; r < runs; r++) {
    const seq = [];

    // Build sequence by appending blocks until we reach requiredYears
    while (seq.length < requiredYears) {
      // Randomly pick an annual series
      const seriesIdx = Math.floor(prng() * annualSeries.length);
      const series = annualSeries[seriesIdx];

      // Randomly pick a block length: 3, 4, 5, or 6 years
      const blockLength = 3 + Math.floor(prng() * 4);

      // Randomly pick a starting year within this series
      // Ensure we can fit at least the chosen blockLength
      const maxStartPos = Math.max(0, series.length - blockLength);
      const startPos = maxStartPos > 0 ? Math.floor(prng() * (maxStartPos + 1)) : 0;

      // Extract up to blockLength consecutive years from this series
      const availableYears = series.length - startPos;
      const actualBlockLength = Math.min(blockLength, availableYears);

      // Add the indices to the sequence
      for (let b = 0; b < actualBlockLength; b++) {
        if (seq.length < requiredYears) {
          seq.push(series[startPos + b]);
        }
      }
    }

    sequences[r] = seq;
  }

  return sequences;
}