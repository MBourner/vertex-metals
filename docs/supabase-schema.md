# Supabase Schema — Vertex Metals Portal

Run all statements in the Supabase SQL editor. Execute in order — foreign keys depend on earlier tables.

---

## 1. contacts

Buyers, suppliers, and any other counterparties.

```sql
CREATE TABLE contacts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name         TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('buyer', 'supplier', 'other')),
  primary_contact_name TEXT,
  email                TEXT,
  phone                TEXT,
  country              TEXT,
  website              TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 2. rfq_submissions

Inbound enquiries from the public contact form. Anonymous INSERT only.

```sql
CREATE TABLE rfq_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL CHECK (type IN ('buyer', 'supplier')),
  name         TEXT NOT NULL,
  company      TEXT NOT NULL,
  email        TEXT NOT NULL,
  country      TEXT,
  product      TEXT,
  message      TEXT,
  quantity_mt  NUMERIC(12,3),
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'responded', 'closed')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER rfq_updated_at
  BEFORE UPDATE ON rfq_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 3. supplier_quotes

FOB quotes received from Indian suppliers. Linked to a contact (supplier).

```sql
CREATE TABLE supplier_quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  product         TEXT NOT NULL,
  specification   TEXT,
  fob_price_usd   NUMERIC(12,2) NOT NULL,
  quantity_mt     NUMERIC(12,3),
  incoterm        TEXT NOT NULL DEFAULT 'FOB',
  validity_date   DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER supplier_quotes_updated_at
  BEFORE UPDATE ON supplier_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 4. trades

One trade record per confirmed deal. Buyer and supplier are both contacts.

```sql
CREATE TABLE trades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT,
  product          TEXT NOT NULL,
  buyer_id         UUID REFERENCES contacts(id) ON DELETE SET NULL,
  supplier_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  quantity_mt      NUMERIC(12,3),
  sell_price_gbp   NUMERIC(14,2),
  cost_price_gbp   NUMERIC(14,2),
  status           TEXT NOT NULL DEFAULT 'enquiry' CHECK (
                     status IN ('enquiry','quoted','confirmed','in_transit','delivered','invoiced','complete')
                   ),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 5. kyc_records

AML/KYC due diligence records. One per contact (unique constraint).

```sql
CREATE TABLE kyc_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id         UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kyc_status         TEXT NOT NULL DEFAULT 'pending' CHECK (
                       kyc_status IN ('pending','in_progress','approved','rejected','expired')
                     ),
  risk_rating        TEXT NOT NULL DEFAULT 'unrated' CHECK (
                       risk_rating IN ('low','medium','high','unrated')
                     ),
  last_screened_date DATE,
  next_review_date   DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER kyc_records_updated_at
  BEFORE UPDATE ON kyc_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 6. cbam_records

UK CBAM embedded carbon reporting. Linked to a trade and supplier.

```sql
CREATE TABLE cbam_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id             UUID REFERENCES trades(id) ON DELETE SET NULL,
  supplier_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  product              TEXT NOT NULL,
  cn_code              TEXT,                          -- Combined Nomenclature code, e.g. 7605 19 00
  quantity_mt          NUMERIC(12,3),
  import_date          DATE,
  embedded_co2_tco2e   NUMERIC(12,4),                 -- tCO2e from Mill Certificate
  carbon_price_eur     NUMERIC(10,2),                 -- EUR/tonne at time of import
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (
                         status IN ('pending','data_received','submitted','verified')
                       ),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER cbam_records_updated_at
  BEFORE UPDATE ON cbam_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Row-Level Security (RLS)

Enable RLS on every table, then apply policies.

```sql
-- Enable RLS
ALTER TABLE contacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbam_records      ENABLE ROW LEVEL SECURITY;

-- contacts: authenticated users only
CREATE POLICY "contacts_auth" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- rfq_submissions: anonymous INSERT (public form), authenticated read/write
CREATE POLICY "rfq_anon_insert" ON rfq_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rfq_auth_all"    ON rfq_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- supplier_quotes: authenticated users only
CREATE POLICY "quotes_auth" ON supplier_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- trades: authenticated users only
CREATE POLICY "trades_auth" ON trades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- kyc_records: authenticated users only
CREATE POLICY "kyc_auth" ON kyc_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cbam_records: authenticated users only
CREATE POLICY "cbam_auth" ON cbam_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## Portal User

Create a portal user via **Supabase Auth → Users → Invite user** (or Add User).
Use email/password auth. The anon key used in `supabase-client.js` handles both
anonymous (public form) and authenticated (portal) sessions.

> **Do not store the service role key in any client-side file.**
