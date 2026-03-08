// js/sequences.js
// Produce sequences of indices into marketReturns using rolling block bootstrap sampling
import { mulberry32 } from './utils.js';

// Pre-calculate mapping from a return's end date to the index of the return that starts there.
// This allows us to follow "consecutive years" starting from any day in the historical record.
function buildNextIndexMap(marketReturns) {
  const dateToIndex = new Map();
  for (let i = 0; i < marketReturns.length; i++) {
    dateToIndex.set(marketReturns[i].startDate.getTime(), i);
  }

  const nextIndex = new Int32Array(marketReturns.length).fill(-1);
  for (let i = 0; i < marketReturns.length; i++) {
    const endT = marketReturns[i].endDate.getTime();
    if (dateToIndex.has(endT)) {
      nextIndex[i] = dateToIndex.get(endT);
    }
  }
  return nextIndex;
}

// marketReturns: array (length N) ; runs: integer ; requiredYears: integer
// returns: array of sequences, each is array of indices (0..N-1)
// Uses Rolling Block Bootstrap: 
// For each run, we stitch together blocks of consecutive historical years.
// Blocks start at random indices and have random lengths (e.g. 3-8 years).
// This maintains the "Sequence of Returns" properties (autocorrelation, clusters)
// while utilizing almost all available historical starting points for diversity.
export function getSequencesFromMarket(marketReturns, runs, requiredYears, seed = null) {
  if (marketReturns.length === 0) throw new Error('marketReturns is empty');

  const prng = (seed === null) ? Math.random : mulberry32(Number(seed) || 1);
  const nextIndex = buildNextIndexMap(marketReturns);
  
  const sequences = new Array(runs);

  for (let r = 0; r < runs; r++) {
    const seq = [];

    while (seq.length < requiredYears) {
      // Pick a random starting point in the historical data
      let currentIdx = Math.floor(prng() * marketReturns.length);
      
      // Pick a random block length between 3 and 8 years
      // This helps break up the "too obvious" patterns while maintaining local properties
      let blockRemaining = 3 + Math.floor(prng() * 6); 

      while (blockRemaining > 0 && currentIdx !== -1 && seq.length < requiredYears) {
        seq.push(currentIdx);
        currentIdx = nextIndex[currentIdx];
        blockRemaining--;
      }
    }

    sequences[r] = seq;
  }

  return sequences;
}
