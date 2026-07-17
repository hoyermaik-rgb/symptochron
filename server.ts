import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

import { aiPrivacyGuard, aiOutputGuard } from "./src/utils";
import { runMigrations } from "./server/database/migrations";
import { importMedicationJsonIfEmpty } from "./server/database/importMedicationJson";
import { getMedicationCount, searchMedications } from "./server/database/repositories/medicationRepository";
import { createUserMedication, deleteUserMedication, listUserMedications, recordMedicationIntake } from "./server/database/repositories/userMedicationRepository";
import { deleteSecureAppRecord, getSecureAppRecord, upsertSecureAppRecord } from "./server/database/repositories/secureAppRecordRepository";

function sanitizePayload(obj: any): any {
  if (typeof obj === 'string') {
    return aiPrivacyGuard(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }
  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = sanitizePayload(obj[key]);
    }
    return newObj;
  }
  return obj;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  runMigrations();
  importMedicationJsonIfEmpty();
  console.log(`SQLite-Datenbank bereit: ${getMedicationCount()} aktive Medikamentendatensätze.`);


  // Zentraler, Ende-zu-Ende verschlüsselter App-Datenspeicher.
  // Der Server speichert ausschließlich AES-GCM-Ciphertext und kann Gesundheitsdaten nicht lesen.
  app.get("/api/secure-records/:recordKey", (req, res) => {
    const record = getSecureAppRecord(req.params.recordKey);
    return record ? res.json(record) : res.status(404).json({ error: "Nicht gefunden." });
  });

  app.put("/api/secure-records/:recordKey", (req, res) => {
    try {
      const record = upsertSecureAppRecord({
        recordKey: req.params.recordKey,
        encryptionVersion: req.body?.encryptionVersion,
        ivBase64: req.body?.ivBase64,
        ciphertextBase64: req.body?.ciphertextBase64,
      });
      return res.json(record);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Ungültiger Datensatz." });
    }
  });

  app.delete("/api/secure-records/:recordKey", (req, res) => {
    try {
      return deleteSecureAppRecord(req.params.recordKey)
        ? res.status(204).end()
        : res.status(404).json({ error: "Nicht gefunden." });
    } catch (error) {
      return res.status(500).json({ error: "Löschen fehlgeschlagen." });
    }
  });

  // API Route: Medikamentensuche ausschließlich aus der lokalen SQLite-Datenbank.
  app.post("/api/bfarm/search", (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string" || !query.trim()) {
        return res.status(400).json({ error: "Query parameter is required and must be a non-empty string." });
      }

      const cleanQuery = aiPrivacyGuard(query).trim();
      const results = searchMedications(cleanQuery, 50);
      return res.json({
        source: "sqlite_medication_database",
        results,
        exactMatch: results.some((item) =>
          item.pzn === cleanQuery.padStart(8, "0") ||
          item.name.toLocaleLowerCase("de-DE") === cleanQuery.toLocaleLowerCase("de-DE"),
        ),
      });
    } catch (error) {
      console.error("SQLite medication search failed:", error);
      return res.status(500).json({ error: "Internal medication database error." });
    }
  });

  app.get("/api/user-medications", (req, res) => {
    try {
      const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
      return res.json({ results: listUserMedications(userId) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Nutzermedikationen konnten nicht geladen werden." });
    }
  });

  app.post("/api/user-medications", (req, res) => {
    try {
      const id = createUserMedication(req.body ?? {});
      return res.status(201).json({ id });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Ungültige Nutzermedikation." });
    }
  });

  app.delete("/api/user-medications/:id", (req, res) => {
    try {
      return deleteUserMedication(req.params.id) ? res.status(204).end() : res.status(404).json({ error: "Nicht gefunden." });
    } catch (error) {
      return res.status(500).json({ error: "Löschen fehlgeschlagen." });
    }
  });

  app.post("/api/medication-intakes", (req, res) => {
    try {
      const { userMedicationId, takenAt, amount, notes } = req.body ?? {};
      const id = recordMedicationIntake(userMedicationId, takenAt, amount, notes);
      return res.status(201).json({ id });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Ungültige Einnahme." });
    }
  });

  // API Route: Trend Analysis using Gemini
  app.post("/api/analyze-trends", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please add your key in Settings > Secrets."
        });
      }

      const sanitizedBody = sanitizePayload(req.body);
      const { dataPoints, medications } = sanitizedBody;

      if (!dataPoints || !Array.isArray(dataPoints)) {
        return res.status(400).json({ error: "Invalid dataPoints format. Expecting an array." });
      }

      // Initialize Google GenAI
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Construct prompt
      const prompt = `
Du bist ein erfahrener medizinischer Datenanalyst und wellnessorientierter KI-Berater für Patienten mit Restless-Legs-Syndrom (RLS).
Bitte führe eine gründliche, evidenzbasierte Trend- und Korrelationsanalyse der letzten 30 Tage basierend auf den bereitgestellten Patientendaten durch.

Hier sind die konfigurierten Medikamente des Patienten:
${JSON.stringify(medications, null, 2)}

Hier sind die täglichem Logbuch-Einträge der letzten 30 Tage (mit durchschnittlicher RLS-Stärke 0-10, Schlafstunden, Schlafqualität 1-5, und den an diesem Tag tatsächlich eingenommenen Medikamenten-IDs):
${JSON.stringify(dataPoints, null, 2)}

Deine Analyse MUSS professionell, mitfühlend, leicht verständlich und auf Deutsch verfasst sein.
Vermeide rein allgemeine Ratschläge oder falsche medizinische Diagnosen, sondern verweise direkt auf statistische oder mathematische Muster in den bereitgestellten Daten (z. B. "An Tagen mit vollständiger Medikamententreue lag die durchschnittliche RLS-Stärke um 2.4 Punkte niedriger als an Tagen mit Lücken"). Wenn kaum Daten vorliegen, weise konstruktiv darauf hin.

WICHTIG: Du darfst dem Patienten NIEMALS konkrete Dosisänderungen (z. B. Erhöhung/Reduzierung von Dosen, Ändern von mg-Werten), Therapieanpassungen (z. B. Absetzen von Medikamenten) oder Einnahmezeitänderungen (z. B. Verschiebung der Einnahmezeit um X Minuten oder Ändern der Tageszeit) empfehlen. Das Verändern von Medikationsplänen ist ausschließlich Ärzten vorbehalten. Halte Empfehlungen auf Lebensstil-, Ernährungs- und allgemeiner Verhaltensebene (z.B. Dehnen, Schlafroutine, Koffeinvermeidung).

Formatiere dein Ergebnis als valides JSON mit exakt der folgenden Struktur:
{
  "summary": "Einleitende Zusammenfassung der RLS-Verläufe und der Gesamtlage der letzten 30 Tage (3-4 Sätze). Informell aber professionell gehalten.",
  "adherenceRate": "Berechneter Prozentsatz der Medikamententreue, d.h. Anteil der Tage an denen konfigurierte Medikamente genommen wurden im Vergleich zu den protokollierten Tagen (Zahl als String, z.B. \"85%\").",
  "correlations": [
    {
      "title": "Titel der Korrelation (z.B. 'Einnahmeregelmäßigkeit vs. RLS-Intensität' oder 'Schlafstunden vs RLS')",
      "observation": "Beobachtung und statistischer Zusammenhang basierend auf den Daten.",
      "impact": "Einfluss-Level (z.B. 'Stark positiv', 'Neutral', 'Negativ', 'Verstärkend')"
    }
  ],
  "patterns": [
    "Identifiziertes Zeit- oder Verhaltensmuster 1 (z.B. 'Abendliche Verschlimmerung am Wochenende bei Kaffeekomsum')",
    "Identifiziertes Zeit- oder Verhaltensmuster 2"
  ],
  "recommendations": [
    "Praktische, lebensstil- oder verhaltensbasierte Empfehlung 1 (z.B. 'Abendliche Waden-Dehnübungen vor dem Schlafengehen')",
    "Praktische Empfehlung 2",
    "Praktische Empfehlung 3"
  ]
}

Gib AUSSCHLIESSLICH dieses JSON-Objekt zurück. Schreibe absolut keine Erklärungen oder Markdown-Begleitkommentare im Header/Footer.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text received from Gemini API");
      }

      // Try to parse to ensure it's valid JSON
      try {
        const parsed = JSON.parse(responseText.trim());

        // Apply AI Output Guard to summary
        if (parsed.summary) {
          const summaryGuard = aiOutputGuard(parsed.summary);
          parsed.summary = summaryGuard.text;
        }

        // Apply AI Output Guard to recommendations
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          parsed.recommendations = parsed.recommendations.map((rec: string) => {
            const recGuard = aiOutputGuard(rec);
            return recGuard.text;
          });
        }

        res.json(parsed);
      } catch (jsonErr) {
        // If not perfectly JSON, return a wrapper or try to sanitize
        console.error("Failed to parse Gemini JSON. Raw text:", responseText);
        res.json({
          summary: "Bei der Datenanalyse ist ein Formatfehler aufgetreten.",
          adherenceRate: "Unbekannt",
          correlations: [{ title: "Rohdaten-Analyse", observation: responseText, impact: "Neutral" }],
          patterns: ["Keine Muster extrahiert"],
          recommendations: ["Versuche es bitte erneut, um korrekte strukturierte Empfehlungen zu generieren."]
        });
      }

    } catch (error: any) {
      console.error("Error in /api/analyze-trends:", error);
      res.status(500).json({ error: error?.message || "Internal Server Error in Gemini analysis." });
    }
  });

  // API Route: Health Insight of the Day using Gemini
  app.post("/api/daily-insight", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please add your key in Settings > Secrets."
        });
      }

      const sanitizedBody = sanitizePayload(req.body);
      const { todayEntry, recentEntries } = sanitizedBody;

      // Initialize Google GenAI
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
Du bist ein renommierter RLS-Spezialist und fachlicher Gesundheitsberater.
Basierend auf den aktuellen Logbucheinträgen des Patienten sollst du den "Gesundheits-Tipp des Tages" (Health Insight of the Day) generieren.
Dieser Tipp muss sich auf EINEN erkannten Auslöser (Trigger) aus den Daten beziehen (z.B. spätes Koffein, Alkohol, Schlafmangel, langes Sitzen, mangelnde Bewegung oder Stress) und eine sofort umsetzbare Lebensstiländerung vorschlagen.

Hier ist der heutige Tagebucheintrag (falls bereits vorhanden):
${JSON.stringify(todayEntry, null, 2)}

Hier sind die Tagebucheinträge der letzten 7 Tage als historischer Kontext:
${JSON.stringify(recentEntries, null, 2)}

Bitte analysiere diese Einträge. Falls wenig spezifische Daten eingetragen sind oder der heutige Eintrag leer ist, generiere einen wissenschaftlich fundierten, praxisnahen Tipp zur RLS-Prävention (z.B. Magnesiumzufuhr, Beindehnung vor dem Schlafengehen, Wechselduschen).

WICHTIG: Du darfst dem Patienten NIEMALS konkrete Dosisänderungen (z. B. Erhöhung/Reduzierung von Dosen), Medikamentenabsetzungen oder Einnahmezeitänderungen (z. B. Verschiebung der Einnahmezeit) empfehlen. Das Verändern von Medikationsplänen ist Ärzten vorbehalten. Halte Empfehlungen rein auf Lebensstil-, Ernährungs- und allgemeiner Verhaltensebene.

Gib das Ergebnis EXAKT als valides JSON in diesem Format zurück (auf Deutsch):
{
  "category": "Kategorie des Tipps (z.B. 'Ernährung', 'Abendroutine', 'Bewegung', 'Schlafhygiene', 'Koffein')",
  "trigger": "Der identifizierte Auslöser oder Risikofaktor (z.B. 'Später Kaffee-Konsum am Nachmittag' oder 'Erhöhtes Stresslevel')",
  "insight": "Eine konkrete, sofort umsetzbare, leicht anwendbare Lebensstil-Anpassung (1-2 kurze Sätze im freundlichen Du-Stil).",
  "rationale": "Kurze Begründung (1-2 Sätze), warum diese Anpassung heute besonders wichtig ist, basierend auf den beobachteten Mustern in den Daten."
}

Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt ohne irgendwelche Markdown-Formatierungen, Erklärungen oder Backticks.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response received from Gemini API");
      }

      try {
        const parsed = JSON.parse(responseText.trim());

        // Apply AI Output Guard to insight
        if (parsed.insight) {
          const insightGuard = aiOutputGuard(parsed.insight);
          parsed.insight = insightGuard.text;
        }

        // Apply AI Output Guard to rationale
        if (parsed.rationale) {
          const rationaleGuard = aiOutputGuard(parsed.rationale);
          parsed.rationale = rationaleGuard.text;
        }

        res.json(parsed);
      } catch (jsonErr) {
        console.error("Failed to parse daily insight JSON. Raw text:", responseText);
        // Clean fallback
        res.json({
          category: "Abendroutine",
          trigger: "Allgemeine RLS-Vorsorge",
          insight: "Mache heute Abend vor dem Zubettgehen 5-10 Minuten leichte Dehnübungen für Waden und Oberschenkel.",
          rationale: "Da heute nur wenige Daten vorliegen, hilft diese bewährte Präventionsmethode, die abendliche Muskelentspannung zu fördern und unangenehme RLS-Sensationen zu lindern."
        });
      }

    } catch (error: any) {
      console.error("Error in /api/daily-insight:", error);
      res.status(500).json({ error: error?.message || "Internal Server Error in Gemini daily insight." });
    }
  });

  // Kompatibilitätsroute: nutzt dieselbe SQLite-Suche, keine zweite Datenquelle.
  app.post("/api/bfarm/demo-search", (req, res) => {
    const query = typeof req.body?.query === "string" ? aiPrivacyGuard(req.body.query).trim() : "";
    if (!query) return res.status(400).json({ error: "Query parameter is required." });
    return res.json({ source: "sqlite_medication_database", results: searchMedications(query, 50) });
  });

  // Vite middleware setup (development vs production)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
