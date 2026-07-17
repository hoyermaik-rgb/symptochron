# AP-08 Backup- und Import-Härtung

Datum: 2026-07-10

Scope:

- `src/utils.ts`
- `src/components/ExportTab.tsx`
- `src/utils.test.ts`

## Problem vor AP-08

Der Importprozess fuer JSON-Backups las Rohdaten direkt ein und verteilte sie ungeprueft auf die lokalen Speicher synchronisierenden Methoden (`syncDiary`, `syncMeds` etc.). Es gab keine Schema-Validierung, keine Typ-Prüfung und keinen Schutz vor inkompatiblen Versionen oder beschädigten Datenstrukturen. Schlug der Import mittendrin fehl (z. B. durch ein ungültiges Datenfeld), hinterließ dies die lokale Anwendungsdatenbank in einem inkonsistenten, teils beschädigten Zustand (keine Rollback-Fähigkeit).

## Umsetzung

### Clientseitige Schema- & Typ-Validierung (validateBackupSchema)

In `src/utils.ts` wurde die Funktion `validateBackupSchema(data: any): { valid: boolean; errors: string[] }` implementiert. Diese führt vor dem Schreiben jeglicher Daten tiefgehende Validierungen durch:

- **JSON-Struktur**: Stellt sicher, dass das Backup ein gueltiges JSON-Objekt ist.
- **Versionierung**: Prueft das Vorhandensein der Backup-Version und erzwingt Kompatibilitaet (z. B. Beginnend mit Version `1.x.x`).
- **Tagebuch (diary)**:
  - Prueft Datums-Schluessel auf das Format `YYYY-MM-DD`.
  - Validiert Schlafstunden (Bereich 0-24) und Schlafqualität (Bereich 1-5).
  - Validiert Schmerzniveaus und RLS-Intensitäten (jeweils Bereich 0-10) in allen 4 Tagessegmenten.
  - Verifiziert, dass eingenommene Medikamente als Liste von Text-IDs formatiert sind.
- **Medikamente (meds)**:
  - Validiert Pflichtfelder (Name, Dosis).
  - Prueft die Pharmazentralnummer (PZN) mittels der Plausibilisierungsfunktion `isValidPzn`.
  - Verhindert negative Bestände, Packungsgrößen und Warnschwellen.
- **Stimmung (mood) & RLS-Fragebögen (rlsSurveys)**:
  - Validiert Wertebereiche (Mood 1-5, Fragebogen-Scores 0-40).
- **Notfalldaten (sosData)**:
  - Prueft die Struktur des Notfallprofils.

### Atomarer Import & Rollback-Schutz

- **Sicherheits-Gatekeeper**: In `ExportTab.tsx` fuehrt die Methode `handleFileDropRestore` nun unmittelbar nach dem JSON-Parsing die Validierung `validateBackupSchema` aus.
- **Rollback-Verhalten**: Bei jeglichem Validierungsfehler (z. B. ein negatives Medikamentenlager oder eine inkompatible Version) wird der Import abgebrochen. Es wird keine Speicher-Synchronisation ausgeloest. Der aktive lokale Datenbestand bleibt vollkommen unberührt (100% Rollback-Sicherheit).
- **Fehlermeldungen**: Dem Nutzer wird der genaue Grund (z. B. *“Import fehlgeschlagen: 2026-07-09: Schlafstunden müssen eine Zahl zwischen 0 und 24 sein.”*) als roter Toast angezeigt. Alle weiteren Fehler werden detailliert in der Entwicklerkonsole protokolliert.

### Unit Tests & Absicherung

- **`src/utils.test.ts`**: Ein neuer Testfall `validateBackupSchema correctly validates or rejects backup files` deckt:
  - Erfolgreiche Validierung gueltiger Backups.
  - Abweisung inkompatibler Versionen.
  - Abweisung fehlerhafter Tagebucheintraege (z. B. zu hohe Schlafstunden).
  - Abweisung ungültiger Datumsschluessel.
  - Abweisung ungültiger Medikamenteneintraege (z. B. negativer Bestand).

## AP-08 Abnahme

Erfuellt:

- Backups tragen eine Versionierung, die vor dem Import validiert wird.
- Vollstaendige Typ- und Wertebereichs-Plausibilisierung aller Datenfelder ist aktiv.
- Atomarer Import schützt vor Teil-Imports und Inkonsistenzen bei fehlerhaften Dateien.
- Alle Unit-Tests laufen fehlerfrei durch (`pass 7/7`).
- Projekt-Build und Linter laufen fehlerfrei.
