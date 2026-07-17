# Header-Logo Mobile-Feinschliff – 10.07.2026

## Ziel

Das bereits vorhandene Header-Logo sollte auf Mobilgeräten kompakter dargestellt werden, ohne Header, Footer, Navigation, Impressum oder Datenschutz erneut umzubauen.

## Änderung

- Header-Bildpfad auf das vorgegebene Asset `/Icon-192.png` gesetzt.
- Mobile Logo-Höhe von vormals 48 px auf 32 px reduziert.
- Desktop-/Tablet-Höhe auf 36 px gesetzt.
- Breite bleibt automatisch (`w-auto`), damit das Seitenverhältnis erhalten bleibt.
- `object-contain` bleibt aktiv, damit das Logo weder verzerrt noch abgeschnitten wird.
- Transparenter PNG-Hintergrund bleibt unverändert.

## Betroffene Datei

- `src/App.tsx`

## Nicht geändert

- Header-Struktur
- Navigation und Buttons
- Footer
- Impressum
- Datenschutz
- Logo-Datei selbst

## Prüfung

- TypeScript-Prüfung: `npm run lint` erfolgreich.
- Tests: `npm test` erfolgreich, 4 Testdateien / 16 Tests bestanden.
- Produktions-Build: `npm run build` erfolgreich.
- Sichtprüfung bei Android-typischer schmaler Breite 360 x 740 px:
  - Logo-Pfad: `/Icon-192.png`
  - gerenderte Mobilhöhe: 32 px
  - `object-fit: contain`
  - Bild vollständig geladen, kein Platzhalterbild
  - keine Überlappung mit Titel oder Header-Buttons
- Sichtprüfung Desktop-Breite 1024 x 768 px:
  - gerenderte Höhe: 36 px
  - keine Überlappung mit Titel oder Header-Buttons
