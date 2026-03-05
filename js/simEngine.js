// js/simEngine.js
// Take sequences of indices + marketReturns and compute paths and failures

// sequences: array of sequences (each sequence -> array of indices into marketReturns)
// marketReturns: array of objects {startDate,endDate,ret}
// corpus0, age0, monthly0, step (e.g., 0.06), requiredYears

export function runBootstrapSimulationFromSequences(sequences, marketReturns, corpus0, age0, monthly0, step) {
  const simResults = [];
  let successes = 0;

  for (let s = 0; s < sequences.length; s++) {
    const seq = sequences[s];
    let start = corpus0;
    let m = monthly0;
    let failed = false;
    let failedAge = null;
    const path = [];

    for (let y = 0; y < seq.length; y++) {
      const idx = seq[y];
      const ret = marketReturns[idx].ret;
      const afterReturn = start * (1 + ret);
      const withdrawal = m * 12;
      const end = afterReturn - withdrawal;
      path.push(end);
      if (end <= 0 && !failed) { failed = true; failedAge = age0 + y; }
      start = end;
      if (y < seq.length - 1) m *= (1 + step);
    }

    if (!failed) successes++;
    simResults.push({ returnIndices: seq, pathEndCorpus: path, failedAt: failed ? failedAge : null });
  }

  return { simResults, successes };
}