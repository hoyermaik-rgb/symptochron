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
function startQRScanner() {
  // Konfiguration für den Scanner
  const config = { 
    fps: 10, 
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  };

  html5QrScanner = new Html5Qrcode("scanner-video-container");
  
  // Kamera starten (Nutzt standardmäßig die Rückkamera beim Smartphone)
  html5QrScanner.start(
    { facingMode: "environment" }, 
    config,
    onScanSuccess,
    onScanFailure
  ).catch(err => {
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
// BMP-PARSER ENGINE (Entschlüsselung)
// ══════════════════════════════════════════════
function parseMedicationPlan(text) {
  try {
    // Überprüfung, ob es sich um den offiziellen Bundesmedikationsplan handelt
    if (!text.startsWith("MP")) {
      // Fallback: Wenn es ein normaler QR-Code mit Text/JSON ist
      attemptSimpleImport(text);
      return;
    }

    // BMP-Daten nutzen oft das Steuerzeichen US (Unit Separator, \x1F) oder ';' als Trenner
    // Hier splitten wir den String auf, um an die Medikamentenblöcke zu kommen
    let delimiter = text.includes("\x1F") ? "\x1F" : ";";
    const tokens = text.split(delimiter);
    
    // In einem echten BMP stehen ab einer bestimmten Position die Medikamente (gekennzeichnet mit "M")
    // Format oft: M (für Medikament), PZN, Name, Stärke, Form, Morgens, Mittags, Abends, Nachts...
    let addedCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "M" || tokens[i].startsWith("M")) {
        // Ein Medikamentenblock wurde gefunden!
        const name = tokens[i + 2] || "Unbekanntes Medikament";
        const dose = tokens[i + 3] || "";
        const form = tokens[i + 4] || "";
        
        // Einnahmeschema extrahieren
        const morning = parseFloat(tokens[i + 5]) || 0;
        const noon = parseFloat(tokens[i + 6]) || 0;
        const evening = parseFloat(tokens[i + 7]) || 0;
        const night = parseFloat(tokens[i + 8]) || 0;
        const pzn = tokens[i + 1] || "";

        // Neues Medikamenten-Objekt für deinen bestehenden Medikamentenplan bauen
        const scannedMed = {
          id: 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: name,
          pzn: pzn,
          dose: dose,
          form: form,
          morning: morning,
          noon: noon,
          evening: evening,
          night: night,
          note: "Via QR-Code importiert"
        };

        if (!appData.medications) appData.medications = [];
        appData.medications.push(scannedMed);
        addedCount++;
        
        // Index weiterspringen, um das eingelesene Objekt zu überspringen
        i += 8; 
      }
    }

    if (addedCount > 0) {
      saveDataToStorage();
      // UI im Medikamenten-Tab aktualisieren (Funktion aus deinen anderen Skripten)
      if (typeof renderMedicationManager === 'function') renderMedicationManager();
      if (typeof renderTakenMedsList === 'function') renderTakenMedsList();
      if (typeof loadMedicationsList === 'function') loadMedicationsList(); // Je nachdem wie deine Render-Funktion exakt heißt
      
      showToast(`${addedCount} Medikamente importiert!`);
    } else {
      showToast("Keine lesbaren Medikamentendaten im Code gefunden.", "error");
    }

  } catch (err) {
    console.error("Parser-Fehler:", err);
    showToast("Fehler beim Verarbeiten des QR-Codes.", "error");
  }
}

// Fallback für einfache QR-Codes (z.B. nur ein Medikamentenname als Freitext)
function attemptSimpleImport(text) {
  // Wenn der Text z.B. JSON ist
  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text);
      if (obj.name) {
        if (!appData.medications) appData.medications = [];
        appData.medications.push({
          id: 'med_' + Date.now(),
          name: obj.name,
          dose: obj.dose || '',
          form: obj.form || '',
          morning: obj.morning || 0,
          noon: obj.noon || 0,
          evening: obj.evening || 0,
          night: obj.night || 0,
          note: "Einfacher JSON-QR-Import"
        });
        saveDataToStorage();
        if (typeof renderMedicationManager === 'function') renderMedicationManager();
        showToast("Medikament importiert!");
        return;
      }
    } catch(e) {}
  }

  // Ansonsten: Erstelle ein Medikament mit dem gescannten Text als Namen
  if (text.trim().length > 0) {
    if (!appData.medications) appData.medications = [];
    appData.medications.push({
      id: 'med_' + Date.now(),
      name: text.substring(0, 50).trim(),
      dose: '',
      form: '',
      morning: 0, noon: 0, evening: 0, night: 0,
      note: "QR-Text-Scan"
    });
    saveDataToStorage();
    if (typeof renderMedicationManager === 'function') renderMedicationManager();
    showToast("Medikamentenname erfasst!");
  }
}