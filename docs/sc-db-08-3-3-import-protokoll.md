# SC-DB-08.3.3 - Revisionssicheres Importprotokoll und Importhistorie

Datum: 2026-07-18

Status: in Arbeit

## Ziel

SC-DB-08.3.3 ergaenzt den privaten Backup-Import um eine revisionssichere Importhistorie innerhalb von `symptochron.db`.

Jeder private Import soll nachvollziehbar protokolliert werden, ohne Gesundheitsinhalte oder Geheimnisse offenzulegen.

## Ausgangslage

- SC-DB-08.3.1 stellt private Analyse und Dry-Run bereit.
- SC-DB-08.3.2 fuehrt Admin-Sitzung, Snapshot, Apply und Verify kontrolliert aus.
- Die produktive SQLite-Datenbank bleibt die einzige dauerhafte Datenbasis.
- Import-Sitzung und technischer Snapshot existieren bereits serverseitig.

## Architektur

Die neue Historie wird als eine weitere Tabelle in `symptochron.db` gespeichert.

Geplant ist ein zentraler Datensatz pro Import mit:

- `import_id`
- `created_at`
- `updated_at`
- `status`
- `last_completed_phase`
- `source_filename`
- `source_size_bytes`
- `source_backup_version`
- `source_schema_version`
- `analysis_summary_json`
- `dry_run_summary_json`
- `apply_summary_json`
- `verify_summary_json`
- `snapshot_reference`
- `error_category`
- `error_message`

## Sicherheitsmodell

- Keine Backup-Inhalte im Klartext.
- Keine Admin-Tokens, Cookies oder CSRF-Werte in Protokollen.
- Nur technische Metadaten und zusammengefasste Statusinformationen.
- Keine separate Audit-Datenbank.
- Nur schreibgeschuetzte Lesepfade fuer Historie und Bericht, zustandsveraendernde Pfade bleiben CSRF-geschuetzt.

## Ablauf

1. Analyse schreibt einen Historieneintrag mit Metadaten.
2. Dry-Run aktualisiert den selben Datensatz mit zusammengefasstem Pruefergebnis.
3. Apply markiert `apply_started`, erzeugt den Snapshot und aktualisiert bei Erfolg oder Fehler den Datensatz.
4. Verify bestaetigt den Import und schreibt nur technische Verifikationsdaten.
5. Die private UI zeigt eine kompakte Historie und den technischen Abschlussbericht.

## Betroffene Dateien

- `server/database/migrations/006_private_backup_import_history.sql`
- `server/database/repositories/privateBackupImportRepository.ts`
- `server/privateBackupImportHttp.ts`
- `src/components/PrivateBackupImportPanel.tsx`
- `server/privateBackupImportHttp.test.ts`
- `src/components/PrivateBackupImportPanel.test.ts`
- `docs/roadmap-progress.md`

## API-Endpunkte

- `GET /api/admin/backup-import/history`
- `GET /api/admin/backup-import/history/:importId`

## Fehlerbehandlung

- Fehler werden mit technischer Kategorie und datensparsamem Kurztext protokolliert.
- Wiederholte Statusabfragen aendern den Zustand nicht.
- Mehrfaches Verify erzeugt keine doppelten Historieneintraege.
- Abgelaufene Sessions werden als `expired` markiert.

## Tests

- Migration auf leerer Testdatenbank
- Historieneintrag nach Analyse
- Statuswechsel ueber Dry-Run, Apply und Verify
- idempotentes Verify
- Historienliste und Einzelbericht
- keine Geheimnisse in Antwortdaten

## Verifikation

Noch offen bis zum Abschluss von SC-DB-08.3.3:

- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`

## Bekannte Grenzen

- Es werden bewusst nur technische Metadaten protokolliert.
- Keine frei exportierbare Datei-Historie.
- Keine separate Restore-/Rollback-Historie ausser dem Snapshot-Verweis.

## Bewusst nicht umgesetzt

- Keine zweite Datenbank.
- Kein externer Audit-Dienst.
- Keine Volltextprotokollierung importierter Gesundheitsdaten.

## Abgrenzung zum naechsten Schritt

SC-DB-08.3.3 endet bei revisionssicherer Importhistorie und technischem Abschlussbericht.
Weitere Importfunktionen, z. B. erweiterte Restore- oder Archivierungslogik, gehoeren nicht in diesen Schritt.
