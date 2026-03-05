// js/main.js
import { formatNumber, toIndianWords } from './utils.js';
import { runStatic } from './staticSim.js';
import { loadMarket, runMCFlow, redrawChartWithSamples, renderSampleFail, lastFailIndices } from './mcSim.js';

// ==================== DOM wiring & updateAll ====================
function updateAll() {
  const corpus = parseFloat(document.getElementById('corpusSlider').value);
  const age = parseInt(document.getElementById('currentAgeSlider').value, 10);
  const monthly = parseFloat(document.getElementById('monthlySlider').value);
  const stepup = parseFloat(document.getElementById('stepupSlider').value);
  const ret = parseFloat(document.getElementById('retSlider').value);

  document.getElementById('corpusValue').textContent = formatNumber(corpus);
  document.getElementById('ageValue').textContent = age;
  document.getElementById('monthlyValue').textContent = formatNumber(monthly);
  document.getElementById('stepupValue').textContent = stepup.toFixed(1);
  document.getElementById('retValue').textContent = ret.toFixed(1);

  const corpusWords = toIndianWords(corpus);
  const annualWithdrawal = monthly * 12;
  const withdrawalPct = corpus > 0 ? ((annualWithdrawal / corpus) * 100).toFixed(1) : '0';
  const ratio = corpus > 0 ? (corpus / annualWithdrawal).toFixed(1) : '0';
  document.getElementById('corpusWords').innerHTML = `${corpusWords}<br>(${ratio}x of 1st year withdrawal)`;
  const monthlyWords = toIndianWords(monthly);
  document.getElementById('monthlyWords').innerHTML = `${monthlyWords}<br>(${withdrawalPct}% of 1st year corpus)`;

  runStatic();
}

// Attach slider events
['corpusSlider','currentAgeSlider','monthlySlider','stepupSlider','retSlider'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', updateAll);
});

// simCount slider update (this is the runs slider)
const simCountSlider = document.getElementById('simCountSlider');
if (simCountSlider) {
  simCountSlider.addEventListener('input', e => {
    document.getElementById('simCountValue').textContent = e.target.value;
  });
  // Set initial value display
  document.getElementById('simCountValue').textContent = simCountSlider.value;
}

// samples slider display (input updates value, change triggers redraw)
const samplesSlider = document.getElementById('samplesSlider');
if (samplesSlider) {
  samplesSlider.addEventListener('input', e => {
    document.getElementById('samplesValue').textContent = e.target.value;
  });
  samplesSlider.addEventListener('change', () => {
    redrawChartWithSamples();
  });
}

// Run Monte Carlo
document.getElementById('runMc').addEventListener('click', () => {
  const runBtn = document.getElementById('runMc');

  if (runBtn.disabled) { alert('Market data not ready yet'); return; }

  // reset UI state
  document.getElementById('niftyStatus').style.display = 'none';
  document.getElementById('sampleFailBtn').style.display = 'none';
  document.getElementById('sampleTableContainer').innerHTML = '';
  document.getElementById('mcResultsTable').style.display = 'none';

  // read params from UI (use existing ids from your current HTML)
  const runs = parseInt(document.getElementById('simCountSlider').value, 10) || 1;
  const corpus0 = parseFloat(document.getElementById('corpusSlider').value) || 0;
  const age0 = parseInt(document.getElementById('currentAgeSlider').value, 10) || 0;
  const monthly0 = parseFloat(document.getElementById('monthlySlider').value) || 0;
  const step = parseFloat(document.getElementById('stepupSlider').value) / 100 || 0;

  // requiredYears logic preserved from original: from current age until 85 inclusive
  const requiredYears = 85 - age0 + 1;

  // start UI loading state
  runBtn.innerText = 'Running...';
  runBtn.disabled = true;
  document.getElementById('mcLoader').style.display = 'flex';

  // small timeout to allow UI to update
  setTimeout(() => {
    try {
      // call the modular MC flow
      const { simResults, successes } = runMCFlow({
        runs,
        corpus0,
        age0,
        monthly0,
        step,
        requiredYears
      });

      // update result table
      document.getElementById('mcTotal').textContent = runs;
      document.getElementById('mcPassed').textContent = successes;
      document.getElementById('mcFailed').textContent = runs - successes;
      const rateCell = document.getElementById('mcRate');
      const successRate = ((successes / runs) * 100).toFixed(1);
      rateCell.textContent = successRate + '%';
      rateCell.style.color = parseFloat(successRate) >= 95 ? '#16a34a' : '#dc2626';
      rateCell.style.fontWeight = 'bold';
      document.getElementById('mcResultsTable').style.display = 'table';

      // draw initial chart with default samples
      redrawChartWithSamples();
      document.querySelector('.samplesContainer').style.display = 'flex';

      // show sample-fail button if failures exist (mc module exposes lastFailIndices)
      if (lastFailIndices && lastFailIndices.length > 0) {
        const sampleBtn = document.getElementById('sampleFailBtn');
        sampleBtn.style.display = 'inline-block';
        sampleBtn.innerText = 'Show a sample failing sequence';
      }
    } catch (e) {
      console.error('MC run failed:', e);
      alert('Simulation failed: ' + e.message);
    } finally {
      // end loading state
      document.getElementById('mcLoader').style.display = 'none';
      runBtn.innerText = 'Run simulations';
      runBtn.disabled = false;
      document.getElementById('niftyStatus').style.display = 'inline';
    }
  }, 50);
});

// Sample failing sequence button
document.getElementById('sampleFailBtn').addEventListener('click', () => {
  renderSampleFail();
});

// Tabs
document.querySelectorAll('.tabBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tabContent').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Update market on selection change
window.updateMarket = async () => {
  const selected = document.querySelector('input[name="marketSource"]:checked').value;
  await loadMarket(selected);
};

// Initial draw and market load
updateAll();
loadMarket('nifty50');