# Feinschliff: Logo, mobile Rahmenbereiche und Rechtstexte

**Datum:** 10.07.2026

## Umgesetzt

- `public/Icon-192.png` wird als sichtbares Header-Logo verwendet.
- Header auf Mobilgeräten kompakter gestaltet.
- unterer Inhaltsabstand berücksichtigt die feste Navigation und `safe-area-inset-bottom`.
- rechtliche Dialogansicht für kleine Displays optimiert.
- Platzhalter im Impressum durch die bereitgestellten Kontaktdaten ersetzt.
- veralteten TMG-Verweis auf § 5 DDG aktualisiert.
- nicht mehr aktuelle EU-OS-Plattform-Verlinkung entfernt.
- Datenschutzerklärung an den tatsächlichen DB-07-Stand angepasst:
  - browserseitige AES-256-GCM-Verschlüsselung,
  - verschlüsselte zentrale SQLite-Speicherung,
  - IndexedDB als verschlüsselter Offline-Cache,
  - lokale technische Browser-Speicherung,
  - Medikamentensuche,
  - optionale Gemini-Funktionen,
  - browserabhängige Spracheingabe,
  - Betroffenenrechte und medizinischer Hinweis.
- externen Google-Fonts-Abruf entfernt; die App nutzt Systemschriften.

## Noch vor öffentlicher Freigabe zu klären

Die Texte sind ein technisch abgeglichener Entwurf, keine anwaltliche Rechtsberatung. Folgende Angaben hängen von der realen Betriebsumgebung ab und müssen abschließend ergänzt oder bestätigt werden:

1. Name und Anschrift des Hostinganbieters beziehungsweise Auftragsverarbeiters.
2. konkrete Speicherfrist der Webserver-Protokolle.
3. Backup-Speicherort und Löschfristen.
4. tatsächlich verwendetes Google-Gemini-/Cloud-Konto, Vertragsgrundlage, Datenregion und Drittlandtransfer.
5. belastbarer Einwilligungsnachweis für Gesundheitsdaten und optionale KI-Nutzung.
6. zuständige Datenschutzaufsichtsbehörde.

## Betroffene Dateien

- `src/App.tsx`
- `src/index.css`
- `src/components/LegalNotice.tsx`
- `docs/feinschliff-logo-rechtstexte-2026-07-10.md`
