// ══════════════════════════════════════════════
// SYMPTOCHRON - SMART SCANNER (BMP & PZN SUPPORT)
// ══════════════════════════════════════════════

var html5QrScanner = window.html5QrScanner || null;
window.html5QrScanner = html5QrScanner;

function commitScannedMedications(meds) {
  if (!Array.isArray(meds) || meds.length === 0) return;
  if (typeof importParsedMedications === 'function') {
    importParsedMedications(meds, 'scan');
    return;
  }
  if (typeof saveMeds === 'function') saveMeds(meds);
  if (typeof renderMedList === 'function') renderMedList();
}

function buildScannedMedication(data) {
  return {
    id: data.id || `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name || 'Unbekannt',
    pzn: data.pzn || '',
    dose: data.dose || '',
    form: data.form || '',
    note: data.note || '',
    source: 'scan',
    schedule: {
      morning: parseFloat(data.schedule?.morning || 0) || 0,
      noon: parseFloat(data.schedule?.noon || 0) || 0,
      evening: parseFloat(data.schedule?.evening || 0) || 0,
      night: parseFloat(data.schedule?.night || 0) || 0,
    }
  };
}

function setScannerUiState(isScanning) {
  const container = document.getElementById("scanner-video-container");
  const startBtn = document.getElementById("startScanBtn");
  const stopBtn = document.getElementById("stopScanBtn");

  if (container) {
    container.style.display = isScanning ? "block" : "none";
    container.style.width = "100%";
    container.style.maxWidth = "450px";
    container.style.minHeight = isScanning ? "320px" : "0";
    container.style.margin = "15px auto 0 auto";
    container.style.overflow = "hidden";
    container.style.borderRadius = "12px";
    container.style.background = "#000";
    container.style.position = "relative";
  }
  if (startBtn) startBtn.style.display = isScanning ? "none" : "inline-block";
  if (stopBtn) stopBtn.style.display = isScanning ? "inline-block" : "none";
}

// ── Scanner-Overlay: roter Laser-Streifen + Zielecken ──
function addScannerOverlay() {
  const container = document.getElementById("scanner-video-container");
  if (!container || container.querySelector(".scan-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "scan-overlay";
  overlay.innerHTML = `
    <div class="scan-frame">
      <span class="scan-corner tl"></span>
      <span class="scan-corner tr"></span>
      <span class="scan-corner bl"></span>
      <span class="scan-corner br"></span>
      <div class="scan-laser"></div>
    </div>
    <div class="scan-hint">Code in den Rahmen halten</div>
  `;
  container.appendChild(overlay);
}

function removeScannerOverlay() {
  const container = document.getElementById("scanner-video-container");
  if (!container) return;
  const overlay = container.querySelector(".scan-overlay");
  if (overlay) overlay.remove();
}

function flashScannerSuccess() {
  const container = document.getElementById("scanner-video-container");
  if (!container) return;
  const overlay = container.querySelector(".scan-overlay");
  if (overlay) overlay.classList.add("success");
  const flash = document.createElement("div");
  flash.className = "scan-success-flash";
  container.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
}

function forceScannerVideoVisible() {
  const container = document.getElementById("scanner-video-container");
  if (!container) return;

  const video = container.querySelector("video");
  if (video) {
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.style.display = "block";
    video.style.visibility = "visible";
    video.style.opacity = "1";
    video.style.width = "100%";
    video.style.height = "auto";
    video.style.maxHeight = "70vh";
    video.style.objectFit = "cover";
    video.style.background = "#000";
  }

  const scanRegion = container.querySelector("#reader__scan_region, [id$='__scan_region']");
  if (scanRegion) {
    scanRegion.style.minHeight = "320px";
    scanRegion.style.display = "flex";
    scanRegion.style.alignItems = "center";
    scanRegion.style.justifyContent = "center";
    scanRegion.style.background = "#000";
  }

  const canvas = container.querySelector("canvas");
  if (canvas) {
    canvas.style.maxWidth = "100%";
    canvas.style.height = "auto";
  }
}

async function startQRScanner() {
  const containerId = "scanner-video-container";
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    if (typeof Html5Qrcode === "undefined" || typeof Html5QrcodeSupportedFormats === "undefined") {
      throw new Error("Scanner-Bibliothek wurde nicht geladen.");
    }

    setScannerUiState(true);
    container.innerHTML = "";

    if (html5QrScanner) {
      await html5QrScanner.stop().catch(() => {});
      if (typeof html5QrScanner.clear === "function") {
        await html5QrScanner.clear().catch(() => {});
      }
      html5QrScanner = null;
    }

    await new Promise(resolve => setTimeout(resolve, 80));

    html5QrScanner = new Html5Qrcode(containerId);
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.CODE_128
      ]
    };

    await html5QrScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    );

    forceScannerVideoVisible();
    addScannerOverlay();
    setTimeout(() => { forceScannerVideoVisible(); addScannerOverlay(); }, 150);
    setTimeout(() => { forceScannerVideoVisible(); addScannerOverlay(); }, 500);

  } catch (err) {
    console.error("Kamera-Fehler:", err);
    setScannerUiState(false);
    const message = window.isSecureContext
      ? "Kamera-Zugriff fehlgeschlagen"
      : "Scanner braucht HTTPS oder localhost";
    if (typeof showToast === 'function') showToast(message);
  }
}

function stopQRScanner() {
  const container = document.getElementById("scanner-video-container");

  if (!html5QrScanner) {
    if (container) container.innerHTML = "";
    setScannerUiState(false);
    return;
  }

  html5QrScanner.stop().then(async () => {
    if (typeof html5QrScanner.clear === "function") {
      await html5QrScanner.clear().catch(() => {});
    }
    html5QrScanner = null;
    if (container) container.innerHTML = "";
    setScannerUiState(false);
  }).catch(err => {
    console.error("Fehler beim harten Stoppen:", err);
    html5QrScanner = null;
    if (container) container.innerHTML = "";
    setScannerUiState(false);
  });
}

function onScanSuccess(decodedText) {
  if (typeof showToast === 'function') showToast("✅ Code erkannt!");
  flashScannerSuccess();
  if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
  // Kurz das Erfolgs-Feedback zeigen, dann Scanner schließen
  setTimeout(() => {
    stopQRScanner();
    parseMedicationPlan(decodedText);
  }, 450);
}

function onScanFailure(error) {}

function parseMedicationPlan(text) {
  try {
    const meds = [];
    let added = 0;

    // 1. VERSUCH: BMP Plan (Großer Block mit vielen Daten)
    if (text.includes("MP") || text.includes("\x1F")) {
      const delimiter = text.includes("\x1F") ? "\x1F" : ";";
      const tokens = text.split(delimiter);

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "M" && i + 1 < tokens.length) {
          meds.push(buildScannedMedication({
            name: tokens[i + 2] || "Unbekannt",
            pzn: tokens[i + 1] || "",
            dose: tokens[i + 3] || "",
            form: tokens[i + 4] || "",
            schedule: {
              morning: (tokens[i + 5] || '0').replace(',', '.'),
              noon: (tokens[i + 6] || '0').replace(',', '.'),
              evening: (tokens[i + 7] || '0').replace(',', '.'),
              night: (tokens[i + 8] || '0').replace(',', '.'),
            }
          }));
          added++;
          i += 8;
        }
      }
      if (added > 0) {
        commitScannedMedications(meds);
        if (typeof showToast === 'function') showToast(`${added} Medikamente importiert`);
        return;
      }
    }

    // 2. VERSUCH: PZN Erkennung (Wenn es nur eine Zahlenfolge ist)
    const isPZN = /^\d{7,10}$/.test(text.trim());
    if (isPZN) {
      handlePznScan(text.trim());
      return;
    }

    // 3. VERSUCH: JSON oder einfacher Text
    try {
      const obj = JSON.parse(text);
      if (obj.name) {
        meds.push(buildScannedMedication(obj));
      } else {
        meds.push(buildScannedMedication({ name: text.substring(0, 30), note: 'Scan-Import' }));
      }
    } catch (e) {
      meds.push(buildScannedMedication({ name: text.substring(0, 30), note: 'Scan-Import' }));
    }

    commitScannedMedications(meds);
  } catch (err) {
    console.error("Parsing Error:", err);
  }
} // <-- Schließt die Funktion parseMedicationPlan

// ── PZN-Lookup: lokale Medikamente → RxNav-API → manuell ergänzen ──
async function handlePznScan(pzn) {
  if (typeof showToast === 'function') showToast("🔍 Suche Medikament zu PZN " + pzn + "…");

  // 1) Schon in der eigenen Liste? Dann nicht doppelt anlegen.
  if (typeof getMeds === 'function') {
    const existing = getMeds().find(m => m.pzn === pzn);
    if (existing) {
      if (typeof showToast === 'function') showToast(`✅ „${existing.name}" ist bereits in deiner Liste`);
      return;
    }
  }

  // 2) Online-Lookup über RxNav (approximate match)
  let foundName = null;
  try {
    if (typeof RXNAV_BASE !== 'undefined' && navigator.onLine !== false) {
      const r = await fetch(`${RXNAV_BASE}/approximateTerm.json?term=${encodeURIComponent(pzn)}&maxEntries=1`);
      const j = await r.json();
      const cand = j?.approximateGroup?.candidate;
      const one = Array.isArray(cand) ? cand[0] : cand;
      if (one?.rxcui) {
        const r2 = await fetch(`${RXNAV_BASE}/rxcui/${one.rxcui}/properties.json`);
        const j2 = await r2.json();
        if (j2?.properties?.name) foundName = j2.properties.name;
      }
    }
  } catch (e) { /* offline oder API nicht erreichbar – weiter mit manueller Ergänzung */ }

  if (foundName) {
    commitScannedMedications([buildScannedMedication({
      pzn,
      name: foundName,
      dose: 'Bitte ergänzen',
      form: 'Bitte ergänzen',
      note: 'Per PZN-Scan geladen – bitte Dosis prüfen'
    })]);
    if (typeof showToast === 'function') showToast(`✅ „${foundName}" hinzugefügt – bitte Dosis ergänzen`);
    return;
  }

  // 3) Kein Treffer: Formular mit vorausgefüllter PZN öffnen statt „Unbekannt" zu speichern
  if (typeof openMedModal === 'function') {
    openMedModal();
    const pznField = document.getElementById('medPzn');
    if (pznField) pznField.value = pzn;
    if (typeof showToast === 'function') showToast("PZN übernommen – bitte Name & Dosis eintragen");
  } else {
    commitScannedMedications([buildScannedMedication({
      pzn,
      name: `Unbekanntes Medikament (PZN: ${pzn})`,
      dose: 'Bitte ergänzen',
      form: 'Bitte ergänzen',
      note: 'PZN nicht gefunden – bitte Angaben vervollständigen'
    })]);
  }
}

// Event Listener für die Buttons aktivieren
function initScannerButtons() {
  setScannerUiState(false);

  const startBtn = document.getElementById("startScanBtn");
  if (startBtn) {
    startBtn.onclick = startQRScanner;
  }

  const stopBtn = document.getElementById("stopScanBtn");
  if (stopBtn) {
    stopBtn.onclick = stopQRScanner;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScannerButtons);
} else {
  initScannerButtons();
}
