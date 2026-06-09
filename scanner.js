// ══════════════════════════════════════════════
// SYMPTOCHRON - SMART SCANNER (BMP & PZN SUPPORT)
// ══════════════════════════════════════════════

let html5QrScanner = null;

async function startQRScanner() {
  const containerId = "scanner-video-container";
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    if (typeof Html5Qrcode === "undefined" || typeof Html5QrcodeSupportedFormats === "undefined") {
      throw new Error("Scanner-Bibliothek wurde nicht geladen.");
    }

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
    const message = window.isSecureContext
      ? "Kamera-Zugriff fehlgeschlagen"
      : "Scanner braucht HTTPS oder localhost";
    if (typeof showToast === 'function') showToast(message);
  }
}

function stopQRScanner() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      html5QrScanner = null;
      document.getElementById("scanner-video-container").style.display = "none";
      document.getElementById("startScanBtn").style.display = "block";
      document.getElementById("stopScanBtn").style.display = "none";
    }).catch(err => {
      console.error("Fehler beim harten Stoppen:", err);
      // Fallback, falls die Bibliothek blockiert: UI trotzdem zurücksetzen
    
  html5QrScanner = null;
      document.getElementById("scanner-video-container").style.display = "none";
      document.getElementById("startScanBtn").style.display = "block";
      document.getElementById("stopScanBtn").style.display = "none";
    });
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

      // Mock-Datenbank für Testzwecke
      const mockMedicationDB = {
        "1234567": { name: "Ibuprofen 400mg", form: "Tablette", hersteller: "Beispiel GmbH" },
        "9876543": { name: "Paracetamol 500mg", form: "Kapsel", hersteller: "Apotheken-Direkt" },
        "5556667": { name: "Diclofenac Gel", form: "Gel", hersteller: "Schmerzfrei AG" }
      };

      const mockFetch = (pzn) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(mockMedicationDB[pzn] || null);
          }, 500);
        });
      };

      mockFetch(pznClean).then(data => {
        if (data) {
          meds.push({
            id: "med_" + Date.now(),
            name: data.name,
            pzn: pznClean,
            dose: "Bitte ergänzen",
            form: data.form || "Bitte ergänzen",
            schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
            note: "Automatisch über PZN geladen" + (data.hersteller ? ` (${data.hersteller})` : '')
          });
          if (typeof saveMeds === 'function') saveMeds(meds);
          if (typeof renderMedList === 'function') renderMedList();
          if (typeof showToast === 'function') showToast("Medikament erfolgreich geladen!");
        } else {
          meds.push({
            id: "med_" + Date.now(),
            name: "Unbekanntes Medikament (PZN: " + pznClean + ")",
            pzn: pznClean,
            dose: "Bitte ergänzen",
            form: "Bitte ergänzen",
            schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
            note: "PZN nicht in Datenbank gefunden"
          });
          if (typeof saveMeds === 'function') saveMeds(meds);
          if (typeof renderMedList === 'function') renderMedList();
          if (typeof showToast === 'function') showToast("PZN nicht gefunden.");
        }
      }).catch(err => {
        console.error("Fehler beim Abrufen der Daten:", err);
        meds.push({
          id: "med_" + Date.now(),
          name: "Fehler beim Laden (PZN: " + pznClean + ")",
          pzn: pznClean,
          dose: "Bitte ergänzen",
          form: "Bitte ergänzen",
          schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
          note: "Fehler beim Datenabruf"
        });
        if (typeof saveMeds === 'function') saveMeds(meds);
        if (typeof renderMedList === 'function') renderMedList();
      });
      return;
    }

    // 3. VERSUCH: JSON oder einfacher Text (Falls es weder BMP noch reine PZN ist)
    try {
      const obj = JSON.parse(text);
      if (obj.name) {
        meds.push({ id: "med_" + Date.now(), ...obj });
      } else {
        meds.push({ id: "med_" + Date.now(), name: text.substring(0, 30), note: "Scan-Import" });
      }
    } catch(e) {
      meds.push({ id: "med_" + Date.now(), name: text.substring(0, 30), note: "Scan-Import" });
    }

    if (typeof saveMeds === 'function') saveMeds(meds);
    if (typeof renderMedList === 'function') renderMedList();

  } catch (err) {
    console.error("Parsing Error:", err);
  }
} // <-- Schließt die Funktion parseMedicationPlan

// Event Listener für die Buttons aktivieren
document.addEventListener('DOMContentLoaded', function() {
  const containerElem = document.getElementById("scanner-video-container");
  if (containerElem) {
    containerElem.style.display = "none";
  }

  const startBtn = document.getElementById("startScanBtn");
  if (startBtn) {
    startBtn.addEventListener("click", startQRScanner);
  }

  const stopBtn = document.getElementById("stopScanBtn");
  if (stopBtn) {
    stopBtn.addEventListener("click", stopQRScanner);
  }
});
