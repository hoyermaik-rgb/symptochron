# SC-DB-08.3.1 - Privater Backup-Import-Assistent

Datum: 2026-07-18

Status: implementiert als private Analyse- und Dry-Run-Oberflaeche, kein Import ausgefuehrt

## Zweck

SC-DB-08.3.1 stellt einen privaten administrativen Assistenten fuer die Dateianalyse und den Dry-Run des vorhandenen Handy-Backups bereit.

Der Assistent ist nur aktiv, wenn `VITE_ENABLE_PRIVATE_BACKUP_IMPORT=true` gesetzt ist.

## Sicherheitsprinzipien

- Keine lokale Pfadangabe aus dem Browser.
- Upload nur als `.json` per `multipart/form-data`.
- Maximal 10 MiB Uploadgroesse.
- Kein dauerhaftes Speichern der hochgeladenen Datei.
- Kein gesundheitsbezogener Klartext in UI, Logs oder Antwortobjekten.
- Adminzugang nur ueber expliziten Token-Header auf dem Server.

## Backend-Endpunkte

- `POST /api/admin/backup-import/analyze`
- `POST /api/admin/backup-import/dry-run`

Die Endpunkte verwenden die bestehende Import- und Analyse-Logik aus `server/database/backupImporter.ts`.

## UI-Felder

Der Assistent zeigt ausschliesslich technische Metadaten:

- Dateiname
- Dateigroesse
- SHA-256
- Backup-Version
- Zeitstempel
- Quellmengen
- erwartete Zieldaten
- Warnungen
- Blocker

## Ergebnisobjekt

Die Analyse- und Dry-Run-Antwort enthaelt:

- `importId`
- `sourceHash`
- `sourceBackupVersion`
- `sourceTimestamp`
- `status`
- `sourceCounts`
- `expectedTargetCounts`
- `warnings`
- `blockers`
- `plannedTables`
- `schemaVersion`
- `importAllowed`

## Offene Punkte fuer SC-DB-08.3.2

- Vollstaendiger Import-Dialog mit Apply/Verify/Rollback
- serverseitige Session-/Token-Verwaltung fuer den Adminzugang
- bessere Validierung von strukturellen Abweichungen im Upload
- optionale Integration in einen spaeteren kontrollierten Importworkflow

## Hinweis

Noch kein Produktivimport wurde ausgefuehrt.
