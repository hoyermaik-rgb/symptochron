# AP-01 localStorage-Audit

Datum: 2026-07-10

Scope: `src/**/*.ts`, `src/**/*.tsx`

Suchmuster:

- `localStorage`
- `symptochron_*`
- `secureStore`

## Ergebnis

Die App nutzt bereits `secureStore` fuer Kernobjekte in IndexedDB, migriert aber mehrere Legacy-localStorage-Keys beim Start. Einige nicht sensible UI-/Statusflags liegen weiterhin in `localStorage`. Kritisch sind die Klartext-PIN (`symptochron_pin`), der Auto-Key ohne PIN (`symptochron_auto_key`) und KI-Caches mit Gesundheitsbezug.

## Key-Matrix

| Key | Fundstelle | Inhalt | Sensibilitaet | Ist-Zustand | Zielstorage | Massnahme |
| --- | --- | --- | --- | --- | --- | --- |
| `symptochron_theme` | `src/App.tsx` | Theme `light`/`dark` | Niedrig | localStorage aktiv | localStorage ok | Behalten. |
| `symptochron_onboarded` | `src/App.tsx` | Onboarding abgeschlossen | Niedrig | localStorage aktiv | localStorage ok | Behalten; bei Demo/Echtmodus erneut pruefen. |
| `symptochron_app_mode` | `src/App.tsx` | `real` oder `demo` | Niedrig/Mittel | localStorage aktiv | localStorage ok | Eingefuehrt in AP-03; steuert Export-Sperren im Demo-Modus. |
| `symptochron_pin` | `src/App.tsx` | Legacy-PIN im Klartext | Hoch | AP-02 migriert einmalig und entfernt den Key | Nicht speichern | Erledigt in AP-02; nur noch Legacy-Migrationspfad. |
| `symptochron_pin_enabled` | `src/App.tsx` | PIN-Schutz aktiviert | Niedrig | localStorage aktiv | localStorage ok | Behalten; enthaelt keine PIN. |
| `symptochron_crypto_salt` | `src/db/secureStore.ts` | PBKDF2-Salt | Niedrig | localStorage aktiv | localStorage ok | Behalten; Salt ist nicht geheim. |
| `symptochron_auto_key` | `src/db/secureStore.ts` | Rohschluessel fuer Auto-Key-Modus | Hoch | localStorage aktiv | Nicht im Klartext speichern | AP-02: Auto-Key-Modus neu bewerten oder abschalten. |
| `symptochron_diary` | `src/App.tsx` | Legacy-Tagebuchdaten | Hoch | Migration zu `secureStore.save('diary')`, danach remove | secureStore `diary` | Migrationstest in AP-02/AP-08. |
| `symptochron_meds` | `src/App.tsx` | Legacy-Medikamente | Hoch | Migration zu `secureStore.save('meds')`, danach remove | secureStore `meds` | Migrationstest in AP-02/AP-04. |
| `symptochron_mood` | `src/App.tsx` | Legacy-Stimmungsdaten | Hoch | Migration zu `secureStore.save('mood')`, danach remove | secureStore `mood` | Scope fuer Core Stable pruefen; MoodChron ist Schwester-App. |
| `symptochron_rls_surveys` | `src/App.tsx` | Legacy-Frageboegen | Hoch | Migration zu `secureStore.save('surveys')`, danach remove | secureStore `surveys` | Migrationstest. |
| `symptochron_appointments` | `src/App.tsx` | Legacy-Termine | Mittel/Hoch | Migration zu `secureStore.save('appts')`, danach remove | secureStore `appts` | Migrationstest. |
| `symptochron_sos_data` | `src/App.tsx` | Notfalldaten, Patientendaten | Hoch | Migration zu `secureStore.save('sos')`, danach remove | secureStore `sos` | Migrationstest; besonders schutzwuerdig. |
| `symptochron_blood_pressure` | `src/App.tsx` | Blutdruckwerte | Hoch | Migration zu `secureStore.save('bp')`, danach remove | secureStore `bp` | Migrationstest. |
| `symptochron_ui_prefs` | `src/App.tsx` | UI- und Modul-Prefs | Mittel | Migration zu `secureStore.save('prefs')`, danach remove | secureStore `prefs` | Beibehalten, weil enthaltene Module/Alarmzeiten Nutzungsprofil verraten koennen. |
| `symptochron_seeded` | `src/App.tsx` | Demo-Seeding-Status | Niedrig/Mittel | localStorage aktiv | Getrennter Modus-Status | AP-03: Demo-/Echtmodus trennen, keine Demo-Daten in echte Exporte. |
| `symptochron_notified_${slot}_${dateStr}` | `src/App.tsx` | Benachrichtigungsmarker pro Slot/Datum | Mittel | localStorage aktiv | secureStore `prefs` oder eigener Notification-Store | AP-02/AP-05: Retention begrenzen oder verschieben. |
| `symptochron_last_backup_reminder` | `src/App.tsx` | Zeitstempel Backup-Erinnerung | Niedrig | localStorage aktiv | localStorage ok | Behalten; keine Gesundheitsdaten. |
| `symptochron_ai_analysis` | `src/components/AiTrendAnalysis.tsx` | KI-Analyse aus Tagebuch/Meds | Hoch | localStorage aktiv | secureStore `aiAnalysis` | AP-03/AP-06: vor KI-Schleuse nicht im Klartext cachen. |
| `symptochron_ai_analysis_date` | `src/components/AiTrendAnalysis.tsx` | Datum KI-Analyse | Mittel | localStorage aktiv | Zusammen mit `aiAnalysis` | Zusammen verschieben oder aus Cache ableiten. |
| `symptochron_insight_data` | `src/components/DailyHealthInsight.tsx` | KI-Tageshinweis mit Gesundheitsbezug | Hoch | localStorage aktiv | secureStore `dailyInsight` | AP-03/AP-06: vor KI-Schleuse nicht im Klartext cachen. |
| `symptochron_insight_date` | `src/components/DailyHealthInsight.tsx` | Datum Tageshinweis | Mittel | localStorage aktiv | Zusammen mit `dailyInsight` | Zusammen verschieben oder aus Cache ableiten. |
| `symptochron_last_pdf_export` | `src/components/PdfExport.tsx` | Zeitstempel letzter PDF-Export | Mittel | localStorage aktiv | secureStore `prefs` | Verschieben, da Exportverhalten Gesundheitsnutzung anzeigen kann. |

## Weitere Befunde

- `localStorage.clear()` in `src/App.tsx` loescht global alle Keys der Origin. Ziel: auf bekannte `symptochron_*` Keys und IndexedDB-Daten beschraenken.
- Legacy-Migration parst JSON inline. Ziel: Fehler pro Key isolieren, damit ein defekter Legacy-Key nicht die gesamte Initialisierung beeintraechtigt.
- `secureStore` speichert verschluesselte Records in IndexedDB, nutzt aber ohne PIN einen in localStorage gespeicherten Rohschluessel. Das erfuellt die Offline-Nutzbarkeit, ist aber kein starker Schutz bei lokalem Zugriff.

## Zielbild

| Kategorie | Ziel |
| --- | --- |
| UI-only Flags | localStorage erlaubt, wenn kein Gesundheits- oder Nutzungsprofil entsteht. |
| Gesundheitsdaten | Nur verschluesselt ueber secureStore/IndexedDB. |
| KI-Caches | Nur verschluesselt, mit Einwilligung und Datenminimierung. |
| Schluessel/PIN | Keine PIN und kein Rohschluessel im Klartext-localStorage. |
| Legacy-Daten | Einmalige robuste Migration, danach gezieltes Entfernen. |

## AP-01 Abnahme

Erfuellt: Alle gefundenen localStorage-Keys sind erfasst und einem Zielstorage zugeordnet.

Offen fuer AP-02:

- PIN-Speicherung entfernen.
- Auto-Key-Konzept entscheiden.
- Migration mit defekten Legacy-Werten testen.
- KI- und PDF-Metadaten aus localStorage entfernen oder begruendet freigeben.
