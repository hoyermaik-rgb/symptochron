# PIN-Verifikations-Fix & Datenrettung – 2026-07-22

Dieses Dokument fasst alle Änderungen und Fehlerbehebungen vom 22.07.2026 zusammen. Es ergänzt `STATUS.md` (Stand 20.07.) und `docs/secure-data-reset-and-json-recovery-2026-07-18.md` (Vorfall vom 18.07.), auf dessen offenem Punkt ("PIN-Entschlüsselbarkeit nach dem Recovery-Import nicht aktiv verifiziert") dieser Vorfall direkt aufbaut.

## Ausgangslage

Beim Entsperren der App mit korrekter PIN erschienen in der Konsole:

```
Failed to decrypt data for key: diary OperationError
Failed to decrypt SecureStore data for key: diary
PIN verification failed
```

Betroffen war das produktive Deployment unter `https://symptochron.family-hoyer.de` (Docker Compose, Host `192.168.178.2`, Container `symptochron-symptochron-app-1`, Bind-Mount `/home/maik/symptochron`).

## Fehler 1: PIN-Prüfung hing an der Entschlüsselbarkeit einzelner Datensätze

**Ursache:** Der Lock-Screen (`verifyPin`-Callback in `src/App.tsx`) lud beim Entsperren alle Datenschlüssel (`diary`, `meds`, `mood`, `surveys`, `appts`, `sos`, `bp`, `prefs`) mit `throwOnDecryptError: true`. Scheiterte auch nur *ein* Schlüssel (z. B. ein durch den Vorfall vom 18.07. verwaister `diary`-Datensatz), wurde das fälschlich als „PIN falsch" gewertet – der eigentliche `__pin_verifier`-Check lief nie.

**Fix (Commit `7ff95a2`, "Decouple PIN verification from per-record decrypt success"):**
- `verifyPin` prüft die PIN jetzt ausschließlich über `secureStore.verifyPin()` (den zentralen `__pin_verifier`-Datensatz).
- Das Nachladen der übrigen Daten läuft danach nicht-strikt (`throwOnDecryptError: false`) – ein einzelner nicht entschlüsselbarer Datensatz blockiert den Login nicht mehr.
- `changePin` bricht dagegen jetzt bewusst laut ab (`throwOnDecryptError: true`), statt einen nicht entschlüsselbaren Datensatz beim PIN-Wechsel still zu verwerfen.
- Test ergänzt: `SecureStore changePin aborts before key rotation when a known record cannot be decrypted` (`src/secureStore.test.ts`).
- Deployed über `docker compose up -d --force-recreate` (neuer Client-Bundle-Hash: `index-C6sHs5Eq.js`, zuvor `index-BhQFqCYZ.js`).

**Ergebnis:** Login funktioniert seither zuverlässig mit korrekter PIN, unabhängig vom Zustand einzelner Datensätze.

## Fehler 2: Reale Nutzdaten waren nach dem Login leer

Nach dem Login-Fix zeigte die App Diary, Medikamente, Stimmung, RLS-Fragebögen und Blutdruck leer. Nur Name und Geburtsdatum im SOS-Profil waren (echt, kein Demo-Platzhalter) vorhanden.

**Ursache:** Wie in `STATUS.md` bereits vorhergesagt, war der Recovery-Import vom 18.07. nie mit der echten PIN verifiziert worden. Ein Blick in `secure_app_records` zeigte, dass `diary`, `meds`, `mood`, `surveys` und `bp` alle innerhalb weniger Sekunden am 18.07. um 21:06 Uhr geschrieben wurden – offenbar mit einem nicht mehr zum aktuellen Salt (`app_crypto_metadata`) passenden Schlüssel. `__pin_verifier` und `sos` stammten dagegen aus einem früheren, noch korrekten Schreibvorgang (18.07., 11:11 Uhr) und funktionierten weiterhin einwandfrei.

**Vorhandenes, aber ungenutztes Werkzeug:** `scripts/reencrypt-recovery-backup.ts`, das ein validiertes JSON-Backup (`backups/recovery-2026-07-18/SymptoChron_Backup_2026-07-17.json`, SHA-256 geprüft: 74 Diary-Einträge, 15 Medikamente, 7 Stimmungseinträge, 0 RLS-Erhebungen) mit dem aktuellen PIN + zentralem Salt neu verschlüsselt.

**Zwei Sicherheitslücken im Skript vor dem Einsatz behoben (Commit `6d1695d`, "Scope recovery re-encrypt to genuinely orphaned keys only"):**
1. `DELETE FROM secure_app_records;` war ungescoped und hätte auch `__pin_verifier` gelöscht (nie wieder angelegt) → Login wäre erneut kaputt gegangen. Jetzt auf die tatsächlich betroffenen Schlüssel beschränkt.
2. Das Skript hätte `sos` blind aus dem Backup überschrieben – das Backup enthält dort aber nur leere Platzhalter, während der aktuell gespeicherte `sos`-Datensatz bereits korrekt echten Namen + Geburtsdatum enthielt. `sos` wurde aus der Wiederherstellung ausgenommen, um diese intakten Daten nicht zu zerstören.

**Ablauf der Wiederherstellung:**
1. Dry-Run zur Validierung (kein PIN nötig): Backup-Hash und Mengen bestätigt.
2. Container kurz gestoppt, um parallele Schreibzugriffe auf die SQLite-Datei zu vermeiden.
3. `--apply` mit echter PIN ausgeführt (PIN als Umgebungsvariable, nie im Chat oder in der Shell-Historie sichtbar). Das Skript legt vorher automatisch einen DB-Snapshot an, schreibt `diary/meds/mood/surveys/bp` in einer Transaktion neu und verifiziert die Entschlüsselung jedes Datensatzes sofort danach.
4. Container neu gestartet, Ergebnis verifiziert: `diary` (5.272 → 22.018 Byte), `meds` (757 → 4.821 Byte), `mood`, `surveys`, `bp` neu verschlüsselt und mit neuem Zeitstempel; `sos`, `prefs`, `__pin_verifier` unverändert.

**Ergebnis:** Diary (74 Einträge), Medikamente (15) und Stimmung (7) wieder sichtbar; Cross-Device-Sync (Login auf zweitem Gerät, sofortige Sichtbarkeit nach Refresh) funktioniert.

## Fehler 3: `prefs` war ebenfalls verwaist

Trotz eines neueren Zeitstempels (21.07.) schlug die Entschlüsselung von `prefs` beim Login ebenfalls mit `OperationError` fehl – vermutlich aus derselben fehlerhaften Schreibphase, nur zu einem späteren Zeitpunkt. Da das Backup vom 17.07. ohnehin keine echten Einstellungsdaten enthält, gab es hier nichts sinnvoll wiederherzustellen.

**Fix:** Die verwaiste `prefs`-Zeile wurde aus `secure_app_records` gelöscht (mit Audit-Log-Eintrag). Die App fällt seither auf ihre eingebauten Standard-Einstellungen zurück; beim nächsten Ändern einer Einstellung wird automatisch wieder ein korrekt verschlüsselter `prefs`-Datensatz gespeichert – bereits erfolgreich getestet (neuer Datensatz von 08:30:49 Uhr, 243 Byte).

## Als unkritisch eingeordnete Meldungen (keine Änderung nötig)

- `GET /api/secure-records/appts 404` – es existieren schlicht noch keine gespeicherten Termine; ein 404 ist hier die normale „nicht vorhanden"-Antwort.
- `POST /api/daily-insight 500` mit „This model is currently experiencing high demand" – transiente Überlastung der Google-Gemini-API, unabhängig von SymptoChron.
- Ein einmaliges `net::ERR_CONNECTION_CLOSED` beim Abruf von `/api/crypto-metadata` – kurzer Netzwerk-Aussetzer; die App fing das erwartungsgemäß über ihren lokalen Salt-Cache-Fallback ab, ohne den Login zu blockieren. Endpoint danach wieder mit HTTP 200 erreichbar.

## Nebenbei entdeckt, bewusst nicht in diesem Zug behoben

- **Migrationsdatei-Mismatch:** `server/database/migrations.ts` referenziert für Schema-Version 4 weiterhin die leere Platzhalter-Datei `004_central_crypto_metadata.sql` statt der tatsächlich Tabellen-erzeugenden `004_app_crypto_metadata.sql`. Auf der Produktions-DB existiert `app_crypto_metadata` bereits (vermutlich manuell/über ein früheres Recovery-Skript angelegt), aber eine **frische** Installation würde die Tabelle über `runMigrations()` nie erzeugen. Sollte bei Gelegenheit als eigene Migration (z. B. Version 8) nachgezogen werden.
- **Divergierende Git-Historie:** Der lokale Checkout (`~/Development/SymptoChron` auf dem Entwicklungsrechner) und der Produktions-Checkout auf dem Server haben unabhängige Commit-Historien (der Server hat einen eigenen `rescue/local-repaired-20260721`-Branch von einem früheren Git-Vorfall). Alle heutigen Commits (`7ff95a2`, `6d1695d`) liegen ausschließlich im Server-Repository, nicht auf GitHub. Eine Zusammenführung wurde bewusst nicht angegangen.
- **GitHub-Repo umbenannt:** `hoyermaik-rgb/schmerztagebuch` → `hoyermaik-rgb/symptochron`. Push funktioniert weiterhin über den Redirect; Remote-URL kann bei Gelegenheit aktualisiert werden.

## Betroffene/geänderte Dateien (Server-Repository, `/home/maik/symptochron`)

| Datei | Änderung |
| --- | --- |
| `src/App.tsx` | `verifyPin`-Callback entkoppelt PIN-Check von Datensatz-Entschlüsselung |
| `src/db/secureStore.ts` | `changePin` bricht bei Decrypt-Fehlern jetzt laut ab |
| `src/secureStore.test.ts` | neuer Test für `changePin`-Abbruchverhalten |
| `scripts/reencrypt-recovery-backup.ts` | `DATA_KEYS` auf `diary/meds/mood/surveys/bp` beschränkt, `DELETE` gescoped (schützt `__pin_verifier` und `sos`) |
| `docs/secure-data-reset-and-json-recovery-2026-07-18.md` | Hinweis ergänzt: korrekte PIN darf durch nicht entschlüsselbare Altdaten nicht als falsch markiert werden |
| `package.json` | Skript-Kommando `recovery:reencrypt-backup` ergänzt |

Direkte, nicht committete Datenbank-Eingriffe (mit Nutzer-Freigabe durchgeführt): Neuverschlüsselung von `diary/meds/mood/surveys/bp` via Recovery-Skript; Löschung des verwaisten `prefs`-Datensatzes.
