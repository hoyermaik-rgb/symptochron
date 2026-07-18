# SC-MD-01 – Verlustfreie Erstübernahme vorhandener Handy-Daten

Datum: 2026-07-18

Status: bereit fuer einen Trockenlauf

## Zweck

SC-MD-01 führt eine einmalig gestartete, private Erstübernahme der bereits vorhandenen Handy-Daten in die zentrale SQLite-Datenbank `data/symptochron.db` ein. Die lokalen Handy-Daten bleiben während des Umbaus unangetastet. IndexedDB bleibt als verschlüsselter Sicherheitscache erhalten.

## Sicherheitsregeln

- Kein automatischer Start beim App-Launch.
- Nur für private Entwicklernutzung sichtbar.
- Während der Migration keine `DELETE`-Operationen.
- Remote-Daten dürfen lokale Daten nicht überschreiben.
- Lokale Daten werden nur hochgeladen und anschließend verifiziert.
- Bei Konflikten oder Fehlern bleibt der lokale Bestand unverändert.
- Die Migration liest direkt aus IndexedDB und umgeht den normalen remote-first-load-Pfad.
- `completed`/`matched` wird erst nach vollständiger Verifikation aller vorgesehenen RecordKeys gesetzt.

## Datenfluss

1. Lokalen verschlüsselten Record direkt aus IndexedDB lesen.
2. Lokalen Record entschlüsseln, kanonisch serialisieren und SHA-256 bilden.
3. Optionalen Serverbestand per `GET` lesen und vor dem Vergleich entschlüsseln.
4. Bei unterschiedlichem lokalem und remote entschlüsseltem Inhalt abbrechen; es erfolgt kein `PUT`.
5. Nur bei fehlendem oder nachweislich leerem Serverbestand lokalen Datensatz per `PUT` hochladen.
6. Serverdatensatz erneut per `GET` lesen.
7. Entschlüsselten Klartext erneut kanonisch hashen sowie Größen und IDs vergleichen.
8. Nur bei vollständiger Übereinstimmung als `verified` markieren.

## Verifikation

Für jeden RecordKey werden mindestens geprüft:

- Datensatzgröße
- relevante IDs
- Datums-Keys
- SHA-256-Hash des kanonisch serialisierten Klartexts

Die kanonische Serialisierung sortiert Objekt-Keys deterministisch. Arrays behalten ihre Reihenfolge. Unterschiedliche IVs oder neu erzeugte Ciphertexte bei identischem Klartext erzeugen keinen Konflikt, weil der Vergleich auf entschlüsseltem semantischem Inhalt erfolgt.

## Abbruchbedingungen

- fehlender lokaler Kernbereich
- Schemafehler
- Hash-Abweichung
- Netzwerkfehler
- unerwarteter Serverinhalt
- fehlgeschlagener `PUT` oder `GET`
- Konflikt zwischen lokal und remote
- Remote-/Decrypt-Fehler, die nicht als leerer Serverbestand behandelt werden dürfen
- beschädigte oder nicht entschlüsselbare lokale Records
- fehlender lokaler Kernbereich bei vorhandenem Remote-Record

## Snapshot-Voraussetzung

Vor dem Start muss administrativ ein Snapshot von `data/symptochron.db` erstellt werden. Die App führt keinen Dateisystem-Snapshot selbst aus.

## Testabdeckung

- leerer Server → lokaler Upload
- identischer Remote-/Lokalbestand → Verifikation
- Konfliktfall → Abbruch ohne Überschreiben
- Netzwerkfehler → Abbruch
- Feature-Schalter deaktiviert → Ansicht verborgen
- `DELETE` wird im Migrationspfad nicht verwendet
- identischer semantischer Inhalt mit anderer JSON-Key-Reihenfolge
- identischer Inhalt mit neuem Ciphertext bzw. anderer IV
- Browser-Neustart bei `in_progress`
- beschädigter lokaler Record
- fehlender lokaler Kernbereich bei vorhandenem Remote-Record

## Offene Risiken

- Der normale App-Boot bleibt außerhalb der Migration remote-first.
- Die äußere Snapshot-Checkbox in `App.tsx` ist noch nicht mit der Panel-Logik gekoppelt.
- Ein eigener Test für einen leeren, aber gültigen Record fehlt noch.

## Erhalt des Caches

Nach der Erstübernahme bleibt IndexedDB als verschlüsselter Sicherheitscache erhalten. Die SQLite-Datenbank ist die produktive Hauptablage, der Browsercache bleibt ergänzend bestehen.
