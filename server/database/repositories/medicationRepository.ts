import { getDatabase } from "../connection";

export interface MedicationSearchResult {
  pzn: string;
  name: string;
  wirkstoff: string;
  atc: string;
  dose: string;
  form: string;
  hersteller: string;
  "packungsgröße": string;
  verified: boolean;
  verificationStatus: string;
  source: string;
  stand: string;
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLocaleLowerCase("de-DE");
}

export function searchMedications(query: string, limit = 50): MedicationSearchResult[] {
  const db = getDatabase();
  const cleanQuery = normalizeSearchTerm(query);
  const normalizedPzn = cleanQuery.replace(/^0+/, "");
  const likeQuery = `%${cleanQuery}%`;

  const rows = db.prepare(`
    SELECT
      mp.pzn,
      mp.product_name,
      mp.active_ingredient_text,
      mp.atc_code,
      mp.strength,
      mp.dosage_form,
      mp.manufacturer,
      mp.package_size,
      mp.verification_status,
      ms.source_name,
      mp.source_updated_at
    FROM medication_products mp
    JOIN medication_sources ms ON ms.id = mp.source_id
    WHERE mp.is_active = 1
      AND (
        lower(mp.normalized_name) LIKE ?
        OR lower(COALESCE(mp.active_ingredient_text, '')) LIKE ?
        OR lower(COALESCE(mp.atc_code, '')) = ?
        OR mp.pzn = ?
        OR ltrim(COALESCE(mp.pzn, ''), '0') = ?
      )
    ORDER BY
      CASE WHEN mp.pzn = ? THEN 0
           WHEN lower(mp.normalized_name) = ? THEN 1
           WHEN lower(mp.normalized_name) LIKE ? THEN 2
           ELSE 3 END,
      mp.product_name COLLATE NOCASE
    LIMIT ?
  `).all(
    likeQuery,
    likeQuery,
    cleanQuery,
    cleanQuery,
    normalizedPzn,
    cleanQuery,
    cleanQuery,
    `${cleanQuery}%`,
    Math.min(Math.max(limit, 1), 50),
  ) as any[];

  return rows.map((row) => ({
    pzn: row.pzn ?? "",
    name: row.product_name,
    wirkstoff: row.active_ingredient_text ?? "",
    atc: row.atc_code ?? "",
    dose: row.strength ?? "",
    form: row.dosage_form ?? "",
    hersteller: row.manufacturer ?? "",
    "packungsgröße": row.package_size ?? "",
    verified: row.verification_status === "verified",
    verificationStatus: row.verification_status,
    source: row.source_name,
    stand: row.source_updated_at ?? "",
  }));
}

export function getMedicationCount(): number {
  const row = getDatabase().prepare(
    "SELECT COUNT(*) AS count FROM medication_products WHERE is_active = 1",
  ).get() as { count: number };
  return row.count;
}
