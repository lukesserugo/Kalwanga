-- Align taxRate columns with the percentage convention used by the
-- application. No data normalization is needed — the DB has zero rows
-- holding a decimal value — but the column defaults and the CHECK
-- constraints must be brought in line.
--
-- Before:
--   company_settings.taxRate DEFAULT 0.0
--   products.taxRate         (no default)
--
-- After:
--   company_settings.taxRate DEFAULT 8
--   products.taxRate         DEFAULT 0
--   every taxRate column constrained to [0, 100]

-- ── Step 1: align defaults with schema.prisma ───────────────────────

ALTER TABLE "company_settings"
  ALTER COLUMN "taxRate" SET DEFAULT 8;

ALTER TABLE "products"
  ALTER COLUMN "taxRate" SET DEFAULT 0;

-- ── Step 2: enforce the percentage convention going forward ─────────

ALTER TABLE "products"
  ADD CONSTRAINT "products_tax_rate_range"
  CHECK ("taxRate" IS NULL OR ("taxRate" >= 0 AND "taxRate" <= 100));

ALTER TABLE "company_settings"
  ADD CONSTRAINT "company_settings_tax_rate_range"
  CHECK ("taxRate" >= 0 AND "taxRate" <= 100);

ALTER TABLE "sales_settings"
  ADD CONSTRAINT "sales_settings_tax_rate_range"
  CHECK ("taxRate" >= 0 AND "taxRate" <= 100);

ALTER TABLE "cart_settings"
  ADD CONSTRAINT "cart_settings_tax_rate_range"
  CHECK ("taxRate" >= 0 AND "taxRate" <= 100);

ALTER TABLE "checkout_settings"
  ADD CONSTRAINT "checkout_settings_tax_rate_range"
  CHECK ("taxRate" >= 0 AND "taxRate" <= 100);

ALTER TABLE "business_units"
  ADD CONSTRAINT "business_units_tax_rate_range"
  CHECK ("taxRate" IS NULL OR ("taxRate" >= 0 AND "taxRate" <= 100));

ALTER TABLE "inventories"
  ADD CONSTRAINT "inventories_tax_rate_range"
  CHECK ("taxRate" IS NULL OR ("taxRate" >= 0 AND "taxRate" <= 100));

ALTER TABLE "tax_records"
  ADD CONSTRAINT "tax_records_tax_rate_range"
  CHECK ("taxRate" >= 0 AND "taxRate" <= 100);

ALTER TABLE "tax_calculations"
  ADD CONSTRAINT "tax_calculations_tax_rate_range"
  CHECK ("taxRate" >= 0 AND "taxRate" <= 100);
