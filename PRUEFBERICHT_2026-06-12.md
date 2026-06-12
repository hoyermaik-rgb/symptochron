# Prüfbericht SymptoChron – 2026-06-12

## Geprüfte Bereiche
- Tagebuch
- Medikamente
- RLS
- Mood / PHQ-9 / GAD-7
- SOS / PWA / Installation
- Export / Import / Backup
- Service Worker / Manifest / Verknüpfungen

## Behobene Fehler

### 1) Tagebuch
- Syntaxfehler in `diary.js` behoben
- `loadCurrentEntry()` wieder korrekt hergestellt
- Schutzabfragen ergänzt

### 2) Routing / Verknüpfungen
- Tabs `mood` und `sos` in `applyInitialRoute()` ergänzt
- Initialisierung robuster gemacht, damit einzelne Module die App nicht komplett blockieren
- Alle `switchTab()`-Ziele geprüft: keine fehlenden Tab-Section-Ziele mehr

### 3) Mood-Modul
- Fehlende GAD-7-Definitionen ergänzt:
  - `GAD7_QUESTIONS`
  - `GAD7_OPTIONS`
  - `getGad7Store()`
  - `saveGad7Store()`
  - `gad7Answers`
- Fallback ergänzt, falls `Chart.js` nicht geladen wird

### 4) Medikamente
- Bedarfsmedikation war trotz vorhandener UI logisch nicht speicherbar
- Validierung angepasst: Medikamente ohne feste Tageszeit können jetzt angelegt werden
- Hinweis im Modal ergänzt: "Leer lassen = Bedarfsmedikation ohne feste Tageszeit"

### 5) RLS
- Fehler in der Wochenlogik behoben
- `isSameCalendarWeek()` war zu grob und konnte mehrere Wochen desselben Monats als identisch behandeln
- Dadurch konnte die IRLS-Wochenfälligkeit fehlerhaft sein

### 6) Export / Import
- CSV-Export korrigiert: Mood-Spalten werden jetzt korrekt gefüllt
- JSON-Backup erweitert um:
  - Mood
  - PHQ-9
  - GAD-7
  - Krisenbereich
  - Reminder-Einstellungen
- JSON-Import ergänzt um Wiederherstellung von:
  - Mood
  - PHQ-9
  - GAD-7
  - Krisenbereich
  - SOS
  - Reminder-Einstellungen
- `clearAllData()` erweitert, damit wirklich alle Modul-Daten gelöscht werden

### 7) PWA / Installation / SOS
- Manifest überarbeitet
- fehlende Icons ergänzt
- `beforeinstallprompt` hat den Browser-Prompt blockiert; automatische Installationshinweise werden jetzt nicht mehr aktiv unterdrückt
- `appinstalled`-Handler ergänzt
- `index.html` um `icon` und `apple-touch-icon` ergänzt

### 8) Service Worker
- Service Worker bereinigt und auf stabile lokale App-Shell reduziert
- problematische externe Precache-Einträge entfernt
- lokale fehlende Dateien ergänzt
- Cache-Version erhöht, damit die neue Offline-Version sicherer übernommen wird

### 9) Externe Bibliotheken lokal eingebunden
- `Chart.js` jetzt lokal aus `vendor/chart.umd.min.js`
- `jsPDF` jetzt lokal aus `vendor/jspdf.umd.min.js`
- `html5-qrcode` jetzt lokal aus `vendor/html5-qrcode.min.js`
- `index.html` und `sw.js` auf lokale Bibliotheken umgestellt

## Neue Dateien
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/icon-1024.png`
- `vendor/chart.umd.min.js`
- `vendor/jspdf.umd.min.js`
- `vendor/html5-qrcode.min.js`

## Prüfstatus
- Alle JavaScript-Dateien: Syntax OK
- `manifest.json`: gültig
- lokale Datei-Referenzen: vollständig
- Tab-Verknüpfungen: vollständig

## Wichtige technische Hinweise
- Das Installations-Popup ist trotzdem browsergesteuert und erscheint nicht garantiert immer
- Für PWA-Installation und Scanner gilt in der Regel: HTTPS oder localhost nötig
- In einer eingebetteten Vorschau ohne Netzwerk können externe Bibliotheken eingeschränkt sein:
  - Chart.js
  - jsPDF
  - html5-qrcode

## Offene Empfehlung
Falls gewünscht, sollten die externen Bibliotheken lokal eingebunden werden, damit:
- Diagramme offline stabil laufen
- PDF-Export offline stabil läuft
- Scanner nicht von CDN-Ladeproblemen abhängt
