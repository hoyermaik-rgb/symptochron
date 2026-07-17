# AP-07 AI Output Guard

Datum: 2026-07-10

Scope:

- `src/utils.ts`
- `server.ts`
- `src/utils.test.ts`

## Problem vor AP-07

KI-Modelle koennen in medizinischen Applikationen unbeabsichtigt konkrete medizinische Anweisungen, Therapieänderungen oder Dosisanpassungen vorschlagen (z. B. "erhöhen Sie die Levodopa-Dosis auf 100 mg", "nehmen Sie das Medikament morgens statt abends", "setzen Sie Medikament X ab"). Solche Vorschlaege bergen erhebliche gesundheitliche Risiken fuer Patienten und koennen rechtliche Konsequenzen haben, da medizinische Verordnungen ausschließlich approbierten Aerzten vorbehalten sind. Es fehlte ein Sicherheitsfilter, der solche Ausgaben blockiert oder neutralisiert.

## Umsetzung

### System-Prompting Einschränkungen

- **Trends-Analyse**: Der System-Prompt in `/api/analyze-trends` wurde um explizite Anweisungen erweitert, die es der KI verbieten, Dosis-, Einnahmezeit- oder sonstige Therapieänderungen vorzuschlagen. Empfehlungen duerfen sich ausschließlich auf Lebensstil-, Ernährungs- und Verhaltensfaktoren beziehen.
- **Tages-Insight**: Der Prompt in `/api/daily-insight` wurde in gleicher Weise verschaerft, sodass der Fokus rein auf schlafhygienischen Routineanpassungen und Trigger-Vermeidung liegt.

### Nachgeschaltete Sicherheitsprüfung (aiOutputGuard)

In `src/utils.ts` wurde die Funktion `aiOutputGuard(text: string): { blocked: boolean; text: string }` implementiert. Diese prueft generierte Texte auf unerlaubte Muster mittels regulärer Ausdrücke:

- **Dosisanpassungen**: Erkennt Begriffe wie "Dosis/Dosierung/Menge" in Kombination mit Aktionen wie "erhöhen/reduzieren/verringern/verdoppeln/halbieren/absetzen" im selben Satz. Erkennt ebenfalls Muster wie "X mg statt Y mg".
- **Einnahmezeitverschiebungen**: Erkennt Begriffe wie "Einnahmezeit/Einnahmezeitpunkt/Wecker" kombiniert mit "vorverlegen/verschieben/ändern" sowie Saetze, die einen Wechsel der Tageszeiten ("morgens statt abends") vorschlagen.
- **Therapie- & Absetzbefehle**: Blockiert Saetze wie "setzen Sie Medikament X ab" oder "beenden Sie die Einnahme von Y".

### Neutralisierung unerlaubter Vorschläge

Falls ein Muster anschlaegt, wird der betroffene Satz bzw. Textblock neutralisiert und durch den standardisierten Warnhinweis ersetzt:
*“Bitte besprechen Sie eventuelle Anpassungen Ihrer Einnahmezeiten oder Dosierungen direkt mit Ihrem behandelnden Arzt. KI-Assistenten dürfen keine Therapieempfehlungen aussprechen.”*

- **Trends-Anwendung**: Der Filter prueft die einleitende Zusammenfassung (`summary`) sowie jeden einzelnen Eintrag der Empfehlungen (`recommendations`). Wird eine Empfehlung geblockt, wird sie durch den Warnhinweis ersetzt. Die uebrigen, sicheren Lebensstil-Empfehlungen bleiben erhalten.
- **Insights-Anwendung**: Prueft das erzeugte Insight (`insight`) und die Begruendung (`rationale`).

### Unit Tests & Absicherung

- **`src/utils.test.ts`**: Ein neuer Testfall `aiOutputGuard correctly blocks medical, dosing, and schedule changes` deckt 9 Negativtestfaelle (Satzkonstrukte, die geblockt werden muessen) und 5 Positivtestfaelle (Saetze, die unveraendert bleiben muessen) ab.

## AP-07 Abnahme

Erfuellt:

- System-Prompts verbieten der KI ausdruecklich medizinische Behandlungsweisungen.
- Der nachgeschaltete `aiOutputGuard` filtert Dosisänderungen, Zeitverschiebungen und Absetzempfehlungen zuverlaessig aus.
- Negativtestfaelle sind komplett gruen (`pass 6/6`).
- Linter und Build-Prozess weisen keine Fehler auf.
