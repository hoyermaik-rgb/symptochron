# Onboarding-, PIN- und Spracheingabe-Stabilisierung – 10.07.2026

## Block A – Istzustand vor Änderungen

### Geprüfte Bereiche

- `src/App.tsx`
- `src/components/Onboarding.tsx`
- `src/components/PinLock.tsx`
- `src/db/secureStore.ts`
- `src/components/DiaryTab.tsx`
- `src/components/MoodTab.tsx`
- `src/secureStore.test.ts`
- `docs/securestore-crypto-note.md`
- `docs/sqlite-appdaten-umbau-db07.md`
- `docs/roadmap-progress.md`

### PIN-Ersteinrichtung

- Das Onboarding besteht vor Änderung aus drei Schritten: Willkommen, optionale Profilgrunddaten, Abschluss.
- Der Erststart kann ohne PIN abgeschlossen werden.
- `symptochron_onboarded=true` wird direkt beim Abschluss des Onboardings geschrieben.
- Eine PIN kann später in den Einstellungen eingerichtet werden.
- Die spätere PIN-Einrichtung verwendet aktuell ein Browser-`prompt()`.
- Die Klartext-PIN wird nach AP-02 nicht mehr persistent gespeichert.
- Bestehende Legacy-PINs aus `symptochron_pin` werden beim Booten in den verschlüsselten PIN-Verifier migriert und danach entfernt.

### SecureStore und PIN-Verifier

- `secureStore.init(pin)` leitet den AES-GCM-Schlüssel per PBKDF2/SHA-256 aus der PIN und einem Salt ab.
- `secureStore.savePinVerifier()` speichert einen verschlüsselten internen Datensatz `__pin_verifier`.
- `secureStore.verifyPin()` prüft die PIN indirekt, indem der Verifier mit dem abgeleiteten Schlüssel entschlüsselt wird.
- `secureStore.changePin(oldPin, newPin, knownKeys)` re-verschlüsselt bekannte Datensätze und schreibt oder entfernt den PIN-Verifier.
- PIN und Klartextdaten verlassen den Browser nicht.

### PIN-Fehlversuche

- Vor Änderung existiert keine persistente Fehlversuchssperre.
- Falsche PIN-Eingaben werden nur im aktuellen React-Zustand als Fehlermeldung angezeigt.
- Reload oder App-Neustart setzen den Versuchszustand faktisch zurück.
- Während der Prüfung ist der Bestätigungsbutton deaktiviert, weitere Fehlversuchslogik fehlt.
- Es gibt keine automatische Datenlöschung bei falscher PIN.

### Spracheingabe

- Spracheingabe ist in `DiaryTab.tsx` und `MoodTab.tsx` implementiert.
- Beide Komponenten erzeugen je eine `SpeechRecognition`-Instanz im `useEffect`.
- `interimResults` ist bereits `false`.
- Das Resultat wird über `e.results[0][0].transcript` an die Notizen angehängt.
- `SpeechRecognition.start()` wird nicht gegen parallele Starts abgesichert.
- Mehrfach ausgelöste finale Ergebnisse können denselben Text erneut anhängen.
- Cleanup beim Unmount ist bisher nicht explizit vorhanden.

## Ziel dieses Blocks

- PIN-Ersteinrichtung verbindlich in das Onboarding aufnehmen.
- Onboarding erst nach erfolgreicher PIN-Einrichtung als abgeschlossen speichern.
- Persistente PIN-Fehlversuchssperre ergänzen.
- Spracheingabe gegen parallele Starts und doppelt angehängte Resultate härten.
- Bestehende SQLite-Architektur unverändert lassen: genau eine produktive Datenbank `data/symptochron.db`.

## Block B – PIN-Festlegung im Onboarding

### Umsetzung

- Das Onboarding wurde von 3 auf 9 kompakte Schritte erweitert:
  1. Willkommen und Moduswahl
  2. Zweck der App
  3. Datenschutz und lokale Verschlüsselung
  4. optionale Profilgrunddaten
  5. PIN festlegen
  6. PIN bestätigen
  7. Backup- und Wiederherstellungshinweis
  8. Zusammenfassung
  9. App starten
- Der Erststart kann nicht mehr ohne PIN abgeschlossen werden.
- PIN-Regel: 4 bis 8 Ziffern, passend zur bestehenden PIN-Maske.
- Die PIN wird zweimal eingegeben und verglichen.
- Die PIN-Felder verwenden `type="password"`, `inputMode="numeric"` und begrenzen Eingaben auf Ziffern.
- Der Onboarding-Abschluss ruft `secureStore.changePin(...)` auf und schreibt erst danach:
  - `symptochron_pin_enabled=true`
  - `symptochron_onboarded=true`
  - den gewählten App-Modus
- Bestehende Nutzer mit `symptochron_onboarded=true` bleiben außerhalb des Onboardings.
- Demo- und Importmodus bleiben erhalten, können den PIN-Schritt aber nicht mehr umgehen.
- Es wird weiterhin keine Klartext-PIN persistiert.

### Geänderte Dateien

- `src/components/Onboarding.tsx`
- `src/App.tsx`

## Block C – PIN-Fehlversuchssperre

### Umsetzung

- Neue isolierte Sperrlogik in `src/security/pinLockout.ts`.
- Persistente technische Sperrdaten in `localStorage` unter `symptochron_pin_lock_state`.
- Gespeichert werden nur:
  - `failedAttempts`
  - `lockedUntil`
  - `lastFailedAt`
- Es werden keine PIN, keine personenbezogenen Daten und keine medizinischen Daten gespeichert.
- Sperrstaffel:
  - Versuch 1 bis 4: keine Sperre
  - Versuch 5: 30 Sekunden
  - Versuch 6: 60 Sekunden
  - Versuch 7: 5 Minuten
  - ab Versuch 8: 15 Minuten
- Während einer aktiven Sperre:
  - wird keine PIN-Prüfung ausgelöst,
  - Nummerntasten und Bestätigung sind deaktiviert,
  - die Restzeit wird sichtbar angezeigt.
- Erfolgreiche Anmeldung löscht den Sperrzustand.
- Reload/App-Neustart umgehen die Sperre nicht, weil Zähler und Sperrzeit persistent sind.
- Rückwärts verstellte Systemzeit hebt eine aktive Sperre nicht auf. Vollständiger Schutz gegen bewusstes Vorstellen der Systemzeit ist offline ohne vertrauenswürdige Zeitquelle nicht erreichbar.

### Geänderte Dateien

- `src/security/pinLockout.ts`
- `src/security/pinLockout.test.ts`
- `src/components/PinLock.tsx`

## Spracheingabe – Mehrfachausgabe behoben

### Umsetzung

- Gemeinsame Auswertungsfunktion `extractFinalSpeechTranscript(...)` ergänzt.
- Es werden nur finale SpeechRecognition-Ergebnisse ab `resultIndex` verarbeitet.
- Interim-Ergebnisse werden ignoriert.
- Doppelt gemeldete finale Transkripte derselben Session werden nicht erneut angehängt.
- Parallele `SpeechRecognition.start()`-Aufrufe werden per Ref-Guard verhindert.
- Beim Unmount wird die Recognition bestmöglich per `abort()` beendet.

### Geänderte Dateien

- `src/speechRecognition.ts`
- `src/speechRecognition.test.ts`
- `src/components/DiaryTab.tsx`
- `src/components/MoodTab.tsx`

## Qualifizierte Zwischentests

### 10.07.2026 – gezielte Unit-Tests

Ausgeführt:

```powershell
npx vitest run src/security/pinLockout.test.ts src/speechRecognition.test.ts
```

Ergebnis:

- 2 Testdateien bestanden
- 8 Tests bestanden
- PIN-Sperrstaffel geprüft
- persistente Lockout-State-Fortschreibung geprüft
- Verhalten bei zurückgestellter Systemzeit geprüft
- Formatierung der Restzeit geprüft
- SpeechRecognition-Final-Result-Auswertung geprüft
- Interim-Ergebnisse und doppelte Ergebnisbereiche ausgeschlossen

## Abschlussprüfung

### TypeScript

Ausgeführt:

```powershell
npm run lint
```

Ergebnis:

- erfolgreich
- 0 TypeScript-Fehler

### Vollständige Unit-Tests

Ausgeführt:

```powershell
npm test
```

Ergebnis:

- 6 Testdateien bestanden
- 24 Tests bestanden
- bestehende SecureStore-, Datenbank- und Utils-Tests weiterhin grün
- neue PIN-Lockout- und SpeechRecognition-Tests grün

### Produktions-Build

Ausgeführt:

```powershell
npm run build
```

Ergebnis:

- erfolgreich
- Vite-Build erfolgreich
- PWA-Dateien erzeugt
- Server-Bundle `dist/server.cjs` erzeugt

### Browser-Ablaufprüfung

Umgebung:

- lokaler Dev-Server
- schmale Mobilbreite 360 x 740 px
- frische Browser-Origin über `http://localhost:3000`

Geprüft:

- Onboarding startet bei Schritt 1/9.
- Moduswahl `Leeres Tagebuch starten` führt in den neuen Ablauf.
- Zu kurze PIN wird abgewiesen.
- Falsche PIN-Bestätigung wird abgewiesen.
- Nach falscher Bestätigung bleibt der Ablauf im Bestätigungsschritt.
- Korrekte Bestätigung führt zum Backup- und Wiederherstellungshinweis.
- Vor dem finalen Start wird die App nicht geöffnet.
- Browser-Console: keine Warnungen oder Fehler im geprüften Ablauf.

Nicht ausgeführt:

- Der finale Onboarding-Start wurde im Browser bewusst nicht ausgelöst, damit keine echte Re-Key-/Migrationsaktion gegen vorhandene Daten oder `data/symptochron.db` angestoßen wird. Die zugehörige Re-Key-/Verifier-Logik ist durch bestehende SecureStore-Tests und den erfolgreichen Build abgedeckt.
