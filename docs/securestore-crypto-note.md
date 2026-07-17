# AP-02 secureStore-Verifikation

Datum: 2026-07-10

Scope:

- `src/db/secureStore.ts`
- `src/App.tsx`
- `src/components/PinLock.tsx`

## Kryptokonzept Ist-Stand

| Bereich | Umsetzung | Bewertung |
| --- | --- | --- |
| Verschluesselung | WebCrypto `AES-GCM` mit 256 Bit | Geeignet fuer lokale Datenverschluesselung. |
| IV | 12 Byte Zufalls-IV pro `save()` | Geeignete GCM-IV-Laenge; IV wird mit Ciphertext gespeichert. |
| PIN-Key-Derivation | `PBKDF2`, `SHA-256`, 100000 Iterationen, 16 Byte Salt | Grundsaetzlich passend; Iterationszahl spaeter gegen Zielgeraete benchmarken. |
| Salt | `symptochron_crypto_salt` in localStorage | OK, Salt ist nicht geheim. |
| Datenablage | Verschluesselte Records via IndexedDB/idb-keyval | OK fuer Offline-Core. |
| Fehlerverhalten | Decrypt-Fehler werden geloggt und `null` zurueckgegeben | Stabil, aber fuer Import/Migration noch genauer testbar. |

## Umgesetzte Haertung

### Keine persistente Klartext-PIN mehr

Vorher:

- `symptochron_pin` wurde in `localStorage` gespeichert.
- Beim App-Start wurde mit dieser PIN entschluesselt, bevor die Sperre sichtbar war.
- Die Lock-UI verglich die Eingabe direkt gegen den gespeicherten Klartextwert.

Jetzt:

- `symptochron_pin` wird nicht mehr geschrieben.
- Bestehende Legacy-PINs werden beim Start einmalig in einen verschluesselten PIN-Verifier migriert und danach aus `localStorage` entfernt.
- Persistent bleibt nur `symptochron_pin_enabled=true` als nicht-geheimer Status.
- Der eingegebene PIN lebt nur noch im React-State der laufenden Session.
- Bei aktivem PIN-Schutz werden Gesundheitsdaten erst nach erfolgreicher PIN-Pruefung geladen.

### Verschluesselter PIN-Verifier

`secureStore` speichert fuer PIN-Schutz einen verschluesselten internen Datensatz `__pin_verifier`.

Pruefung:

1. Nutzer gibt PIN ein.
2. `secureStore.init(pin)` leitet den AES-Key ab.
3. `secureStore.verifyPin()` versucht, `__pin_verifier` zu entschluesseln.
4. Nur bei gueltigem Verifier werden Kern-Daten geladen und die App entsperrt.

## Geaenderte Dateien

- `src/db/secureStore.ts`: `savePinVerifier()`, `verifyPin()`, `removePinVerifier()` ergaenzt; `changePin()` schreibt oder entfernt den Verifier.
- `src/components/PinLock.tsx`: optionale asynchrone PIN-Pruefung ergaenzt; falscher PIN bleibt im Sperrbildschirm.
- `src/App.tsx`: Startlogik auf PIN-Flag plus Verifier umgestellt; Legacy-`symptochron_pin` wird entfernt; Datenload nach PIN verschoben.

## Restrisiken / Folgearbeit

- Der Auto-Key-Modus ohne PIN speichert weiterhin `symptochron_auto_key` in `localStorage`. Das ist nutzbar fuer bequemen Offline-Betrieb, aber kein starker Schutz gegen lokalen Zugriff. Entscheidung offen: fuer Core Stable deaktivieren oder im Datenschutztext klar als Komfortmodus kennzeichnen.
- Legacy-Migration parst JSON weiterhin inline. AP-08 sollte defekte Legacy-Werte isoliert testen und abfangen.
- Die Iterationszahl von PBKDF2 sollte auf Zielgeraeten gemessen werden, damit Entsperren nicht zu langsam wird, aber Brute-Force nicht trivial ist.

## AP-02 Abnahme

Erfuellt:

- AES-Modus dokumentiert.
- Key-Derivation, Salt und IV dokumentiert.
- PIN-Wechselpfad schreibt einen verschluesselten Verifier.
- Klartext-PIN wird nicht mehr persistent gespeichert.
- Falsche PIN kann den Verifier nicht entschluesseln und entsperrt die App nicht.

Teilweise offen:

- Auto-Key-Konzept ist bewusst als Restrisiko markiert und sollte im naechsten Datenschutz-/Storage-Schritt entschieden werden.
