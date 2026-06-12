# SymptoChron

SymptoChron ist eine lokale Web-App zur Erfassung von:

- Schmerzen
- RLS (Restless-Legs-Syndrom)
- Schlaf
- Stimmung & Depression (MoodPath-Modul)
- Medikamentenplan und Einnahmen
- Blutdruck
- Export- und Backup-Daten

Die App läuft komplett im Browser und speichert Daten lokal auf dem Gerät.

---

## Funktionen

### Tagebuch
- Erfassung von Schmerz und RLS nach Tageszeit
- Schlafdauer und Schlafqualität
- Tagesnotizen
- Einflussfaktoren wie Stress, Kaffee, Alkohol usw.
- tägliche Medikamenteneinnahme abhaken

### Medikamente
- Medikamente anlegen
- Medikamente bearbeiten
- Medikamente löschen
- Einnahmezeiten pro Tageszeit festlegen
- lokale Wechselwirkungswarnungen
- Online-Wechselwirkungsprüfung über RxNav/RxNorm
- Scanner-Import für Medikamentendaten

### RLS
- tägliche RLS-Dokumentation
- IRLS-Fragebogen
- Terminverwaltung für Vorbereitungsphasen vor Arztterminen

### Analyse & Statistik
- Schmerz- und RLS-Auswertungen
- Tageszeit-Analyse
- Einflussfaktoren-Vergleich
- Medikationsanalyse
- Korrelationen (inkl. Stimmung)
- Blutdruck-/Schmerz-Vergleich
- Mood-Insights (Stimmung ↔ Schmerz/RLS/Schlaf)

### Export / Import
- JSON-Backup
- CSV-Export
- PDF-Bericht
- JSON- und CSV-Import

### Stimmung & Mood (MoodPath)
- Täglicher Stimmungs-Check-In (0–10 Skala)
- 7 Dimensionen: Stimmung, Energie, Antrieb, Angst, Reizbarkeit, Konzentration, Hoffnungslosigkeit
- Depressions-Symptome-Tracking
- Positive Aktivitäten
- Stimmungs-Notizen mit Spracheingabe
- Mood-Status auf dem Startbildschirm
- Korrelationen mit Schmerz, RLS und Schlaf

### Zusatzmodul
- Blutdrucktabelle
- Erinnerungsfunktion

---

## Technische Basis

Die App besteht aus reinem:

- HTML
- CSS
- JavaScript

Es gibt kein Backend und keine Datenbank auf einem Server.

Daten werden im Browser gespeichert über `localStorage`.

---

## Projektdateien

### Wichtige Dateien
- `index.html` – Hauptstruktur der App
- `style.css` – Design und Layout
- `app.js` – zentrale Initialisierung, Routing, Utilities
- `meds.js` – Medikamentenlogik
- `diary.js` – Tagebuchlogik
- `rls.js` – RLS-Bereich
- `charts.js` – Auswertung und Diagramme
- `export.js` – Export, Import, PDF
- `scanner.js` – Scanner und Scan-Import
- `bloodpressure.js` – Blutdruckmodul
- `patient.js` – Patientendaten
- `sw.js` – Service Worker
- `manifest.json` – PWA-Metadaten
- `mood.js` – Stimmungs- und Mood-Tracking (MoodPath)
- `vendor/chart.umd.min.js` – lokal eingebundene Chart.js-Bibliothek
- `vendor/jspdf.umd.min.js` – lokal eingebundene jsPDF-Bibliothek
- `vendor/html5-qrcode.min.js` – lokal eingebundene Scanner-Bibliothek

### Dokumentation
- `TECHNISCHE_DOKUMENTATION.md` – ausführliche technische Dokumentation

---

## Start der App

Die App kann direkt über die `index.html` geöffnet werden.

Empfohlen ist ein Browser mit Unterstützung für:
- `localStorage`
- Kamera-Zugriff
- Service Worker
- Notifications

Für Scanner-Funktionen ist in der Regel nötig:
- HTTPS
  oder
- localhost

---

## Datenspeicherung

Die Daten bleiben lokal im Browser gespeichert.

Dazu gehören z. B.:
- Tagebucheinträge
- Medikamente
- RLS-Daten
- Blutdruckwerte
- Patientendaten
- Einstellungen

Wichtig:
Wenn Browserdaten gelöscht werden, können auch App-Daten verloren gehen. Deshalb regelmäßig ein JSON-Backup erstellen.

---

## Entwicklungsstatus

Die App wurde intern logisch überarbeitet, ohne das Design zu verändern.

Wichtige Verbesserungen:
- Medikamentenlogik zentralisiert
- lokale Datumslogik verbessert
- Scanner-Import vereinheitlicht
- Bearbeiten von Medikamenten ergänzt
- Import/Export robuster gemacht
- Routing über URL-Hash ergänzt

---

## Hinweise für Weiterentwicklung

Wenn an der App weitergearbeitet wird, sollten vor allem diese Dateien beachtet werden:
- `app.js`
- `meds.js`
- `diary.js`
- `rls.js`
- `charts.js`
- `export.js`
- `scanner.js`

Für technische Details bitte die Datei `TECHNISCHE_DOKUMENTATION.md` lesen.

---

## Testen nach Änderungen

Nach Änderungen an JavaScript, PWA oder Service Worker:

1. Seite neu laden
2. bei Bedarf Hard Refresh ausführen
3. installierte PWA ggf. komplett schließen und neu öffnen

---

## Ziel der App

Die App soll helfen, Symptome, Medikation und Begleitfaktoren strukturiert festzuhalten, damit Verläufe und Muster besser erkennbar werden.

Sie ersetzt keine ärztliche Beratung.
