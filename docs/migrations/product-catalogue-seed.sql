-- =============================================================
-- Vertex Metals — Product Catalogue Seed Data
-- Run in Supabase SQL Editor
-- Safe to re-run — all inserts are idempotent (name-checked)
-- CN codes are indicative; verify before CBAM/customs filing
-- default_markup_pct left NULL — set per your margin strategy
-- vat_rate / insurance_pct stored as decimals: 0.200 = 20%, 0.005 = 0.5%
-- =============================================================


-- ── 1. Remove test/placeholder data ──────────────────────────

DELETE FROM product_lines
WHERE name IN ('Screw, Special – PN 130035904', 'Steel Wire Test');

DELETE FROM product_families
WHERE name IN ('ENGINEERED PARTS - AEROSPACE', 'STEEL PRODUCTS');


-- ── 2. Normalise existing aluminium family name ───────────────

UPDATE product_families
SET name = 'Aluminium Products'
WHERE name = 'ALUMINIUM PRODUCTS';

UPDATE product_lines
SET metal_family = 'Aluminium Products',
    sub_type     = 'Alloy Wire'
WHERE (name ILIKE '%AA1350%' OR name ILIKE '%EC Grade%')
  AND metal_family IS DISTINCT FROM 'Aluminium Products';


-- ── 3. Insert product families (skip if already present) ─────

INSERT INTO product_families (id, name, description, active)
SELECT gen_random_uuid(), t.name, t.description, true
FROM (VALUES
  ('Aluminium Products',                'Aluminium alloys, wire, bar, sheet and structural forms'),
  ('Copper & Copper Products',          'Copper wire, rod, sheet, plate, tube and concentrate'),
  ('Stainless Steel',                   'Austenitic, ferritic and duplex stainless steel in all forms'),
  ('Mild Steel',                        'Structural and engineering mild steel grades'),
  ('Other Metals & Alloys',             'Brass, bronze, tool steel, nickel alloys, titanium and specialist metals'),
  ('Critical Minerals & Concentrates',  'Copper concentrate, lithium, mica and strategic minerals')
) AS t(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM product_families pf WHERE pf.name = t.name
);


-- ── 4. Insert product lines (skip if name already present) ───
-- Columns: name, metal_family, sub_type, cn_code,
--          vat_rate, insurance_pct, active, notes

INSERT INTO product_lines (
  id, name, metal_family, sub_type, cn_code,
  vat_rate, insurance_pct, active, notes
)
SELECT
  gen_random_uuid(),
  t.name, t.metal_family, t.sub_type, t.cn_code,
  t.vat_rate, t.insurance_pct, t.active, t.notes
FROM (VALUES

  -- ── ALUMINIUM PRODUCTS ──────────────────────────────────────
  -- EC Grade (AA1350) already exists — only 6101 and 6201 added here
  ('Aluminium Alloy Core Wire — 6101',
   'Aluminium Products', 'Alloy Wire', '7605 19 00',
   0.200, 0.005, true,
   'IEC 60889 / ASTM B232 — T81 / T6 temper'),

  ('Aluminium Alloy Core Wire — 6201',
   'Aluminium Products', 'Alloy Wire', '7605 19 00',
   0.200, 0.005, true,
   'IEC 60889 / ASTM B232 — T81 temper'),

  ('Aluminium Bar & Rod',
   'Aluminium Products', 'Bar & Rod', '7604 29 10',
   0.200, 0.005, true,
   'Multiple alloys on request'),

  ('Aluminium Sheet, Plate & Coil',
   'Aluminium Products', 'Sheet & Plate', '7606 12 20',
   0.200, 0.005, true,
   'Multiple alloys on request'),

  ('Aluminium Tube & Pipe',
   'Aluminium Products', 'Tube & Pipe', '7608 20 81',
   0.200, 0.005, true,
   NULL),

  -- ── COPPER & COPPER PRODUCTS ────────────────────────────────
  ('Copper Wire — Cu-ETP (C11000)',
   'Copper & Copper Products', 'Wire & Rod', '7408 11 00',
   0.200, 0.005, true,
   'Electrolytic Tough Pitch — BS EN 1172 / ASTM B152'),

  ('Copper Wire — Cu-DHP (C12200)',
   'Copper & Copper Products', 'Wire & Rod', '7408 19 00',
   0.200, 0.005, true,
   'Deoxidized High Phosphorus — ASTM B133'),

  ('Copper Wire — Cu-OF (C10200)',
   'Copper & Copper Products', 'Wire & Rod', '7408 19 00',
   0.200, 0.005, true,
   'Oxygen-Free — ASTM B133'),

  ('Copper Sheet & Plate',
   'Copper & Copper Products', 'Sheet & Plate', '7409 11 00',
   0.200, 0.005, true,
   'BS EN 1172 / ASTM B152'),

  ('Copper Tube & Pipe',
   'Copper & Copper Products', 'Tube & Pipe', '7411 10 00',
   0.200, 0.005, true,
   NULL),

  ('Copper Concentrate',
   'Copper & Copper Products', 'Concentrate', '2603 00 00',
   0.200, 0.005, false,
   'Sourced on enquiry — subject to full AML/KYC and ESG due diligence'),

  -- ── STAINLESS STEEL ─────────────────────────────────────────
  ('Stainless Steel 304',
   'Stainless Steel', 'Flat-Rolled', '7219 31 00',
   0.200, 0.005, true,
   'EN 10088 / ASTM A240 — austenitic, sheet, plate and coil'),

  ('Stainless Steel 316 / 316L',
   'Stainless Steel', 'Flat-Rolled', '7219 31 00',
   0.200, 0.005, true,
   'EN 10088 / ASTM A240 — marine and chemical processing grade'),

  ('Stainless Steel 430',
   'Stainless Steel', 'Flat-Rolled', '7219 21 10',
   0.200, 0.005, true,
   'EN 10088 — ferritic grade, cold-rolled'),

  ('Stainless Steel 310',
   'Stainless Steel', 'Flat-Rolled', '7219 31 00',
   0.200, 0.005, true,
   'EN 10088 — high temperature grade'),

  ('Stainless Steel 321',
   'Stainless Steel', 'Flat-Rolled', '7219 31 00',
   0.200, 0.005, true,
   'EN 10088 — titanium-stabilised austenitic'),

  ('Stainless Steel 2205 Duplex',
   'Stainless Steel', 'Flat-Rolled', '7219 31 00',
   0.200, 0.005, true,
   'EN 10088 — duplex austenitic-ferritic, high strength'),

  ('Stainless Steel Bar & Rod',
   'Stainless Steel', 'Bar & Rod', '7222 11 11',
   0.200, 0.005, true,
   'Multiple grades — EN 10088 / ASTM A276'),

  ('Stainless Steel Tube & Pipe',
   'Stainless Steel', 'Tube & Pipe', '7304 11 00',
   0.200, 0.005, true,
   NULL),

  -- ── MILD STEEL ──────────────────────────────────────────────
  ('Mild Steel S235',
   'Mild Steel', 'Structural', '7208 51 00',
   0.200, 0.005, true,
   'BS EN 10025 — hot-rolled structural'),

  ('Mild Steel S275',
   'Mild Steel', 'Structural', '7208 51 00',
   0.200, 0.005, true,
   'BS EN 10025 — hot-rolled structural'),

  ('Mild Steel S355',
   'Mild Steel', 'Structural', '7208 51 00',
   0.200, 0.005, true,
   'BS EN 10025 — high-strength structural'),

  ('Mild Steel A36',
   'Mild Steel', 'Structural', '7208 51 00',
   0.200, 0.005, true,
   'ASTM A36 — general structural'),

  ('Mild Steel A572 GR50',
   'Mild Steel', 'Structural', '7208 51 00',
   0.200, 0.005, true,
   'ASTM A572 Grade 50 — high-strength low-alloy'),

  ('Mild Steel Bar & Rod',
   'Mild Steel', 'Bar & Rod', '7214 20 00',
   0.200, 0.005, true,
   NULL),

  ('Mild Steel Sheet, Plate & Coil',
   'Mild Steel', 'Sheet & Plate', '7209 17 10',
   0.200, 0.005, true,
   NULL),

  ('Mild Steel Tube & Pipe',
   'Mild Steel', 'Tube & Pipe', '7306 30 77',
   0.200, 0.005, true,
   NULL),

  -- ── OTHER METALS & ALLOYS ────────────────────────────────────
  ('Brass',
   'Other Metals & Alloys', 'Non-Ferrous', '7407 10 00',
   0.200, 0.005, true,
   'Various grades on enquiry'),

  ('Bronze',
   'Other Metals & Alloys', 'Non-Ferrous', '7407 21 10',
   0.200, 0.005, true,
   'Various grades on enquiry'),

  ('Tool Steel',
   'Other Metals & Alloys', 'Specialist', '7228 30 20',
   0.200, 0.005, true,
   NULL),

  ('Bright Steel',
   'Other Metals & Alloys', 'Specialist', '7215 50 80',
   0.200, 0.005, true,
   NULL),

  ('Inconel / Nickel Superalloys',
   'Other Metals & Alloys', 'Specialist', '7505 11 00',
   0.200, 0.005, true,
   'Origin and grade verification required on all enquiries'),

  ('Titanium',
   'Other Metals & Alloys', 'Specialist', '8108 20 00',
   0.200, 0.005, true,
   'Non-India origin only — full origin verification required'),

  -- ── CRITICAL MINERALS & CONCENTRATES ────────────────────────
  -- All marked inactive (active=false) — forward capability, sourced on enquiry
  ('Lithium Carbonate',
   'Critical Minerals & Concentrates', 'Battery Materials', '2836 91 00',
   0.200, 0.005, false,
   'Full ESG due diligence required — OECD guidance compliance'),

  ('Mica (RMI-Certified)',
   'Critical Minerals & Concentrates', 'Industrial Minerals', '2525 10 00',
   0.200, 0.005, false,
   'Responsible Mica Initiative certified sources only — no uncertified mica'),

  ('Manganese Ore',
   'Critical Minerals & Concentrates', 'Ore', '2602 00 00',
   0.200, 0.005, false,
   NULL),

  ('Chromite / Chromium',
   'Critical Minerals & Concentrates', 'Ore', '2610 00 00',
   0.200, 0.005, false,
   NULL),

  ('Bauxite',
   'Critical Minerals & Concentrates', 'Ore', '2606 00 00',
   0.200, 0.005, false,
   NULL)

) AS t(name, metal_family, sub_type, cn_code, vat_rate, insurance_pct, active, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM product_lines pl WHERE pl.name = t.name
);


-- ── 5. Summary check ─────────────────────────────────────────
-- Run this after the inserts to confirm counts

SELECT
  pf.name                        AS family,
  COUNT(pl.id)                   AS product_lines,
  COUNT(pl.id) FILTER (WHERE pl.active) AS active
FROM product_families pf
LEFT JOIN product_lines pl ON pl.metal_family = pf.name
GROUP BY pf.name
ORDER BY pf.name;
