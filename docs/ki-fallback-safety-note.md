# AP-05 KI-Fallback entschärfen

Datum: 2026-07-10

Scope:

- `server.ts`
- `src/components/MedsTab.tsx`

## Problem vor AP-05

Wenn ein gesuchtes Medikament oder eine Pharmazentralnummer (PZN) nicht in der lokalen Datenbank gefunden wurde, hat der Server eine KI-Abfrage (Gemini Resolver) gestartet. Die KI neigte jedoch dazu, fuer ungültige oder nicht existierende PZNs (z. B. Tippfehler) fiktive Medikamentendaten zu erzeugen ("PZN-Raten"). Im Frontend fehlte zudem eine eindeutige Kennzeichnung fuer diese unbestätigten Daten. Es gab keinen klaren "Nicht-gefunden"-Zustand und keine Hilfestellung (Suchhilfe) fuer den Nutzer, wenn eine Suche ergebnislos blieb.

## Umsetzung

### Entschärfung des KI-Resolvers (Server)

- **Strictness-Prompting**: Der Prompt fuer die Google-Gemini-Schnittstelle in `server.ts` wurde so verschaerft, dass bei unbekannten, ungueltigen oder im deutschen Arzneimittelregister nicht verzeichneten PZNs keine Daten geschaetzt/generiert werden duerfen. Stattdessen wird exakt ein leeres Array `[]` zurueckgegeben.
- **Unverifiziert-Flag**: Ergebnisse aus der Live-Schnittstelle werden serverseitig zwingend mit `verified: false` und `source: "KI-Echtzeit-Schnittstelle (Unverifiziert)"` markiert.

### "Nicht-gefunden"- & Suchhilfe-Ansicht (Client)

- **Plausibilitäts-Warnung**: Wird nach einer Suche kein Eintrag gefunden (Ergebnis-Array `[]`), rendert `MedsTab.tsx` eine auffaellige Warnkarte.
- **Suchhilfe-Workflow**:
  - Dem Nutzer wird erklaert, was moegliche Fehlerursachen sein koennten (Tippfehler in der PZN, auslaendische Medikamente ohne deutsche PZN).
  - Ein direkter externer Link `🔍 Im Web nach PZN suchen` oeffnet eine Google-Abfrage fuer die eingegebene Nummer.
  - Über den Button `➕ Trotzdem manuell anlegen` wird das Erfassungsmodal geoeffnet. Die PZN oder der Suchbegriff werden bereits vorausgefuellt, die Datenquelle wird auf `"Manuelle Eingabe (Nicht gefunden)"` und `verified` zwingend auf `false` gesetzt.

### UI-Warnungen für unbestätigte Daten

- **Warn-Banner**: Falls Suchergebnisse von der KI stammen (`verified: false`), zeigt die Ergebnis-Karte im Suchergebnis ein bernsteinfarbenes Warn-Banner an: *“⚠️ Unverifizierter KI-Vorschlag. Bitte Wirkstoff, Stärke und Form manuell abgleichen!”*
- **Sicherheits-Hinweis im Modal**: Setzt der Benutzer im Modal manuell den Haken `Offiziell verifiziert (BfArM-Datenbestand)`, obwohl die Datenquelle manuell oder durch die KI-Suche befuellt wurde, blendet die App dynamisch eine Sicherheitswarnung ein: *“⚠️ Hinweis: Dieser Eintrag wurde manuell angelegt oder stammt aus einer KI-Suche. Bitte verifiziere die PZN, den Wirkstoff und den Hersteller gründlich, bevor du ihn als verifiziert markierst.”*

## AP-05 Abnahme

Erfuellt:

- Gemini Resolver prompten verhindert das Generieren von Fantasiedaten (PZN-Raten).
- Bei leeren Ergebnissen erscheint die Warnkarte samt Suchhilfe (PZN-Hinweise, Google-Link) und der Schnellerfassung.
- Unverifizierte KI-Suchergebnisse tragen ein deutliches Warn-Banner.
- Das Verifizierungs-Modal warnt den Nutzer vor unberechtigter Verifizierungsmarkierung.
- TypeScript-Typen und Builds kompilieren fehlerfrei.
