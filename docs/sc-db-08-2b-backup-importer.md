# SC-DB-08.2B - Transaktionaler Backup-Importer

Datum: 2026-07-18

Status: implementiert als administrative CLI, kein Produktivimport ausgefuehrt

## Zweck

SC-DB-08.2B ergaenzt das verbindliche SQLite-Zielschema um einen kontrollierten Importpfad fuer das vorhandene Handy-Backup.

Der Importer arbeitet ausschliesslich auf explizit angegebenen Pfaden und faellt nicht automatisch auf `data/symptochron.db` zurueck.

## CLI-Nutzung

```bash
npm run import:backup -- \
  --mode dry-run \
  --backup /pfad/zur/handy-backup.json \
  --database /pfad/zur/zieldb.db
```

Vor einem erstmaligen Import kann die Zieldatenbank explizit mit dem administrativen Migrationsbefehl auf Schema-Version 5 angehoben werden:

```bash
npm run db:migrate -- --database /pfad/zur/zieldb.db
```

Pflichtargumente:

- `--mode`
- `--backup`
- `--database`

Weitere Argumente:

- `--snapshot`
- `--import-id`
- `--allow-empty`
- `--report`

Unterstuetzte Modi:

- `dry-run`
- `apply`
- `verify`
- `rollback`

## Sicherheitsregeln

- Ohne expliziten `--database`-Pfad startet der Import nicht.
- Produktivpfade werden nicht stillschweigend angenommen.
- `apply` benoetigt einen gueltigen Snapshot-Pfad.
- Kein interaktives Ueberschreiben.
- Keine Deletes im Importpfad.
- Keine Klartext-Gesundheitsinhalte in Reports oder Logs.
- `db:migrate` arbeitet nur auf dem explizit uebergebenen Pfad und verwendet niemals den impliziten Standardpfad.
- Die Importtabellen liegen in Schema-Version 5; Version 4 ist historisch der zentralen Crypto-Metadaten vorbehalten.

## Dry-Run

Dry-Run validiert:

- JSON-Struktur
- Backup-Version
- Pflichtfelder
- Datumsformate
- Medikamenten-IDs
- Referenzen aus `diary.medsTaken`
- SOS-Struktur
- RLS-Struktur
- unbekannte Felder als Warnungen
- Mood-Skala 0..5 fuer `stimmung`, `energie`, `antrieb`, `angst`, `reizbarkeit`, `konzentration`, `hoffnungslosigkeit`

Dry-Run schreibt nichts in die Zieldatenbank.

## Apply

Apply wird nur ausgefuehrt, wenn:

- das Backup valide ist
- die Datenbank existiert
- die Schema-Version mindestens 5 ist
- ein Snapshot-Pfad angegeben ist
- der Snapshot existiert und groesser als 0 Byte ist
- der Snapshot `PRAGMA integrity_check` besteht
- der `source_hash` noch nicht angewendet wurde
- keine Blocker vorhanden sind

Apply laeuft in genau einer SQLite-Transaktion und schreibt zuerst das Importmanifest.

## Verify

Verify prueft:

- Importmanifest
- erwartete Counts
- importierte IDs
- `PRAGMA foreign_key_check`
- `PRAGMA integrity_check`
- Statuswechsel erst nach erfolgreicher Pruefung

## Rollback

Rollback:

- verlangt explizit Zielpfad und Snapshotpfad
- sichert den aktuellen Zustand vor dem Restore
- restauriert den Snapshot statt heuristisch einzelne Tabellen zurueckzubauen
- prueft die restaurierte Datei mit `integrity_check`

## Importreport

Optional kann ein JSON-Report geschrieben werden.

Enthaltene Felder:

- `importId`
- `sourceHash`
- `sourceBackupVersion`
- `sourceTimestamp`
- `mode`
- `status`
- `counts`
- `importedIds`
- `matchedIds`
- `warnings`
- `errors`
- `startedAt`
- `completedAt`
- `databasePath`
- `snapshotPath`

## Bekanntes

- Der Importer ist administrativ und fuer kontrollierte Erstuebernahmen gedacht.
- Noch kein Produktivimport wurde ausgefuehrt.
- Der Importpfad bleibt absichtlich getrennt von der Produktiv-App-Runtime.
