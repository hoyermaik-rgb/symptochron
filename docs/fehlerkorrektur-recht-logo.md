# Fehlerkorrektur: Rechtstexte und Header-Logo

Stand: 10.07.2026

## Behobene Punkte

- Impressum und Datenschutz öffnen nun jeweils direkt den richtigen Inhalt.
- Der aktive Rechtstext wird beim erneuten Öffnen zuverlässig gesetzt.
- Im oberen Bereich ist wieder ein sichtbarer Zurück-Button vorhanden.
- Im unteren Bereich führt „Zurück zur App“ ebenfalls sicher aus dem Dialog.
- Aus `public/Icon-192.png` wurde eine für den kleinen Header geeignete, transparente Ausschnittsdatei `public/Icon-192-header.png` erzeugt.
- Der Header verwendet diesen klar erkennbaren Leuchtturm-Ausschnitt statt das vollständige quadratische Logo stark zu verkleinern.

## Prüfung

- TypeScript-Prüfung: bestanden
- Automatisierte Tests: 16/16 bestanden
- Produktions- und PWA-Build: bestanden
