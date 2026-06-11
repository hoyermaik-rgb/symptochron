# Konzept: Professioneller Depressions- und Stimmungsverlauf-Tracker

## Projektname (Arbeitstitel)

**MoodPath Pro**
Alternativen:

* SymptoChron Mood
* MindTrack
* MoodChronicle
* EmotiLog
* PsyTrack

---

# Vision

Eine datenschutzfreundliche Anwendung, die Betroffenen hilft, Depressionen, Stimmungsschwankungen und psychische Belastungen strukturiert zu dokumentieren, Muster zu erkennen und aussagekräftige Berichte für Ärzte, Therapeuten und Selbsthilfegruppen zu erstellen.

**Grundprinzip:**

* Patient im Mittelpunkt
* Daten gehören ausschließlich dem Nutzer
* Offline-First
* Wissenschaftlich fundiert
* Einfach genug für den Alltag
* Tief genug für langfristige Analysen

---

# Zielgruppen

### Patienten

* Depressionen
* Dysthymie
* Burnout
* Angststörungen
* Bipolare Störungen
* Chronische Schmerzen mit psychischer Belastung

### Therapeuten

* Verlaufskontrolle
* Therapiebegleitung
* Rückfallprävention

### Ärzte

* Medikamentenbewertung
* Verlaufskontrolle
* Diagnostische Unterstützung

---

# Dashboard

Beim Öffnen der App sieht der Nutzer:

### Heute

* Aktuelle Stimmung
* Schlafqualität
* Energielevel
* Belastungsgrad
* Letzter Eintrag
* Tagesnotiz

### Schnellübersicht

* Stimmung der letzten 7 Tage
* Durchschnittsenergie
* Schlaftrend
* Trigger-Häufigkeit

---

# Täglicher Check-In

Dauer: 30 Sekunden bis 2 Minuten

## Stimmung

Skala:

😞 Sehr schlecht
🙁 Schlecht
😐 Neutral
🙂 Gut
😄 Sehr gut

oder

0–10 Skala

---

## Energielevel

0–10

---

## Antrieb

0–10

---

## Hoffnungslosigkeit

0–10

---

## Angstniveau

0–10

---

## Reizbarkeit

0–10

---

## Konzentration

0–10

---

## Schlaf

### Dauer

* Stunden
* Minuten

### Qualität

0–10

### Einschlafprobleme

Ja/Nein

### Durchgeschlafen

Ja/Nein

---

# Symptomtracking

Typische Depressionssymptome:

* Interessenverlust
* Freudlosigkeit
* Grübeln
* Schuldgefühle
* Wertlosigkeitsgefühle
* Antriebslosigkeit
* Appetitverlust
* Appetitsteigerung
* Sozialer Rückzug
* Konzentrationsprobleme
* Schlafstörungen

Bewertung:

* Nicht vorhanden
* Leicht
* Mittel
* Stark

---

# Aktivitätstracking

Erfassung positiver Aktivitäten:

* Spaziergang
* Sport
* Meditation
* Treffen mit Freunden
* Therapie
* Hobby
* Arbeit
* Haushalt

Später analysierbar:

„An Tagen mit Bewegung ist die Stimmung durchschnittlich 27 % besser.“

---

# Trigger-Tracking

Mögliche Auslöser:

* Konflikte
* Stress
* Schlafmangel
* Schmerzen
* Einsamkeit
* Arbeit
* Finanzielle Sorgen
* Familienprobleme

Eigene Trigger möglich.

---

# Medikamentenmodul

Erfassung:

* Medikament
* Dosierung
* Uhrzeit

Beispiel:

* Sertralin
* Escitalopram
* Venlafaxin

Auswertungen:

* Stimmung vor Medikament
* Stimmung nach Medikament
* Nebenwirkungsverlauf

---

# Tagebuch

Freitextbereich

Optionen:

* Text
* Spracheingabe
* Bilder
* Anhänge

KI-Auswertung möglich:

* Häufige Themen
* Emotionserkennung
* Belastungsanalyse

Nur lokal auf dem Gerät.

---

# Wissenschaftliche Fragebögen

## PHQ-9

PHQ-9

Automatisch:

* monatlich
* alle 14 Tage

---

## WHO-5

WHO-5 Well-Being Index

---

## GAD-7

GAD-7

---

# KI-Analysemodul

Lokale Analyse (kein Cloud-Zwang)

Erkennt:

### Verschlechterungen

Beispiel:

> Die Stimmung ist seit 14 Tagen kontinuierlich gesunken.

---

### Rückfallwarnung

Beispiel:

> Aktuelles Muster ähnelt früheren depressiven Episoden.

---

### Positive Faktoren

Beispiel:

> An Tagen mit Sport liegt die Stimmung durchschnittlich 2,1 Punkte höher.

---

### Triggeranalyse

Beispiel:

> Schlaf unter 6 Stunden geht häufig mit schlechter Stimmung einher.

---

# Verlaufsdiagramme

## Stimmung

* Tag
* Woche
* Monat
* Jahr

## Schlaf

## Energie

## Antrieb

## Angst

## PHQ-9

## Medikamentenverlauf

---

# Krisenbereich

Notfallkarte:

* Therapeut
* Arzt
* Vertrauenspersonen

Persönlicher Krisenplan:

* Warnzeichen
* Bewältigungsstrategien
* Hilfreiche Kontakte

---

# Arzt- und Therapieberichte

Export als PDF

Zeitraum:

* 2 Wochen
* 1 Monat
* 3 Monate
* 6 Monate

Inhalt:

* Stimmungstrend
* PHQ-9-Verlauf
* Schlafentwicklung
* Trigger
* Medikamente
* Eigene Notizen

---

# Datenschutzkonzept

## Standard

* Komplett offline
* Keine Registrierung
* Keine Cloud-Pflicht

---

## Optional

Verschlüsselte Backups:

* Lokale Datei
* Eigene Cloud
* NAS
* USB-Stick

---

## Sicherheit

* AES-256-Verschlüsselung
* PIN
* Passwort
* Biometrische Anmeldung

---

# Technische Umsetzung

## Plattform

PWA (Progressive Web App)

Vorteile:

* Android
* iPhone
* Windows
* Linux
* macOS

Eine Codebasis für alle Geräte.

---

## Offline-Datenbank

* IndexedDB
* Dexie.js

---

## Frontend

* React
* TypeScript
* Material UI

---

## Diagramme

* Recharts
* Chart.js

---

## Export

* PDF
* CSV
* JSON

---

# Premium-Idee für die Zukunft

Falls das Projekt irgendwann veröffentlicht werden soll:

### Kostenlose Version

* Stimmung
* Symptome
* Tagebuch
* Diagramme

### Pro-Version

* KI-Musteranalyse
* Arztberichte
* Erweiterte Statistiken
* Individuelle Fragebögen
* Lokale KI-Unterstützung

---

## Besondere Funktion als Alleinstellungsmerkmal

**"Lebenslinien-Analyse"**

Die App verknüpft automatisch:

* Stimmung
* Schlaf
* Medikamente
* Aktivitäten
* Trigger
* Schmerzen

und erstellt verständliche Aussagen wie:

> „Ihre Stimmung verschlechtert sich regelmäßig 2–3 Tage nach Nächten mit weniger als 5 Stunden Schlaf.“

oder

> „In den letzten 6 Monaten waren soziale Aktivitäten der stärkste positive Einflussfaktor auf Ihr Wohlbefinden.“

Das wäre eine Funktion, die viele aktuelle Mood-Tracker nur sehr eingeschränkt anbieten und die besonders für Patienten und Therapeuten einen hohen Mehrwert liefern kann.
	