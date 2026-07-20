# SC-DB-08.1 - Import-Mapping fuer Handy-Backup

Datum: 2026-07-18

Analysegrundlage:

- Backup: `/home/maikhoyer/Development/SymptoChron-Import/handy-backup.json`
- Zielcode: aktuelle SQLite-Architektur im Workspace `SymptoChron`
- Produktivdatenbank wurde **nicht** geoeffnet
- Diese Dokumentation ist rein analytisch und veraendert keine Daten

## Kurzfazit

Das Handy-Backup ist ein gueltiges JSON-Objekt mit Klartext-Gesundheitsdaten. Es ist **nicht verschluesselt** und enthaelt keine Ciphertexte, IVs, Salts oder PIN-Verifier. Die Daten sind in vier Nutzdatenbereichen organisiert:

- `diary`
- `mood`
- `meds`
- `sosData`

Zusatz: `rlsSurveys` ist vorhanden, aber leer.

Die aktuelle SQLite-Architektur reicht fuer Medikamente und verschluesselte App-Records teilweise aus, aber nicht fuer ein sauberes, strukturiertes Vollimport-Zielschema fuer Tagebuch, Stimmung, RLS-Frageboegen, Blutdruck, Termine und SOS-Daten. Dafuer sind zusaetzliche Tabellen sinnvoll und fuer den Importplan notwendig.

## Vorpruefung Backup

### Dateieigenschaften

- Dateigroesse: `33726 bytes`
- JSON gueltig: ja
- Backup-Version: `1.0.0`
- Schema-Version: nicht vorhanden
- Zeitstempel: `2026-06-21T08:50:00.000Z`
- Backup-Hash: `fb106e339e575db38914f869cbda09a8ce96cb5e9c447b45f90f793c5eb01229`

### Top-Level-Felder

- `version`
- `timestamp`
- `diary`
- `meds`
- `mood`
- `rlsSurveys`
- `sosData`

### Pflichtfelder aus Importperspektive

Fuer einen fachlich brauchbaren Import sind mindestens erforderlich:

- `version`
- `timestamp`
- `diary`
- `meds`
- `mood`
- `sosData`

`rlsSurveys` ist im Backup vorhanden, aber in diesem Bestand leer.

### Unbekannte oder zusatzliche Felder

Top-Level aus Sicht des Zielschemas:

- `rlsSurveys`
- `sosData`

Innerhalb der Bereiche:

- `diary`: `notes`, `sleepHours`, `sleepQuality`, `factors`, `medsTaken`, `painAreas`, `pressure`, `weather`, `updated`
- `mood`: `stimmung`, `energie`, `antrieb`, `angst`, `reizbarkeit`, `konzentration`, `hoffnungslosigkeit`, `symptoms`, `activities`, `updated`
- `meds`: `id`, `name`, `dose`, `form`, `schedule`, `time`, `thresholdDays`, `source`, `active`, `createdAt`, `updatedAt`, plus optional `note`, `pzn`, `stock`
- `sosData`: `patientName`, `dob`, `bloodType`, `allergies`, `diagnoses`, `emergencyNotes`, `iceContacts`, `personal`, `medical`

## Datenbereiche im Backup

### `diary`

- Typ: Objekt mit Datumsschluesseln
- Anzahl Datensaetze: `52`
- Schluesselbereich: `2026-04-30` bis `2026-06-20`
- Eintragszeitstempel: `updated` pro Tag vorhanden
- Leere Bereiche: nein

Inhaltlich:

- Schmerzwerte morgens, mittags, abends, nachts
- RLS-Werte morgens, mittags, abends, nachts
- Notizen
- Schlafstunden und Schlafqualitaet
- Faktoren wie Stress oder schlechtes Schlafen
- `medsTaken` als Liste von Medikamenten-/Slot-IDs
- punktuell `painAreas`, `pressure`, `weather`

### `mood`

- Typ: Objekt mit Datumsschluesseln
- Anzahl Datensaetze: `6`
- Schluesselbereich: `2026-06-11` bis `2026-06-19`
- Eintragszeitstempel: `updated` pro Tag vorhanden
- Leere Bereiche: nein

Inhaltlich:

- historische Skala je Feld: `0..5`
- beobachtete Werte im Backup:
  - `stimmung`: `1..3`
  - `energie`: `1..3`
  - `antrieb`: `0..2`
  - `angst`: `1..5`
  - `reizbarkeit`: `0..5`
  - `konzentration`: `2..5`
  - `hoffnungslosigkeit`: `0..2`
- psychische Symptome als Bool-Map
- Aktivitäten als Bool-Map

### `meds`

- Typ: Array
- Anzahl Datensaetze: `15`
- IDs: alle vorhanden
- Dubletten: keine erkennbar
- Leere Bereiche: nein

Inhaltlich:

- interne ID
- Name
- Dosis
- Darreichungsform
- Wochen-/Tagesplan in `schedule`
- textuelle Zeitbeschreibung in `time`
- Warnschwelle `thresholdDays`
- Quelle `source`
- Aktiv-Flag `active`
- Zeitstempel `createdAt`, `updatedAt`
- teilweise `note`
- einmal `pzn`
- einmal `stock`

### `rlsSurveys`

- Typ: Objekt
- Anzahl Datensaetze: `0`
- Leerer Bereich: ja

### `sosData`

- Typ: Objekt
- Bedeutung: SOS-/Notfalldaten mit Person, medizinischem Profil und ICE-Kontakten

Unterfelder:

- `patientName`
- `dob`
- `bloodType`
- `allergies`
- `diagnoses`
- `emergencyNotes`
- `iceContacts`
- `personal`
- `medical`

Zusatzbeobachtung:

- `personal` und `medical` sind strukturierter als die Legacy-Top-Level-Felder und sollten bevorzugt als Zielstruktur verwendet werden.
- `iceContacts` enthaelt mindestens einen Notfallkontakt mit eigener ID.

## Verschluesselung

Eindeutig:

- Nutzdaten liegen im Klartext vor: ja
- Ciphertext vorhanden: nein
- IV vorhanden: nein
- Salt vorhanden: nein
- PIN-Verifier vorhanden: nein
- SecureStore-Records im Backup: nein
- Vollstaendig ohne IndexedDB rekonstruierbar: ja, soweit dieses JSON allein betrachtet wird

Folgerung:

- Das Backup ist ein Klartext-Export und nicht ein verschluesselter Transportcontainer.
- Beim Import in die produktive Architektur muss Schutz neu aufgebaut werden, falls Felder spaeter weiterhin verschluesselt gespeichert werden sollen.

## Zielschema aus Codeanalyse

### Bereits vorhandene Tabellen

#### `schema_migrations`

- Zweck: Versionsstand der Migrationen
- PK: `version`
- FK: keine
- Pflichtfelder: `version`, `name`, `applied_at`
- Zeitstempel: `applied_at`
- Unique: PK auf `version`
- Loeschverhalten: n/a
- Repository-Funktionen: keine dedizierte Repository-API, wird von `runMigrations()` verwendet

#### `medication_sources`

- Zweck: Importquellen fuer Medikamentenstammdaten
- PK: `id` INTEGER AUTOINCREMENT
- FK: keine
- Pflichtfelder: `source_key`, `source_name`
- Zeitstempel: `imported_at`
- Unique: `source_key`
- Loeschverhalten: wird in anderen Tabellen referenziert, daher faktisch restriktiv
- Repository-Funktionen: indirekt ueber `importMedicationJsonIfEmpty()`

#### `medication_products`

- Zweck: Medikamentenstammdaten / Referenzprodukte
- PK: `id` INTEGER AUTOINCREMENT
- FK: `source_id -> medication_sources.id ON DELETE RESTRICT`
- Pflichtfelder: `source_id`, `product_name`, `normalized_name`, `verification_status`, `is_active`
- Zeitstempel: `imported_at`
- Unique: `UNIQUE(source_id, source_record_id)`, partieller Unique-Index auf `pzn`
- Loeschverhalten: Referenzschluessel restriktiv
- Repository-Funktionen: `searchMedications()`, `getMedicationCount()`

#### `active_ingredients`

- Zweck: Wirkstoffstammdaten
- PK: `id` INTEGER AUTOINCREMENT
- FK: `source_id -> medication_sources.id ON DELETE SET NULL`
- Pflichtfelder: `canonical_name`, `normalized_name`
- Unique: `normalized_name`
- Loeschverhalten: Quelle auf `NULL`

#### `medication_product_ingredients`

- Zweck: Zuordnung Produkt <-> Wirkstoff
- PK: zusammengesetzt aus `medication_product_id`, `active_ingredient_id`
- FK:
  - `medication_product_id -> medication_products.id ON DELETE CASCADE`
  - `active_ingredient_id -> active_ingredients.id ON DELETE RESTRICT`
- Pflichtfelder: beide IDs
- Unique: PK
- Loeschverhalten: Produkt geloescht => Zuordnung weg

#### `medication_import_runs`

- Zweck: Protokoll der Medikamentenimporte
- PK: `id` INTEGER AUTOINCREMENT
- FK: `source_id -> medication_sources.id ON DELETE RESTRICT`
- Pflichtfelder: `source_id`, `status`
- Zeitstempel: `started_at`, `finished_at`
- Unique: keine zusaetzliche
- Loeschverhalten: restriktiv

#### `user_medications`

- Zweck: persoenliche Medikamenteneintraege
- PK: `id` TEXT
- FK: `medication_product_id -> medication_products.id ON DELETE SET NULL`
- Pflichtfelder: `id`, `created_at`, `updated_at`
- Zeitstempel: `created_at`, `updated_at`
- Unique: PK
- Loeschverhalten: Produktloeschung setzt FK auf `NULL`
- Repository-Funktionen: `listUserMedications()`, `createUserMedication()`, `deleteUserMedication()`

#### `medication_schedules`

- Zweck: Tageszeitplan pro Nutzermedikation
- PK: `id` TEXT
- FK: `user_medication_id -> user_medications.id ON DELETE CASCADE`
- Pflichtfelder: `user_medication_id`, `time_of_day`, `amount`
- Zeitstempel: `created_at`
- Unique: PK
- Loeschverhalten: Kaskade
- Repository-Funktionen: entsteht in `createUserMedication()`

#### `medication_intakes`

- Zweck: dokumentierte Einnahmen
- PK: `id` TEXT
- FK: `user_medication_id -> user_medications.id ON DELETE CASCADE`
- Pflichtfelder: `user_medication_id`, `taken_at`
- Zeitstempel: `created_at`
- Unique: PK
- Loeschverhalten: Kaskade
- Repository-Funktionen: `recordMedicationIntake()`

#### `medication_packages`

- Zweck: Packungsdaten / PZN-Ebene
- PK: `id` INTEGER AUTOINCREMENT
- FK: `medication_product_id -> medication_products.id ON DELETE CASCADE`
- Pflichtfelder: `medication_product_id`, `is_active`, `created_at`, `updated_at`
- Zeitstempel: `created_at`, `updated_at`
- Unique: partieller Unique-Index auf `pzn`

#### `medication_aliases`

- Zweck: Suchalias pro Produkt
- PK: `id` INTEGER AUTOINCREMENT
- FK: `medication_product_id -> medication_products.id ON DELETE CASCADE`
- Pflichtfelder: `medication_product_id`, `alias`, `normalized_alias`, `alias_type`
- Unique: `UNIQUE(medication_product_id, normalized_alias)`
- Loeschverhalten: Kaskade

#### `medication_audit_log`

- Zweck: fachliches Audit fuer Medikamentendaten
- PK: `id` INTEGER AUTOINCREMENT
- FK: keine
- Pflichtfelder: `entity_type`, `entity_id`, `action`
- Zeitstempel: `created_at`

#### `secure_app_records`

- Zweck: verschluesselte Anwendungsdaten in SQLite
- PK: `record_key` TEXT
- FK: keine
- Pflichtfelder: `record_key`, `encryption_version`, `iv_base64`, `ciphertext_base64`, `content_length`
- Zeitstempel: `created_at`, `updated_at`
- Unique: PK
- Loeschverhalten: direktes Loeschen
- Repository-Funktionen: `upsertSecureAppRecord()`, `getSecureAppRecord()`, `deleteSecureAppRecord()`, `countSecureAppRecords()`

#### `app_data_audit_log`

- Zweck: technisches Audit fuer Secure-Records
- PK: `id` INTEGER AUTOINCREMENT
- FK: keine
- Pflichtfelder: `record_key`, `action`
- Zeitstempel: `occurred_at`

### Bewertung der bestehenden Struktur

Ausreichend fuer:

- Medikamentenstammdaten
- persoenliche Medikamentenlisten
- Einnahmeereignisse
- verschluesselte App-Records mit klaren Schluesseln

Nicht ausreichend fuer einen sauberen Vollimport:

- strukturierte Tagebuchtabellen
- strukturierte Stimmungstabelle
- strukturierte RLS-Fragebogenhistorie
- strukturierte Blutdruckhistorie
- strukturierte Terminverwaltung
- normalisierte SOS-/Notfallstruktur mit Kontakt- und Profiltabellen
- Importmanifest mit Laufhistorie

## Zielabbildung des Backups

### `meds` -> `user_medications`

**Quellpfad:** `meds[]`

| Quelle | Ziel | Regel | Risiko |
| --- | --- | --- | --- |
| `id` | `user_medications.id` | ID soweit stabil und syntaktisch plausibel uebernehmen | gering |
| `name` | `custom_name` oder FK zu `medication_products` | Wenn Produkt per PZN oder Name eindeutig gefunden wird, FK setzen; sonst als Custom-Medikation speichern | mittel |
| `dose` | `custom_dosage` | 1:1 Text uebernehmen | gering |
| `form` | `custom_form` | 1:1 Text uebernehmen | gering |
| `schedule` | `medication_schedules` | Pro Slot einen Datensatz erzeugen | mittel |
| `time` | abgeleitet / optional speichern | Nur als Anzeige- oder Plausibilitaetstext, nicht als Primärquelle | gering |
| `thresholdDays` | keine direkte Zieltabelle vorhanden | derzeit nicht strukturiert abbildbar, optional spaeteres Zusatzfeld | mittel |
| `source` | Metadatenfeld / Notiz | Nur dokumentarisch uebernehmen | gering |
| `active` | Aktivstatus in Nutzermedikation | als aktiv/inaktiv speichern | gering |
| `createdAt`, `updatedAt` | Zeitstempel | 1:1 uebernehmen, sofern ISO-kompatibel | gering |
| `note` | `notes` | 1:1 uebernehmen | gering |
| `pzn` | FK / Produktzuordnung | PZN validieren und Referenzprodukt suchen | mittel |
| `stock` | keine eigene Zielspalte vorhanden | nur abbilden, wenn das Zielschema Bestand fuer Nutzermedikation vorsieht | hoch |

### `schedule` -> `medication_schedules`

**Quellpfad:** `meds[].schedule`

| Quelle | Ziel | Regel | Risiko |
| --- | --- | --- | --- |
| `morning`, `noon`, `evening`, `night` | `time_of_day`, `amount` | Pro nicht-null/positivem Slot einen Datensatz schreiben | gering |
| Zahlenwert | `amount` | als Menge uebernehmen | gering |

Wichtige Regeln:

- Slotnamen nur aus dem bekannten Set uebernehmen.
- Nullwerte nicht als Schedule-Eintrag speichern.
- Doppelte Slot-Definitionen pro Medikation vermeiden.

### `diary` -> `diary_entries`

**Quellpfad:** `diary[YYYY-MM-DD]`

| Quelle | Ziel | Regel | Risiko |
| --- | --- | --- | --- |
| Datumsschluessel | `entry_date` | 1:1 als Tagesdatum uebernehmen | gering |
| `morning_pain` bis `night_pain` | strukturierte Schmerzspalten | 1:1 numerisch uebernehmen | gering |
| `morning_rls` bis `night_rls` | strukturierte RLS-Spalten | 1:1 numerisch uebernehmen | gering |
| `notes` | Notizspalte | Klartext uebernehmen | gering bis mittel |
| `sleepHours` | Schlafstunden | numerisch validieren | gering |
| `sleepQuality` | Schlafqualitaet | numerisch validieren | gering |
| `factors` | JSON-Spalte | als Bool-Map speichern | gering |
| `medsTaken` | Verweis auf Einnahmen | nur nach Aufloesung der Slot-IDs | hoch |
| `painAreas` | JSON-Spalte oder separate Tabelle | als Array speichern oder normalisieren | mittel |
| `pressure` | optionaler Kontext | als Text speichern | gering |
| `weather` | optionaler Kontext | als Text speichern | gering |
| `updated` | `updated_at` | 1:1 uebernehmen | gering |

### `diary.medsTaken` -> `medication_intakes`

**Quellpfad:** `diary[date].medsTaken[]`

Beobachtung:

- Eintragssyntax: `medicationId_slot`
- Beispiele aus dem Backup:
  - `mq7nmsnl_morning`
  - `mq7nls6c_night`

Transformationsregel:

- Split am letzten Slot-Suffix oder anhand des bekannten Slot-Sets.
- `medicationId` gegen `meds.id` pruefen.
- Slotzeit zu einem Tageszeitwert mappen.
- Ein Intake-Datensatz pro Slot-Eintrag erzeugen.
- Wenn keine eindeutige Zuordnung moeglich ist, nicht automatisch importieren.

Risiko:

- sehr hoch, weil die Quelle keine exakten Uhrzeiten, sondern Slot-Markierungen enthaelt

### `mood` -> `mood_entries`

**Quellpfad:** `mood[YYYY-MM-DD]`

| Quelle | Ziel | Regel | Risiko |
| --- | --- | --- | --- |
| Datumsschluessel | `entry_date` | 1:1 uebernehmen | gering |
| `stimmung` | Stimmungswert | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `energie` | Energiewert | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `antrieb` | Antriebswert | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `angst` | Angstwert | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `reizbarkeit` | Reizbarkeit | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `konzentration` | Konzentration | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `hoffnungslosigkeit` | Hoffnungslosigkeit | 1:1 numerisch uebernehmen, historische Skala 0..5 | gering |
| `symptoms` | JSON-Symptomfeld | als Bool-Map speichern | gering |
| `activities` | JSON-Aktivitaetsfeld | als Bool-Map speichern | gering |
| `updated` | `updated_at` | 1:1 uebernehmen | gering |

### `rlsSurveys` -> `rls_surveys`

**Quellpfad:** `rlsSurveys[date]`

Status:

- Im konkreten Backup leer
- Zielschema sollte trotzdem vorhanden sein, weil die App diese Struktur bereits kennt

Regel:

- pro Datum ein datierter Survey-Record
- Antworten, Summen, Schweregrad und Zeitstempel speichern

### `sosData` -> `sos_profiles`, `sos_contacts`

**Quellpfad:** `sosData`

| Quelle | Ziel | Regel | Risiko |
| --- | --- | --- | --- |
| `patientName` | SOS-Profilname | 1:1 oder aus `personal.name` bevorzugt | gering |
| `dob` | Geburtsdatum | 1:1 | gering |
| `bloodType` | Blutgruppe | 1:1 | gering |
| `allergies` | Allergien | 1:1 | gering bis mittel |
| `diagnoses` | Diagnosen | 1:1 Text oder normalisierte Liste | mittel |
| `emergencyNotes` | Krisennotiz | 1:1, aber verschluesselt oder in geschuetzter Fachstruktur | hoch |
| `iceContacts[]` | Kontakte | je Kontakt ein Datensatz | gering |
| `personal` | Profil-Tabelle | bevorzugte strukturierte Quelle | gering |
| `medical` | Medizinprofil | bevorzugte strukturierte Quelle | gering |

#### `sosData.personal`

Quellfelder:

- `name`
- `birthdate`
- `address`
- `profilePhoto`

Empfohlene Zielabbildung:

- `sos_profiles.name`
- `sos_profiles.birthdate`
- `sos_profiles.address`
- `sos_profiles.profile_photo_ref` oder `profile_photo_blob`

Risiko:

- `profilePhoto` kann leer, `null` oder nur referenziell sein. Vor Import klaeren, ob es ein Blob, ein lokaler Pfad oder nur Platzhalter ist.

#### `sosData.medical`

Quellfelder:

- `bloodGroup`
- `allergies`
- `chronicConditions`

Empfohlene Zielabbildung:

- `sos_profiles.blood_group`
- `sos_profiles.allergies`
- `sos_profiles.chronic_conditions`

#### `sosData.iceContacts`

Quellfelder pro Kontakt:

- `id`
- `name`
- `phone`
- `relationship`

Empfohlene Zielabbildung:

- `sos_contacts.contact_id`
- `sos_contacts.profile_id`
- `sos_contacts.name`
- `sos_contacts.phone`
- `sos_contacts.relationship`

Risiko:

- gering fuer Struktur, mittel fuer Dubletten, wenn Kontakte bereits im Zielsystem existieren

### Unbekannte Zusatzfelder

Im Backup nicht als eigener Bereich vorhanden, aber relevant:

- `rlsSurveys` leer
- kein explizites `appointments`
- kein explizites `bloodPressure`
- kein explizites `prefs`
- kein explizites `crisisPlan`

Diese Daten sollten nicht stillschweigend importiert werden.

## Zielarchitektur - notwendige Ergaenzungen

Die folgende Struktur wird fuer einen sauberen Vollimport empfohlen:

- `diary_entries`
- `mood_entries`
- `rls_surveys`
- `appointments`
- `blood_pressure_entries`
- `sos_profiles`
- `sos_contacts`
- optional `sos_documents`
- optional `import_manifests`

### Warum `secure_app_records` allein nicht reicht

`secure_app_records` ist technisch passend fuer verschluesselte App-Records, aber fachlich zu grob fuer:

- Tageshistorien
- aggregierbare Werte
- saubere Abfragen
- FK-gestuetzte Medikationsintakes
- wiederholbare Importverifikation

Es sollte daher nur fuer wirklich verschluesselte, eher dokumentartige Records genutzt werden, nicht als alleiniger Fachspeicher fuer alle Bereiche.

## Medikamente - exakte Importregeln

### `meds` -> `user_medications`

Verbindlich:

- Backup-ID nach Moeglichkeit erhalten
- PZN validieren
- Wenn ein Produkt ueber PZN oder Alias gefunden wird, FK setzen
- Wenn kein Produkt eindeutig gefunden wird, als Custom-Medikation importieren
- Dublette pro externer ID vermeiden
- vorhandene `stock`-Werte nur dann uebernehmen, wenn das Zielschema Bestand auf Nutzermedikationsebene vorsieht
- `note` und `source` nur in dafuer vorgesehenen Notizspalten speichern

### `schedule` -> `medication_schedules`

Verbindlich:

- Slotnamen aus `morning`, `noon`, `evening`, `night` normalisieren
- nur positive Mengen importieren
- pro Slot genau ein Schedule-Datensatz
- keine blind doppelte Erzeugung

### `diary.medsTaken` -> `medication_intakes`

Verbindlich:

- jeder Slot-Eintrag wird auf eine Intake-Referenz reduziert
- Intake-Zeitpunkt wird, falls kein exakter Zeitwert vorliegt, als abgeleitete Tageszeit gespeichert
- ohne valide Medikamenten-ID kein automatischer Import
- IDs nicht erfinden
- Dubletten anhand `(date, medicationId, slot)` erkennen

## Verschluesselung und Schutz

Fachliche Daten, die strukturiert in SQLite liegen sollten:

- Tagebuch
- Stimmung
- Blutdruck
- Termine
- Medikamentenlisten
- Einnahmen
- RLS-Frageboegen
- SOS-Profile und Kontakte

Zusatzschutz:

- sensible Felder in `secure_app_records` oder spaeteren geschuetzten Fachspalten verschluesseln, wenn sie aus dem Client nie im Klartext benoetigt werden
- bestehende `SecureStore`-Verschluesselung kann fuer den Clientzugriff weiterhin genutzt werden
- neue PIN-/Schluesselmaterialien muessen fuer die produktive SQLite-Zielarchitektur neu oder fortgesetzt aus einem lokalen Geheimnis abgeleitet werden

Wichtig:

- Das Handy-Backup selbst enthaelt Klartext.
- Der Import muss deshalb entscheiden, welche Felder strukturiert gespeichert und welche zusaetzlich geschuetzt werden.

## Importregeln

### Dry-Run

- nur lesen
- Schema und Referenzen pruefen
- alle Ziel-IDs und Abhaengigkeiten simulieren
- keine Schreiboperationen

### Apply

- nur nach erfolgreichem Dry-Run
- ausschliesslich in einer Transaktion
- keine Teilimports

### Verify

- Anzahl der Datensaetze pruefen
- erwartete IDs pruefen
- Hashes pro Bereich vergleichen
- Abweichungen dokumentieren

### Rollback

- bei jedem Validierungs- oder Schreibfehler komplette Transaktion zurueckrollen
- keine teilweisen Nebenwirkungen

### Snapshot-Pflicht

- vor dem ersten Apply muss ein Snapshot von `data/symptochron.db` existieren

### Wiederholbarkeit und Idempotenz

- Importlaeufe muessen wiederholbar sein
- dieselbe Quelle darf nicht zu doppelten Datensaetzen fuehren
- stabile Importschluessel benoetigen
  - Backup-ID
  - Datumsschluessel
  - medizinische Fachschluessel

### Konfliktbehandlung

- bei bestehender Ziel-ID anderer Hash = Konflikt
- bei fehlender Eindeutigkeit = manueller Check
- bei unsicherer Referenz = Abbruch oder Quarantaene

### Abbruchbedingungen

- ungültiges JSON
- inkompatible Backup-Version
- fehlende Pflichtbereiche
- unaufloesbare Medikamenten-Referenzen
- unklare Mapping-Quelle fuer Krisen- oder Kontaktfelder
- Schemaabweichung im Zielsystem

## Importmanifest

### Bewertung

Eine eigene SQLite-Tabelle fuer das Importmanifest ist sinnvoll und sollte im Zielschema vorgesehen werden.

Begruendung:

- nachvollziehbarer Erstimport
- spaetere Wiederholbarkeit
- Verifikation und Rollback-Historie
- Auditierbarkeit fuer administrative Datenuebernahme

### Vorschlag

```ts
type ImportManifest = {
  importVersion: string;
  sourceBackupVersion: string;
  sourceHash: string;
  sourceTimestamp: string;
  targetSchemaVersion: number;
  startedAt: string | null;
  completedAt: string | null;
  mode: "dry-run" | "apply" | "verify";
  status: "pending" | "validated" | "applied" | "verified" | "failed" | "rolled_back";
  counts: Record<string, number>;
  importedIds: Record<string, string[]>;
  warnings: string[];
  errors: string[];
};
```

### Empfohlene Spalten fuer eine Tabelle

- `import_version`
- `source_backup_version`
- `source_hash`
- `source_timestamp`
- `target_schema_version`
- `started_at`
- `completed_at`
- `mode`
- `status`
- `counts_json`
- `imported_ids_json`
- `warnings_json`
- `errors_json`

## Offene Fragen vor SC-DB-08.2

1. Soll `diary` in eine dedizierte Tabelle mit Spalten pro Messwert oder in eine generische JSON-Struktur mit normalisierten Indexspalten?
2. Gibt es bereits geplante, aber noch nicht implementierte Tabellen fuer `diary_entries`, `mood_entries`, `rls_surveys`, `appointments`, `blood_pressure_entries`, `sos_profiles`, `sos_contacts`?
3. Wie soll `diary.medsTaken` zeitlich interpretiert werden, wenn nur Slotnamen, aber keine Uhrzeiten vorliegen?
4. Sind die Backup-`meds.id`-Werte dauerhaft als Nutzermedikations-IDs verwendbar, oder muessen neue Ziel-IDs erzeugt werden?
5. Soll `stock` in der Zielarchitektur auf Produkt-, Packungs- oder Nutzermedikations-Ebene gespeichert werden?
6. Wie sollen bereits vorhandene Serverdaten bei Konflikten behandelt werden?
7. Welche Felder sollen endgueltig verschluesselt bleiben und welche duerfen strukturiert im Klartext in SQLite liegen?
8. Ist `sosData.personal.profilePhoto` ein Blob, ein Referenzpfad oder nur ein UI-Platzhalter?
9. Soll `rlsSurveys` trotz Leere als feste Fachstruktur angelegt werden?
10. Ist eine Import-Historientabelle verbindlich gewollt?

## Entscheidung fuer SC-DB-08.2

SC-DB-08.2 kann **noch nicht direkt implementiert** werden, solange das Zielschema fuer Tagebuch, Stimmung, SOS, Blutdruck und Manifest nicht verbindlich angelegt ist.

Empfohlene Lage:

- Zielschema zuerst festziehen
- dann Import-Transformation implementieren
- danach Dry-Run und Verifikation auf einer frischen Testdatenbank
