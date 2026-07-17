# AP-06 AI Privacy Guard

Datum: 2026-07-10

Scope:

- `src/utils.ts`
- `server.ts`
- `src/utils.test.ts`

## Problem vor AP-06

Die App uebermittelt in freien Textfeldern (z. B. Tagebuch-Notizen oder Medikamenten-Zusatzinfos) Daten an die Google-Gemini-API fuer Trendanalysen und taegliche Gesundheitstipps. Hierbei bestand die Gefahr, dass versehentlich eingegebene personenbezogene Daten (PII) wie Namen von Patienten oder Aerzten, Telefonnummern, E-Mail-Adressen, Geburtsdaten oder Wohnanschriften an externe Server uebermittelt werden. Es fehlte ein zentraler Schutzfilter zur Anonymisierung dieser Daten.

## Umsetzung

### Zentraler Anonymisierungs-Filter (aiPrivacyGuard)

In `src/utils.ts` wurde die Funktion `aiPrivacyGuard` implementiert. Diese analysiert einen Text und schwaerzt personenbezogene Details durch standardisierte Platzhalter:

- **E-Mail-Adressen**: Werden durch `[E-MAIL]` ersetzt.
- **Telefonnummern**: Deutsche und internationale Rufnummern-Formate werden durch `[TELEFON]` ersetzt.
- **Kalender- & Geburtsdaten**: Daten im Format DD.MM.YYYY, DD/MM/YY sowie YYYY-MM-DD werden durch `[DATUM]` ersetzt.
- **Postleitzahlen & Orte**: Deutsche PLZ mit nachfolgendem Ortsnamen werden durch `[ADRESSE]` ersetzt.
- **Straßenadressen**: Straßennamen mit gaengigen Suffixen (straße, weg, platz, ring etc.) und Hausnummern werden durch `[ADRESSE]` ersetzt.
- **Namen mit Anrede/Titel**: Chained Honorifics (wie `Herr Müller`, `Frau Dr. med. Schmidt`, `Prof. Meier`) werden durch `[PERSON]` ersetzt.
- **Häufige deutsche Vornamen**: Eine integrierte Namensliste schwaerzt Vornamen (wie Erika, Maik, Max) fallunabhaengig zu `[PERSON]`.
- **Eigene Namenslisten**: Optionale Übergabe von anwenderspezifischen Namen zur gezielten Schwaerzung.

### Rekursive Payload-Desinfektion (Server)

- **Rekursiver Parser**: In `server.ts` wurde die Hilfsfunktion `sanitizePayload(obj: any): any` eingefuehrt. Diese durchlaeuft jede eingehende JSON-Struktur und wendet `aiPrivacyGuard` auf alle enthaltenen Strings an.
- **Schnittstellen-Schleuse**:
  - Im Endpoint `/api/analyze-trends` wird der gesamte Request-Body vor der Weiterleitung an die Gemini-API desinfiziert.
  - Im Endpoint `/api/daily-insight` werden `todayEntry` und `recentEntries` (inklusive aller Notizen) rekursiv gereinigt.
  - In den Suchschnittstellen `/api/bfarm/search` und `/api/bfarm/demo-search` wird der Suchstring bereinigt, um zu verhindern, dass versehentliche Namenseingaben im Suchfeld die KI erreichen.

### Unit Tests & Absicherung

- **`src/utils.test.ts`**: Ein neuer Testfall `aiPrivacyGuard correctly sanitizes PII from free text logs` deckt alle Anonymisierungs-Szenarien ab und prueft das korrekte Ineinandergreifen der regulären Ausdrücke.

## AP-06 Abnahme

Erfuellt:

- Personenbezogene Daten (E-Mails, Telefonnummern, Geburtsdaten, Wohnanschriften, Namen) werden vor dem Versand an die KI-API zuverlaessig durch Platzhalter ersetzt.
- Rekursiver Desinfektions-Filter schützt alle vorhandenen und zukünftigen String-Datenfelder im Payload.
- Die desinfizierte Form behaelt den klinischen Kontext bei, sodass die KI weiterhin praezise Analysen durchfuehren kann.
- Alle Unit-Tests laufen fehlerfrei durch (`pass 5/5`).
- Projekt-Build und Linter laufen fehlerfrei.
