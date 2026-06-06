// ══════════════════════════════════════════════
// SYMPTOCHRON - QR-CODE SCANNER (BMP INTERFACE) - STABLE VERSION
// ══════════════════════════════════════════════

let html5QrScanner = null;

// Hilfsfunktion zur sicheren Funktionsaufrufung
const safeCall = (fnName, ...args) => {
  if (typeof window[fnName] === 'function') {
    return window[fnName](...args);
  }
  console.warn(`Funktion ${fnName} nicht gefunden.`);
};

async function startQRScanner() {
  const containerId = "scanner-video-container";
  const container = document.getElementById(containerId);
  const startBtn = document.getElementById("startScanBtn");
  const stopBtn = document.getElementById("stopScanBtn");

  if (!container) {
    console.error("Container #scanner-video-container nicht gefunden!");
    return;
  }

  try {
    // Vorherigen Scanner stoppen
    if (html5QrScanner) {
      await html5QrScanner.stop().catch(() => {});
      html5QrScanner = null;
    }

    html5QrScanner = new Html5Qrcode(containerId);
    
    const config = { 
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

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

    // UI Anpassung
    container.style.display = "block";
    startBtn.style.display = "none";
    stopBtn.style.display = "block";

  } catch (err) {
    console.error("Kamera-Fehler:", err);
    safeCall("showToast", "Kamera-Zugriff fehlgeschlagen: " + err.message);
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
  safeCall("showToast", "Code erkannt!");
  stopQRScanner(); // Scanner nach Erfolg stoppen
  parseMedicationPlan(decodedText);
}

function onScanFailure(error) {
  // Ignorieren während der Suche
}

function parseMedicationPlan(text) {
  try {
    // Sicherstellen, dass getMeds existiert, sonst leeres Array
    let meds = (typeof getMeds === 'function') ? getMeds() : [];
    let added = 0;

    if (text.startsWith("MP") || text.includes("\x1F")) {
      const delimiter = text.includes("\x1F") ? "\x1F" : ";";
      const tokens = text.split(delimiter);
      
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === "M" && i + 8 < tokens.length) {
          const pzn = tokens[i + 1] || "";
          const name = tokens[i + 2] || "Unbekannt";
          const dose = tokens[i + 3] || "";
          const form = tokens[i + 4] || "";
          
          meds.push({
            id: "med_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            name: name,
            pzn: pzn,
            dose: dose,
            form: form,
            schedule: {
              morning: parseFloat(tokens[i + 5]?.replace(',', '.') || 0),
              noon: parseFloat(tokens[i + 6]?.replace(',', '.') || 0),
              evening: parseFloat(tokens[i + 7]?.replace(',', '.') || 0),
              night: parseFloat(tokens[i + 8]?.replace(',', '.') || 0)
            }
          });
          added++;
          i += 8; // Springe über den Block
        }
      }
    } else {
      try {
        const obj = JSON.parse(text);
        if (obj.name) {
          meds.push({ id: "med_" + Date.now(), ...obj });
          added++;
        }
      } catch(e) {
        meds.push({
          id: "med_" + Date.now(),
          name: text.substring(0, 30),
          note: "Scan-Import"
        });
        added++;
      }
    }

    if (added > 0) {
      safeCall("saveMeds", meds);
      safeCall("renderMedList");
      safeCall("showToast", `${added} Medikamente importiert`);
    }
  } catch (err) {
    console.error("Parsing Error:", err);
    safeCall("showToast", "Fehler beim Verarbeiten des Codes");
  }
}

// Event Listener für die Buttons
document.getElementById("startScanBtn").addEventListener("click", startQRScanner);
document.getElementById("stopScanBtn").addEventListener("click", stopQRScanner);
