// ── Pearson correlation ─────────────────────────
function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

function getDailySeries(store, extractor) {
  const dates = Object.keys(store).sort();
  const xs = [];
  const ys = [];
  dates.forEach(d => {
    const pair = extractor(store[d], d);
    if (pair && pair[0] !== null && pair[1] !== null && !isNaN(pair[0]) && !isNaN(pair[1])) {
      xs.push(pair[0]);
      ys.push(pair[1]);
    }
  });
  return { xs, ys, n: xs.length };
}

function dailyAvgPain(entry) {
  const vals = TIMES.map(t => entry[`${t.key}_pain`]).filter(v => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function dailyAvgRls(entry) {
  const vals = TIMES.map(t => entry[`${t.key}_rls`]).filter(v => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function renderCorrelations() {
  const grid = document.getElementById('correlationGrid');
  if (!grid) return;
  const store = getStore();
  const rlsDaily = getRlsDaily();

  const pairs = [
    {
      label: 'Ø Schmerz ↔ Schlafqualität',
      get: () => getDailySeries(store, e => {
        const p = dailyAvgPain(e);
        const s = e.sleepQuality;
        return p !== null && s !== undefined ? [p, s] : null;
      }),
    },
    {
      label: 'Ø RLS ↔ Schlafqualität',
      get: () => getDailySeries(store, e => {
        const r = dailyAvgRls(e);
        const s = e.sleepQuality;
        return r !== null && s !== undefined ? [r, s] : null;
      }),
    },
    {
      label: 'Ø Schmerz ↔ Schlafdauer (h)',
      get: () => getDailySeries(store, e => {
        const p = dailyAvgPain(e);
        const h = e.sleepHours;
        return p !== null && h !== undefined ? [p, h] : null;
      }),
    },
    {
      label: 'Ø RLS ↔ Schlafdauer (h)',
      get: () => getDailySeries(store, e => {
        const r = dailyAvgRls(e);
        const h = e.sleepHours;
        return r !== null && h !== undefined ? [r, h] : null;
      }),
    },
    {
      label: 'Ø Schmerz ↔ Ø RLS',
      get: () => getDailySeries(store, e => {
        const p = dailyAvgPain(e);
        const r = dailyAvgRls(e);
        return p !== null && r !== null ? [p, r] : null;
      }),
    },
    {
      label: 'RLS-Symptom (Doku) ↔ Schlaf (Doku)',
      get: () => {
        const dates = Object.keys(rlsDaily).sort();
        const xs = [], ys = [];
        dates.forEach(d => {
          const e = rlsDaily[d];
          if (e.symptom !== undefined && e.sleepQuality !== undefined) {
            xs.push(e.symptom);
            ys.push(e.sleepQuality);
          }
        });
        return { xs, ys, n: xs.length };
      },
    },
    // ── Mood-Korrelationen (wenn Mood-Daten vorhanden) ──
    ...(typeof getMoodStore === 'function' && typeof getMoodAverageForDate === 'function' ? [
      {
        label: 'Ø Schmerz ↔ Stimmung',
        get: () => {
          const moodStore = getMoodStore();
          const xs = [], ys = [];
          Object.keys(store).sort().forEach(d => {
            const p = dailyAvgPain(store[d]);
            const m = getMoodAverageForDate(d);
            if (p !== null && m !== null) {
              xs.push(p);
              ys.push(m);
            }
          });
          return { xs, ys, n: xs.length };
        },
      },
      {
        label: 'Ø RLS ↔ Stimmung',
        get: () => {
          const moodStore = getMoodStore();
          const xs = [], ys = [];
          Object.keys(store).sort().forEach(d => {
            const r = dailyAvgRls(store[d]);
            const m = getMoodAverageForDate(d);
            if (r !== null && m !== null) {
              xs.push(r);
              ys.push(m);
            }
          });
          return { xs, ys, n: xs.length };
        },
      },
      {
        label: 'Schlafqualität ↔ Stimmung',
        get: () => {
          const moodStore = getMoodStore();
          const xs = [], ys = [];
          Object.keys(store).sort().forEach(d => {
            const e = store[d];
            const s = e.sleepQuality;
            const m = getMoodAverageForDate(d);
            if (s !== undefined && m !== null) {
              xs.push(s);
              ys.push(m);
            }
          });
          return { xs, ys, n: xs.length };
        },
      },
    ] : []),
  ];

  if (typeof getBloodPressureDailyAverages === 'function') {
    const bpDaily = getBloodPressureDailyAverages();
    pairs.push({
      label: 'Ø Schmerz ↔ systolischer Blutdruck',
      get: () => {
        const xs = [], ys = [];
        Object.keys(bpDaily).sort().forEach(d => {
          const e = store[d];
          const p = e ? dailyAvgPain(e) : null;
          const sys = bpDaily[d].systolic;
          if (p !== null && sys !== null && !isNaN(p) && !isNaN(sys)) {
            xs.push(p);
            ys.push(sys);
          }
        });
        return { xs, ys, n: xs.length };
      },
    });
    pairs.push({
      label: 'Ø Schmerz ↔ diastolischer Blutdruck',
      get: () => {
        const xs = [], ys = [];
        Object.keys(bpDaily).sort().forEach(d => {
          const e = store[d];
          const p = e ? dailyAvgPain(e) : null;
          const dia = bpDaily[d].diastolic;
          if (p !== null && dia !== null && !isNaN(p) && !isNaN(dia)) {
            xs.push(p);
            ys.push(dia);
          }
        });
        return { xs, ys, n: xs.length };
      },
    });
  }

  const results = pairs.map(p => {
    const { xs, ys, n } = p.get();
    const r = pearsonCorrelation(xs, ys);
    return { label: p.label, r, n };
  }).filter(x => x.n >= 5);

  if (!results.length) {
    grid.innerHTML = '<div class="empty-state" style="padding:20px"><p>Noch zu wenig gemeinsame Tage (min. 5) für Korrelationen.<br>Erfassen Sie Schlaf, Schmerz und RLS regelmäßig.</p></div>';
    return;
  }

  grid.innerHTML = results.map(({ label, r, n }) => {
    const abs = Math.abs(r);
    const cls = abs >= 0.5 ? 'strong' : abs >= 0.3 ? 'moderate' : 'weak';
    const sign = r > 0 ? '+' : '';
    return `<div class="corr-item">
      <span class="corr-pair">${escHtml(label)} <span style="color:var(--text-3)">(n=${n})</span></span>
      <span class="corr-val ${cls}">r = ${sign}${r.toFixed(2)}</span>
    </div>`;
  }).join('');
}

function avgOf(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function renderTagPatternInsights() {
  const el = document.getElementById('tagPatternInsights');
  if (!el) return;
  const store = getStore();
  const insights = [];

  INFLUENCE_TAGS.forEach(tag => {
    const withVals = { pain: [], rls: [] };
    const withoutVals = { pain: [], rls: [] };

    Object.keys(store).forEach(d => {
      const e = store[d];
      const p = dailyAvgPain(e);
      const r = dailyAvgRls(e);
      if (p === null && r === null) return;
      const has = !!(e.factors && e.factors[tag.key]);
      if (has) {
        if (p !== null) withVals.pain.push(p);
        if (r !== null) withVals.rls.push(r);
      } else {
        if (p !== null) withoutVals.pain.push(p);
        if (r !== null) withoutVals.rls.push(r);
      }
    });

    const tagLabel = tag.label;
    ['rls', 'pain'].forEach(metric => {
      const w = withVals[metric];
      const o = withoutVals[metric];
      if (w.length < MIN_PATTERN_DAYS || o.length < MIN_PATTERN_DAYS) return;
      const avgW = avgOf(w);
      const avgO = avgOf(o);
      const diff = avgW - avgO;
      if (Math.abs(diff) < MIN_TAG_DIFF) return;
      const metricLabel = metric === 'rls' ? 'RLS' : 'Schmerz';
      if (diff > 0) {
        insights.push(`An Tagen mit ${tagLabel} lag dein ${metricLabel} im Schnitt bei <strong>${avgW.toFixed(1)}</strong>, ohne bei <strong>${avgO.toFixed(1)}</strong> – ${tagLabel.replace(/^[^\s]+\s/, '')} könnte ein Auslöser sein.`);
      } else {
        const pct = avgO ? Math.round(Math.abs(diff) / avgO * 100) : 0;
        insights.push(`${tagLabel} senkt deinen ${metricLabel} im Schnitt von <strong>${avgO.toFixed(1)}</strong> auf <strong>${avgW.toFixed(1)}</strong>${pct ? ` (−${pct}%)` : ''}.`);
      }
    });
  });

  if (!insights.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><p>Nutze die Einflussfaktoren im Tagebuch – nach min. 5 Tagen mit/ohne Tag erscheinen Muster.</p></div>';
    return;
  }
  el.innerHTML = insights.map(t => `<div class="smart-insight">💡 ${t}</div>`).join('');
}

function renderMedEffectInsights() {
  const el = document.getElementById('medEffectInsights');
  if (!el) return;
  const store = getStore();
  const meds = getMeds();
  const insights = [];

  meds.forEach(m => {
    const id = m.id;
    const withVals = { pain: [], rls: [] };
    const withoutVals = { pain: [], rls: [] };

    Object.keys(store).forEach(d => {
      const e = store[d];
      const p = dailyAvgPain(e);
      const r = dailyAvgRls(e);
      if (p === null && r === null) return;
      const taken = typeof isMedicationTaken === 'function'
        ? isMedicationTaken(e, id)
        : (e.medsTaken || []).includes(id);
      if (taken) {
        if (p !== null) withVals.pain.push(p);
        if (r !== null) withVals.rls.push(r);
      } else {
        if (p !== null) withoutVals.pain.push(p);
        if (r !== null) withoutVals.rls.push(r);
      }
    });

    ['rls', 'pain'].forEach(metric => {
      const w = withVals[metric];
      const o = withoutVals[metric];
      if (w.length < 3 || o.length < 3) return;
      const avgW = avgOf(w);
      const avgO = avgOf(o);
      if (avgW === null || avgO === null || avgO === 0) return;
      const pct = Math.round((avgO - avgW) / avgO * 100);
      if (Math.abs(pct) < 8) return;
      const metricLabel = metric === 'rls' ? 'RLS' : 'Schmerz';
      if (pct > 0) {
        insights.push(`Unter Einnahme von <strong>${escHtml(m.name)}</strong> sank dein ${metricLabel} im Schnitt um <strong>${pct}%</strong> (${avgO.toFixed(1)} → ${avgW.toFixed(1)}).`);
      } else {
        insights.push(`An Tagen mit <strong>${escHtml(m.name)}</strong> war dein ${metricLabel} im Schnitt <strong>${Math.abs(pct)}%</strong> höher (${avgO.toFixed(1)} → ${avgW.toFixed(1)}).`);
      }
    });
  });

  if (!insights.length) {
    el.innerHTML = '<div class="empty-state" style="padding:16px"><p>Im Tagebuch „Medikamente heute eingenommen“ ankreuzen – dann Vergleich Einnahme- vs. freie Tage.</p></div>';
    return;
  }
  el.innerHTML = insights.map(t => `<div class="smart-insight">${t}</div>`).join('');
}

// ── Analysis Tab ─────────────────────────────────
function renderAnalysisTab() {
  const store = getStore();
  const dates = Object.keys(store).sort();
  const warningEl = document.getElementById('analysis-warning-banner');
  const warningText = document.getElementById('analysis-warning-text');

  if (dates.length < 5) {
    if (warningEl) { warningEl.style.display = 'block'; }
    if (warningText) warningText.textContent = 'Noch zu wenig Daten – bitte mindestens 5 Tage im Tagebuch erfassen, damit die Muster-Analyse funktioniert.';
  } else {
    if (warningEl) warningEl.style.display = 'none';
  }

  // Pain & RLS peak time
  const timeAvgPain = [0,0,0,0], timeAvgRls = [0,0,0,0];
  const painCnt = [0,0,0,0], rlsCnt = [0,0,0,0];
  dates.forEach(d => {
    const e = store[d];
    TIMES.forEach((t, i) => {
      if (e[`${t.key}_pain`] !== undefined) {
        timeAvgPain[i] += e[`${t.key}_pain`];
        painCnt[i]++;
      }
      if (e[`${t.key}_rls`] !== undefined) {
        timeAvgRls[i] += e[`${t.key}_rls`];
        rlsCnt[i]++;
      }
    });
  });

  const painAvgs = timeAvgPain.map((v, i) => painCnt[i] ? v / painCnt[i] : 0);
  const rlsAvgs  = timeAvgRls.map((v, i)  => rlsCnt[i] ? v / rlsCnt[i] : 0);
  const maxPainIdx = painAvgs.indexOf(Math.max(...painAvgs));
  const maxRlsIdx  = rlsAvgs.indexOf(Math.max(...rlsAvgs));

  const painTimeEl  = document.getElementById('profile-pain-time');
  const painValEl   = document.getElementById('profile-pain-value');
  const rlsTimeEl   = document.getElementById('profile-rls-time');
  const rlsValEl    = document.getElementById('profile-rls-value');

  if (painTimeEl) painTimeEl.textContent = TIMES[maxPainIdx]?.label || '–';
  if (painValEl)  painValEl.textContent  = `Ø ${painAvgs[maxPainIdx].toFixed(1)} / 10`;
  if (rlsTimeEl)  rlsTimeEl.textContent  = TIMES[maxRlsIdx]?.label || '–';
  if (rlsValEl)   rlsValEl.textContent   = `Ø ${rlsAvgs[maxRlsIdx].toFixed(1)} / 10`;

  // Main trigger
  const triggerEl = document.getElementById('profile-main-trigger');
  const triggerScore = document.getElementById('profile-trigger-score');
  let bestTag = null, bestDiff = 0;
  INFLUENCE_TAGS.forEach(tag => {
    const withVals = [], withoutVals = [];
    dates.forEach(d => {
      const e = store[d];
      const p = dailyAvgPain(e);
      if (p === null) return;
      if (e.factors && e.factors[tag.key]) withVals.push(p);
      else withoutVals.push(p);
    });
    if (withVals.length >= 3 && withoutVals.length >= 3) {
      const diff = avgOf(withVals) - avgOf(withoutVals);
      if (Math.abs(diff) > Math.abs(bestDiff)) { bestDiff = diff; bestTag = tag; }
    }
  });
  if (triggerEl) triggerEl.textContent = bestTag ? bestTag.label : 'Noch keine Daten';
  if (triggerScore) triggerScore.textContent = bestTag ? `Ø ${bestDiff > 0 ? '+' : ''}${bestDiff.toFixed(1)} Punkte Schmerz` : 'Mehr Tage mit Einflussfaktoren erfassen';

  // Trigger comparison bars
  const triggerList = document.getElementById('trigger-list');
  if (!triggerList) return;
  const rows = INFLUENCE_TAGS.map(tag => {
    const withVals = [], withoutVals = [];
    dates.forEach(d => {
      const e = store[d];
      const p = dailyAvgPain(e);
      if (p === null) return;
      if (e.factors && e.factors[tag.key]) withVals.push(p);
      else withoutVals.push(p);
    });
    if (withVals.length < 3 || withoutVals.length < 3) return null;
    const avgWith    = avgOf(withVals);
    const avgWithout = avgOf(withoutVals);
    const diff = avgWith - avgWithout;
    const pct  = Math.round(Math.abs(diff) / (avgWithout || 1) * 100);
    const color = diff > 0 ? 'var(--accent-pain)' : 'var(--accent-2)';
    const barW  = Math.min(100, pct * 2);
    return `<div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px">${tag.label}</span>
        <span style="font-family:var(--mono);font-size:12px;color:${color}">${diff > 0 ? '+' : ''}${diff.toFixed(1)} (${pct}%)</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:6px">
        <div style="background:${color};width:${barW}%;height:6px;border-radius:4px;transition:width 0.4s"></div>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-top:4px">Mit: ${avgWith.toFixed(1)} · Ohne: ${avgWithout.toFixed(1)} · ${withVals.length + withoutVals.length} Tage</div>
    </div>`;
  }).filter(Boolean);

  triggerList.innerHTML = rows.length
    ? rows.join('')
    : '<div class="empty-state" style="padding:16px"><p>Nutze die Einflussfaktoren im Tagebuch – nach min. 3 Tagen mit/ohne Tag erscheinen Vergleiche.</p></div>';

  if (typeof renderBloodPressureAnalysis === 'function') renderBloodPressureAnalysis();
}

// ── Charts ───────────────────────────────────────
function setChartView(view, btn) {
  currentChartView = view;
  document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCharts();
}

function renderCharts() {
  const store = getStore();
  const dates = Object.keys(store).sort();

  // Compute stats
  let totalPain = 0, totalRls = 0, countPain = 0, countRls = 0;
  dates.forEach(d => {
    const e = store[d];
    TIMES.forEach(t => {
      if (e[`${t.key}_pain`] !== undefined) { totalPain += e[`${t.key}_pain`]; countPain++; }
      if (e[`${t.key}_rls`]  !== undefined) { totalRls  += e[`${t.key}_rls`];  countRls++;  }
    });
  });
  document.getElementById('statAvgPain').textContent = countPain ? (totalPain/countPain).toFixed(1) : '–';
  document.getElementById('statAvgRls').textContent  = countRls  ? (totalRls/countRls).toFixed(1)   : '–';
  document.getElementById('statDays').textContent    = dates.length;

  // Determine date range
  const today = new Date();
  let days;
  if (currentChartView === 'week')   days = 7;
  else if (currentChartView === 'month')  days = 30;
  else if (currentChartView === '3month') days = 90;
  else days = 365;

  const labels = [];
  const painData = [];
  const rlsData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = formatLocalDate(d);
    const entry = store[str];

    let lbl;
    if (days <= 7) lbl = `${DAY_NAMES[d.getDay()]} ${d.getDate()}.`;
    else if (days <= 30) lbl = `${d.getDate()}.${d.getMonth()+1}.`;
    else lbl = `${d.getDate()}.${d.getMonth()+1}.`;

    labels.push(lbl);

    if (entry) {
      let p = [], r = [];
      TIMES.forEach(t => {
        if (entry[`${t.key}_pain`] !== undefined) p.push(entry[`${t.key}_pain`]);
        if (entry[`${t.key}_rls`]  !== undefined) r.push(entry[`${t.key}_rls`]);
      });
      painData.push(p.length ? +(p.reduce((a,b)=>a+b,0)/p.length).toFixed(1) : null);
      rlsData.push(r.length  ? +(r.reduce((a,b)=>a+b,0)/r.length).toFixed(1) : null);
    } else {
      painData.push(null);
      rlsData.push(null);
    }
  }

  // Main chart
  const ctx = document.getElementById('mainChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Schmerz',
          data: painData,
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255,107,107,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#ff6b6b',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          spanGaps: true,
        },
        {
          label: 'RLS',
          data: rlsData,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167,139,250,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#a78bfa',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: true,
          spanGaps: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1e35',
          titleColor: '#8aa8cc',
          bodyColor: '#e8f1ff',
          borderColor: '#1e3a5f',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y + ' / 10' : '–'}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,58,95,0.5)', drawBorder: false },
          ticks: { color: '#4a6890', font: { size: 10, family: "'DM Mono', monospace" }, maxRotation: 45 }
        },
        y: {
          min: 0, max: 10,
          grid: { color: 'rgba(30,58,95,0.5)', drawBorder: false },
          ticks: { color: '#4a6890', font: { size: 10 }, stepSize: 2 }
        }
      }
    }
  });

  // Time-of-day chart (last 7 days avg per time slot)
  const todLabels = ['Morgen', 'Mittag', 'Abend', 'Nacht'];
  const todPain = [0,0,0,0];
  const todRls  = [0,0,0,0];
  const todPainCount = [0,0,0,0];
  const todRlsCount = [0,0,0,0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const str = formatLocalDate(d);
    const entry = store[str];
    if (!entry) continue;
    TIMES.forEach((t, idx) => {
      if (entry[`${t.key}_pain`] !== undefined) {
        todPain[idx] += entry[`${t.key}_pain`];
        todPainCount[idx]++;
      }
      if (entry[`${t.key}_rls`] !== undefined) {
        todRls[idx] += entry[`${t.key}_rls`];
        todRlsCount[idx]++;
      }
    });
  }

  const todPainAvg = todPain.map((v, i) => todPainCount[i] ? +(v / todPainCount[i]).toFixed(1) : 0);
  const todRlsAvg  = todRls.map((v, i)  => todRlsCount[i] ? +(v / todRlsCount[i]).toFixed(1) : 0);

  const ctx2 = document.getElementById('todChart').getContext('2d');
  if (todChartInstance) todChartInstance.destroy();
  todChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: todLabels,
      datasets: [
        {
          label: 'Schmerz',
          data: todPainAvg,
          backgroundColor: 'rgba(255,107,107,0.7)',
          borderColor: '#ff6b6b',
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: 'RLS',
          data: todRlsAvg,
          backgroundColor: 'rgba(167,139,250,0.7)',
          borderColor: '#a78bfa',
          borderWidth: 1,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1e35',
          titleColor: '#8aa8cc',
          bodyColor: '#e8f1ff',
          borderColor: '#1e3a5f',
          borderWidth: 1,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8aa8cc', font: { size: 12, family: "'DM Sans', sans-serif", weight: '500' } }
        },
        y: {
          min: 0, max: 10,
          grid: { color: 'rgba(30,58,95,0.5)' },
          ticks: { color: '#4a6890', font: { size: 10 }, stepSize: 2 }
        }
      }
    }
  });

  renderCorrelations();
  renderTagPatternInsights();
  renderMedEffectInsights();
}
