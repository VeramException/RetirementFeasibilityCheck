// js/goals.js
import { formatNumber, formatIndian, showToast } from './utils.js';

let state = {
  investments: [],
  goals: []
};

let allocationChart = null;
const STORAGE_KEY = 'retire_goals_data';

// Load from LocalStorage
export function initGoals() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    state.investments = data.investments || [];
    state.goals = data.goals || [];
  }
  renderAll();
  setupEventListeners();
  refreshAllMFNavs(); // Auto-refresh live NAVs on load
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  state.goals.sort((a, b) => a.year - b.year);
  renderDashboard();
  renderInvestments();
  renderGoals();
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  const total = state.investments.reduce((sum, inv) => sum + (inv.units * inv.price), 0);
  const totalEl = document.getElementById('totalNetworth');
  if (totalEl) totalEl.textContent = '₹' + formatIndian(total);

  // Hide Export button if no data
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.style.display = (state.investments.length === 0 && state.goals.length === 0) ? 'none' : 'block';
  }

  let alloc = { eq: 0, dt: 0, gd: 0, ot: 0 };
  state.investments.forEach(inv => {
    const val = inv.units * inv.price;
    alloc.eq += val * (inv.alloc.eq / 100);
    alloc.dt += val * (inv.alloc.dt / 100);
    alloc.gd += val * (inv.alloc.gd / 100);
    alloc.ot += val * (inv.alloc.ot / 100);
  });

  const colors = { eq: '#2b7cff', dt: '#64748b', gd: '#f59e0b', ot: '#94a3b8' };
  
  const breakdownHtml = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      ${renderAllocLine('Equity', alloc.eq, total, colors.eq)}
      ${renderAllocLine('Debt', alloc.dt, total, colors.dt)}
      ${renderAllocLine('Gold', alloc.gd, total, colors.gd)}
      ${renderAllocLine('Other', alloc.ot, total, colors.ot)}
    </div>
  `;
  const breakdownEl = document.getElementById('allocationBreakdown');
  if (breakdownEl) breakdownEl.innerHTML = breakdownHtml;

  updateAllocationChart(alloc, colors);

  const container = document.getElementById('goalSummaryContainer');
  if (!container) return;

  if (state.investments.length === 0) {
    container.innerHTML = '<p class="muted">No investments added yet.</p>';
    return;
  }

  const sortedInvestments = [...state.investments]
    .map(inv => ({ ...inv, val: inv.units * inv.price }))
    .sort((a, b) => b.val - a.val);

  const tableHtml = `
    <div style="margin-top: 20px;">
      <h3 onclick="window.goToInvestments()" style="font-size: 16px; margin-bottom: 12px; color: var(--accent); cursor: pointer; display: inline-block;">Holdings ↗</h3>
      <table class="linked-inv-table">
        <thead>
          <tr>
            <th style="text-align: left;">Investment</th>
            <th style="text-align: center;">% of NW</th>
            <th style="text-align: right;">Value</th>
          </tr>
        </thead>
        <tbody>
          ${sortedInvestments.map(inv => `
            <tr>
              <td style="text-align: left;">${inv.name}</td>
              <td style="text-align: center;">${total > 0 ? Math.round((inv.val / total) * 100) : 0}%</td>
              <td style="text-align: right; font-weight: 600;">₹${formatIndian(inv.val)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  container.innerHTML = tableHtml;
}

window.goToInvestments = () => {
    const btn = document.querySelector('.tabBtn[data-tab="investmentsTab"]');
    if (btn) btn.click();
};

function renderGoalCard(goal, isSummary = false) {
  const currentVal = calculateGoalCurrentValue(goal);
  const goalAlloc = calculateGoalAllocation(goal);
  const colors = { eq: '#2b7cff', dt: '#64748b', gd: '#f59e0b', ot: '#94a3b8' };
  
  // Setup attributes
  const clickFn = isSummary ? '' : `window.handleGoalClick(event, '${goal.id}', ${!!goal.isSurplus})`;
  const styleAttr = goal.isSurplus ? 'style="border-style:dashed; background:#f8fafc; cursor:pointer;"' : '';

  let headerAmount = `Target: ₹${formatIndian(goal.target)}`;
  let surplusText = '';
  if (!goal.noTrack && currentVal >= goal.target) {
    headerAmount = `<span class="achieved-text">Target: ₹${formatIndian(goal.target)} ✅</span>`;
    const surplusVal = currentVal - goal.target;
    if (surplusVal > 0) {
        surplusText = `<span class="surplus-text">Surplus: ₹${formatIndian(surplusVal)}</span> • `;
    }
  }

  const progress = goal.noTrack ? null : Math.round((currentVal / goal.target) * 100);
  const reqXirr = goal.noTrack ? null : calculateRequiredXirr(currentVal, goal.target, goal.year);

  // Expanded table logic
  let expandedContent = '';
  if (!isSummary && goal.links.length > 0) {
    const sortedLinks = [...goal.links]
        .map(l => ({ ...l, inv: state.investments.find(i => i.id === l.invId) }))
        .filter(l => l.inv)
        .map(l => ({ ...l, val: (l.inv.units * l.inv.price) * (l.pct / 100) }))
        .sort((a, b) => b.val - a.val);

    expandedContent = `
        <div class="expanded-content" id="expanded-${goal.id}" style="display:none;">
            <table class="linked-inv-table">
                <thead>
                    <tr>
                        <th>Investment</th>
                        <th>Linked %</th>
                        <th class="val-col">Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedLinks.map(l => `
                        <tr>
                            <td>${l.inv.name}</td>
                            <td>${l.pct.toFixed(1)}%</td>
                            <td class="val-col">₹${formatIndian(l.val)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
  }
  
  return `
    <div class="goal-card" id="goal-card-${goal.id}" onclick="${clickFn}" ${styleAttr}>
      <div class="card-header">
        <span class="card-title">${goal.name} ${goal.noTrack ? '' : `(${goal.year})`}</span>
        <span class="card-amount">${goal.noTrack ? `₹${formatIndian(currentVal)}` : headerAmount}</span>
      </div>
      ${goal.noTrack ? '' : `<div class="progress-container"><div class="progress-bar" style="width:${Math.min(100, progress)}%"></div></div>`}
      ${renderMiniAllocWithProgress(goalAlloc, goal.noTrack ? null : { progress, currentVal, reqXirr, surplusText }, colors)}
      ${expandedContent}
    </div>
  `;
}

// Global click/tap trackers
let lastGoalClickTime = 0;
let lastGoalClickId = null;
let lastInvClickTime = 0;
let lastInvClickId = null;

window.handleGoalClick = (e, id, isSurplus) => {
    const currentTime = new Date().getTime();
    const tapThreshold = 300; // ms
    
    if (lastGoalClickId === id && (currentTime - lastGoalClickTime) < tapThreshold) {
        // Double tap - edit
        if (!isSurplus) window.editGoalById(id);
        lastGoalClickId = null; // Reset
    } else {
        // Single tap - toggle expand
        window.toggleGoalExpand(id);
        lastGoalClickId = id;
    }
    lastGoalClickTime = currentTime;
};

window.handleInvClick = (e, id) => {
    const currentTime = new Date().getTime();
    const tapThreshold = 300; 
    
    if (lastInvClickId === id && (currentTime - lastInvClickTime) < tapThreshold) {
        // Double tap - edit
        window.editInvestmentById(id);
        lastInvClickId = null;
    } else {
        // Single tap - do nothing or highlight? (Investment cards don't expand yet)
        lastInvClickId = id;
    }
    lastInvClickTime = currentTime;
};

window.toggleGoalExpand = (id) => {
    const card = document.getElementById(`goal-card-${id}`);
    const content = document.getElementById(`expanded-${id}`);
    if (!card || !content) return;
    
    const isExpanded = card.classList.toggle('expanded');
    content.style.display = isExpanded ? 'block' : 'none';
};

function renderMiniAllocWithProgress(alloc, progressData, colors) {
  const allocHtml = `
    <div class="goal-alloc-row">
      <div class="goal-alloc-items-group">
        ${renderAllocationRowOnly(alloc, colors)}
      </div>
      ${progressData ? `
        <div class="goal-progress-info">
          ${progressData.surplusText}
          Progress: ${progressData.progress}% (₹${formatIndian(progressData.currentVal)}) • 
          <span class="xirr-badge">Req. XIRR: ${progressData.reqXirr}%</span>
        </div>
      ` : ''}
    </div>
  `;
  return allocHtml;
}

function renderAllocationRowOnly(alloc, colors) {
  return `
    <div class="goal-alloc-item"><div class="goal-alloc-dot" style="background:${colors.eq}"></div>Equity: ${Math.round(alloc.eq)}%</div>
    <div class="goal-alloc-item"><div class="goal-alloc-dot" style="background:${colors.dt}"></div>Debt: ${Math.round(alloc.dt)}%</div>
    <div class="goal-alloc-item"><div class="goal-alloc-dot" style="background:${colors.gd}"></div>Gold: ${Math.round(alloc.gd)}%</div>
    <div class="goal-alloc-item"><div class="goal-alloc-dot" style="background:${colors.ot}"></div>Other: ${Math.round(alloc.ot)}%</div>
  `;
}

function renderAllocLine(label, val, total, color) {
  const pct = total > 0 ? Math.round(val / total * 100) : 0;
  const amount = Math.round(val);
  return `
    <div style="display:flex; align-items:center; gap:8px;">
      <div style="width:10px; height:10px; border-radius:2px; background:${color};"></div>
      <span style="flex:1;">${label}</span>
      <span style="font-weight:600;">${pct}% <span style="color:var(--muted); font-weight:400; font-size:11px; margin-left:4px;">(₹${formatIndian(amount)})</span></span>
    </div>
  `;
}

function updateAllocationChart(alloc, colors) {
  const canvas = document.getElementById('allocationChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (allocationChart) {
    allocationChart.destroy();
  }

  const data = [alloc.eq, alloc.dt, alloc.gd, alloc.ot];
  const hasData = data.some(v => v > 0);

  allocationChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Equity', 'Debt', 'Gold', 'Other'],
      datasets: [{
        data: hasData ? data : [1],
        backgroundColor: hasData ? [colors.eq, colors.dt, colors.gd, colors.ot] : ['#f1f5f9'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: hasData,
          position: 'nearest',
          caretPadding: 15,
          displayColors: false,
          padding: 10,
          bodyFont: { size: 12 },
          callbacks: {
            label: (item) => ` ${item.label}: ₹${formatIndian(item.raw)}`
          }
        }
      },
      cutout: '75%'
    }
  });
}

// ==================== INVESTMENTS ====================
function renderInvestments() {
  const list = document.getElementById('investmentList');
  if (!list) return;
  if (state.investments.length === 0) {
    list.innerHTML = '<p class="muted">No investments added. Click the button below to add your first investment.</p>';
    return;
  }

  const colors = { eq: '#2b7cff', dt: '#64748b', gd: '#f59e0b', ot: '#94a3b8' };

  list.innerHTML = state.investments.map((inv) => `
    <div class="investment-card" onclick="window.handleInvClick(event, '${inv.id}')">
      <div class="card-header">
        <span class="card-title">${inv.name}</span>
        <div class="card-amount-main">₹${formatIndian(inv.units * inv.price)}</div>
      </div>
      <div class="inv-card-body">
        <div class="inv-units-info">
          ${formatNumber(inv.units)} units @ ₹${formatNumber(inv.price)}
          ${inv.mfCode ? `<span class="live-status-dot"></span><span class="live-status-text">Live rate</span>` : ''}
        </div>
        <div class="goal-alloc-row">
          <div class="goal-alloc-items-group">
            ${renderAllocationRowOnly(inv.alloc, colors)}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== GOALS ====================
function renderGoals() {
  const list = document.getElementById('goalList');
  if (!list) return;
  const surplus = getSurplusGoal();
  const allGoals = [...state.goals];
  if (surplus) allGoals.push(surplus);

  if (allGoals.length === 0) {
    list.innerHTML = '<p class="muted">No goals added. Click the button below to create a financial goal.</p>';
    return;
  }

  list.innerHTML = allGoals.map((goal) => renderGoalCard(goal, false)).join('');
}

// ==================== MF API SERVICE ====================
const MF_CACHE_KEY = 'mf_nav_cache';
const MF_API_BASE = 'https://api.mfapi.in/mf';

async function fetchLiveNAV(schemeCode) {
    const cache = JSON.parse(localStorage.getItem(MF_CACHE_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0];
    
    if (cache[schemeCode] && cache[schemeCode].date === today) {
        return cache[schemeCode].nav;
    }

    try {
        const res = await fetch(`${MF_API_BASE}/${schemeCode}/latest`);
        const data = await res.json();
        if (data.status === 'SUCCESS' && data.data && data.data[0]) {
            const nav = parseFloat(data.data[0].nav);
            cache[schemeCode] = { nav, date: today };
            localStorage.setItem(MF_CACHE_KEY, JSON.stringify(cache));
            return nav;
        }
    } catch (e) {
        console.error('Failed to fetch NAV:', e);
    }
    return null;
}

async function searchMF(query) {
    try {
        const res = await fetch(`${MF_API_BASE}/search?q=${encodeURIComponent(query)}`);
        return await res.json();
    } catch (e) {
        showToast('Search failed: Check your internet');
        return [];
    }
}

// Global MF Search Handlers
window.handleMFSearch = async () => {
    const query = document.getElementById('mfSearchInput').value;
    if (!query || query.length < 3) {
        showToast('Enter at least 3 characters');
        return;
    }
    
    const resultsContainer = document.getElementById('mfSearchResults');
    resultsContainer.innerHTML = '<p class="muted" style="padding:20px; text-align:center;">Searching...</p>';
    
    const results = await searchMF(query);
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p class="muted" style="padding:20px; text-align:center;">No funds found.</p>';
        return;
    }

    resultsContainer.innerHTML = results.map(fund => `
        <div class="mf-result-item" onclick="window.selectMF('${fund.schemeCode}', '${fund.schemeName.replace(/'/g, "\\'")}')">
            <span class="mf-result-name">${fund.schemeName}</span>
            <span class="mf-result-code">Code: ${fund.schemeCode}</span>
        </div>
    `).join('');
};

function updateNavInputState() {
    const isAuto = document.getElementById('navAutoToggle').checked;
    const invPrice = document.getElementById('invPrice');
    if (!invPrice) return;
    
    if (isAuto) {
        invPrice.readOnly = true;
        invPrice.style.background = '#f8fafc';
        invPrice.style.cursor = 'not-allowed';
        invPrice.title = 'NAV is automatically synced. Switch to Manual to edit.';
    } else {
        invPrice.readOnly = false;
        invPrice.style.background = '#fff';
        invPrice.style.cursor = 'text';
        invPrice.title = '';
    }
}

window.selectMF = async (code, name) => {
    document.getElementById('mfSearchResults').innerHTML = '<p class="muted" style="padding:20px; text-align:center;">Fetching latest NAV...</p>';
    const nav = await fetchLiveNAV(code);
    if (nav) {
        document.getElementById('invName').value = name;
        setFormattedValue('invPrice', nav, '₹');
        document.getElementById('investmentForm').dataset.mfCode = code;
        updateInvValue();
        document.getElementById('navAutoToggle').checked = true;
        updateNavInputState();
        document.getElementById('mfSearchOverlay').style.display = 'none';
        showToast('Fund details linked!', 'success');
    } else {
        showToast('Failed to get NAV for this fund.');
        document.getElementById('mfSearchResults').innerHTML = '<p class="muted" style="padding:20px; text-align:center;">Select a fund to continue</p>';
        document.getElementById('navAutoToggle').checked = false;
        updateNavInputState();
    }
};

async function refreshAllMFNavs() {
    let updated = false;
    for (let inv of state.investments) {
        if (inv.mfCode) {
            const nav = await fetchLiveNAV(inv.mfCode);
            if (nav && Math.abs(nav - inv.price) > 0.0001) {
                inv.price = nav;
                updated = true;
            }
        }
    }
    if (updated) {
        saveToStorage();
        renderAll();
    }
}
function calculateGoalCurrentValue(goal) {
  let total = 0;
  goal.links.forEach(link => {
    const inv = state.investments.find(i => i.id === link.invId);
    if (inv) {
      total += (inv.units * inv.price) * (link.pct / 100);
    }
  });
  return total;
}

function calculateGoalAllocation(goal) {
  const currentVal = calculateGoalCurrentValue(goal);
  if (currentVal === 0) return { eq: 0, dt: 0, gd: 0, ot: 0 };

  let alloc = { eq: 0, dt: 0, gd: 0, ot: 0 };
  goal.links.forEach(link => {
    const inv = state.investments.find(i => i.id === link.invId);
    if (inv) {
      const weightedVal = (inv.units * inv.price) * (link.pct / 100);
      alloc.eq += weightedVal * (inv.alloc.eq / 100);
      alloc.dt += weightedVal * (inv.alloc.dt / 100);
      alloc.gd += weightedVal * (inv.alloc.gd / 100);
      alloc.ot += weightedVal * (inv.alloc.ot / 100);
    }
  });

  return {
    eq: (alloc.eq / currentVal * 100),
    dt: (alloc.dt / currentVal * 100),
    gd: (alloc.gd / currentVal * 100),
    ot: (alloc.ot / currentVal * 100)
  };
}

function calculateRequiredXirr(current, target, targetYear) {
  if (current >= target) return 0;
  const years = targetYear - new Date().getFullYear();
  if (years <= 0) return 99.9;
  const cagr = (Math.pow(target / current, 1 / years) - 1) * 100;
  return cagr.toFixed(1);
}

function getSurplusGoal() {
    let surplusLinks = [];
    state.investments.forEach(inv => {
        const linkedPct = state.goals.reduce((sum, g) => {
            const link = g.links.find(l => l.invId === inv.id);
            return sum + (link ? link.pct : 0);
        }, 0);
        const remainingPct = 100 - linkedPct;
        if (remainingPct > 0.01) {
            surplusLinks.push({ invId: inv.id, pct: remainingPct });
        }
    });

    if (surplusLinks.length === 0) return null;

    return {
        id: 'surplus',
        name: 'Surplus Available',
        noTrack: true,
        links: surplusLinks,
        isSurplus: true
    };
}

function setupNumericFormatting(id, prefix = '') {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    if (val === '') {
      e.target.dataset.raw = '';
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      e.target.dataset.raw = val;
      e.target.value = prefix + formatIndian(num);
    }
  });
}

function getRawValue(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const val = el.dataset.raw;
  return val ? parseFloat(val) : 0;
}

function setFormattedValue(id, val, prefix = '') {
  const input = document.getElementById(id);
  if (!input) return;
  input.dataset.raw = val || '';
  input.value = val ? prefix + formatIndian(val) : '';
}

// ==================== EVENT WIRING ====================
let activeGoalLinks = [];

function updateInvValue() {
  const units = getRawValue('invUnits');
  const price = getRawValue('invPrice');
  const val = units * price;
  const el = document.getElementById('invValue');
  if (el) el.value = val > 0 ? '₹' + formatIndian(val) : '₹0';
}

function setupEventListeners() {
  setupNumericFormatting('goalTarget', '₹');
  setupNumericFormatting('invPrice', '₹');
  setupNumericFormatting('invUnits', '');

  const invPrice = document.getElementById('invPrice');
  if (invPrice) invPrice.addEventListener('input', updateInvValue);
  const invUnits = document.getElementById('invUnits');
  if (invUnits) invUnits.addEventListener('input', updateInvValue);

  // Toggle Track fields based on checkbox
  const goalNoTrack = document.getElementById('goalNoTrack');
  if (goalNoTrack) {
    goalNoTrack.addEventListener('change', (e) => {
        const fields = document.getElementById('goalTrackFields');
        if (fields) {
            fields.style.opacity = e.target.checked ? '0.3' : '1';
            fields.style.pointerEvents = e.target.checked ? 'none' : 'auto';
        }
    });
  }

  // Investment Form
  const showAddInv = document.getElementById('showAddInvestment');
  if (showAddInv) {
    showAddInv.addEventListener('click', () => {
        resetInvForm();
        document.getElementById('investmentFormOverlay').style.display = 'flex';
    });
  }

  const saveInv = document.getElementById('saveInvestment');
  if (saveInv) {
    saveInv.addEventListener('click', () => {
        const name = document.getElementById('invName').value;
        const units = getRawValue('invUnits');
        const price = getRawValue('invPrice');
        const eq = parseFloat(document.getElementById('allocEq').value) || 0;
        const dt = parseFloat(document.getElementById('allocDt').value) || 0;
        const gd = parseFloat(document.getElementById('allocGd').value) || 0;
        const ot = parseFloat(document.getElementById('allocOt').value) || 0;
        const mfCode = document.getElementById('investmentForm').dataset.mfCode || null;

        if (!name || isNaN(units) || units <= 0 || isNaN(price) || price <= 0) { 
            showToast('Please enter a valid name, units (>0), and price (>0)'); 
            return; 
        }
        if (Math.round(eq + dt + gd + ot) !== 100) { showToast('Total allocation must be 100%'); return; }

        const id = document.getElementById('investmentForm').dataset.editId || Date.now().toString();
        const inv = { id, name, units, price, alloc: { eq, dt, gd, ot }, mfCode };

        const idx = state.investments.findIndex(i => i.id === id);
        if (idx > -1) state.investments[idx] = inv;
        else state.investments.push(inv);

        saveToStorage();
        renderAll();
        closeForms();
    });
  }

  const deleteInv = document.getElementById('deleteInvestment');
  if (deleteInv) {
    deleteInv.addEventListener('click', () => {
        const id = document.getElementById('investmentForm').dataset.editId;
        if (!id) return;
        if (!confirm('Are you sure you want to delete this investment? All goal links will also be removed.')) return;
        
        state.investments = state.investments.filter(i => i.id !== id);
        state.goals.forEach(goal => {
            goal.links = goal.links.filter(l => l.invId !== id);
        });
        
        saveToStorage();
        renderAll();
        closeForms();
    });
  }

  const cancelInv = document.getElementById('cancelInvestment');
  if (cancelInv) cancelInv.addEventListener('click', closeForms);

  // MF Search Handlers
  const searchMFBtn = document.getElementById('searchMFBtn');
  if (searchMFBtn) {
    searchMFBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('mfSearchInput').value = '';
        document.getElementById('mfSearchResults').innerHTML = '<p class="muted" style="padding:20px; text-align:center;">Enter fund name to search...</p>';
        document.getElementById('mfSearchOverlay').style.display = 'flex';
    });
  }

  const mfSearchActionBtn = document.getElementById('mfSearchActionBtn');
  if (mfSearchActionBtn) mfSearchActionBtn.addEventListener('click', window.handleMFSearch);
  
  const mfSearchInput = document.getElementById('mfSearchInput');
  if (mfSearchInput) {
    mfSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.handleMFSearch();
    });
  }

  const cancelMfSearch = document.getElementById('cancelMfSearch');
  if (cancelMfSearch) {
    cancelMfSearch.addEventListener('click', () => {
        document.getElementById('mfSearchOverlay').style.display = 'none';
        // If we canceled and don't have a linked fund, revert toggle
        if (!document.getElementById('investmentForm').dataset.mfCode) {
            document.getElementById('navAutoToggle').checked = false;
            updateNavInputState();
        }
    });
  }

  // NAV Auto/Manual Toggle Handler
  const navAutoToggle = document.getElementById('navAutoToggle');
  if (navAutoToggle) {
    navAutoToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Switched to Auto: Open search if no code linked, or just keep readonly
            if (!document.getElementById('investmentForm').dataset.mfCode) {
                document.getElementById('mfSearchInput').value = '';
                document.getElementById('mfSearchResults').innerHTML = '<p class="muted" style="padding:20px; text-align:center;">Enter fund name to search...</p>';
                document.getElementById('mfSearchOverlay').style.display = 'flex';
            }
        } else {
            // Switched to Manual: Clear code and make editable
            document.getElementById('investmentForm').dataset.mfCode = '';
        }
        updateNavInputState();
    });
  }

  // Goal Form
  const showAddGoal = document.getElementById('showAddGoal');
  if (showAddGoal) {
    showAddGoal.addEventListener('click', () => {
        resetGoalForm();
        activeGoalLinks = [];
        renderTaggedInvestments();
        document.getElementById('goalFormOverlay').style.display = 'flex';
    });
  }

  const saveGoal = document.getElementById('saveGoal');
  if (saveGoal) {
    saveGoal.addEventListener('click', () => {
        const name = document.getElementById('goalName').value;
        const noTrack = document.getElementById('goalNoTrack').checked;
        const target = noTrack ? 0 : getRawValue('goalTarget');
        const year = noTrack ? 9999 : parseInt(document.getElementById('goalYear').value);

        if (!name || (!noTrack && (isNaN(target) || isNaN(year)))) { showToast('Please fill all fields'); return; }

        // Validation for investment linking limits
        const currentGoalId = document.getElementById('goalForm').dataset.editId;
        for (const link of activeGoalLinks) {
            const inv = state.investments.find(i => i.id === link.invId);
            if (!inv) continue;

            const otherGoalsPct = state.goals.reduce((sum, g) => {
                if (g.id === currentGoalId) return sum;
                const otherLink = g.links.find(l => l.invId === inv.id);
                return sum + (otherLink ? otherLink.pct : 0);
            }, 0);
            
            const maxAvailable = 100 - otherGoalsPct;
            if (link.pct > maxAvailable + 0.01) {
                showToast(`Only ${maxAvailable.toFixed(1)}% of ${inv.name} is available for linking.`);
                return;
            }
        }

        const id = document.getElementById('goalForm').dataset.editId || Date.now().toString();
        const goal = { id, name, target, year, noTrack, links: activeGoalLinks.filter(l => l.pct > 0) };

        const idx = state.goals.findIndex(g => g.id === id);
        if (idx > -1) state.goals[idx] = goal;
        else state.goals.push(goal);

        saveToStorage();
        renderAll();
        closeForms();
    });
  }

  const deleteGoal = document.getElementById('deleteGoal');
  if (deleteGoal) {
    deleteGoal.addEventListener('click', () => {
        const id = document.getElementById('goalForm').dataset.editId;
        if (!id) return;
        if (!confirm('Are you sure you want to delete this goal?')) return;
        
        state.goals = state.goals.filter(g => g.id !== id);
        
        saveToStorage();
        renderAll();
        closeForms();
    });
  }

  const cancelGoal = document.getElementById('cancelGoal');
  if (cancelGoal) cancelGoal.addEventListener('click', closeForms);

  const addTag = document.getElementById('addInvestmentTag');
  if (addTag) {
    addTag.addEventListener('click', (e) => {
        e.preventDefault();
        const popup = document.getElementById('investmentSelectorPopup');
        if (state.investments.length === 0) { showToast('No more existing investments found. Go to Investments tab, and new investments'); return; }
        
        const currentGoalId = document.getElementById('goalForm').dataset.editId;
        const untagged = state.investments.map(inv => {
            const linkedPct = state.goals.reduce((sum, g) => {
                if (g.id === currentGoalId) return sum;
                const link = g.links.find(l => l.invId === inv.id);
                return sum + (link ? link.pct : 0);
            }, 0);
            const inActiveGoal = activeGoalLinks.find(l => l.invId === inv.id);
            if (inActiveGoal) return { ...inv, remainingPct: 0 }; 

            const remainingPct = 100 - linkedPct;
            return { ...inv, remainingPct };
        }).filter(inv => inv.remainingPct > 0.01);

        if (untagged.length === 0) { showToast('No more existing investments found. Go to Investments tab, and new investments'); return; }

        popup.innerHTML = untagged.map(inv => `
            <div class="selector-item" onclick="window.addTagToActiveGoal('${inv.id}', ${inv.remainingPct})">
                <span style="font-weight:600;">${inv.name}</span>
                <span style="color:var(--muted); font-size:11px;">Available: ₹${formatIndian(inv.units * inv.price * inv.remainingPct / 100)}</span>
            </div>
        `).join('');
        popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    });
  }

  document.addEventListener('click', (e) => {
    const popup = document.getElementById('investmentSelectorPopup');
    if (popup && !e.target.closest('.investment-tagger')) {
      popup.style.display = 'none';
    }
  });

  // Footer Actions: Export, Import (Now in Networth page)
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `goal_tracker_${timestamp}.json`;
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    });
  }

  const importBtn = document.getElementById('importData');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
  }

  const importFile = document.getElementById('importFile');
  if (importFile) {
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data.investments || !data.goals) throw new Error('Invalid format');
                state = data;
                saveToStorage();
                renderAll();
                showToast('Data imported successfully!', 'success');
            } catch (err) {
                showToast('Failed to import: ' + err.message);
            }
            e.target.value = ''; // Reset file input
        };
        reader.readAsText(file);
    });
  }
}

window.addTagToActiveGoal = (invId, maxPct = 100) => {
  activeGoalLinks.push({ invId, pct: maxPct });
  renderTaggedInvestments();
  document.getElementById('investmentSelectorPopup').style.display = 'none';
};

window.removeTagFromActiveGoal = (invId) => {
  activeGoalLinks = activeGoalLinks.filter(l => l.invId !== invId);
  renderTaggedInvestments();
};

function renderTaggedInvestments() {
  const container = document.getElementById('taggedInvestmentsList');
  if (!container) return;
  const currentGoalId = document.getElementById('goalForm').dataset.editId;

  container.innerHTML = activeGoalLinks.map(link => {
    const inv = state.investments.find(i => i.id === link.invId);
    if (!inv) return '';
    
    // Calculate max available for this specific investment
    const otherGoalsPct = state.goals.reduce((sum, g) => {
        if (g.id === currentGoalId) return sum;
        const otherLink = g.links.find(l => l.invId === inv.id);
        return sum + (otherLink ? otherLink.pct : 0);
    }, 0);
    const maxAvailable = 100 - otherGoalsPct;

    const val = (inv.units * inv.price) * (link.pct / 100);
    return `
      <div class="tagger-row" data-inv-id="${inv.id}">
        <div style="flex:1; display:flex; flex-direction:column;">
            <span style="font-size:13px; font-weight:600;">${inv.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <div style="display:flex; align-items:center; gap:4px;">
                <input type="number" value="${link.pct}" min="0" max="${maxAvailable}" step="0.1" 
                    style="width:55px; text-align:center; padding:4px; border:1px solid #e2e8f0; border-radius:4px;"
                    oninput="window.updateTagPct('${inv.id}', this.value, event)">
                <span style="font-size:12px;">%</span>
            </div>
            <span id="tag-val-${inv.id}" style="font-size:12px; color:var(--muted); min-width:80px; text-align:right;">₹${formatIndian(val)}</span>
        </div>
        <span class="remove-tag" onclick="window.removeTagFromActiveGoal('${inv.id}')">×</span>
      </div>
    `;
  }).join('');
}

window.updateTagPct = (invId, val, event) => {
    const link = activeGoalLinks.find(l => l.invId === invId);
    if (link) {
        link.pct = parseFloat(val) || 0;
        // Update the value label without re-rendering the whole list
        const inv = state.investments.find(i => i.id === invId);
        const valLabel = document.getElementById(`tag-val-${invId}`);
        if (inv && valLabel) {
            const newVal = (inv.units * inv.price) * (link.pct / 100);
            valLabel.textContent = '₹' + formatIndian(newVal);
        }
    }
};

function closeForms() {
  const invOverlay = document.getElementById('investmentFormOverlay');
  if (invOverlay) invOverlay.style.display = 'none';
  const goalOverlay = document.getElementById('goalFormOverlay');
  if (goalOverlay) goalOverlay.style.display = 'none';
}

function resetInvForm() {
  const title = document.getElementById('invFormTitle');
  if (title) title.textContent = 'Add Investment';
  const form = document.getElementById('investmentForm');
  if (form) {
    form.dataset.editId = '';
    form.dataset.mfCode = '';
  }
  const name = document.getElementById('invName');
  if (name) name.value = '';
  setFormattedValue('invUnits', '', '');
  setFormattedValue('invPrice', '', '₹');
  updateInvValue();
  
  const toggle = document.getElementById('navAutoToggle');
  if (toggle) toggle.checked = false;
  updateNavInputState();

  const del = document.getElementById('deleteInvestment');
  if (del) del.style.display = 'none';
  const fields = ['allocEq', 'allocDt', 'allocGd', 'allocOt'];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = 0;
  });
}

function resetGoalForm() {
  const title = document.getElementById('goalFormTitle');
  if (title) title.textContent = 'Add Financial Goal';
  const form = document.getElementById('goalForm');
  if (form) form.dataset.editId = '';
  const name = document.getElementById('goalName');
  if (name) name.value = '';
  const noTrack = document.getElementById('goalNoTrack');
  if (noTrack) noTrack.checked = false;
  const fields = document.getElementById('goalTrackFields');
  if (fields) {
    fields.style.opacity = '1';
    fields.style.pointerEvents = 'auto';
  }
  setFormattedValue('goalTarget', '', '₹');
  const year = document.getElementById('goalYear');
  if (year) year.value = '';
  const del = document.getElementById('deleteGoal');
  if (del) del.style.display = 'none';
}

window.editInvestmentById = (id) => {
  const inv = state.investments.find(i => i.id === id);
  if (!inv) return;
  const title = document.getElementById('invFormTitle');
  if (title) title.textContent = 'Edit Investment';
  const form = document.getElementById('investmentForm');
  if (form) {
    form.dataset.editId = inv.id;
    form.dataset.mfCode = inv.mfCode || '';
  }
  const name = document.getElementById('invName');
  if (name) name.value = inv.name;
  setFormattedValue('invUnits', inv.units, '');
  setFormattedValue('invPrice', inv.price, '₹');
  updateInvValue();

  const toggle = document.getElementById('navAutoToggle');
  if (toggle) toggle.checked = !!inv.mfCode;
  updateNavInputState();

  const del = document.getElementById('deleteInvestment');
  if (del) del.style.display = 'block';
  document.getElementById('allocEq').value = inv.alloc.eq;
  document.getElementById('allocDt').value = inv.alloc.dt;
  document.getElementById('allocGd').value = inv.alloc.gd;
  document.getElementById('allocOt').value = inv.alloc.ot;
  
  document.getElementById('investmentFormOverlay').style.display = 'flex';
};

window.editGoalById = (id) => {
  const goal = state.goals.find(g => g.id === id);
  if (!goal) return;
  const title = document.getElementById('goalFormTitle');
  if (title) title.textContent = 'Edit Goal';
  const form = document.getElementById('goalForm');
  if (form) form.dataset.editId = goal.id;
  const name = document.getElementById('goalName');
  if (name) name.value = goal.name;
  const noTrack = document.getElementById('goalNoTrack');
  if (noTrack) noTrack.checked = goal.noTrack || false;
  
  const fields = document.getElementById('goalTrackFields');
  if (fields) {
    fields.style.opacity = goal.noTrack ? '0.3' : '1';
    fields.style.pointerEvents = goal.noTrack ? 'none' : 'auto';
  }

  setFormattedValue('goalTarget', goal.target, '₹');
  const year = document.getElementById('goalYear');
  if (year) year.value = (goal.year === 9999) ? '' : goal.year;
  const del = document.getElementById('deleteGoal');
  if (del) del.style.display = 'block';
  
  activeGoalLinks = JSON.parse(JSON.stringify(goal.links));
  renderTaggedInvestments();
  
  document.getElementById('goalFormOverlay').style.display = 'flex';
};
