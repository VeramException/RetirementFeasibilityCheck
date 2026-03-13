// js/main.js
import { formatNumber, toIndianWords, formatIndian, showToast, parseNumber } from './utils.js';
import { runStatic } from './staticSim.js';
import { loadMarket, runMCFlow, redrawChartWithSamples, renderSampleFail, lastFailIndices } from './mcSim.js';
import { initGoals } from './goals.js';

// ==================== DOM wiring & updateAll ====================
function updateAll() {
  const corpus = parseFloat(document.getElementById('corpusSlider').value);
  const age = parseInt(document.getElementById('currentAgeSlider').value, 10);
  const endAge = parseInt(document.getElementById('endAgeSlider').value, 10);
  const monthly = parseFloat(document.getElementById('monthlySlider').value);
  const stepup = parseFloat(document.getElementById('stepupSlider').value);
  const ret = parseFloat(document.getElementById('retSlider').value);

  // Update input fields with formatted values
  document.getElementById('corpusInput').value = formatNumber(corpus);
  document.getElementById('ageInput').value = age;
  document.getElementById('endAgeInput').value = endAge;
  document.getElementById('monthlyInput').value = formatNumber(monthly);
  document.getElementById('stepupInput').value = stepup.toFixed(1);
  document.getElementById('retInput').value = ret.toFixed(1);

  const corpusWords = toIndianWords(corpus);
  const annualWithdrawal = monthly * 12;
  const withdrawalPct = corpus > 0 ? ((annualWithdrawal / corpus) * 100).toFixed(1) : '0';
  const ratio = corpus > 0 ? (corpus / annualWithdrawal).toFixed(1) : '0';
  document.getElementById('corpusWords').innerHTML = `${corpusWords} <span class="hint-detail">(${ratio}x of 1st year withdrawal)</span>`;
  const monthlyWords = toIndianWords(monthly);
  document.getElementById('monthlyWords').innerHTML = `${monthlyWords} <span class="hint-detail">(${withdrawalPct}% of 1st year corpus)</span>`;

  runStatic();
}

// Map inputs to sliders
const inputToSliderMap = {
  'ageInput': 'currentAgeSlider',
  'endAgeInput': 'endAgeSlider',
  'corpusInput': 'corpusSlider',
  'monthlyInput': 'monthlySlider',
  'stepupInput': 'stepupSlider',
  'retInput': 'retSlider'
};

// Map display names for error messages
const inputDisplayNames = {
  'ageInput': 'Retirement age',
  'endAgeInput': 'Life expectancy',
  'corpusInput': 'Initial corpus',
  'monthlyInput': 'Monthly withdrawal',
  'stepupInput': 'Withdrawal increase',
  'retInput': 'Annual return'
};

// Attach input events
Object.keys(inputToSliderMap).forEach(inputId => {
  const inputEl = document.getElementById(inputId);
  const sliderId = inputToSliderMap[inputId];
  const sliderEl = document.getElementById(sliderId);

  if (inputEl && sliderEl) {
    inputEl.addEventListener('change', () => {
      let val = parseNumber(inputEl.value);
      const min = parseFloat(sliderEl.min);
      const max = parseFloat(sliderEl.max);
      const displayName = inputDisplayNames[inputId];

      if (val < min) {
        showToast(`${displayName} cannot be less than ${inputId.includes('corpus') || inputId.includes('monthly') ? '₹ ' + formatNumber(min) : min + (inputId.includes('Age') ? '' : '%')}`);
        val = min;
      } else if (val > max) {
        showToast(`${displayName} cannot exceed ${inputId.includes('corpus') || inputId.includes('monthly') ? '₹ ' + formatNumber(max) : max + (inputId.includes('Age') ? '' : '%')}`);
        val = max;
      }
      
      sliderEl.value = val;
      updateAll();
    });

    // Also handle Enter key
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        inputEl.blur();
      }
    });
  }
});

// Attach slider events
['corpusSlider','currentAgeSlider','endAgeSlider','monthlySlider','stepupSlider','retSlider'].forEach(id => {
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

  if (runBtn.disabled) { showToast('Market data not ready yet'); return; }

  // reset UI state
  document.getElementById('niftyStatus').style.display = 'none';
  document.getElementById('sampleFailBtn').style.display = 'none';
  document.getElementById('sampleTableContainer').innerHTML = '';
  document.getElementById('mcOuterContainer').style.display = 'none';

  // read params from UI (use existing ids from your current HTML)
  const runs = parseInt(document.getElementById('simCountSlider').value, 10) || 1;
  const corpus0 = parseFloat(document.getElementById('corpusSlider').value) || 0;
  const age0 = parseInt(document.getElementById('currentAgeSlider').value, 10) || 0;
  const endAge = parseInt(document.getElementById('endAgeSlider').value, 10) || 85;
  const monthly0 = parseFloat(document.getElementById('monthlySlider').value) || 0;
  const step = parseFloat(document.getElementById('stepupSlider').value) / 100 || 0;

  // requiredYears logic: from current age until endAge inclusive
  const requiredYears = endAge - age0 + 1;

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
        endAge,
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
      document.getElementById('mcOuterContainer').style.display = 'table';

      // Calculate and update percentile table
      updatePercentilesTable(simResults);

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
      showToast('Simulation failed: ' + e.message);
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
    // Only affect sibling sub-tabs within the same sub-tab container
    const container = btn.closest('.tabContainer');
    if (container) {
      container.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tabContent').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    }
  });
});

// Primary Tabs
document.querySelectorAll('.primaryTabBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.dataset.tab) return;
    document.querySelectorAll('.primaryTabBtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.primaryTabContent').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Calculate and display percentiles for corpus values
function updatePercentilesTable(simResults) {
  if (!simResults || simResults.length === 0) return;

  // Extract final corpus value from each simulation
  const finalCorpusValues = simResults.map(result => {
    const pathEndCorpus = result.pathEndCorpus;
    return pathEndCorpus[pathEndCorpus.length - 1];
  });

  // Sort values in ascending order
  finalCorpusValues.sort((a, b) => a - b);

  // Calculate percentiles
  const calculatePercentile = (arr, percentile) => {
    const index = (percentile / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return arr[lower];
    }
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  };

  // For "80% probability", we want the value where 80% of cases have AT LEAST this much
  // That's the 20th percentile (100-80)
  // Higher probability = lower corpus value (more conservative)
  const p80 = calculatePercentile(finalCorpusValues, 100 - 80);  // 20th percentile
  const p90 = calculatePercentile(finalCorpusValues, 100 - 90);  // 10th percentile
  const p95 = calculatePercentile(finalCorpusValues, 100 - 95);  // 5th percentile

  // Update the percentile table cells
  document.getElementById('p80').textContent = formatIndian(p80);
  document.getElementById('p90').textContent = formatIndian(p90);
  document.getElementById('p95').textContent = formatIndian(p95);
}

// Update market on selection change
window.updateMarket = async () => {
  const selected = document.querySelector('input[name="marketSource"]:checked').value;
  await loadMarket(selected);
};

// Initial draw and market load
updateAll();
loadMarket('nifty50');
initGoals();