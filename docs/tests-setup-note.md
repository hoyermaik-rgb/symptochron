# AP-11 Tests einrichten

Datum: 2026-07-10

Scope:

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `src/utils.test.ts`
- `src/secureStore.test.ts`
- `playwright.config.ts`
- `tests/basic.spec.ts`

## Problem vor AP-11

Es gab keine standardisierte Test-Infrastruktur im Projekt. Die Unittests wurden behelfsmaessig ueber den integrierten Node-Testrunner und `tsx` direkt aufgerufen (`npx tsx --test src/utils.test.ts`). Es gab keine dedizierte Moeglichkeit, die kryptografischen Verlaeufe der IndexedDB/LocalStorage-basierten `SecureStore`-Datenbank oder End-to-End-Benutzeraktionen (Playwright) automatisiert zu pruefen, und kein einfaches `npm test` Kommando.

## Umsetzung

### Test-Runner & package.json Integration

- **Vitest**: Vitest wurde als moderne, extrem schnelle Testumgebung installiert.
- **npm scripts**: 
  - `"test": "vitest run"` fuehrt alle Unittests atomar aus.
  - `"test:e2e": "playwright test"` ist fuer spaetere E2E-Tests konfiguriert.
- **tsconfig.json**: Die Playwright-Konfiguration und die e2e-Tests in `tests/` wurden von der TypeScript-Kompilierungspruefung (`tsc --noEmit`) ausgeschlossen. Dies verhindert Kompilierungsfehler auf Systemen, auf denen Playwright-Bibliotheken nicht lokal installiert sind.
- **vite.config.ts**: Vitest wurde so konfiguriert, dass es den `tests/` Ordner ignoriert, da dieser exklusiv Playwright-Tests vorbehalten ist.

### Unittests Migration & Ausbau

- **`src/utils.test.ts`**: Wurde erfolgreich auf Vitest umgezogen. Alle 7 Test-Suiten (PZN, MedDB, PII-Privacy Guard, Output-Safety Guard, Backup-Schema) laufen unter Vitest.
- **`src/secureStore.test.ts`**: Ein neuer Testfall prueft die Ver- und Entschluesselung von `SecureStore`. Da Node.js nativ kein `localStorage` und kein IndexedDB besitzt, wurde Folgendes ueber Mocking geloest:
  - `idb-keyval` (`get`, `set`, `del`) wurde mittels `vi.mock` abgefangen und speichert Daten im Speicher (`Map`).
  - `localStorage` wurde global gemockt, um Salt und Auto-Keys im Speicher zu sichern.
  - Die echten Verschluesselungsverfahren (`AES-GCM` mit 256 Bit) sowie die PBKDF2-Schluesselableitung aus PINs werden dank der in Node.js verfuegbaren Web Crypto API realitaetsgetreu mitgeprueft.

### End-to-End Test-Setup (Playwright)

- **`playwright.config.ts`**: Konfiguriert einen Chromium-Testlauf. Beinhaltet einen lokalen `webServer`-Startbefehl via `npm run dev`, um Playwright-Tests vollautomatisch mit dem lokalen Vite-Server zu verbinden.
- **`tests/basic.spec.ts`**: Implementiert einen E2E-Smoke-Test, der die Homepage aufruft und prueft, ob der HTML-Titel "SymptoChron" korrekt geladen wird.

## AP-11 Abnahme

Erfuellt:

- Standardisiertes `npm test` fuehrt Vitest-Suiten aus.
- 8 von 8 Unittests laufen gruen durch (Dauer ~680ms).
- IndexedDB und LocalStorage-Verschluesselung des `SecureStore` ist via Mocking im Unittest vollstaendig abgedeckt.
- Playwright-E2E-Infrastruktur steht und ist fuer CI vorbereitet.
- Build-Prozess und Linter laufen fehlerfrei.
