CREATE TABLE IF NOT EXISTS medication_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_product_id INTEGER NOT NULL,
  pzn TEXT,
  package_size TEXT,
  package_unit TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medication_product_id) REFERENCES medication_products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_medication_packages_pzn
  ON medication_packages(pzn)
  WHERE pzn IS NOT NULL AND pzn <> '';

CREATE TABLE IF NOT EXISTS medication_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_product_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'product_name',
  FOREIGN KEY (medication_product_id) REFERENCES medication_products(id) ON DELETE CASCADE,
  UNIQUE(medication_product_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS ix_medication_aliases_normalized
  ON medication_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS medication_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO medication_packages (medication_product_id, pzn, package_size)
SELECT id, pzn, package_size
FROM medication_products
WHERE (pzn IS NOT NULL AND pzn <> '') OR (package_size IS NOT NULL AND package_size <> '');

INSERT OR IGNORE INTO medication_aliases (medication_product_id, alias, normalized_alias, alias_type)
SELECT id, product_name, normalized_name, 'product_name'
FROM medication_products;
