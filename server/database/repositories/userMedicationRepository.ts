import { randomUUID } from "node:crypto";
import { getDatabase } from "../connection";

export interface UserMedicationInput {
  id?: string;
  userId?: string | null;
  medicationProductId?: number | null;
  customName?: string | null;
  customDosage?: string | null;
  customForm?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  schedule?: Record<string, number>;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function listUserMedications(userId?: string): unknown[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT um.*, mp.product_name, mp.pzn, mp.active_ingredient_text,
           mp.verification_status
    FROM user_medications um
    LEFT JOIN medication_products mp ON mp.id = um.medication_product_id
    WHERE (? IS NULL OR um.user_id = ?)
    ORDER BY COALESCE(um.start_date, um.created_at) DESC
  `).all(userId ?? null, userId ?? null);
}

export function createUserMedication(input: UserMedicationInput): string {
  const db = getDatabase();
  const id = input.id?.trim() || randomUUID();
  if (!input.medicationProductId && !textOrNull(input.customName)) {
    throw new Error("medicationProductId oder customName ist erforderlich.");
  }
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`INSERT INTO user_medications (
      id, user_id, medication_product_id, custom_name, custom_dosage,
      custom_form, start_date, end_date, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
      .run(id, textOrNull(input.userId), input.medicationProductId ?? null,
        textOrNull(input.customName), textOrNull(input.customDosage),
        textOrNull(input.customForm), textOrNull(input.startDate),
        textOrNull(input.endDate), textOrNull(input.notes));

    const insertSchedule = db.prepare(`INSERT INTO medication_schedules
      (id, user_medication_id, time_of_day, amount) VALUES (?, ?, ?, ?)`);
    for (const [slot, amount] of Object.entries(input.schedule ?? {})) {
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Ungültiger Einnahmeplan.");
      insertSchedule.run(randomUUID(), id, slot, amount);
    }
    db.prepare(`INSERT INTO medication_audit_log(entity_type, entity_id, action, details_json)
      VALUES ('user_medication', ?, 'created', ?)`)
      .run(id, JSON.stringify({ medicationProductId: input.medicationProductId ?? null }));
    db.exec("COMMIT;");
    return id;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function deleteUserMedication(id: string): boolean {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = db.prepare("DELETE FROM user_medications WHERE id = ?").run(id);
    if (result.changes > 0) {
      db.prepare(`INSERT INTO medication_audit_log(entity_type, entity_id, action)
        VALUES ('user_medication', ?, 'deleted')`).run(id);
    }
    db.exec("COMMIT;");
    return result.changes > 0;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function recordMedicationIntake(userMedicationId: string, takenAt: string, amount?: number, notes?: string): string {
  const db = getDatabase();
  const exists = db.prepare("SELECT 1 FROM user_medications WHERE id = ?").get(userMedicationId);
  if (!exists) throw new Error("Nutzermedikation nicht gefunden.");
  if (!takenAt || Number.isNaN(Date.parse(takenAt))) throw new Error("Ungültiger Einnahmezeitpunkt.");
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) throw new Error("Ungültige Einnahmemenge.");
  const id = randomUUID();
  db.prepare(`INSERT INTO medication_intakes(id, user_medication_id, taken_at, amount, notes)
    VALUES (?, ?, ?, ?, ?)`).run(id, userMedicationId, takenAt, amount ?? null, textOrNull(notes));
  return id;
}
