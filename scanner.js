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
      console.error("Fehler beim Stoppen:", err);
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

    const cleanText = text.trim();

    // 1. PZN Erkennung (7-10 stellige Zahl)
    const isPZN = /^\d{7,10}$/.test(cleanText);
    
    if (isPZN) {
      const pznClean = cleanText;
      if (typeof showToast === 'function') showToast("PZN erkannt: " + pznClean);
      
      meds.push({
        id: "med_" + Date.now(),
        name: "Medikament (PZN: " + pznClean + ")",
        pzn: pznClean,
        dose: "Bitte ergänzen",
        form: "Bitte ergänzen",
        schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
        time: "Bitte Einnahmezeiten angeben",
        note: "Über QR-Code importiert"
      });
      added++;
    }
    // 2. BMP-Format (einfache Erkennung)
    else if (text.includes("MP") || text.includes("\x1F")) {
      const delimiter = text.includes("\x1F") ? "\x1F" : ";";
      const tokens = text.split(delimiter);
      
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]?.trim() === "M" && i + 8 < tokens.length) {
          const name = tokens[i + 2]?.trim() || "Unbekannt";
          const pzn = tokens[i + 1]?.trim() || "";
          const dose = tokens[i + 3]?.trim() || "";
          const form = tokens[i + 4]?.trim() || "";
          const morning = parseFloat(tokens[i + 5]?.replace(',', '.') || 0);
          const noon = parseFloat(tokens[i + 6]?.replace(',', '.') || 0);
          const evening = parseFloat(tokens[i + 7]?.replace(',', '.') || 0);
          const night = parseFloat(tokens[i + 8]?.replace(',', '.') || 0);
          
          if (morning > 0 || noon > 0 || evening > 0 || night > 0) {
            const timeStr = [];
            if (morning > 0) timeStr.push(morning + "× Morgens");
            if (noon > 0) timeStr.push(noon + "× Mittags");
            if (evening > 0) timeStr.push(evening + "× Abends");
            if (night > 0) timeStr.push(night + "× Nachts");
            
            meds.push({
              id: "med_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
              name: name,
              pzn: pzn,
              dose: dose,
              form: form,
              schedule: { morning, noon, evening, night },
              time: timeStr.join(" · "),
              note: "Über QR-Code importiert"
            });
            added++;
            i += 8;
          }
        }
      }
    }
    // 3. Einfacher Text
    else if (cleanText.length > 2 && cleanText.length < 100) {
      meds.push({
        id: "med_" + Date.now(),
        name: cleanText,
        pzn: "",
        dose: "Bitte ergänzen",
        form: "Bitte ergänzen",
        schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
        time: "Bitte Einnahmezeiten angeben",
        note: "Über QR-Code importiert"
      });
      added++;
    }

    if (added > 0) {
      if (typeof saveMeds === 'function') saveMeds(meds);
      if (typeof renderMedList === 'function') renderMedList();
      if (typeof showToast === 'function') showToast(added + " Medikament(e) importiert");
      return;
    }

    if (typeof showToast === 'function') showToast("Kein Medikamenten-Code erkannt");

  } catch (err) {
    console.error("Parsing Error:", err);
    if (typeof showToast === 'function') showToast("Fehler beim Verarbeiten des Codes");
  }
}

// Event Listener
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