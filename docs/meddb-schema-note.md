# AP-04 MedDB-Schema & Validierung

Datum: 2026-07-10

Scope:

- `src/types.ts`
- `src/utils.ts`
- `bfarm_db.json` (root)
- `server/bfarm_db.json`
- `server.ts`
- `src/components/MedsTab.tsx`
- `src/utils.test.ts`

## Problem vor AP-04

Das Datenmodell fuer Medikamente (`Medication`) enthielt keine Metadaten zur Verifizierung (wie Wirkstoff, Quelle, Datenstand oder einen verifizierten Status). Zudem wiesen 22 von 23 Pharmazentralnummern (PZN) in der mitgelieferten Mock-Datenbank (`bfarm_db.json`) mathematisch ungueltige Prüfziffern auf, was eine korrekte Plausibilisierung und Validierung unmoeglich machte. Es fehlte eine strukturierte clientseitige Validierung beim Hinzufuegen und Scannen von Medikamenten.

## Umsetzung

### Schema-Erweiterung und Validierung

- **Modellerweiterung**: Das `Medication`-Interface in `src/types.ts` wurde um die Felder `wirkstoff?: string`, `stand?: string` und `verified?: boolean` erweitert.
- **PZN-Prüfzifferprüfung**: In `src/utils.ts` wurde die Funktion `isValidPzn` implementiert, die PZNs (7 oder 8 Ziffern, mit automatischer fuehrender Null) mittels des offiziellen Modulo-11-Verfahrens (Gewichtungen von 1 bis 7) prueft.
- **Schema-Validierung**: Die Funktion `validateMedication` prueft nun Pflichtfelder (Name, Stärke/Dosis) sowie die Richtigkeit der PZN und stellt sicher, dass Bestaende und Warnschwellen nicht negativ sind.

### Bereinigung der Arzneimitteldatenbank

- Alle PZNs in `bfarm_db.json` (im Root-Verzeichnis und im `server/`-Verzeichnis) wurden korrigiert, sodass sie die mathematisch korrekte Prüfziffer tragen.
- Ungueltige Platzhalter-PZNs fuer Rivotril, Paracetamol und Tramadol wurden durch echte, gueltige deutsche PZNs (`00213836`, `06718342` und `07493129`) ersetzt.
- Die gleichen PZNs wurden in den Onboarding- und Demodaten-Vorgaben in `src/components/MedsTab.tsx` aktualisiert.

### Backend- und API-Erweiterung

- Die Routen `/api/bfarm/search` und `/api/bfarm/demo-search` reichern gefundene Eintraege nun automatisch mit `verified: true`, `source: "BfArM-Datenbank (Local Copy - Offline)"` und dem Datenstand `stand: "09.07.2026"` an.
- Fallback-Generierungen der KI oder des Servers werden explizit mit `verified: false` und entsprechenden Quellenkennzeichnungen markiert.

### Frontend UI-Stabilisierung

- **Datenpflege-Modal**: Das Modal in `MedsTab.tsx` bietet nun dedizierte Felder fuer Wirkstoff, Datenquelle und Datenstand an sowie eine Checkbox fuer den verifizierten Status.
- **Speicher-Validierung**: Beim Speichern wird `validateMedication` aufgerufen. Ungueltige PZNs oder negative Werte werden abgefangen und loesen eine Toast-Warnung aus.
- **Verifizierungs-Badge**: Sowohl in der Desktop-Tabelle als auch in den mobilen Medikamentenkarten wird neben dem Medikamentennamen ein Status-Badge ("✓ Verifiziert" in Smaragdgrün vs. "Manuell" in Schiefergrau) inklusive Tooltip mit Datenstand und Quelle gerendert.

### Automatisierte Tests

- **`src/utils.test.ts`**: Enthält nun Unit-Tests fuer `isValidPzn` und `validateMedication`.
- **Datenbank-Integritätstest**: Ein neuer Test laedt die lokale `bfarm_db.json` und stellt sicher, dass alle Eintraege gueltige PZNs aufweisen.

## Restrisiken / Folgearbeit

- **AP-05 (KI-Fallback entschaerfen)**: Der KI-Fallback im Such-Endpoint darf laut Roadmap keine verifizierten Stammdaten erzeugen. Dies ist durch die serverseitige Kennzeichnung mit `verified: false` vorbereitet, muss aber in Phase 3 vollstaendig abgesichert werden (z. B. Kennzeichnung von Raten/Suchhilfe im Client).
- **Clientseitiger Cache**: In `docs/storage-audit.md` wurde ein KI-Cache erwaehnt. Zukuenftig sollte dieser ebenfalls auf schema-korrekte MedDB-Modelle migriert werden.

## AP-04 Abnahme

Erfuellt:

- Lokale Medikamenten-Datenbank v1 mit korrekten PZNs und Feldern (PZN, Name, Wirkstoff, Stärke, Form, Packung, Quelle, Stand, verified) vorhanden.
- Clientseitige Validierung fuer PZN-Prüfziffern und Bestände beim Speichern aktiv.
- UI-Anzeige fuer verifizierten Datenursprung und Wirkstoffe in Desktop- und Mobil-Ansicht vorhanden.
- Automatisierte Tests sind gruen (`pass 4/4`).
