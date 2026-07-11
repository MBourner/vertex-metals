-- Available Grades — a simple add/remove list per product line, for products
-- where "grade" is purely a spec-level detail (e.g. Antimony purity grades)
-- rather than something with its own CN code or pricing (those cases stay as
-- separate product_lines rows, per the Stainless Steel pattern).
CREATE TABLE IF NOT EXISTS product_line_grades (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id uuid        NOT NULL REFERENCES product_lines(id) ON DELETE CASCADE,
  grade           text        NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE product_line_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full access on product_line_grades"
  ON product_line_grades FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
