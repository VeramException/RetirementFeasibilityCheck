// js/staticSim.js
import { formatIndian } from './utils.js';

let staticChart = null;

export function runStatic() {
    const corpus0 = parseFloat(document.getElementById('corpusSlider').value);
    const age0 = parseInt(document.getElementById('currentAgeSlider').value, 10);
    const endAge = parseInt(document.getElementById('endAgeSlider').value, 10);
    const monthly0 = parseFloat(document.getElementById('monthlySlider').value);
    const step = parseFloat(document.getElementById('stepupSlider').value) / 100 || 0;
    const retPct = parseFloat(document.getElementById('retSlider').value) / 100 || 0;
    const stop = true;

    let rows = [], start = corpus0, m = monthly0, depleted = null;
    for (let age = age0; age <= endAge; age++) {
        if (depleted !== null) { rows.push({ age, depleted: true }); continue; }
        if (age !== age0) m *= (1 + step);
        const annual = m * 12;
        const after = start * (1 + retPct);
        const end = after - annual;
        rows.push({ age, start, after, monthly: m, annual, end });
        if (end <= 0 && stop) depleted = age;
        start = end;
    }

    let html = '<table><thead><tr>' + 
        '<th class="age">Age</th>' +
        '<th><span class="desktop-only">Starting Corpus</span><span class="mobile-only">Start</span></th>' +
        '<th><span class="desktop-only">Corpus after ' + (retPct*100).toFixed(1) + '% Growth</span><span class="mobile-only">Growth</span></th>' +
        '<th><span class="desktop-only">Monthly Withdrawal</span><span class="mobile-only">Monthly</span></th>' +
        '<th><span class="desktop-only">Annual Withdrawal</span><span class="mobile-only">Annual</span></th>' +
        '<th><span class="desktop-only">Ending Corpus</span><span class="mobile-only">End</span></th>' +
        '</tr></thead><tbody>';
    rows.forEach(r => {
        if (r.depleted) {
            html += `<tr class="depleted"><td class="age">${r.age}</td><td></td><td></td><td></td><td></td><td></td></tr>`;
        } else {
            const startStr = formatIndian(r.start);
            const afterStr = formatIndian(r.after);
            const monthlyStr = '-' + formatIndian(r.monthly);
            const annualStr = '-' + formatIndian(r.annual);
            const endStr = formatIndian(r.end);
            html += `<tr>
                <td class="age">${r.age}</td>
                <td><span class="desktop-only">₹ </span>${startStr}</td>
                <td><span class="desktop-only">₹ </span>${afterStr}</td>
                <td class="negative"><span class="desktop-only">₹ </span>${monthlyStr}</td>
                <td class="negative"><span class="desktop-only">₹ </span>${annualStr}</td>
                <td><span class="desktop-only">₹ </span>${endStr}</td>
            </tr>`;
        }
    });
    html += '</tbody></table>';
    document.getElementById('tableWrap').innerHTML = html;

    const summaryDiv = document.getElementById('staticSummary');
    if (depleted !== null) {
        summaryDiv.innerHTML = `<span style='color:#dc2626;font-weight:600'>✖ Failed</span> - Corpus depleted at age ${depleted}`;
    } else {
        summaryDiv.innerHTML = `<span style='color:#16a34a;font-weight:600'>✔ Success</span> - Ending corpus at age ${endAge}: <span style='color:#16a34a;'> ₹ ${formatIndian(rows[rows.length-1].end)} </span>`;
    }

    const labels = rows.map(r => r.age);
    const data = rows.map(r => r.depleted ? null : r.end);
    if (staticChart) staticChart.destroy();
    staticChart = new Chart(document.getElementById('staticChart'), {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: '#2b7cff', tension: 0.3 }] },
        options: {
            plugins: { legend: { display: false } }, // tooltips enabled by default
            scales: { y: { ticks: { callback: v => formatIndian(v) } } }
        }
    });
}