# AP-10 PDF-Berichte einfrieren (Musterberichte)

Datum: 2026-07-10

Scope:

- `src/components/PdfExport.tsx`
- `src/components/ExportTab.tsx`

## Problem vor AP-10

1. **Typo im Disclaimer**: Die Fusszeile des Berichts enthielt den auffaelligen Schreibfehler *"Er stellt keine direkte Diganose dar."* statt *"Diagnose"*.
2. **Keine PDF-Erprobung im Demo-Modus**: Der PDF-Arzt-Report war im Demo-Modus komplett gesperrt. Dadurch konnten weder Benutzer noch Auditoren das Kern-Feature (PDF-Export) anhand der Beispieldaten begutachten, ohne zuvor muehsam eigene Datensaetze einzutragen.
3. **Fehlende Kennzeichnung von Testdaten**: Ohne Kennzeichnung bestand das Risiko, dass Demo- oder Testberichte irrtuemlich als echte Patientenhistorie an Mediziner uebermittelt werden.

## Umsetzung

### Fehlerkorrektur (Disclaimer)

- In `src/components/PdfExport.tsx` (Zeile 361) wurde der Text des Fusszeilen-Disclaimers korrigiert:
  *Alt:* `... keine direkte Diganose dar.`
  *Neu:* `... keine direkte Diagnose dar.`

### Muster-Report Freischaltung (Demo-Wasserzeichen)

- **Muster-Report**: Der Export-Button wurde im Demo-Modus freigegeben. Benutzer koennen den PDF-Bericht direkt aus dem Demo-Zustand heraus generieren.
- **Diagonal-Wasserzeichen (`drawDemoWatermark`)**: 
  Wird die PDF-Generierung im Demo-Modus gestartet (`isDemoMode: true`), wird auf jeder generierten Seite (Deckblatt, Verlaufskurve & Heatmap, Medikationsplan sowie alle Folgeseiten der Tagebuch-Matrix) ein schwach transparentes (8% Deckkraft) rotes Diagonal-Wasserzeichen aufgedruckt:
  **"DEMO / TESTDATEN"**
  Dieses liegt mittig quer ueber der Seite. Das Schriftbild und die Lesbarkeit der medizinischen Beispieldaten bleiben voll erhalten (Sichtpruefung erfolgreich), jedoch ist ein Missbrauch oder Verwechslung mit echten Befunden ausgeschlossen.
- **Transparenz-Fallback**: Ist die Opacity-Funktion `doc.GState` im jsPDF-Kontext nicht verfuegbar, greift ein farblicher Fallback auf ein extrem helles Rot (`RGB 253, 226, 226`), das dieselbe Wirkung erzielt.

## AP-10 Abnahme

Erfuellt:

- Rechtschreibfehler "Diganose" -> "Diagnose" im Hauptdisclaimer behoben.
- Demo-Wasserzeichen diagonal auf allen Export-Seiten integriert.
- PDF-Export fuer Demo-Daten zwecks Sichtpruefung ("Muster-Report") freigegeben.
- Build-Prozess und Linter sind gruen.
