# DB-01 – Zentrale SQLite-Medikamentendatenbank

**Datum:** 10.07.2026  
**Status:** Abgeschlossen  
**Ziel:** Beginn des Datenbank-Stabilitätsumbaus vor der E2E-Testphase.

## Verbindliche Architekturentscheidung

SymptoChron verwendet künftig genau eine produktive SQLite-Datenbank:

```text
data/symptochron.db
```

Alle fachlichen Bereiche der App werden später in dieser einen Datei über getrennte Tabellen und Fremdschlüssel abgebildet. Für Medikamente existiert keine zweite produktive Datenbank. Eine technisch identische Testdatenbank bleibt zulässig.

## Umgesetzte Änderungen

### 1. Zentrale Datenbankverbindung

Neu angelegt:

- `server/database/connection.ts`

Aktivierte SQLite-Einstellungen:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```

Der Standardpfad ist `data/symptochron.db`. Ein abweichender Pfad kann ausschließlich über `SYMPTOCHRON_DB_PATH` gesetzt werden.

### 2. Versioniertes Migrationssystem

Neu angelegt:

- `server/database/migrations.ts`
- `server/database/migrations/001_initial_schema.sql`

Die Migration wird transaktional ausgeführt und in `schema_migrations` protokolliert.

### 3. Medikamentenschema

Angelegt wurden:

- `medication_sources`
- `medication_products`
- `active_ingredients`
- `medication_product_ingredients`
- `medication_import_runs`
- `user_medications`
- `medication_schedules`
- `medication_intakes`

Referenzdaten und persönliche Nutzerdaten sind damit fachlich getrennt, liegen aber in derselben SQLite-Datei.

### 4. Einmaliger JSON-Import

Neu angelegt:

- `server/database/importMedicationJson.ts`

Importquellen:

1. `Bfarm_DB/bfarm_db_neu.json` als großer Ausgangsdatenbestand
2. `bfarm_db.json` als bisheriger kuratierter Teilbestand

Importregeln:

- Leere Werte bleiben leer.
- Es werden keine Wirkstoffe, PZN, ATC-Codes, Stärken oder Hersteller geschätzt.
- PZN werden ausschließlich normalisiert, nicht erfunden.
- Datensätze ohne Produktname werden übersprungen.
- Der große Bestand erhält den Status `source_imported`.
- Der bisherige kuratierte Teilbestand erhält den Status `verified`.
- Importläufe werden in `medication_import_runs` protokolliert.
- Der automatische Import erfolgt nur, wenn `medication_products` leer ist.

Ergebnis des ersten Imports:

- 24.246 Datensätze aus dem großen Ausgangsbestand importiert
- 23 kuratierte Datensätze eingelesen beziehungsweise über vorhandene PZN priorisiert
- 1 Datensatz ohne verwertbaren Produktnamen übersprungen
- 24.267 aktive Medikamentendatensätze in SQLite

### 5. Medikamentensuche auf SQLite umgestellt

Neu angelegt:

- `server/database/repositories/medicationRepository.ts`

Geändert:

- `server.ts`

Die doppelte produktive Route `POST /api/bfarm/search` wurde entfernt und durch genau eine SQLite-gestützte Route ersetzt.

Gesucht wird nach:

- PZN mit und ohne führende Null
- Produktname
- Wirkstofftext
- ATC-Code

Maximal 50 Ergebnisse werden zurückgegeben.

### 6. Unsicheren KI-Fallback entfernt

Die frühere produktive Suchroute konnte bei fehlendem Treffer simulierte oder KI-generierte Arzneimitteldaten zurückgeben. Dieser Pfad wurde vollständig entfernt.

Für einen unbekannten Suchbegriff liefert die Route jetzt ausschließlich:

```json
{
  "source": "sqlite_medication_database",
  "results": [],
  "exactMatch": false
}
```

Damit werden keine Medikamentenstammdaten erfunden.

### 7. Laufzeitdateien geschützt

Geändert:

- `.gitignore`
- `.env.example`

SQLite-Laufzeitdateien (`.db`, `.db-wal`, `.db-shm`) sind von Git ausgeschlossen. Der Datenbankpfad ist in `.env.example` dokumentiert.

## Durchgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm run lint` | Erfolgreich, 0 TypeScript-Fehler |
| Serverstart mit leerer Datenbank | Erfolgreich |
| Automatische Migration | Erfolgreich |
| Automatischer Erstimport | Erfolgreich |
| Suche nach `Pramipexol` | 2 kuratierte, verifizierte Treffer |
| Suche nach `Diazepamum` | Treffer aus dem großen SQLite-Ausgangsbestand |
| Doppelte produktive Suchroute | Beseitigt |
| KI-/Simulationsfallback bei Nichttreffer | Beseitigt |

## Noch nicht Bestandteil von DB-01

Dieser Schritt migriert noch nicht sämtliche Tagebuch-, Profil-, Stimmungs-, Schlaf- oder Einstellungsdaten aus dem browserseitigen SecureStore nach SQLite. Das erfolgt nur in einem nachfolgenden, separat dokumentierten Roadmap-Schritt.

Die alten JSON-Dateien bleiben vorerst als nachvollziehbare Importquellen im Projekt. Sie werden nicht mehr von der produktiven Medikamentensuche verwendet und erst nach erfolgreicher Test- und Abnahmephase archiviert oder entfernt.
