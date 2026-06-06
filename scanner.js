// ══════════════════════════════════════════════
// SYMPTOCHRON - QR-CODE SCANNER (BMP INTERFACE)
// ══════════════════════════════════════════════

let html5QrScanner = null;

function startQRScanner() {
  const containerId = "scanner-video-container";
  if (!document.getElementById(containerId)) return;

  html5QrScanner = new Html5Qrcode(containerId);
  
  const config = { 
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
    formatsToSupport: [ 
      Html5QrcodeSupportedFormats.QR_CODE, 
      Html5QrcodeSupportedFormats.DATA_MATRIX 
    ]
  };

  html5QrScanner.start(
    { facingMode: "environment" }, 
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
    console.error("Kamera-Fehler:", err);
    showToast("Kamera-Zugriff fehlgeschlagen.");
  });
}

function stopQRScanner() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      html5QrScanner = null;
    }).catch(err => console.error(err));
  }
}

function onScanSuccess(decodedText) {
  showToast("Code erkannt!");
  closeScannerModal();
  parseMedicationPlan(decodedText);
}

function onScanFailure(error) {
  // Silent failure during search
}

function parseMedicationPlan(text) {
  try {
    let meds = getMeds();
    let added = 0;

    if (text.startsWith("MP")) {
      // Bundesmedikationsplan (BMP)
      const delimiter = text.includes("\x1F") ? "\x1F" : ";";
      const tokens = text.split(delimiter);
      
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].startsWith("M")) {
          const name = tokens[i + 2] || "Unbekannt";
          const pzn = tokens[i + 1] || "";
          const dose = tokens[i + 3] || "";
          const form = tokens[i + 4] || "";
          
          meds.push({
            id: Date.now().toString() + "_" + Math.random().toString(36).substr(2, 4),
            name: name,
            pzn: pzn,
            dose: dose,
            form: form,
            schedule: {
              morning: parseFloat(tokens[i + 5]) || 0,
              noon: parseFloat(tokens[i + 6]) || 0,
              evening: parseFloat(tokens[i + 7]) || 0,
              night: parseFloat(tokens[i + 8]) || 0
            }
          });
          added++;
          i += 8;
        }
      }
    } else {
      // Einfacher Text oder JSON
      try {
        const obj = JSON.parse(text);
        if (obj.name) {
          meds.push({ id: Date.now().toString(), ...obj });
          added++;
        }
      } catch(e) {
        meds.push({
          id: Date.now().toString(),
          name: text.substring(0, 30),
          note: "Scan-Import"
        });
        added++;
      }
    }

    if (added > 0) {
      saveMeds(meds);
      renderMedList();
      showToast(`${added} Medikamente importiert`);
    }
  } catch (err) {
    showToast("Fehler beim Verarbeiten");
  }
}
