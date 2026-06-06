// ══════════════════════════════════════════════
// SYMPTOCHRON - SMART SCANNER (BMP & PZN SUPPORT)
// ══════════════════════════════════════════════

let html5QrScanner = null;

async function startQRScanner() {
  const containerId = "scanner-video-container";
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    if (html5QrScanner) {
      await html5QrScanner.stop().catch(() => {});
      html5QrScanner = null;
    }

    html5QrScanner = new Html5Qrcode(containerId);
    const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
    const formats = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.CODE_128
    ];

    await html5QrScanner.start(
      { facingMode: "environment" }, 
      { ...config, formatsToSupport: formats },
      onScanSuccess,
      onScanFailure
    );

    document.getElementById("scanner-video-container").style.display = "block";
    document.getElementById("startScanBtn").style.display = "none";
    document.getElementById("stopScanBtn").style.display = "block";

  } catch (err) {
    console.error("Kamera-Fehler:", err);
    if (typeof showToast === 'function') showToast("Kamera-Zugriff fehlgeschlagen");
  }
}

function stopQRScanner() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      html5QrScanner = null;
      document.getElementById("scanner-video-container").style.display = "none";
      document.getElementById("startScanBtn").style.display = "block";
      document.getElementById("stopScanBtn").style.display = "none";
    }).catch(err => console.error(err));
  }
}

function onScanSuccess(decodedText) {
  if (typeof showToast === 'function') showToast("Code erkannt!");
  stopQRScanner();
  parseMedicationPlan(decodedText);
}

function onScanFailure(error) {}

function parseMedicationPlan(text) {
  try {
    let meds = (typeof getMeds === 'function') ? getMeds() : [];
    let added = 0;

    // 1. VERSUCH: BMP Plan (Großer Block mit vielen Daten)
    if (text.includes("MP") || text.includes("\x1F")) {
      const delimiter = text.includes("\x1F") ? "\x1F" : ";";
      const tokens = text.split(delimiter);
      
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "M" && i + 1 < tokens.length) {
          meds.push({
            id: "med_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            name: tokens[i + 2] || "Unbekannt",
            pzn: tokens[i + 1] || "",
            dose: tokens[i + 3] || "",
            form: tokens[i + 4] || "",
            schedule: {
              morning: parseFloat(tokens[i + 5]?.replace(',', '.') || 0),
              noon: parseFloat(tokens[i + 6]?.replace(',', '.') || 0),
              evening: parseFloat(tokens[i + 7]?.replace(',', '.') || 0),
              night: parseFloat(tokens[i + 8]?.replace(',', '.') || 0)
            }
          });
          added++;
          i += 8; // Überspringe den Block
        }
      }
      if (added > 0) {
        saveMeds(meds);
        renderMedList();
        if (typeof showToast === 'function') showToast(`${added} Medikamente importiert`);
        return;
      }
    }

    // 2. VERSUCH: PZN Erkennung (Wenn es nur eine Zahlenfolge ist)
    const isPZN = /^\d{7,10}$/.test(text.trim());
    if (isPZN) {
      const pznClean = text.trim();
      if (typeof showToast === 'function') showToast("Suche Medikament in Datenbank...");

      // API abfragen
      fetch(`https://api.dr-bahr.com/pzn/${pznClean}`)
        .then(response => response.json())
        .then(data => {
          // Wenn die API einen Namen liefert, nutzen wir ihn, sonst Platzhalter
          const medName = data.name ? data.name : `Unbekanntes Medikament (PZN: ${pznClean})`;
          const hersteller = data.hersteller ? ` (${data.hersteller})` : '';

          meds.push({
            id: "med_" + Date.now(),
            name: medName,
            pzn: pznClean,
            dose: "Bitte ergänzen",
            form: data.groesse || "Bitte ergänzen",
            schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
            note: "Automatisch über PZN geladen" + hersteller
          });

          // Speichern und Anzeigen, nachdem die API geantwortet hat
          if (typeof saveMeds === 'function') saveMeds(meds);
          if (typeof renderMedList === 'function') renderMedList();
          if (typeof showToast === 'function') showToast("Medikament erfolgreich geladen!");
        })
        .catch(err => {
          console.error("API Fehler:", err);
          // Fallback, falls Internet weg ist oder API streikt
          meds.push({
            id: "med_" + Date.now(),
            name: "Medikament (PZN: " + pznClean + ")",
            pzn: pznClean,
            dose: "Bitte ergänzen",
            form: "Bitte ergänzen",
            schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
            note: "Offline-Import - Name manuell ergänzen"
          });
          if (typeof saveMeds === 'function') saveMeds(meds);
          if (typeof renderMedList === 'function') renderMedList();
        });
        
      return; // Beendet die Funktion hier, da fetch im Hintergrund weiterläuft
    }
