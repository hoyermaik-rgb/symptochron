// ══════════════════════════════════════════════
// SYMPTOCHRON - SMART PATTERN ENGINE & STATS
// ══════════════════════════════════════════════

// Hauptfunktion für den Analyse-Tab (Muster-Erkennung)
function runAnalysis() {
  const entries = appData.entries || {};
  const dates = Object.keys(entries).sort();

  // Elemente aus der UI holen
  const pPainTime = document.getElementById('profile-pain-time');
  const pPainVal = document.getElementById('profile-pain-value');
  const pRlsTime = document.getElementById('profile-rls-time');
  const pRlsVal = document.getElementById('profile-rls-value');
  const pTrigger = document.getElementById('profile-main-trigger');
  const pTriggerScore = document.getElementById('profile-trigger-score');
  const warningBanner = document.getElementById('analysis-warning-banner');
  const warningText = document.getElementById('analysis-warning-text');

  if (dates.length < 3) {
    if (warningBanner && warningText) {
      warningText.innerText = "Trage mindestens 3 Tagebuch-Einträge ein, damit die Smart Pattern Engine Muster erkennen kann.";
      warningBanner.style.display = 'block';
    }
    return;
  } else {
    if (warningBanner) warningBanner.style.display = 'none';
  }

  // Zählvariablen für die Berechnung
  let painTimeCounts = {}, rlsTimeCounts = {}, triggerCounts = {};
  let totalPain = 0, totalRls = 0;

  dates.forEach(d => {
    const e = entries[d];
    const pLvl = parseInt(e.painLevel) || 0;
    const rLvl = parseInt(e.rlsLevel) || 0;

    totalPain += pLvl;
    totalRls += rLvl;

    // Schmerzhöhepunkte nach Tageszeit tracken
    if (pLvl >= 5 && e.painType) {
      painTimeCounts[e.painType] = (painTimeCounts[e.painType] || 0) + 1;
    }

    // RLS-Höhepunkte nach Tageszeit tracken
    if (rLvl >= 5 && e.rlsTime) {
      rlsTimeCounts[e.rlsTime] = (rlsTimeCounts[e.rlsTime] || 0) + 1;
    }

    // Trigger-Häufigkeiten zählen
    if (Array.isArray(e.triggers)) {
      e.triggers.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    }
  });

  // 1. Schmerzhöhepunkt auswerten
  const topPainTime = getTopKey(painTimeCounts);
  if (pPainTime && pPainVal) {
    pPainTime.innerText = topPainTime ? translateTimeKey(topPainTime) : "Kein klarer Trend";
    pPainVal.innerText = `Durchschnittlicher Schmerzwert: ${(totalPain / dates.length).toFixed(1)}/10`;
  }

  // 2. RLS-Höhepunkt auswerten
  const topRlsTime = getTopKey(rlsTimeCounts);
  if (pRlsTime && pRlsVal) {
    pRlsTime.innerText = topRlsTime ? translateTimeKey(topRlsTime) : "Kein klarer Trend";
    pRlsVal.innerText = `Durchschnittliche Intensität: ${(totalRls / dates.length).toFixed(1)}/10`;
  }

  // 3. Haupt-Einflussfaktor auswerten
  const topTrigger = getTopKey(triggerCounts);
  if (pTrigger && pTriggerScore) {
    pTrigger.innerText = topTrigger || "Keine Trigger dokumentiert";
    pTriggerScore.innerText = topTrigger ? `Trat an ${triggerCounts[topTrigger]} Tagen begleitend auf.` : "--";
  }

  // Optionale Trigger-Vergleichsliste im Tab rendern
  renderTriggerRanking(triggerCounts);
}

// Hilfsfunktion: Liefert den Schlüssel mit dem höchsten Zahlenwert
function getTopKey(obj) {
  let max = 0, topKey = null;
  for (let key in obj) {
    if (obj[key] > max) {
      max = obj[key];
      topKey = key;
    }
  }
  return topKey;
}

// Hilfsfunktion: Macht englische/technische IDs lesbar für den Nutzer
function translateTimeKey(key) {
  const dict = {
    'morning': 'Morgens', 'noon': 'Mittags', 'evening': 'Abends', 'night': 'Nachts',
    'stechend': 'Stechend', 'pochend': 'Pochend', 'ziehend': 'Ziehend', 'dumpf': 'Dumpf'
  };
  return dict[key] || key;
}

// Trigger-Ranking rendern
function renderTriggerRanking(counts) {
  const container = document.getElementById('trigger-list');
  if (!container) return;
  container.innerHTML = '';

  const sortedTriggers = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);

  if (sortedTriggers.length === 0) {
    container.innerHTML = '<p style="color:var(--text-3); font-size:12px;">Noch nicht genügend Trigger-Daten vorhanden.</p>';
    return;
  }

  sortedTriggers.forEach(t => {
    const div = document.createElement('div');
    div.style = 'background:var(--bg-card2); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:13px;';
    div.innerHTML = `
      <span style="color:var(--text-1); font-weight:500;">⚠️ ${t}</span>
      <span style="color:var(--accent-pain); font-weight:bold;">${counts[t]}x registriert</span>
    `;
    container.appendChild(div);
  });
}

// ══════════════════════════════════════════════
// STATISTIKEN & BASIC DIAGRAMME (FALLS AKTIV)
// ══════════════════════════════════════════════
function renderCharts() {
  // Wenn du Bibliotheken wie Chart.js verwendest, zieht dieser Code hierhin um.
  // Falls du Balkendiagramme selbst via CSS baust, fügen wir diese Logik hier ein.
  console.log("Statistik-Diagramme aktualisiert.");
}