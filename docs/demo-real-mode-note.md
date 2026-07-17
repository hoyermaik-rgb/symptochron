# AP-03 Demo-/Echtmodus trennen

Datum: 2026-07-10

Scope:

- `src/components/Onboarding.tsx`
- `src/App.tsx`
- `src/components/ExportTab.tsx`

## Problem vor AP-03

Die App hat bei leerem Tagebuch automatisch Demo-Daten erzeugt. Dadurch konnte ein echter Erststart bereits mit Beispieldaten befuellt werden. Fuer v1.0 Core Stable ist das riskant, weil Demo-Daten in Backups, CSV/FHIR-Dateien oder PDF-Berichten landen konnten.

## Umsetzung

### Explizite Startauswahl

Das Onboarding bietet jetzt drei klare Wege:

- Leeres Tagebuch starten
- Demo ansehen
- Backup importieren

Die Demo wird nur noch geladen, wenn der Nutzer sie aktiv auswaehlt.

### App-Modus

Der Modus wird in `symptochron_app_mode` gespeichert:

- `real`: echtes Tagebuch, echte Backups/Exporte erlaubt
- `demo`: Demo-Daten aktiv, klinische Exporte gesperrt

`symptochron_seeded` bleibt als Legacy-/Demo-Status erhalten, entscheidet aber nicht mehr automatisch ueber Befuellung beim Start.

### Export-Schutz

Im Demo-Modus sind gesperrt:

- PDF-Report
- JSON-Backup
- CSV-Export
- FHIR-Export

Backup-Import bleibt erlaubt. Nach erfolgreichem Import wird der Modus wieder auf `real` gesetzt und `symptochron_seeded` entfernt.

### Manueller Demo-Button

Der vorhandene Demo-Ladebutton in den Einstellungen ist im Echtmodus gesperrt, sobald bereits Tagebuch-, Medikamenten- oder Mood-Daten vorhanden sind. Dadurch koennen echte Daten nicht versehentlich mit Demo-Daten ueberschrieben werden.

## Restrisiken / Folgearbeit

- `handleClearAllData()` nutzt weiterhin `localStorage.clear()` und loescht bisher nicht alle IndexedDB-Keys gezielt. Das gehoert zu AP-08/Backup- und Import-Haertung.
- Backup-Import validiert aktuell nur rudimentaer. AP-08 muss Versionierung, Schema und defekte Dateien absichern.
- Demo-Daten werden im Demo-Modus weiterhin im selben SecureStore abgelegt. Da Exporte gesperrt sind, ist der Abnahmefall fuer AP-03 erfuellt; langfristig waere ein separater Demo-Store sauberer.

## AP-03 Abnahme

Erfuellt:

- Startauswahl fuer leeres Tagebuch, Demo und Backup-Import vorhanden.
- Keine automatische Demo-Befuellung bei leerem Echtstart.
- Demo-Daten koennen nicht als echte PDF/JSON/CSV/FHIR-Exporte ausgegeben werden.
- Demo-Daten koennen vorhandene Echtmodus-Daten nicht per Einstellungen ueberschreiben.
