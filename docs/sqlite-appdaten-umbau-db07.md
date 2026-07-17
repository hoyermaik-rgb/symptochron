# DB-07 – Zentrale verschlüsselte App-Daten in SQLite

**Datum:** 10.07.2026  
**Status:** abgeschlossen und qualifiziert getestet

## Ziel

Die bisher ausschließlich im Browser-SecureStore gespeicherten App-Daten erhalten eine zentrale, produktive Ablage in derselben SQLite-Datei `data/symptochron.db`, in der bereits die Medikamentendaten liegen. Gesundheitsdaten werden weiterhin ausschließlich clientseitig mit AES-256-GCM verschlüsselt. Der Server erhält weder PIN noch Klartext.

## Architekturentscheidung

- `symptochron.db` bleibt die einzige produktive SQLite-Datenbank.
- Die neue Tabelle `secure_app_records` speichert nur Datensatzschlüssel, Verschlüsselungsversion, IV, Ciphertext, Länge und Zeitstempel.
- IndexedDB bleibt vorläufig als **verschlüsselter Offline-Cache**, nicht als fachliche Hauptdatenbank.
- Vorhandene Browserdaten werden beim ersten erfolgreichen Laden bestmöglich in SQLite übernommen.
- Bei fehlender Serververbindung arbeitet die App weiter mit dem verschlüsselten Cache und synchronisiert beim nächsten Zugriff erneut.

## Neue und geänderte Dateien

### Neu

- `server/database/migrations/003_secure_app_records.sql`
- `server/database/repositories/secureAppRecordRepository.ts`
- `server/database/secureAppRecordDatabase.test.ts`
- `docs/sqlite-appdaten-umbau-db07.md`

### Geändert

- `server/database/migrations.ts`
- `server.ts`
- `src/db/secureStore.ts`
- `server/database/medicationDatabase.test.ts`
- `docs/roadmap-progress.md`

## Datenbankschema

### `secure_app_records`

Speichert ausschließlich verschlüsselte Nutzdaten:

- `record_key`
- `encryption_version`
- `iv_base64`
- `ciphertext_base64`
- `content_length`
- `created_at`
- `updated_at`

### `app_data_audit_log`

Dokumentiert ausschließlich technische Änderungen:

- `record_key`
- `action`: `created`, `updated`, `deleted`
- `occurred_at`

Es werden keine medizinischen Inhalte in das Audit-Protokoll geschrieben.

## API

- `GET /api/secure-records/:recordKey`
- `PUT /api/secure-records/:recordKey`
- `DELETE /api/secure-records/:recordKey`

Die API prüft:

- zulässige Datensatzschlüssel,
- korrektes Base64,
- exakt 12 Byte langen AES-GCM-IV,
- zulässige Verschlüsselungsversion,
- maximale Ciphertext-Größe von 10 MiB.

## Migrationsverhalten

1. Die App versucht, einen verschlüsselten Datensatz aus SQLite zu laden.
2. Ist dort kein Datensatz vorhanden oder der Server offline, wird der verschlüsselte IndexedDB-Cache verwendet.
3. Ein vorhandener Cache-Datensatz wird bestmöglich in SQLite hochgeladen.
4. Neue Schreibvorgänge aktualisieren Cache und SQLite.
5. Die PIN und der Schlüssel verlassen den Browser nicht.

## Qualifizierte Tests

### Automatisierte Tests

- 4 Testdateien bestanden
- 16 Tests bestanden
- Speicherung ausschließlich als Ciphertext geprüft
- atomisches Upsert geprüft
- Audit-Protokollierung geprüft
- Löschen geprüft
- Validierung von Schlüssel, IV und Größenlimit geprüft
- bestehende SecureStore-Verschlüsselung und PIN-Wechsel geprüft
- Medikamenten- und Fremdschlüsseltests weiterhin grün

### Statische Prüfung

- `npm run lint`: bestanden

### Produktions-Build

- `npm run build`: bestanden
- PWA-Service-Worker erzeugt
- Server-Bundle erzeugt

### API-Smoke-Test

Mit einer frischen temporären SQLite-Datei wurden erfolgreich durchgeführt:

1. Serverstart und Migrationen 1–3
2. Medikamentenimport mit 24.267 aktiven Datensätzen
3. verschlüsselten Datensatz per PUT speichern
4. denselben Ciphertext per GET laden
5. Datensatz per DELETE löschen
6. erwarteter HTTP-Status `204`

## Sicherheitsgrenzen

- Die SQLite-Datei enthält weiterhin verschlüsselte Gesundheitsdaten, sollte aber trotzdem durch Betriebssystemrechte und Backups geschützt werden.
- Der Offline-Cache wird in einem späteren Block um eine belastbare Synchronisationswarteschlange und Konfliktbehandlung ergänzt.
- Mehrgeräte-Synchronisation ist nicht Bestandteil dieses Blocks.

## Ergebnis

Die App besitzt nun erstmals eine zentrale, datenschutzgerechte Ablage für Tagebuch, Stimmung, Blutdruck, Termine, Einstellungen und weitere SecureStore-Schlüssel innerhalb derselben `symptochron.db`. Die Verschlüsselung bleibt vollständig auf dem Endgerät.
