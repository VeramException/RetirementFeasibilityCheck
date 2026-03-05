// js/mcSim.js
// Top-level Monte Carlo glue (UI-facing functions). Uses market loader, sequences & engine.

import { loadNifty50 } from './markets/nifty50.js';
import { getSequencesFromMarket } from './sequences.js';
import { runBootstrapSimulationFromSequences } from './simEngine.js';
import { formatIndian, formatDate as fmt } from './utils.js';

// exported state for UI usage
export let marketReturns = [];
export let marketLoaded = false;
export let marketLoadError = false;

export let lastSimPaths = [];
export let lastFailIndices = [];
export let lastFailShown = new Set();
export let lastLabels = [];

// status update (same DOM IDs as before)
export function updateMarketStatus(idSpan='niftyStatus', runButtonId='runMc') {
  const statusSpan = document.getElementById(idSpan);
  const runBtn = document.getElementById(runButtonId);
  if (marketLoadError) {
    statusSpan.innerHTML = `<span class="error">❌ Failed to load market data.</span>`;
    if (runBtn) runBtn.disabled = true;
  } else if (!marketLoaded) {
    statusSpan.innerHTML = '<span class="muted">⏳ Loading market data...</span>';
    if (runBtn) runBtn.disabled = true;
  } else {
    statusSpan.innerHTML = `<span class="success">✅ ${marketReturns.length} historical 1-year returns</span>`;
    if (runBtn) runBtn.disabled = false;
    // Update simulation slider max to allow up to 10,000 simulations
    const simSlider = document.getElementById('simCountSlider');
    if (simSlider) {
      simSlider.max = 10000;
      if (parseInt(simSlider.value) > 10000) {
        simSlider.value = 10000;
        document.getElementById('simCountValue').textContent = 10000;
      }
    }
    const maxSeqSpan = document.getElementById('maxSequences');
    if (maxSeqSpan) maxSeqSpan.textContent = '10,000';
  }
}

// load a named market - for now only 'nifty50' implemented
export async function loadMarket(name='nifty50') {
  try {
    marketLoaded = false;
    marketLoadError = false;
    updateMarketStatus();

    if (name === 'nifty50') {
      marketReturns = await loadNifty50();
    } else {
      throw new Error('Unknown market: ' + name);
    }

    marketLoaded = true;
    marketLoadError = false;
    updateMarketStatus();
  } catch (e) {
    console.error('loadMarket error:', e);
    marketLoaded = false;
    marketLoadError = true;
    updateMarketStatus();
  }
}

// run full bootstrap flow given runs and UI params
// args: { runs, corpus0, age0, monthly0, step, requiredYears, seed }
export function runMCFlow({ runs, corpus0, age0, monthly0, step, requiredYears, seed = null }) {
  if (!marketLoaded) throw new Error('Market not loaded');

  // 1) produce sequences using provided runs and optional seed
  const sequences = getSequencesFromMarket(marketReturns, runs, requiredYears, seed);

  // 2) run engine to compute paths & failures
  const { simResults, successes } = runBootstrapSimulationFromSequences(sequences, marketReturns, corpus0, age0, monthly0, step);

  // store for UI interactions
  lastSimPaths = simResults;
  lastFailIndices = simResults.map((r, idx) => ({ idx, failedAt: r.failedAt }))
                              .filter(x => x.failedAt !== null)
                              .map(x => x.idx);
  lastFailShown.clear();
  lastLabels = Array.from({ length: requiredYears }, (_, i) => age0 + i);

  return { simResults, successes };
}

// redraw chart using a sample set of paths
export function redrawChartWithSamples(samplesCount = null) {
  if (!lastSimPaths.length) return;

  const totalDisplayPaths = samplesCount || parseInt(document.getElementById('samplesSlider').value, 10) || 100;
  const runs = lastSimPaths.length;
  const successes = lastSimPaths.filter(r => r.failedAt === null).length;
  const successPaths = lastSimPaths.filter(r => r.failedAt === null).map(r => r.pathEndCorpus);
  const failPaths = lastSimPaths.filter(r => r.failedAt !== null).map(r => r.pathEndCorpus);

  // compute counts of success/fail to show
  let successCount = Math.min(successPaths.length, Math.round(totalDisplayPaths * successes / runs));
  let failCount = Math.min(failPaths.length, totalDisplayPaths - successCount);
  if (successCount + failCount < totalDisplayPaths) {
    successCount = Math.min(successPaths.length, totalDisplayPaths);
    failCount = Math.min(failPaths.length, totalDisplayPaths - successCount);
  }

  function samplePaths(arr, k) {
    if (!arr || arr.length === 0) return [];
    if (k >= arr.length) return arr.slice();
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, k);
  }

  const sampledSuccess = samplePaths(successPaths, successCount);
  const sampledFail = samplePaths(failPaths, failCount);

  const datasets = [];
  sampledSuccess.forEach(path => datasets.push({ data: path, borderColor: 'rgba(43,124,255,0.25)', borderWidth: 1.2, pointRadius: 0, tension: 0.2 }));
  sampledFail.forEach(path => datasets.push({ data: path, borderColor: 'rgba(220,38,38,0.25)', borderWidth: 1.2, pointRadius: 0, tension: 0.2 }));

  const labels = lastLabels || [];
  if (!labels.length) return;

  const corpus0 = parseFloat(document.getElementById('corpusSlider').value) || 1;
  const maxY = corpus0 * 10;
  const minY = -corpus0 * 10;

  // defensive destroy: only call destroy if it exists and is a function
  if (window.mcChart && typeof window.mcChart.destroy === 'function') {
    try { window.mcChart.destroy(); } catch (e) { console.warn('Failed to destroy existing mcChart instance:', e); }
  }

  try {
    window.mcChart = new Chart(document.getElementById('mcChart'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          y: {
            min: minY,
            max: maxY,
            grid: { color: context => context.tick.value === 0 ? '#ccc' : '#e5e7eb' },
            ticks: { callback: v => formatIndian(v) }
          }
        }
      }
    });
    document.getElementById('mcChart').style.display = 'block';
  } catch (e) {
    console.error('Error creating mcChart:', e);
  }
}

// render sample failing sequence into DOM
export function renderSampleFail() {
  if (!lastFailIndices || lastFailIndices.length === 0) return;
  let available = [];
  for (let i = 0; i < lastFailIndices.length; i++) {
    if (!lastFailShown.has(lastFailIndices[i])) available.push(lastFailIndices[i]);
  }
  if (available.length === 0) { lastFailShown.clear(); available = lastFailIndices.slice(); }
  const chosenIdx = available[Math.floor(Math.random() * available.length)];
  lastFailShown.add(chosenIdx);
  const sim = lastSimPaths[chosenIdx];
  if (!sim) return;
  const indices = sim.returnIndices;
  const path = sim.pathEndCorpus;

  const age0 = parseInt(document.getElementById('currentAgeSlider').value, 10);
  const corpus0 = parseFloat(document.getElementById('corpusSlider').value);
  const monthly0 = parseFloat(document.getElementById('monthlySlider').value);
  const step = parseFloat(document.getElementById('stepupSlider').value) / 100 || 0;

  let startCorpus = corpus0;
  let m = monthly0;
  let rows = [];
  let depletedFlag = false;

  for (let y = 0; y < path.length; y++) {
    const age = age0 + y;
    const idx = indices[y];
    const hist = marketReturns[idx];
    const startDate = hist.startDate;
    const endDate = hist.endDate;
    const ret = hist.ret;
    const afterReturn = startCorpus * (1 + ret);
    const withdrawal = m * 12;
    const finalCorpus = path[y];

    if (finalCorpus <= 0) depletedFlag = true;

    rows.push({
      age,
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      retPct: (ret * 100).toFixed(2) + '%',
      startCorpus,
      afterReturn,
      withdrew: withdrawal,
      finalCorpus,
      depleted: depletedFlag
    });

    startCorpus = finalCorpus;
    if (y < path.length - 1) m *= (1 + step);
  }

  let html = '<table id="sampleTable"><thead><tr><th>Age</th><th>Fund Start Date</th><th>Fund End Date</th><th>Return %</th><th>Starting Corpus</th><th>After Return</th><th>Withdrew</th><th>Final Corpus</th></tr></thead><tbody>';
  rows.forEach(r => {
    const rowClass = r.depleted ? 'depleted-row' : '';
    const retClass = r.retPct.includes('-') ? 'negative' : '';
    const startClass = r.startCorpus < 0 ? 'negative' : '';
    const afterClass = r.afterReturn < 0 ? 'negative' : '';
    const finalClass = r.finalCorpus < 0 ? 'negative' : '';
    html += `<tr class="${rowClass}">
      <td>${r.age}</td>
      <td>${r.startDate}</td>
      <td>${r.endDate}</td>
      <td class="${retClass}">${r.retPct}</td>
      <td class="${startClass}">₹ ${formatIndian(r.startCorpus)}</td>
      <td class="${afterClass}">₹ ${formatIndian(r.afterReturn)}</td>
      <td>₹ ${formatIndian(r.withdrew)}</td>
      <td class="${finalClass}">₹ ${formatIndian(r.finalCorpus)}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('sampleTableContainer').innerHTML = html;
  const sampleBtn = document.getElementById('sampleFailBtn');
  sampleBtn.innerText = 'Show another sample failing sequence';
}