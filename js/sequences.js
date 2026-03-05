// js/sequences.js
// Produce sequences of indices into marketReturns using optional seed
import { mulberry32 } from './utils.js';

// marketReturns: array (length N) ; runs: integer ; requiredYears: integer
// returns: array of sequences, each is array of indices (0..N-1)
export function getSequencesFromMarket(marketReturns, runs, requiredYears, seed = null) {
  const N = marketReturns.length;
  if (N === 0) throw new Error('marketReturns is empty');
  const prng = (seed === null) ? Math.random : mulberry32(Number(seed) || 1);
  const sequences = new Array(runs);
  for (let r = 0; r < runs; r++) {
    const seq = new Array(requiredYears);
    for (let y = 0; y < requiredYears; y++) {
      // sample index with replacement
      const idx = Math.floor(prng() * N);
      seq[y] = idx;
    }
    sequences[r] = seq;
  }
  return sequences;
}