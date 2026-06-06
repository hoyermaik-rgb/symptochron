// ══════════════════════════════════════════════
// SYMPTOCHRON - QR-CODE SCANNER (BMP INTERFACE)
// ══════════════════════════════════════════════

let html5QrScanner = null;

// Öffnet den Scanner (wird vom UI-Button aufgerufen)
function openScannerModal() {
  const modal = document.getElementById('scannerModal');
  if (modal) modal.style.display = 'flex';
  
  // Initialisiere den Scanner, sobald das Modal offen ist
  setTimeout(() => {
    startQRScanner();
  }, 300);
}

// Schließt den Scanner und stoppt die Kamera
function closeScannerModal() {
  const modal = document.getElementById('scannerModal');
  if (modal) modal.style.display = 'none';
  
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      console.log("Kamera erfolgreich gestoppt.");
    }).catch(err => {
      console.error("Fehler beim Stoppen der Kamera: ", err);
    });
  }
}

// Startet die Kamera-Übertragung im vordefinierten Container
const config = { 
    fps: 20, // Höhere Bildrate für schnelleres Erfassen
    qrbox: function(viewfinderWidth, viewfinderHeight) {
      // Dynamische Box: Nutzt 75% des Bildschirms, damit man den Code gut sieht
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const fontSize = Math.floor(minEdge * 0.75);
      return { width: fontSize, height: fontSize };
    },
    aspectRatio: 1.0,
    // EXPLIZIT: Erlaubt QR-Codes UND die auf Medikationsplänen genutzten DataMatrix-Codes
    formatsToSupport: [ 
      Html5QrcodeSupportedFormats.QR_CODE, 
      Html5QrcodeSupportedFormats.DATA_MATRIX 
    ]
  };

  html5QrScanner = new Html5Qrcode("scanner-video-container");
  
  // Kamera starten
  html5QrScanner.start(
    { facingMode: "environment" }, 
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
    alert("Kamera-Fehler: " + err);
    showToast("Kamera-Zugriff verweigert oder nicht verfügbar.", "error");
    console.error("Html5Qrcode Start Error:", err);
  });
}

// Erfolg-Callback: Wenn ein QR-Code erkannt wurde
function onScanSuccess(decodedText, decodedResult) {
  // Sofort Feedback geben und Scanner stoppen
  showToast("Code erfolgreich gescannt!");
  closeScannerModal();
  
  // Den gescannten Inhalt verarbeiten
  parseMedicationPlan(decodedText);
}

// Fehler-Callback: Wird fortlaufend aufgerufen, während er sucht (kann leer bleiben)
function onScanFailure(error) {
  // Zu viel Log-Spam vermeiden, da er jede Sekunde mehrfach feuert
}

// ══════════════════════════════════════════════
// BMP-PARSER ENGINE (An dein System angepasst)
// ══════════════════════════════════════════════
function parseMedicationPlan(text) {
  try {
    // Überprüfung auf offiziellen Bundesmedikationsplan
    if (!text.startsWith("MP")) {
      attemptSimpleImport(text);
      return;
    }

    // BMP-Daten nutzen das Steuerzeichen US (\x1F) oder ';' als Trenner
    let delimiter = text.includes("\x1F") ? "\x1F" : ";";
    const tokens = text.split(delimiter);
    
    // Bestehende Medikamente über deine diary.js-Funktion laden
    let meds = [];
    if (typeof getMeds === 'function') {
      meds = getMeds();
    } else {
      meds = JSON.parse(localStorage.getItem('painDiaryMeds') || '[]');
    }

    let addedCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "M" || tokens[i].startsWith("M")) {
        // Ein Medikamentenblock wurde im BMP-String gefunden
        const name = tokens[i + 2] || "Unbekanntes Medikament";
        const dose = tokens[i + 3] || "";
        const form = tokens[i + 4] || "";
        
        // Einnahmeschema extrahieren
        const morning = parseFloat(tokens[i + 5]) || 0;
        const noon = parseFloat(tokens[i + 6]) || 0;
        const evening = parseFloat(tokens[i + 7]) || 0;
        const night = parseFloat(tokens[i + 8]) || 0;
        const pzn = tokens[i + 1] || "";

        // Abwärtskompatiblen Zeilenstring für die Anzeige bauen wie in diary.js
        const timeLabels = [];
        if (morning) timeLabels.push(`${morning}× Morgens`);
        if (noon)    timeLabels.push(`${noon}× Mittags`);
        if (evening) timeLabels.push(`${evening}× Abends`);
        if (night)   timeLabels.push(`${night}× Nachts`);
        const timeStr = timeLabels.join(' · ');

        // Objekt exakt so aufbauen, wie es diary.js erwartet:
        const scannedMed = {
          id: Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 3),
          name: name,
          pzn: pzn || undefined,
          dose: dose,
          form: form || undefined,
          schedule: {
            morning: morning,
            noon: noon,
            evening: evening,
            night: night
          },
          time: timeStr,
          note: "Via QR-Code importiert"
        };

        meds.push(scannedMed);
        addedCount++;
        
        // Index weiterspringen
        i += 8; 
      }
    }

    if (addedCount > 0) {
      // Speichern über deine diary.js-Funktionen
      if (typeof saveMeds === 'function') {
        saveMeds(meds);
      } else {
        localStorage.setItem('painDiaryMeds', JSON.stringify(meds));
      }

      // UI über deine diary.js-Funktion aktualisieren
      if (typeof renderMedList === 'function') {
        renderMedList();
      }

      showToast(`✅ ${addedCount} Medikamente importiert!`);
    } else {
      showToast("⚠️ Keine lesbaren Medikamentendaten im Code gefunden.", "error");
    }

  } catch (err) {
    console.error("Parser-Fehler:", err);
    showToast("❌ Fehler beim Verarbeiten des QR-Codes.", "error");
  }
}

// Fallback für einfache QR-Codes (z.B. nur ein Medikamentenname als Freitext)
function attemptSimpleImport(text) {
  let meds = [];
  if (typeof getMeds === 'function') {
    meds = getMeds();
  } else {
    meds = JSON.parse(localStorage.getItem('painDiaryMeds') || '[]');
  }

  // Wenn der Text JSON ist
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      if (obj.name) {
        meds.push({
          id: Date.now().toString(36),
          name: obj.name,
          dose: obj.dose || '',
          form: obj.form || undefined,
          schedule: {
            morning: obj.morning || 0,
            noon: obj.noon || 0,
            evening: obj.evening || 0,
            night: obj.night || 0
          },
          time: obj.time || 'Bei Bedarf',
          note: "JSON-QR-Import"
        });
        
        if (typeof saveMeds === 'function') saveMeds(meds);
        else localStorage.setItem('painDiaryMeds', JSON.stringify(meds));
        
        if (typeof renderMedList === 'function') renderMedList();
        showToast("✅ Medikament importiert!");
        return;
      }
    } catch(e) {}
  }

  // Ansonsten: Erstelle ein einfaches Medikament mit dem Text als Name
  if (text.trim().length > 0) {
    meds.push({
      id: Date.now().toString(36),
      name: text.substring(0, 50).trim(),
      dose: '',
      form: undefined,
      schedule: { morning: 0, noon: 0, evening: 0, night: 0 },
      time: 'Bedarf (Text-Scan)',
      note: "QR-Text-Scan"
    });
    
    if (typeof saveMeds === 'function') saveMeds(meds);
    else localStorage.setItem('painDiaryMeds', JSON.stringify(meds));
    
    if (typeof renderMedList === 'function') renderMedList();
    showToast("✅ Medikamentenname erfasst!");
  }
}