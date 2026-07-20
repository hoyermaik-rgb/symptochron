# SC-DB-08.3.4 - Kontrollierter Snapshot-Restore und Rollback-Assistent

Datum: 2026-07-18

Status: abgeschlossen

## Ziel

SC-DB-08.3.4 ergaenzt den privaten Importpfad um einen manuell ausloesbaren, kontrollierten Snapshot-Restore mit Sicherheits-Snapshot, anschliessender Verifikation und automatischem Rueckfall.

## Ausgangslage

- SC-DB-08.3.1 liefert Analyse und Dry-Run.
- SC-DB-08.3.2 liefert Admin-Sitzung, HttpOnly-Cookie, CSRF, Import-Sitzung, Snapshot vor Apply und idempotentes Verify.
- SC-DB-08.3.3 liefert revisionssichere Importhistorie in SQLite.
- Der produktive Datenspeicher bleibt eine einzige SQLite-Datei.

## Architektur

Der Restore ist als eigener administrativer Pfad umgesetzt:

- Restore-Analyse
- Restore-Bestaetigung
- Restore-Ausfuehrung
- Restore-Historie
- Restore-Bericht

Die Implementierung nutzt die bestehende Importhistorie als Snapshot-Quelle und fuehrt eine eigene Restore-Historie in `symptochron.db`.

## Snapshot-Format

- Snapshots sind vollstaendige SQLite-Dateien.
- Referenziert wird nur die technische `snapshotReference` aus der Importhistorie.
- Direkte Pfade aus dem Frontend werden nicht akzeptiert.
- Die Aufloesung erfolgt ausschliesslich serverseitig innerhalb von `SYMPTOCHRON_BACKUP_DIR`.

## Snapshot-Aufloesung

Die Aufloesung prueft:

- existierende Import-Historie
- vorhandene Snapshot-Referenz
- Pfad innerhalb von `SYMPTOCHRON_BACKUP_DIR`
- keine Path-Traversal-Pfade
- keine Symlink-Flucht
- regulare Datei
- begrenzte Dateigroesse
- SQLite-Header
- `PRAGMA integrity_check`
- `PRAGMA foreign_key_check`
- vorhandene Zieltabellen
- keine unbekannte zukuenftige Schema-Version

## Restore-Sitzung

Es gibt eine kurzlebige serverseitige Restore-Sitzung mit:

- Restore-ID
- Import-ID
- Snapshot-Referenz
- Ablaufzeit
- Bestaetigungsstatus
- Sicherheits-Snapshot-Referenz
- technischem Status

Die Sitzung ist an die Admin-Sitzung und den CSRF-Wert gebunden.

## Sicherheitsmodell

- Keine Klartext-Gesundheitsdaten im Bericht.
- Keine Tokens, Cookies oder CSRF-Werte in der Historie.
- Keine freien Pfade vom Client.
- Keine zweite Produktivdatenbank.
- Keine Tabellen-fuer-Tabellen-Wiederherstellung.

## CSRF-Modell

Schreibende Restore-Endpunkte sind CSRF-geschuetzt.
Read-only-Historie ist zustandslos lesbar, solange die Admin-Sitzung gueltig ist.

## Bestaetigungsmodell

Vor dem Restore ist eine separate Server-Bestaetigung erforderlich.

Die Bestaetigung ist gebunden an:

- Admin-Sitzung
- Restore-Sitzung
- Snapshot
- Ablaufzeit
- CSRF

## Locking

Ein gemeinsames Lock sichert produktive Datenbankoperationen fuer:

- Import-Apply
- Restore
- automatischen Rueckfall

Das Lock wird auf Serverseite freigegeben, auch bei Fehlern.

Bekannte Grenze:

- Andere Schreibpfade der Anwendung verwenden dieses Lock derzeit nicht.

## Sicherheits-Snapshot

Vor dem Restore wird der aktuelle produktive Datenbestand per `VACUUM INTO` gesichert und danach validiert.

Dieser Sicherheits-Snapshot dient als Rueckfallbasis.

## Atomarer Restore

Der Restore ersetzt die produktive SQLite-Datei ueber:

1. Validierung der Snapshot-Datei
2. Sicherheits-Snapshot
3. `closeDatabase()`
4. atomaren Dateiaustausch
5. erneutes Oeffnen der Produktivdatenbank
6. automatische Verifikation

## Verify

Das Verify prueft:

- Datenbank laesst sich oeffnen
- `PRAGMA integrity_check`
- `PRAGMA foreign_key_check`
- erwartete Tabellen
- `schema_migrations`
- zentrale Tabellen lesbar

## Automatischer Rueckfall

Falls Restore oder Verify fehlschlagen, wird der Sicherheits-Snapshot kontrolliert zurueckgespielt und erneut verifiziert.

## Statusmodell

Verwendete Statuswerte:

- `restore_created`
- `restore_analyzed`
- `restore_confirmed`
- `safety_snapshot_created`
- `restore_started`
- `restore_applied`
- `restore_verified`
- `restore_failed`
- `rollback_started`
- `rollback_applied`
- `rollback_verified`
- `rollback_failed`
- `expired`

## Zustandsuebergaenge

- Analyse erzeugt einen Restore-Datensatz.
- Bestaetigung setzt den Status auf `restore_confirmed`.
- Restore setzt `restore_started`.
- Sicherheits-Snapshot setzt `safety_snapshot_created`.
- Erfolg endet in `restore_verified`.
- Fehler mit Rueckfall enden in `rollback_verified` oder `rollback_failed`.

## Persistenzmodell

Neue Tabelle:

- `private_backup_restore_history`

Persistiert werden:

- Restore-ID
- Import-ID
- Snapshot-Referenz
- Sicherheits-Snapshot-Referenz
- Zeitstempel
- Restore-Status
- Verify-Status
- Rollback-Status
- technische Zusammenfassungen
- datensparsame Fehlerkategorie
- datensparame Kurzmeldung

## API-Endpunkte

- `POST /api/admin/backup-import/restore/analyze`
- `POST /api/admin/backup-import/restore/confirm`
- `POST /api/admin/backup-import/restore/apply`
- `GET /api/admin/backup-import/restore/history`
- `GET /api/admin/backup-import/restore/:restoreId`

## UI-Ablauf

Die bestehende private Import-UI wurde erweitert um:

- Snapshot-Pruefung
- Restore-Bestaetigung
- Restore-Start
- Restore-Status
- Verify-Status
- Rollback-Status
- technischen Abschlussbericht

## Datenschutz und Datenminimierung

Es werden nur technische Metadaten gespeichert:

- keine gesamten Backup-Inhalte
- keine Klartext-Gesundheitsdaten
- keine Geheimnisse
- keine absoluten Benutzerpfade

## Fehlerbehandlung

Fehler werden datensparsam protokolliert und mit Kategorien wie `restore_error` oder `rollback_error` versehen.

## Retry und Idempotenz

- Wiederholtes Verify veraendert den Zustand nicht.
- Wiederholtes Restore derselben Sitzung fuehrt nicht zu parallelen Operationen.
- Doppelte Restore-Versuche werden ueber den gleichen Datensatz protokolliert.

## Tests

Abgedeckt wurden:

- gueltiger Restore
- unbekannte und manipulierbare Snapshots
- zukuenftige Schema-Version
- Importhistorie-Bindung
- Sicherheits-Snapshot-Verhalten
- Restore-Historie
- UI-Integration

## Verifikation

Ausgefuehrt und erfolgreich:

- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`

## Bekannte Grenzen

- Das zentrale Lock deckt bisher nur Import-Apply, Restore und Rueckfall ab.
- Andere Schreibpfade nutzen dieses Lock noch nicht.

## Restrisiken

- Ein Restore ersetzt bewusst den produktiven Datenstand.
- Alte History-Eintraege koennen durch den Snapshot-Austausch temporaer verschwinden und werden danach wieder hergestellt.

## Bewusst nicht umgesetzte Punkte

- keine automatische Snapshot-Loeschung
- keine Cloud-Backups
- kein manueller Dateibrowser
- kein Snapshot-Download
- keine zeitgesteuerten Restores
- kein Restore ohne Administratorbestaetigung
- kein kosmetischer Komplettumbau der UI
