# DB-02 bis DB-06 – Medikamentendatenbank stabilisieren und testbereit machen

**Datum:** 10.07.2026  
**Status:** Abgeschlossen für den Medikamentenbereich  
**Grundlage:** Eine produktive SQLite-Datei `data/symptochron.db`.

## DB-02 – Schema härten

Neu:

- Migration `002_medication_hardening.sql`
- Tabelle `medication_packages`
- Tabelle `medication_aliases`
- Tabelle `medication_audit_log`
- eindeutiger PZN-Index auf Packungsebene
- Suchindex für normalisierte Aliasnamen
- Übernahme vorhandener Produktnamen und Packungsdaten in die neuen Tabellen

**Qualifizierter Test:** Migrationen 1 und 2 werden in einer frischen Testdatenbank transaktional ausgeführt. Fremdschlüssel sind aktiv. Ergebnis: bestanden.

## DB-03 – Referenz- und Nutzerdaten trennen

Die bereits in DB-01 angelegte fachliche Trennung wurde vervollständigt:

- `medication_products`, `medication_packages`, `active_ingredients` und `medication_aliases` enthalten Referenzdaten.
- `user_medications`, `medication_schedules` und `medication_intakes` enthalten persönliche Daten.
- Referenzdatensätze werden nicht in persönliche Datensätze kopiert, sondern über Fremdschlüssel verknüpft.
- Eigene Präparate bleiben als `custom_name` möglich, ohne einen amtlichen Datensatz vorzutäuschen.

**Qualifizierter Test:** Nutzermedikation mit Einnahmeplan wird in einer Transaktion gespeichert. Ungültige Pläne mit negativen Mengen werden vollständig zurückgerollt. Ergebnis: bestanden.

## DB-04 – Kontrollierte Schreibzugriffe

Neu:

- `server/database/repositories/userMedicationRepository.ts`
- `GET /api/user-medications`
- `POST /api/user-medications`
- `DELETE /api/user-medications/:id`
- `POST /api/medication-intakes`

Schreibvorgänge validieren Pflichtwerte, Einnahmezeitpunkte und Mengen. Anlegen und Löschen werden im Audit-Protokoll dokumentiert.

**Qualifizierter Test:** Anlegen, Auflisten, Einnahme protokollieren und kaskadierendes Löschen wurden automatisiert geprüft. Ergebnis: bestanden.

## DB-05 – Nur noch eine Suchquelle

Die bisherige Demo-Suchroute liest keine JSON-Datei mehr. Sie ist nur noch eine Kompatibilitätsroute und verwendet dieselbe SQLite-Suche wie die produktive Route.

Zusätzlich wurde im Medikamenten-Scanner der letzte unsichere Platzhalter entfernt. Bei einer unbekannten PZN werden jetzt ausdrücklich keine erfundenen Werte wie `300 mg`, `Tablette` oder eine angenommene Packungsgröße gespeichert.

Die Oberfläche kennzeichnet die Quelle nun als lokale SymptoChron-SQLite-Medikamentendatenbank.

**Qualifizierter Test:** Ein absichtlich unbekannter Suchbegriff liefert `results: []` und `exactMatch: false`. Es wird kein Nutzerdatensatz erzeugt. Ergebnis: bestanden.

## DB-06 – Querschnitts- und Laufzeittest

Automatisierte Prüfung:

| Prüfung | Ergebnis |
|---|---|
| `npm run lint` | bestanden |
| `npm test` | 12 von 12 Tests bestanden |
| `npm run build` | bestanden |
| frische Datenbank + beide Migrationen | bestanden |
| automatischer Import | 24.267 aktive Datensätze |
| Suche `Pramipexol` | verifizierte Treffer |
| Suche unbekannter Begriff | leere Trefferliste |
| Nutzermedikation anlegen | bestanden |
| Einnahme speichern | bestanden |
| Nutzermedikation auflisten | bestanden |
| kaskadierendes Löschen | bestanden |

## Wichtige Abgrenzung

DB-02 bis DB-06 schließen den **Medikamentenbereich** für die bevorstehende Testphase ab. Die übrigen Gesundheitsdaten der App liegen weiterhin im verschlüsselten browserseitigen SecureStore. Eine Migration sämtlicher Tagebuch-, Profil-, Schlaf-, Stimmungs- und Einstellungsdaten auf serverseitiges SQLite wäre ein eigener Architektur- und Datenschutzschritt und wurde nicht stillschweigend durchgeführt.

Damit bleibt die App im aktuellen Teststand datenschutzseitig konservativ: SQLite ist die einzige produktive Referenz- und Medikamenten-Backenddatenbank, während bestehende verschlüsselte Clientdaten nicht ohne gesonderte Migration verändert werden.
