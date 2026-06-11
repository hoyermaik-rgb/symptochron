# Technische Dokumentation – SymptoChron

## 1. Ziel des Projekts
SymptoChron ist eine clientseitige Web-App zur lokalen Erfassung von:

- Schmerzintensität
- RLS-Symptomatik
- Schlaf
- Stimmung & Depression (MoodPath-Modul)
- Medikation
- Blutdruck
- Export-/Backup-Daten

Die Anwendung arbeitet ohne Backend und speichert die Daten im `localStorage` des Browsers.

---

## 2. Technischer Stand nach dem Umbau
Der Umbau erfolgte mit dem Ziel:

- **kein Redesign**
- **bestehende Bedienlogik beibehalten**
- **interne Logik konsolidieren**
- **Medikationsbereich zentralisieren**
- **Datumslogik stabilisieren**
- **Import/Export robuster machen**

### Wichtigste Ergebnisänderungen
- Medikamentenlogik wurde in `meds.js` zentralisiert.
- Datumslogik wurde von UTC auf **lokales Datum** umgestellt.
- Medikationsanalyse berücksichtigt jetzt auch Slot-Einnahmen wie `medId_morning`.
- Scanner-Import nutzt zentrale Medikamentenlogik.
- Bearbeiten von Medikamenten ist möglich.
- Patientendaten sind zentral nutzbar.
- Service-Worker-Registrierung liegt nicht mehr in `patient.js`, sondern zentral in `app.js`.
- Hash-Routing für Tabs (`#diary`, `#meds`, `#rls`, ...) ist vorhanden.

---

## 3. Aktuelle Dateistruktur

### Kernmodule
- `index.html` – Grundstruktur der Oberfläche, Tabs, Modale, Script-Reihenfolge
- `app.js` – App-Initialisierung, Routing, Datum, globale Utilities
- `meds.js` – zentrale Medikamentenlogik
- `diary.js` – Tagebuchlogik
- `rls.js` – RLS-Logik
- `charts.js` – Analyse und Diagramme
- `export.js` – Export, Import, PDF
- `scanner.js` – Scanner und Scan-Parsing
- `bloodpressure.js` – Blutdruckmodul
- `patient.js` – Patientendaten
- `mood.js` – Stimmungs- und Mood-Tracking (MoodPath)
- `style.css` – komplettes UI-Styling
- `sw.js` – Service Worker
- `manifest.json` – PWA-Metadaten

---

## 4. Einschätzung: welche Dateien als weitgehend abgeschlossen gelten

### Weitgehend fertig
- `manifest.json`
- `style.css`
- `bloodpressure.js`
- `patient.js`
- `sw.js`

### Fachlich zentral / künftig am ehesten noch relevant
- `app.js`
- `meds.js`
- `diary.js`
- `rls.js`
- `charts.js`
- `export.js`
- `scanner.js`
- `index.html`

---

## 5. Script-Reihenfolge
Aktuell in `index.html` eingebunden in dieser Reihenfolge:

1. `app.js`
2. `meds.js`
3. `diary.js`
4. `rls.js`
5. `bloodpressure.js`
6. `charts.js`
7. `export.js`
8. `patient.js`
9. `scanner.js`

Diese Reihenfolge ist wichtig, da spätere Dateien auf globale Funktionen früherer Dateien zugreifen.

---

## 6. App-Initialisierung
Die Initialisierung läuft zentral über `initApp()` in `app.js`.

### Aufgaben von `initApp()`
- Header-Datum setzen
- Tagebuch-Zeitblöcke erzeugen
- Einflussfaktoren erzeugen
- Wochenübersicht rendern
- RLS-Formulare vorbereiten
- Medikamentenliste rendern
- aktuellen Tagebucheintrag laden
- Navigation aktualisieren
- RLS initialisieren
- Wechselwirkungswarnungen aktualisieren
- Import-Zone initialisieren
- Start-Route aus URL-Hash anwenden

Zusätzlich wird in `app.js` registriert:
- `hashchange` → Tab-Routing
- `serviceWorker` → PWA-Registrierung

---

## 7. Routing
Die App nutzt Hash-basiertes Routing für Tabs.

### Unterstützte Hashes
- `#diary`
- `#rls`
- `#meds`
- `#analysis`
- `#charts`
- `#export`

### Relevante Funktionen
- `switchTab(name)`
- `applyInitialRoute()`

---

## 8. Datumslogik
Die Datumslogik wurde auf **lokale Datumserzeugung** umgestellt.

### Relevante Funktionen in `app.js`
- `formatLocalDate(date)`
- `todayStr()`
- `parseDate(str)`
- `addDays(str, n)`
- `formatDateLabel(str)`

### Warum das wichtig ist
Vorher wurde teils `toISOString().split('T')[0]` verwendet. Das konnte lokal rund um Mitternacht einen falschen Tag liefern.

---

## 9. LocalStorage-Struktur

### Verwendete Keys
- `painDiary` – Tagebuchdaten
- `painDiaryMeds` – Medikamentenplan
- `painDiarySettings` – allgemeine Einstellungen / RLS-Modus / Termine
- `painDiaryRlsDaily` – tägliche RLS-Dokumentation
- `painDiaryRlsSurvey` – RLS-Fragebögen
- `painDiaryBloodPressure` – Blutdruckwerte
- `painDiaryReminderSettings` – Reminder-Einstellungen
- `symptochron_patient_name` – Patient Name
- `symptochron_patient_bday` – Patient Geburtsdatum

---

## 10. Datenmodelle

### 10.1 Tagebucheintrag (`painDiary`)
Gespeichert pro Datum `YYYY-MM-DD`.

Beispiel:

```js
{
  morning_pain: 4,
  morning_rls: 2,
  noon_pain: 3,
  evening_pain: 6,
  notes: "heute ruhiger Tag",
  sleepHours: 6.5,
  sleepQuality: 4,
  factors: {
    stress: true,
    coffee: true
  },
  medsTaken: ["med_abc_morning", "med_xyz_evening"],
  updated: "2026-06-10T..."
}
```

### 10.2 Medikament (`painDiaryMeds`)
Intern normalisiert durch `normalizeMedication()` in `meds.js`.

Beispiel:

```js
{
  id: "med_xxx",
  name: "Ibuprofen",
  pzn: "12345678",
  dose: "400 mg",
  form: "Tablette",
  note: "nach dem Essen",
  schedule: {
    morning: 1,
    noon: 0,
    evening: 1,
    night: 0
  },
  time: "1× Morgens · 1× Abends",
  source: "manual",
  active: true,
  createdAt: "...",
  updatedAt: "..."
}
```

### 10.3 RLS-Tagesdoku (`painDiaryRlsDaily`)
Beispiel:

```js
{
  symptom: 6,
  sleepQuality: 3,
  beginDuration: "21:30, ca. 2 Std.",
  triggers: "Stress",
  medication: "Pramipexol 0,18mg",
  relief: "Gehen",
  augmentation: true,
  updated: "..."
}
```

### 10.4 RLS-Survey (`painDiaryRlsSurvey`)
Beispiel:

```js
{
  answers: [1,2,1,3,2,2,1,2,1,1],
  sum: 16,
  severity: "Leichte Beschwerden",
  updated: "..."
}
```

### 10.5 Blutdruckeintrag (`painDiaryBloodPressure`)
Beispiel:

```js
{
  id: "bp_xxx",
  date: "2026-06-10",
  time: "08:30",
  systolic: 128,
  diastolic: 82,
  pulse: 74,
  context: "Morgens",
  note: "vor Medikament"
}
```

### 10.6 Patientendaten
Über `getPatientData()`:

```js
{
  name: "Max Mustermann",
  bday: "1980-01-10"
}
```

---

## 11. Medikamentenmodul (`meds.js`)
`meds.js` ist das zentrale Fachmodul für Medikation.

### Hauptaufgaben
- Storage lesen/schreiben
- Medikamente normalisieren
- Alt-/Neudaten vereinheitlichen
- Medikamentenliste rendern
- Einnahme-Häkchen im Tagebuch rendern
- Einnahme aus DOM einsammeln
- Bearbeiten / Löschen
- Dublettenprüfung beim Import
- Bereinigung verwaister Einnahmereferenzen
- Offline-Interaktionen prüfen
- Online-Interaktionen via RxNav prüfen

### Wichtige Funktionen
- `getMeds()`
- `saveMeds(list)`
- `normalizeMedication(raw)`
- `normalizeMedicationList(list)`
- `buildLegacyTimeString(schedule)`
- `mergeImportedMedications(existing, incoming)`
- `findMedicationDuplicate(existing, med)`
- `renderMedList()`
- `renderMedIntakeForDiary(takenIds)`
- `collectMedicationIntakeFromDom()`
- `isMedicationTaken(entry, medId)`
- `deleteMedicationById(id)`
- `cleanupMedicationReferences(id)`
- `saveMedication()`
- `openMedModal(editId)`
- `closeMedModal()`
- `checkDrugInteractions()`
- `resolveRxcui(name, pzn)`

### Besondere Verbesserung
Die Analyse erkennt jetzt auch Slot-IDs:
- `med_x_morning`
- `med_x_noon`
- `med_x_evening`
- `med_x_night`

---

## 12. Tagebuchmodul (`diary.js`)
`diary.js` enthält nur noch Tagebuchlogik und nutzt Medikamentenfunktionen aus `meds.js`.

### Aufgaben
- Wochenübersicht
- Zeitblöcke
- Score-Auswahl
- Laden/Speichern des aktuellen Tagebucheintrags
- Einflussfaktoren
- Spracheingabe
- Datumsnavigation

### Hinweis
Medikationslogik wurde hier bewusst reduziert.

---

## 13. RLS-Modul (`rls.js`)
`rls.js` enthält die RLS-Fachlogik.

### Aufgaben
- Termine
- RLS-Modus
- tägliche RLS-Dokumentation
- Survey
- Bannerlogik
- Sichtbarkeitssteuerung

### Wichtige Funktionen
- `applyRlsVisibility()`
- `shouldShowDetailedRls()`
- `shouldShowWeeklySurvey()`
- `saveRlsDaily()`
- `saveRlsSurvey()`
- `renderAppointmentList()`

Die Medikations-Interaktionslogik wurde daraus entfernt und zentral in `meds.js` belassen.

---

## 14. Analyse- und Chartmodul (`charts.js`)
### Aufgaben
- Korrelationen
- Mustererkennung
- Smart Insights
- Medikationsanalyse
- Diagramme

### Wichtige Korrektur
Zähler für Schmerz und RLS wurden getrennt.
Vorher konnten RLS-Durchschnitte verfälscht sein.

### Wichtige Funktionen
- `dailyAvgPain(entry)`
- `dailyAvgRls(entry)`
- `renderCorrelations()`
- `renderTagPatternInsights()`
- `renderMedEffectInsights()`
- `renderAnalysisTab()`
- `renderCharts()`

---

## 15. Export-/Importmodul (`export.js`)
### Aufgaben
- CSV-Export
- JSON-Backup
- PDF-Bericht
- CSV-/JSON-Import
- komplette Datenlöschung

### Verbesserungen
- JSON enthält jetzt auch Patientendaten
- Import führt Medikamente zusammen statt blind anzuhängen
- Blutdruckdaten werden dedupliziert importiert
- PDF nutzt aktuelle Einflussfaktoren (`factors`)
- PDF nutzt zentrale Patientendaten
- `clearAllData()` löscht auch Reminder- und Patientendaten

### Wichtige Funktionen
- `exportCSV()`
- `exportJSON()`
- `exportPDF()`
- `importData(input)`
- `mergeBloodPressureEntries(existing, incoming)`
- `clearAllData()`

---

## 24. Mood-Modul (MoodPath) – Stimmungs- und Depressions-Tracking

Das Mood-Modul wurde als eigenständiges Feature-Modul hinzugefügt und ist vollständig in die bestehende App integriert.

### 24.1 Aufgaben
- Täglicher Stimmungs-Check-In (7 Dimensionen)
- Depressions-Symptome-Tracking
- Positive Aktivitäten
- Stimmungs-Notizen mit Spracheingabe
- Mood-Status auf dem Startbildschirm
- Korrelationen mit Schmerz, RLS und Schlaf
- Mood-Daten in Export/Import

### 24.2 Datei
- `mood.js` – vollständige Mood-Logik

### 24.3 LocalStorage-Key
- `symptochron_mood` – Stimmungsdaten pro Datum

### 24.4 Datenmodell (Mood-Eintrag)

```js
{
  stimmung: 7,
  energie: 6,
  antrieb: 5,
  angst: 3,
  reizbarkeit: 4,
  konzentration: 8,
  hoffnungslosigkeit: 2,
  symptoms: {
    gruebeln: true,
    schuldgefuehle: true
  },
  activities: {
    sport: true,
    freunde: true
  },
  notes: "Gutes Gespräch heute",
  updated: "2026-06-11T..."
}
```

### 24.5 Globale Hilfsfunktionen
- `getMoodStore()`
- `getMoodAverageForDate(dateStr)`
- `MOOD_DIMENSIONS`

### 24.6 Integrationen

**Startbildschirm (welcome.js)**
- Automatische Mood-Status-Karte mit Durchschnittswert und Farbcodierung

**Statistik (charts.js)**
- Drei neue Korrelationen:
  - Ø Schmerz ↔ Stimmung
  - Ø RLS ↔ Stimmung
  - Schlafqualität ↔ Stimmung

**Export (export.js)**
- CSV: Neue Spalten `stimmung`, `energie`, `angst`
- JSON: Mood-Daten werden unter dem Key `mood` mitexportiert (Version 5)

### 24.7 Navigation
- Neuer Tab „Mood“ (`#mood`)
- Wird über `switchTab('mood')` gesteuert

### 24.8 Design
- Vollständig konsistent mit dem bestehenden UI
- Verwendet dieselben Farben und Komponenten wie RLS und Tagebuch

---

## 25. Aktualisierte Script-Reihenfolge

Die empfohlene Reihenfolge im `index.html` lautet nun:

1. `app.js`
2. `meds.js`
3. `diary.js`
4. `rls.js`
5. `bloodpressure.js`
6. `charts.js`
7. `export.js`
8. `patient.js`
9. `scanner.js`
10. `mood.js` (kann auch früher geladen werden)

---

## 16. Scanner-Modul (`scanner.js`)
### Aufgaben
- Kamera starten/stoppen
- Video sichtbar machen
- erkannte Inhalte interpretieren
- Medikamente standardisiert bauen
- Import an zentrale Medikationslogik übergeben

### Wichtige Funktionen
- `startQRScanner()`
- `stopQRScanner()`
- `parseMedicationPlan(text)`
- `buildScannedMedication(data)`
- `commitScannedMedications(meds)`

### Unterstützte Fälle
- BMP-Plan / strukturierter Block
- reine PZN
- JSON
- einfacher Text-Fallback

---

## 17. Blutdruckmodul (`bloodpressure.js`)
### Aufgaben
- Blutdruckwerte erfassen
- Modalfenster für Blutdrucktabelle
- Tageszusammenfassung
- Korrelation zu Schmerz
- Reminder-Funktion

### Hinweis
Das Modul ist fachlich relativ eigenständig und aktuell weitgehend stabil.

---

## 18. Patientenmodul (`patient.js`)
### Aufgaben
- Patientendaten speichern
- Patientendaten laden
- zentrale Lesefunktion `getPatientData()`

---

## 19. PWA / Service Worker
### `manifest.json`
Beschreibt die App als installierbare PWA.

### `sw.js`
- cached App-Dateien lokal
- verwendet aktuell Cache-Version `schmerztagebuch-v5`
- reagiert auf Notification Clicks

### Hinweis
Bei Änderungen an gecachten Dateien ist meist ein kompletter Reload sinnvoll.

---

## 20. Bekannte technische Restpunkte / optionale Verbesserungen
Diese Punkte sind **optional**, nicht kritisch:

1. weitere Reduktion globaler Funktionen zugunsten eines Namensraums
2. noch stärkere Entkopplung von `index.html`-Inline-Handlern
3. optional echte Online-PZN-Auflösung statt Mock-Datenbank im Scanner
4. optional mehr Validierung beim CSV-Import
5. optional Archivieren/Inaktiv-Schalten von Medikamenten statt nur Löschen

---

## 21. Test-Checkliste

### Allgemein
- App lädt ohne Konsole-Fehler
- Tabs lassen sich wechseln
- Hash-Routing funktioniert

### Medikamente
- Medikament anlegen
- Medikament bearbeiten
- Medikament löschen
- Einnahme im Tagebuch anhaken
- Reload lädt korrekt
- Wechselwirkungsprüfung funktioniert

### Analyse
- Smart Analysis erkennt Einnahmen mit Slot-IDs
- Diagramme zeigen Schmerz/RLS korrekt
- Tageszeit-Mittelwerte stimmen

### Scanner
- Scanner startet
- Stop funktioniert
- BMP-/PZN-/Text-Import landet in Medikamentenliste

### Export/Import
- JSON exportieren
- JSON wieder importieren
- Patientendaten kommen zurück
- Medikamente werden nicht blind dupliziert
- PDF wird erzeugt

### Blutdruck
- Eintrag anlegen
- Tabelle wird aktualisiert
- Analyse erscheint

---

## 22. Zusammenfassung
Die App ist nach dem Umbau weiterhin eine klassische, leichtgewichtige Browser-App ohne Backend, aber mit deutlich saubererer interner Struktur.

Der wichtigste Architekturpunkt ist jetzt:

> **Medikation ist in `meds.js` zentralisiert.**

Dadurch sind folgende Bereiche konsistenter geworden:
- Medikationsplan
- Einnahmeerfassung
- Scanner-Import
- Analyse
- Wechselwirkungsprüfung
- Import/Export

---

## 23. Empfohlene Betriebsnotiz
Nach Änderungen an der App bitte immer:

1. Seite/PWA neu laden
2. bei Service-Worker-Änderungen ggf. Hard Refresh durchführen
3. bei Problemen zuerst Browser-Cache bzw. PWA-Instanz neu starten

---

_Endstand Dokumentation erstellt am 2026-06-10._
