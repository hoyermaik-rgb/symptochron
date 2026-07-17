import fs from "fs";
import path from "path";
import { getDatabase } from "./connection";

interface SourceMedication {
  pzn?: unknown;
  name?: unknown;
  wirkstoff?: unknown;
  atc?: unknown;
  dose?: unknown;
  form?: unknown;
  hersteller?: unknown;
  "packungsgröße"?: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeName(value: string): string {
  return value.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
}

function normalizePzn(value: unknown): string {
  const digits = text(value).replace(/\D/g, "");
  if (!digits || digits.length > 8) return "";
  return digits.padStart(8, "0");
}

export function importMedicationJsonIfEmpty(): void {
  const db = getDatabase();
  const existing = db.prepare("SELECT COUNT(*) AS count FROM medication_products").get() as { count: number };
  if (existing.count > 0) return;

  const preferredFile = path.join(process.cwd(), "Bfarm_DB", "bfarm_db_neu.json");
  if (!fs.existsSync(preferredFile)) {
    console.warn("SQLite-Medikamentenimport übersprungen: Bfarm_DB/bfarm_db_neu.json fehlt.");
    return;
  }

  const parsed = JSON.parse(fs.readFileSync(preferredFile, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Die Medikamenten-Importdatei enthält kein JSON-Array.");

  const sourceKey = "bfarm_local_import_2026-07-10";
  db.prepare(`
    INSERT INTO medication_sources (source_key, source_name, source_file, imported_at, notes)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      source_name = excluded.source_name,
      source_file = excluded.source_file,
      imported_at = CURRENT_TIMESTAMP,
      notes = excluded.notes
  `).run(
    sourceKey,
    "Lokaler BfArM-Ausgangsdatenbestand",
    path.relative(process.cwd(), preferredFile),
    "Unverändert importierter Ausgangsdatenbestand; leere Felder wurden nicht ergänzt oder geschätzt.",
  );

  const source = db.prepare("SELECT id FROM medication_sources WHERE source_key = ?").get(sourceKey) as { id: number };
  const run = db.prepare(`
    INSERT INTO medication_import_runs (source_id, status, input_records)
    VALUES (?, 'running', ?)
  `).run(source.id, parsed.length);

  const insert = db.prepare(`
    INSERT INTO medication_products (
      source_id, source_record_id, pzn, product_name, normalized_name,
      active_ingredient_text, atc_code, strength, dosage_form,
      manufacturer, package_size, verification_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'source_imported')
    ON CONFLICT(source_id, source_record_id) DO UPDATE SET
      pzn = excluded.pzn,
      product_name = excluded.product_name,
      normalized_name = excluded.normalized_name,
      active_ingredient_text = excluded.active_ingredient_text,
      atc_code = excluded.atc_code,
      strength = excluded.strength,
      dosage_form = excluded.dosage_form,
      manufacturer = excluded.manufacturer,
      package_size = excluded.package_size,
      imported_at = CURRENT_TIMESTAMP,
      is_active = 1
  `);

  let inserted = 0;
  let skipped = 0;
  db.exec("BEGIN IMMEDIATE;");
  try {
    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index] as SourceMedication;
      const name = text(item.name);
      if (!name) {
        skipped += 1;
        continue;
      }
      const pzn = normalizePzn(item.pzn);
      insert.run(
        source.id,
        pzn || `row-${index + 1}`,
        pzn || null,
        name,
        normalizeName(name),
        text(item.wirkstoff) || null,
        text(item.atc) || null,
        text(item.dose) || null,
        text(item.form) || null,
        text(item.hersteller) || null,
        text(item["packungsgröße"]) || null,
      );
      inserted += 1;
    }
    db.prepare(`
      UPDATE medication_import_runs
      SET finished_at = CURRENT_TIMESTAMP, status = 'completed',
          inserted_records = ?, skipped_records = ?
      WHERE id = ?
    `).run(inserted, skipped, Number(run.lastInsertRowid));
    db.prepare(`
      UPDATE medication_sources
      SET record_count = ?, imported_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(inserted, source.id);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    db.prepare(`
      UPDATE medication_import_runs
      SET finished_at = CURRENT_TIMESTAMP, status = 'failed', error_message = ?
      WHERE id = ?
    `).run(error instanceof Error ? error.message : String(error), Number(run.lastInsertRowid));
    throw error;
  }

  const curatedFile = path.join(process.cwd(), "bfarm_db.json");
  let curatedCount = 0;
  if (fs.existsSync(curatedFile)) {
    const curated = JSON.parse(fs.readFileSync(curatedFile, "utf8"));
    if (Array.isArray(curated)) {
      const curatedKey = "symptochron_curated_medications_2026-07-10";
      db.prepare(`
        INSERT INTO medication_sources (source_key, source_name, source_file, imported_at, notes)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(source_key) DO UPDATE SET imported_at = CURRENT_TIMESTAMP
      `).run(
        curatedKey,
        "SymptoChron kuratierter BfArM-Teilbestand",
        path.relative(process.cwd(), curatedFile),
        "Manuell kuratierter Teilbestand. Verifizierungsstatus aus dem bisherigen Projektstand übernommen.",
      );
      const curatedSource = db.prepare("SELECT id FROM medication_sources WHERE source_key = ?").get(curatedKey) as { id: number };
      const deleteExistingPzn = db.prepare("DELETE FROM medication_products WHERE pzn = ?");
      const upsertCurated = db.prepare(`
        INSERT INTO medication_products (
          source_id, source_record_id, pzn, product_name, normalized_name,
          active_ingredient_text, atc_code, strength, dosage_form,
          manufacturer, package_size, verification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified')
        ON CONFLICT(source_id, source_record_id) DO UPDATE SET
          pzn = excluded.pzn,
          product_name = excluded.product_name,
          normalized_name = excluded.normalized_name,
          active_ingredient_text = excluded.active_ingredient_text,
          atc_code = excluded.atc_code,
          strength = excluded.strength,
          dosage_form = excluded.dosage_form,
          manufacturer = excluded.manufacturer,
          package_size = excluded.package_size,
          verification_status = 'verified',
          imported_at = CURRENT_TIMESTAMP,
          is_active = 1
      `);
      db.exec("BEGIN IMMEDIATE;");
      try {
        for (let index = 0; index < curated.length; index += 1) {
          const item = curated[index] as SourceMedication;
          const name = text(item.name);
          const pzn = normalizePzn(item.pzn);
          if (!name || !pzn) continue;
          deleteExistingPzn.run(pzn);
          upsertCurated.run(
            curatedSource.id, pzn, pzn, name, normalizeName(name),
            text(item.wirkstoff) || null, text(item.atc) || null,
            text(item.dose) || null, text(item.form) || null,
            text(item.hersteller) || null, text(item["packungsgröße"]) || null,
          );
          curatedCount += 1;
        }
        db.prepare("UPDATE medication_sources SET record_count = ? WHERE id = ?")
          .run(curatedCount, curatedSource.id);
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
    }
  }

  console.log(`SQLite-Medikamentenimport abgeschlossen: ${inserted} Quelldatensätze, ${curatedCount} kuratierte Datensätze, ${skipped} übersprungen.`);
}
