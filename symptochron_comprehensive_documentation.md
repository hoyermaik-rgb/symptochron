# Systemdokumentation & Entwicklungs-Roadmap: SymptoChron

Dieses Dokument dient als umfassende Übersicht und technisches Handbuch für den SymptoChron-Gesundheitsmanager. Es beschreibt den Aufbau, den Code, die Installation sowie die regulatorischen/UX-bezogenen Verbesserungspotenziale (30-Punkte-Roadmap).

---

## 1. Einleitung & Zielgruppe
SymptoChron ist eine spezialisierte digitale Tagebuch- und Verlaufs-App für Patientinnen und Patienten mit **chronischen Schmerzen** und neurologischen Erkrankungen wie dem **Restless-Legs-Syndrom (RLS)**. 
Die App ermöglicht es Nutzern, Symptome zu tracken, Medikamentenpläne nach Bundeseinheitlichem Medikationsplan (BMP) zu verwalten, Wechselwirkungen zu prüfen und Notfalldaten (SOS) sowie einen Arzt-Verlaufsbericht (PDF) zu exportieren.

---

## 2. Installation & Ausführung

### Lokale Entwicklung & Start
1. **Repository klonen** und in das Projektverzeichnis wechseln.
2. **Abhängigkeiten installieren**:
   ```bash
   npm install
   ```
3. **Entwicklungsserver starten**:
   ```bash
   npm run dev
   ```
   Die App läuft lokal unter `http://localhost:3000`.

### Produktion & Docker-Bereitstellung
Das Projekt ist dockerisiert und verwendet Docker Compose zur automatischen Orchestrierung inklusive NodeJS und Express-Server.
1. **Container bauen und im Hintergrund starten**:
   ```bash
   docker compose up -d --build
   ```
2. **Container neu generieren (z. B. nach Code-Updates)**:
   ```bash
   docker compose up -d --force-recreate
   ```
   Die Server-Instanz ist auf Port `3050` freigegeben.

### PWA-Installation (Progressive Web App)
SymptoChron ist offline-first ausgelegt.
- **Android / Chrome**: Über die Menüleiste des Browsers „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.
- **iOS / Safari**: Teilen-Symbol (Viereck mit Pfeil nach oben) antippen und „Zum Home-Bildschirm“ wählen.

---

## 3. Struktur & Code-Verzeichnis (Code Map)

Das Projekt ist als moderner Vite + React + TypeScript-Stack mit einem ExpressJS-Backend aufgebaut.

```
symptochron/
├── index.html                   # HTML-Einstiegspunkt (enthält PWA-Manifest und Icon-Links)
├── package.json                 # Projektabhängigkeiten und Skripte (build, dev, lint)
├── server.ts                    # Express-Backend (stellt REST-Endpoints & Daily AI Insights bereit)
├── server/
│   └── bfarm_db.json            # Lokale DiGA-Datenbank-Kopie für API-Zwecke
├── src/
│   ├── main.tsx                 # React-Initialisierung
│   ├── App.tsx                  # Hauptkomponente (State-Management, Routing und Reiter-Weichen)
│   ├── fhirMapper.ts            # Mappings für HL7 FHIR Standard (ePA-Interoperabilität)
│   ├── index.css                # Globales CSS (Tailwind und Custom Dark Mode Styles)
│   ├── types.ts                 # Zentrale TypeScript-Typdefinitionen (DiaryEntry, Medication, etc.)
│   ├── utils.ts                 # Hilfsfunktionen (Pearson-Korrelation, Datum-Formatierungen)
│   └── components/              # Modulare App-Komponenten
│       ├── WelcomeTab.tsx       # Startseite (Vorratswarnung, Arzttermine, Schlaf-Score)
│       ├── DiaryTab.tsx         # Tagebuch (Symptom-Weiche, Schieberegler, Körperkarte)
│       ├── MedsTab.tsx          # Medikationsplan (BMP-Tabelle, Wechselwirkungen, PDF-Druck)
│       ├── StatsTab.tsx         # Verlauf (Musteranalysen, Korrelations-Übersetzer)
│       ├── Charts.tsx           # Symptom-Kurven (SVG-Diagramme mit Einnahme-Pillen)
│       ├── SosTab.tsx           # SOS-Notfallpass (QR-Code, Wallet-Ausweis-Export)
│       ├── ExportTab.tsx        # Datenexporte (Datumsfilter, E-Mail-Generator)
│       ├── PdfExport.tsx        # Klinischer Arzt-Report PDF (Executive Summary für Visiten)
│       └── Onboarding.tsx       # Einführung und erste Einrichtung
```

---

## 4. Die 30-Punkte-Roadmap (Hebel zur DiGA & MDR-Reife)

### A. Kurzfristige Maßnahmen (Sofort umzusetzen)
1. **Korrektur von Validierungsdaten**: Systematische Prüfung aller Standardmedikamente (z. B. Zuordnung von Antikonvulsiva vs. Opioiden) im Demo-Bestand zur Sicherung der klinischen Glaubwürdigkeit.
2. **Krypto-Schutz für Mail-Exporte**: Deaktivierung des unverschlüsselten `mailto`-Body-Texts bei sensiblen Patientendaten. Umstellung auf passwortgeschützte Zip-Dateien.
3. **[ERLEDIGT] DSGVO-SOS-Einwilligung**: Checkbox im SOS-Bereich integriert. Patient muss explizit einwilligen, bevor Notfalldaten unverschlüsselt verarbeitet werden dürfen (`dsgvoConsent`).
4. **[ERLEDIGT] Unit-Tests für die Statistik**: Abdeckung des Pearson-Korrelations-Algorithmus in `src/utils.test.ts` (vollständige Suite für positive, negative, schwache Korrelationen sowie Randfälle).
5. **Caching-Optimierung**: Speicherung der täglich generierten AI-Insights im LocalStorage, um unnötige Serverlast und API-Kosten zu vermeiden.
6. **WCAG-Buttons-Kontrast**: Anpassung der Umrandungen und Textfarben inaktiver Buttons im Dark Mode, um überall Kontrastwerte von über 4.5:1 sicherzustellen.
7. **Validierung von Eingaben im Krisenplan**: Pflichtfelder für Notfallnummern im Mood-Krisenplan implementieren, um Fehleingaben (z.B. unvollständige Telefonnummern) auszuschließen.
8. **Automatisierte Backup-Erinnerung**: Einblendung eines Pop-ups alle 30 Tage, das den Nutzer an den Export seiner verschlüsselten Backups erinnert.
9. **[ERLEDIGT] Beseitigung von Vite-Chunk-Warnings**: Konfiguration von Rollup in `vite.config.ts` zur Chunk-Splittung (`manualChunks` für schwere Abhängigkeiten wie jsPDF, html5-qrcode, lucide).
10. **Warnung vor Abweichungen des Bestands**: Einfügen eines Disclaimers im Dashboard-Bestandsbanner, der klarstellt, dass der digitale Vorrat keine manuelle Kontrolle der Boxen ersetzt.

### B. Mittelfristige Maßnahmen (Zertifizierungs-Vorbereitung)
11. **[ERLEDIGT - DEMO] Echte Arzneimittel-DB**: Backend-Route `/api/bfarm/search` in `server.ts` implementiert, die in lokaler BfArM-Datenbank sucht, mit Live-Gemini-Resolver als intelligentem Fallback.
12. **MIO-DataMatrix-Codes**: Implementierung echter zweidimensionaler XML-DataMatrix-Grafiken auf dem BMP-Ausdruck zur Einlesbarkeit im Praxisverwaltungssystem (PVS).
13. **[ERLEDIGT] Verschlüsselte Offline-Datenbank**: Sichere Verschlüsselung aller kritischen Keys (Tagebuch, Medikamente, Vitaldaten) mittels AES in der IndexedDB über `secureStore.ts`.
14. **Service Worker Endpoints**: Vollständige PWA-Offline-Registrierung aller API-Endpunkte für die Nutzung ohne jegliche Internetverbindung.
15. **[ERLEDIGT] Standardisierte Diagnostik (IRLS)**: Digitale Erfassung des klinischen Internationalen RLS-Schweregrad-Fragebogens (IRLS) mit validiertem Gesamtscore (0–40) im RLS-Tagebuchmodus.
16. **[ERLEDIGT] Interoperabilität (FHIR)**: FHIR-Konvertierung in `src/fhirMapper.ts` und Exportfunktion ("⚕️ HL7 FHIR Export") im ExportTab eingebaut, um Daten an die ePA zu übertragen.
17. **[ERLEDIGT] App-Sperre**: Lokale PIN-Code-Sperre über modalen `PinLock`-Overlay-Mechanismus in `App.tsx` integriert.
18. **[ERLEDIGT] BMP-Import via Scan**: Scanner in `MedsTab.tsx` liest 2D-DataMatrix-Codes (XML-Knoten `<M>` mit Attributen `p`, `a`, `m`, `v`, `h`, `z`) aus und befüllt Pläne & Einnahmezeiten vollautomatisch.
19. **Lokale Web Push API**: Lokale Erinnerungs-Benachrichtigungen für Einnahmen und Tagebucheinträge direkt über den Service Worker ohne externen Push-Dienst.
20. **Erweiterte Interaktionsprüfung**: Einbindung von Lebensmitteln (z.B. Eisenpräparate blockieren L-Dopa-Einnahme) in die Wechselwirkungs-Ampel.

### C. Langfristige Maßnahmen (DiGA-Zulassung & Telematik)
21. **Fast-Track-Zulassung**: Anmeldung beim BfArM als offizielle digitale Gesundheitsanwendung (DiGA) zur Abrechenbarkeit auf Rezept.
22. **MDR-Klasse-IIa-Zertifizierung**: Zertifizierung der App als Medizinprodukt der Klasse IIa nach der europäischen Medizinprodukteverordnung (MDR).
23. **BSI TR-03161 Sicherheitszertifikat**: Durchführung eines Penetrationstests und Erhalt des BSI-Zertifikats zum Nachweis maximaler Datensicherheit.
24. **Schnittstelle KIM**: Anbindung an die Telematikinfrastruktur über KIM (Kommunikation im Medizinwesen) zur gesicherten Direktübermittlung an Ärzte.
25. **Wearables & Actigraphie**: Koppelung mit Smartwatches zur objektiven Erfassung von nächtlicher Unruhe (Periodic Limb Movements in Sleep - PLMS) als zweitem RLS-Verlaufsparameter.
26. **Klinische RCT-Studie**: Durchführung einer randomisierten, kontrollierten Studie (RCT) zum Nachweis des medizinischen Nutzens (besseres Schmerzmanagement).
27. **On-Device Machine Learning**: Vorhersage von Symptom-Spitzen durch lokale neuronale Netze (TensorFlow.js) zur präventiven Trigger-Warnung.
28. **Anbindung ePA 2.0**: Direkte Synchronisation und Datenaustausch mit der elektronischen Patientenakte (ePA) der Krankenkassen.
29. **Multi-User / Pflegeportal**: Mandantenfähigkeit für pflegende Angehörige oder zur Echtzeit-Freigabe für behandelnde Schmerztherapeuten.
30. **Internationalisierung (EU-MDR)**: Übersetzung und Validierung der medizinischen Skalen für die europäische Zulassung in Englisch, Spanisch und Französisch.
