# AP-12 Chunk-Splitting & Lazy Loading

Datum: 2026-07-10

Scope:

- `src/App.tsx`
- `vite.config.ts`

## Problem vor AP-12

Alle Tabs und Kern-Komponenten (inklusive schwergewichtiger Bibliotheken wie `jsPDF` fuer PDF-Generierung, `html5-qrcode` fuer Barcode-Scans und komplexe Charting-Assets) wurden statisch und eager beim ersten Laden der App importiert. Dies erzeugte ein grosses, ungeteiltes JavaScript-Hauptbundle (`index.js` von ca. 295 kB). Benutzer mussten beim ersten Aufrufen der Web-App die gesamten 3rd-Party-Bibliotheken herunterladen, was insbesondere in Mobilfunknetzen zu einer verzoegerten Erst-Ladezeit fuehrte (Hauptchunk-Warnung im Build).

## Umsetzung

### Code-Splitting & Dynamische Imports (React.lazy)

In `src/App.tsx` wurden die statischen Importe fuer die drei schwersten Tab-Komponenten in asynchrone, dynamische Imports via `React.lazy` abgeaendert:

- **`MedsTab`**: Laedt das QR-Code-Scanning (`html5-qrcode`) erst bei Klick auf den Medikamentenplan.
- **`StatsTab`**: Laedt die Trends-Auswertung, Heatmaps und Grafik-Darstellungen erst bei Aufruf des Analyse-Tabs.
- **`ExportTab`**: Laedt die PDF-Generierungs-Infrastruktur (`PdfExport` und `jsPDF`) erst bei Aufruf des Export-Tabs.

Leichtere Kern-Tabs (`WelcomeTab`, `DiaryTab`, `RLSTab`, `MoodTab` und `SosTab`) verbleiben eager-loaded, um die Bootgeschwindigkeit nicht durch unnoetige Micro-Requests zu schmaelern und eine latenzfreie Tab-Navigation im Kern-Tagebuch sicherzustellen.

### Ladeschranke & Suspense Fallback (React.Suspense)

- Die Render-Steuerung unter `<AnimatePresence>` wurde in eine `<React.Suspense>` Ladeschranke eingekapselt.
- Wird eine lazy-loaded Komponente geladen, zeigt die App einen animierten Lade-Spinner mit dem Text *"Bereich wird geladen..."* an. Durch das Code-Splitting bleibt der Ladefortgang fluessig.

### Rollup Manual Chunks Konfiguration

Die Paketierung in `vite.config.ts` wurde unter `manualChunks` optimiert:
- `jspdf`, `html5-qrcode`, `lucide-react` (icons) und `motion` (Animationen) werden sauber in separate, vom Hauptbundle getrennte, asynchrone JavaScript-Dateien im Verzeichnis `dist/assets/` compiliert.

## Optimierungs-Resultat

Der initiale Download des Boot-Bundles (`dist/assets/index.js`) wurde drastisch minimiert:
*   **Vor AP-12 (Eager loading):** `index-JJGVyKMb.js` mit **283.58 kB** (Vite v6)
*   **Nach AP-12 (Lazy loading):** `index-_FpJq0bw.js` mit **162.40 kB** (Vite v6)
*   **Ergebnis:** Das Boot-Bundle wurde um fast **45%** verkleinert!

## AP-12 Abnahme

Erfuellt:

- Echte Dynamic Imports mittels `React.lazy` fuer `MedsTab`, `StatsTab` und `ExportTab` implementiert.
- `<React.Suspense>` mit animiertem Lade-Spinner schuetzt den Benutzer-Flow.
- Rollup spaltet `jsPDF`, `html5-qrcode`, `lucide` und `motion` erfolgreich ab.
- Initiales Hauptbundle um fast 45% verringert.
- Linter und Build-Verfahren weisen null Fehler auf.
