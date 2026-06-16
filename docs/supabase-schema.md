## Table `access_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `user_id` | `uuid` |  Nullable |
| `ip_address` | `inet` |  Nullable |
| `endpoint` | `text` |  Nullable |
| `method` | `text` |  Nullable |
| `resource_id` | `uuid` |  Nullable |
| `result` | `text` |  |

## Table `cbam_records`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `trade_id` | `uuid` |  Nullable |
| `supplier_id` | `uuid` |  Nullable |
| `product` | `text` |  |
| `cn_code` | `text` |  Nullable |
| `quantity_mt` | `numeric` |  Nullable |
| `import_date` | `date` |  Nullable |
| `embedded_co2_tco2e` | `numeric` |  Nullable |
| `carbon_price_eur` | `numeric` |  Nullable |
| `status` | `text` |  |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `concessions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `trade_id` | `uuid` |  |
| `original_specification` | `text` |  |
| `actual_specification` | `text` |  |
| `delta_summary` | `text` |  |
| `customer_signatory_name` | `text` |  Nullable |
| `customer_signatory_email` | `text` |  Nullable |
| `customer_signed_at` | `timestamptz` |  Nullable |
| `signed_document_path` | `text` |  Nullable |
| `commercial_adjustment_gbp` | `numeric` |  Nullable |
| `precedent_acknowledged` | `bool` |  |
| `notes` | `text` |  Nullable |

## Table `contacts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `company_name` | `text` |  |
| `type` | `text` |  |
| `primary_contact_name` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `country` | `text` |  Nullable |
| `website` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `approval_status` | `text` |  Nullable |
| `approved_at` | `timestamptz` |  Nullable |
| `approved_by` | `uuid` |  Nullable |
| `next_audit_due_date` | `date` |  Nullable |
| `last_sanctions_screened_at` | `timestamptz` |  Nullable |
| `last_sanctions_result` | `text` |  Nullable |
| `company_registration_number` | `text` |  Nullable |
| `vat_number` | `text` |  Nullable |
| `beneficial_owner` | `text` |  Nullable |
| `supplier_type` | `text` |  Nullable — `manufacturing` \| `materials_commodities` \| `logistics` \| `packaging` \| `service_provider` (enforced at application layer). Determines onboarding diligence tier — see `docs/supplier-onboarding-process.md` |
| `address_line_1` | `text` |  Nullable — registered/company address |
| `address_line_2` | `text` |  Nullable — registered/company address |
| `city` | `text` |  Nullable — registered/company address |
| `postcode` | `text` |  Nullable — registered/company address |
| `dispatch_address_line_1` | `text` |  Nullable — added in migration 20260612b. Warehouse/dispatch address, only populated if different from the registered company address above |
| `dispatch_address_line_2` | `text` |  Nullable — added in migration 20260612b |
| `dispatch_city` | `text` |  Nullable — added in migration 20260612b |
| `dispatch_postcode` | `text` |  Nullable — added in migration 20260612b |
| `dispatch_country` | `text` |  Nullable — added in migration 20260612b |
| `company_phone` | `text` |  Nullable — added in migration 20260612c. Main company phone number, captured at Stage 1 |
| `supplier_reference` | `text` |  Nullable — added in migration 20260612c. Generated at Stage 1 (`generateSupplierReference()`, format `VS-YYYY-XXXXX`). Unique where not null |
| `export_licence_number` | `text` |  Nullable — added in migration 20260612c. Generic export licence reference (if applicable); replaces the earlier Bolivia-specific "RUEX" field |
| `qms_certification` | `text` |  Nullable — added in migration 20260612c. `'none'` \| `'iso_9001'` \| `'iatf_16949'` \| `'other'`, captured at Stage 1 |
| `qms_certificate_ref` | `text` |  Nullable — added in migration 20260612c |
| `qms_expiry` | `date` |  Nullable — added in migration 20260612c |
| `esg_policy_in_place` | `bool` |  Nullable — added in migration 20260612c. Captured at Stage 2 |
| `carbon_reporting_available` | `bool` |  Nullable — added in migration 20260612c. Captured at Stage 2 |
| `esg_notes` | `text` |  Nullable — added in migration 20260612c |
| `environmental_permit_ref` | `text` |  Nullable — added in migration 20260612c |
| `environmental_permit_expiry` | `date` |  Nullable — added in migration 20260612c |
| `bank_account_name` | `text` |  Nullable — added in migration 20260612c. Captured at Stage 2, masked client-side |
| `bank_account_number` | `text` |  Nullable — added in migration 20260612c. Masked client-side via `maskAccountNumber()` |
| `bank_sort_code` | `text` |  Nullable — added in migration 20260612c. Sort code / routing number |
| `bank_iban` | `text` |  Nullable — added in migration 20260612c. Masked client-side |
| `bank_swift_bic` | `text` |  Nullable — added in migration 20260612c |
| `bank_name` | `text` |  Nullable — added in migration 20260612c |
| `bank_account_verified_in_name` | `bool` | Default `false` — added in migration 20260612c. Confirms the bank account is held in the registered company's name; gates `stage2_complete` |
| `accepted_currencies` | `text[]` |  Nullable — added in migration 20260612c. Checkbox set from `USD, GBP, EUR, INR, CNY, AED`, captured at Stage 3 |
| `default_currency` | `text` |  Nullable — added in migration 20260612c. Must be one of `accepted_currencies`, captured at Stage 3 |
| `payment_terms_initial` | `text` |  Nullable — added in migration 20260612c. Captured at Stage 3 |
| `payment_terms_subsequent` | `text` |  Nullable — added in migration 20260612c. Captured at Stage 3 |
| `standard_incoterm` | `text` |  Nullable — added in migration 20260612c. Captured at Stage 3 |

## Table `disputes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `trade_id` | `uuid` |  |
| `raised_by` | `text` |  |
| `raised_at` | `timestamptz` |  |
| `category` | `text` |  |
| `description` | `text` |  |
| `evidence_documents` | `_uuid` |  Nullable |
| `status` | `text` |  |
| `resolution` | `text` |  Nullable |
| `resolved_at` | `timestamptz` |  Nullable |
| `cost_attribution` | `text` |  Nullable |
| `corrective_action_required` | `bool` |  |
| `supplier_re_audit_triggered` | `bool` |  |

## Table `inbound_emails`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `received_at` | `timestamptz` |  |
| `from_address` | `text` |  |
| `to_address` | `text` |  Nullable |
| `subject` | `text` |  Nullable |
| `body_text` | `text` |  Nullable |
| `body_html` | `text` |  Nullable |
| `raw_message_path` | `text` |  Nullable |
| `linked_trade_id` | `uuid` |  Nullable |
| `direction` | `text` |  |
| `processed` | `bool` |  |

## Table `kyc_records`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `contact_id` | `uuid` |  |
| `kyc_status` | `text` |  |
| `risk_rating` | `text` |  |
| `last_screened_date` | `date` |  Nullable |
| `next_review_date` | `date` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `order_documents`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `trade_id` | `uuid` |  |
| `document_type` | `text` |  |
| `file_path` | `text` |  |
| `file_name` | `text` |  |
| `file_size_bytes` | `int8` |  Nullable |
| `mime_type` | `text` |  Nullable |
| `uploaded_by` | `uuid` |  Nullable |
| `source` | `text` |  |
| `email_id` | `uuid` |  Nullable |
| `notes` | `text` |  Nullable |

## Table `order_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `trade_id` | `uuid` |  |
| `event_type` | `text` |  |
| `from_state` | `text` |  Nullable |
| `to_state` | `text` |  Nullable |
| `actor_id` | `uuid` |  Nullable |
| `actor_role` | `text` |  Nullable |
| `evidence_ref` | `text` |  Nullable |
| `reason_code` | `text` |  Nullable |
| `notes` | `text` |  Nullable |

## Table `order_state_transitions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `from_state` | `text` |  |
| `to_state` | `text` |  |
| `requires_approval` | `bool` |  |
| `required_role` | `text` |  Nullable |
| `is_system_triggered` | `bool` |  |

## Table `order_states`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `display_name` | `text` |  |
| `lane` | `text` |  |
| `is_terminal` | `bool` |  |
| `description` | `text` |  |

## Table `product_lines`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `cn_code` | `text` |  Nullable |
| `default_markup_pct` | `numeric` |  Nullable |
| `vat_rate` | `numeric` |  Nullable |
| `insurance_pct` | `numeric` |  Nullable |
| `active` | `bool` |  Nullable |
| `metal_family` | `text` |  Nullable |
| `sub_type` | `text` |  Nullable |
| `standard_sell_price_gbp` | `numeric(14,2)` |  Nullable |
| `pricing_last_reviewed` | `date` |  Nullable |
| `market_reference_price_gbp` | `numeric(14,2)` |  Nullable |
| `market_price_updated_date` | `date` |  Nullable |
| `default_origin_country` | `text` |  Nullable |
| `default_destination` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `product_families`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `active` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `reason_codes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `code` | `text` | Primary |
| `category` | `text` |  |
| `description` | `text` |  |

## Table `rfq_submissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `type` | `text` |  |
| `name` | `text` |  |
| `company` | `text` |  |
| `email` | `text` |  |
| `country` | `text` |  Nullable |
| `product` | `text` |  Nullable |
| `message` | `text` |  Nullable |
| `quantity_mt` | `numeric` |  Nullable |
| `status` | `text` |  |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `role` | `text` |  Nullable |
| `phone` | `text` |  Nullable |

## Table `sanctions_screens`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `subject_type` | `text` |  |
| `subject_id` | `uuid` |  |
| `subject_name_snapshot` | `text` |  |
| `screened_at` | `timestamptz` |  |
| `screened_by` | `uuid` |  Nullable |
| `lists_screened` | `_text` |  Nullable |
| `tool_used` | `text` |  Nullable |
| `result` | `text` |  |
| `match_resolution_notes` | `text` |  Nullable |
| `evidence_path` | `text` |  Nullable |

## Table `shipment_legs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `shipment_id` | `uuid` |  |
| `leg_type` | `text` |  |
| `origin` | `text` |  Nullable |
| `destination` | `text` |  Nullable |
| `carrier` | `text` |  Nullable |
| `booking_reference` | `text` |  Nullable |
| `departure_date` | `date` |  Nullable |
| `arrival_date` | `date` |  Nullable |
| `cost_gbp` | `numeric` |  Nullable |
| `notes` | `text` |  Nullable |

## Table `shipments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `trade_id` | `uuid` |  |
| `logistics_model` | `text` |  |
| `freight_forwarder` | `text` |  Nullable |
| `booking_reference` | `text` |  Nullable |
| `eta_uk_port` | `date` |  Nullable |
| `eta_delivery` | `date` |  Nullable |
| `total_freight_cost_gbp` | `numeric` |  Nullable |
| `status` | `text` |  |
| `notes` | `text` |  Nullable |

## Table `supplier_audits`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `supplier_id` | `uuid` |  |
| `audit_date` | `date` |  |
| `audit_type` | `text` |  |
| `auditor_name` | `text` |  |
| `audit_report_path` | `text` |  Nullable |
| `outcome` | `text` |  |
| `conditions` | `text` |  Nullable |
| `next_audit_due_date` | `date` |  |
| `notes` | `text` |  Nullable |
| `onboarding_id` | `uuid` |  Nullable FK → supplier_onboarding |

## Table `supplier_quotes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` |  Nullable |
| `product` | `text` |  |
| `specification` | `text` |  Nullable |
| `fob_price_usd` | `numeric` |  |
| `quantity_mt` | `numeric` |  Nullable |
| `incoterm` | `text` |  |
| `validity_date` | `date` |  Nullable |
| `status` | `text` | CHECK IN ('pending','active','expired','used') |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `product_line_id` | `uuid` |  Nullable |
| `onboarding_review_status` | `text` |  Nullable, app-enforced enum |
| `onboarding_review_notes` | `text` |  Nullable |

`pending` represents a product line linked to a supplier as "permitted to supply" with no live quote yet (added from the supplier detail page's Products tab, with placeholder `fob_price_usd: 0` and `incoterm: 'FOB'`). It is excluded from all `.eq('status','active')` lookups used by the calculator, RFQ matching, and supplier PO selection until edited with real pricing.

`onboarding_review_status` is `NULL` for product links not created via onboarding (e.g. added later from the supplier detail page's Products tab), or one of `pending_review | approved | rejected` for products offered during Stage 1a registration and reviewed by compliance during Stage 1b. `onboarding_review_notes` holds the compliance director's notes for that review. Rejected rows are kept (not deleted) for audit, flagged "Rejected" on the Products tab.

## Table `trades`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `reference` | `text` |  Nullable |
| `product` | `text` |  |
| `buyer_id` | `uuid` |  Nullable |
| `supplier_id` | `uuid` |  Nullable |
| `quantity_mt` | `numeric` |  Nullable |
| `sell_price_gbp` | `numeric` |  Nullable |
| `cost_price_gbp` | `numeric` |  Nullable |
| `status` | `text` |  |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `product_line_id` | `uuid` |  Nullable |
| `fob_price_usd` | `numeric` |  Nullable |
| `freight_usd` | `numeric` |  Nullable |
| `insurance_usd` | `numeric` |  Nullable |
| `exchange_rate` | `numeric` |  Nullable |
| `markup_pct` | `numeric` |  Nullable |
| `vat_rate` | `numeric` |  Nullable |
| `vat_amount_gbp` | `numeric` |  Nullable |
| `invoice_number` | `text` |  Nullable |
| `invoice_date` | `date` |  Nullable |
| `payment_received_date` | `date` |  Nullable |
| `payment_received_gbp` | `numeric` |  Nullable |
| `supplier_payment_date` | `date` |  Nullable |
| `supplier_payment_gbp` | `numeric` |  Nullable |
| `current_state` | `text` |  |
| `customer_po_reference` | `text` |  Nullable |
| `cancelled_reason` | `text` |  Nullable |
| `dispute_window_closes_at` | `timestamptz` |  Nullable |
| `customer_po_email_id` | `uuid` |  Nullable |
| `specification` | `text` |  Nullable |
| `incoterms` | `text` |  Nullable |
| `delivery_destination` | `text` |  Nullable |
| `required_delivery_date` | `date` |  Nullable |
| `customer_po_date` | `date` |  Nullable |
| `payment_terms` | `text` |  Nullable |
| `special_conditions` | `text` |  Nullable |

## Table `user_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `role` | `text` |  |
| `granted_at` | `timestamptz` |  |
| `granted_by` | `uuid` |  Nullable |

## Table `verification_queue`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `created_at` | `timestamptz` |  |
| `trade_id` | `uuid` |  |
| `queue_type` | `text` |  |
| `drafted_by` | `uuid` |  |
| `assigned_to` | `uuid` |  Nullable |
| `priority` | `text` |  |
| `sla_due_at` | `timestamptz` |  |
| `status` | `text` |  |
| `decision_at` | `timestamptz` |  Nullable |
| `decision_by` | `uuid` |  Nullable |
| `decision_reason_code` | `text` |  Nullable |
| `decision_notes` | `text` |  Nullable |

---

## Supplier Onboarding — ISO 9001 Tables

> Added: migration 20260603. These tables implement the redesigned supplier onboarding workflow aligned with ISO 9001:2015. See `docs/supplier-onboarding-process.md` for the full workflow description.

## Table `supplier_enquiries`

Pre-onboarding leads from the website contact form or raised manually by Jackson. Jackson reviews and converts to a formal onboarding, or declines with a documented reason.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `source` | `text` | `'website_form'` \| `'manual_entry'` |
| `company_name` | `text` |  |
| `contact_name` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `country` | `text` |  Nullable |
| `products_of_interest` | `text` |  Nullable |
| `message` | `text` |  Nullable |
| `submitted_at` | `timestamptz` |  |
| `status` | `text` | `'new'` \| `'under_review'` \| `'converted'` \| `'declined'` |
| `reviewed_by` | `uuid` |  Nullable FK → auth.users |
| `reviewed_at` | `timestamptz` |  Nullable |
| `decline_reason` | `text` |  Nullable — required when status = `'declined'` |
| `converted_to_onboarding_id` | `uuid` |  Nullable FK → supplier_onboarding |
| `hq_address` | `text` |  Nullable |
| `website` | `text` |  Nullable |
| `position_title` | `text` |  Nullable |
| `supply_capacity_mt` | `text` |  Nullable — free text, e.g. "200–500 MT/month" |
| `export_markets` | `text` |  Nullable |
| `testing_procedures` | `text` |  Nullable |
| `shipping_terms` | `text` |  Nullable — incoterm code or `'Open'` |
| `certifications` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

### RLS

- `portal_full_access` — authenticated, full CRUD.
- `Anon insert website partner enquiries` — anon may INSERT where `source = 'website_form'` and `status = 'new'` (used by `partners.html`'s register-interest form).

---

## Table `supplier_onboarding`

Central workflow state machine for each onboarding attempt. Jackson raises it; Martyn vets it; Jackson makes the final decision.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `contact_id` | `uuid` | FK → contacts |
| `enquiry_id` | `uuid` |  Nullable FK → supplier_enquiries |
| `workflow_stage` | `text` | App-enforced enum (no DB CHECK constraint), redesigned in migration 20260612d: `'draft'` \| `'pending_compliance'` \| `'stage1_complete'` \| `'pending_stage2'` \| `'awaiting_supplier_info'` \| `'stage2_complete'` \| `'trade_ready'` \| `'rejected'`. See `docs/supplier-onboarding-process.md` for the 3-phase model |
| `risk_level` | `text` |  Nullable — `'low'` \| `'medium'` \| `'high'` |
| `raised_by` | `uuid` |  Nullable FK → auth.users (Jackson) |
| `vetting_assigned_to` | `uuid` |  Nullable FK → auth.users (Martyn) |
| `recommendation` | `text` |  Nullable — `'approve'` \| `'approve_with_conditions'` \| `'reject'` |
| `recommendation_rationale` | `text` |  Nullable |
| `recommendation_submitted_at` | `timestamptz` |  Nullable |
| `decision` | `text` |  Nullable — `'approved'` \| `'approved_with_conditions'` \| `'rejected'` |
| `decision_justification` | `text` |  Nullable |
| `decision_by` | `uuid` |  Nullable FK → auth.users (Jackson) |
| `decision_at` | `timestamptz` |  Nullable |
| `conditions_summary` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `activated_at` | `timestamptz` |  Nullable — reused (no new column) to mean "Stage 2 complete" timestamp, set when `workflow_stage` advances to `stage2_complete` |
| `tob_status` | `text` | Default `'not_generated'` — added in migration 20260612d. `'not_generated'` \| `'generated'` \| `'sent'` \| `'confirmed'`. `'confirmed'` gates `stage2_complete` |
| `tob_generated_at` | `timestamptz` |  Nullable — added in migration 20260612d |
| `tob_sent_at` | `timestamptz` |  Nullable — added in migration 20260612d |
| `tob_confirmed_at` | `timestamptz` |  Nullable — added in migration 20260612d |
| `review_required` | `boolean` | Default `false` — added in migration 20260616c. Set `true` when an ad-hoc edit causes a meaningful change to compliance or commercial scoring bands. Used by Phase D ad-hoc recompute and Exceptions Review |
| `review_required_reason` | `text` |  Nullable — added in migration 20260616c. Human-readable reason for the flag |

---

## Table `supplier_risk_assessment`

Single row per onboarding. Scored preliminarily by Martyn at Stage 1 (using whatever information is available at registration). For full-diligence suppliers (`manufacturing` / `materials_commodities`), the same row is reviewed/refined during Stage 2 before the recommendation — see `reviewed_at`/`reviewed_by` below. Five criteria scored 1–5 (5 = highest risk). Computed average and derived risk category are stored for audit trail integrity.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` | FK → supplier_onboarding |
| `financial_viability_score` | `smallint` |  Nullable — 1–5 |
| `quality_certification_score` | `smallint` |  Nullable — 1–5 |
| `regulatory_compliance_score` | `smallint` |  Nullable — 1–5 |
| `geographic_risk_score` | `smallint` |  Nullable — 1–5 |
| `supply_continuity_score` | `smallint` |  Nullable — 1–5 |
| `overall_score` | `numeric(4,2)` |  Nullable — computed average |
| `risk_category` | `text` |  Nullable — `'low'` \| `'medium'` \| `'high'` |
| `financial_viability_notes` | `text` |  Nullable |
| `quality_certification_notes` | `text` |  Nullable |
| `regulatory_compliance_notes` | `text` |  Nullable |
| `geographic_risk_notes` | `text` |  Nullable |
| `supply_continuity_notes` | `text` |  Nullable |
| `overall_notes` | `text` |  Nullable |
| `risk_category_override` | `bool` |  Default false |
| `risk_category_override_reason` | `text` |  Nullable — required when override = true |
| `assessed_by` | `uuid` |  Nullable FK → auth.users |
| `assessment_date` | `timestamptz` |  |
| `next_assessment_due` | `date` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `reviewed_at` | `timestamptz` |  Nullable — added in migration 20260612e. `NULL` = preliminary (Stage 1 only); set when Martyn reviews/refines the assessment during Stage 2. Required (non-null) for `stage2_complete` on the full-diligence track |
| `reviewed_by` | `uuid` |  Nullable FK → auth.users — added in migration 20260612e |

---

## Table `supplier_documents`

Version-controlled document uploads with expiry tracking. Superseded versions have `is_current = false`. Martyn can mark a type N/A for a supplier (e.g. W-9 for non-US) with a mandatory reason.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` |  Nullable FK → supplier_onboarding |
| `document_type` | `text` | See migration for full enum values |
| `document_label` | `text` |  Nullable — required when type = `'other'` |
| `jurisdiction` | `text` |  Nullable — ISO 3166-1 alpha-2 or `'global'` |
| `version` | `integer` |  Default 1 |
| `file_path` | `text` |  Nullable — null when not_applicable = true |
| `file_name` | `text` |  Nullable — null when not_applicable = true |
| `file_size_bytes` | `bigint` |  Nullable |
| `mime_type` | `text` |  Nullable |
| `uploaded_by` | `uuid` |  Nullable FK → auth.users |
| `uploaded_at` | `timestamptz` |  Nullable |
| `expiry_date` | `date` |  Nullable |
| `is_current` | `bool` |  Default true |
| `not_applicable` | `bool` |  Default false |
| `not_applicable_reason` | `text` |  Nullable — required when not_applicable = true |
| `change_reason` | `text` |  Nullable — required when version > 1 |
| `created_at` | `timestamptz` |  |

---

## Table `supplier_approvals`

One row per formal approval or rejection at each workflow stage. Both Martyn's recommendation and Jackson's final decision write here so they are independently queryable and immutable.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` | FK → supplier_onboarding |
| `approval_stage` | `text` | `'screening'` \| `'documents'` \| `'compliance'` \| `'recommendation'` \| `'final_approval'` \| `'gate1_compliance'` \| `'gate1_commercial'` \| `'gate2_compliance'` \| `'gate2_commercial'` — Phase A+ adds four dual-director gate values replacing the old single recommendation/decision pattern |
| `approver_id` | `uuid` | FK → auth.users |
| `approver_role` | `text` | `'director_commercial'` \| `'director_compliance'` |
| `decision` | `text` | `'approved'` \| `'approved_with_conditions'` \| `'rejected'` |
| `justification` | `text` |  |
| `conditions` | `text` |  Nullable — required when decision = `'approved_with_conditions'` |
| `decided_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |

### RLS

- `portal_full_access` — authenticated, full CRUD.

---

## Table `supplier_compliance_scores`

Additive compliance risk score — one row per scoring event (Gate 1 or Gate 2). Versioned; prior rows are retained for audit. Added in migration 20260616a, replacing the legacy 1–5 `supplier_risk_assessment` weighted model (which remains readable for in-flight records).

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` | FK → supplier_onboarding |
| `gate` | `smallint` | `1` or `2` — which gate checkpoint this score relates to |
| `total_score` | `int` | Additive sum of selected factor scores (null if `Prohibited`) |
| `rating_band` | `text` | `'Low Risk'` \| `'Medium Risk'` \| `'High Risk'` \| `'Very High Risk'` \| `'Prohibited'` |
| `components` | `jsonb` | Array of `{group, factor_key, label, score}` — full factor breakdown for explainability |
| `computed_at` | `timestamptz` | Default `now()` |
| `computed_by` | `uuid` | FK → auth.users — director who submitted the scoring form |

### RLS

- `portal_full_access` — authenticated, full CRUD.

---

## Table `supplier_commercial_scores`

Additive commercial suitability score — one row per scoring event (Gate 1 or Gate 2). Second scoring axis alongside compliance risk; answers "how valuable is this supplier to Vertex?". Added in migration 20260616b.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` | FK → supplier_onboarding |
| `gate` | `smallint` | `1` or `2` |
| `total_score` | `int` | Additive sum of selected factor scores |
| `rating_band` | `text` | `'Poor Fit'` \| `'Moderate Fit'` \| `'Strong Fit'` \| `'Strategic Supplier'` |
| `components` | `jsonb` | Array of `{group, factor_key, label, score}` |
| `computed_at` | `timestamptz` | Default `now()` |
| `computed_by` | `uuid` | FK → auth.users |

### RLS

- `portal_full_access` — authenticated, full CRUD.

---

## Table `supplier_audit_trail`

Append-only event log. RLS permits INSERT and SELECT only; UPDATE and DELETE are denied. Covers the full supplier lifecycle from enquiry through activation and beyond.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` |  Nullable FK → supplier_onboarding |
| `event_type` | `text` | See migration for full enum values |
| `actor_id` | `uuid` |  Nullable FK → auth.users |
| `actor_role` | `text` |  Nullable |
| `occurred_at` | `timestamptz` |  |
| `description` | `text` | Human-readable sentence |
| `field_name` | `text` |  Nullable — for `contact_field_changed` events |
| `old_value` | `text` |  Nullable |
| `new_value` | `text` |  Nullable |
| `metadata` | `jsonb` |  Nullable |

---

## Table `supplier_nonconformities`

Compliance failures, process gaps, or approval errors. Linked to corrective_actions for tracked remediation.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` |  Nullable FK → supplier_onboarding |
| `incident_date` | `date` |  |
| `description` | `text` |  |
| `severity` | `text` | `'low'` \| `'medium'` \| `'high'` |
| `root_cause` | `text` |  Nullable |
| `reported_by` | `uuid` |  Nullable FK → auth.users |
| `status` | `text` | `'open'` \| `'in_progress'` \| `'closed'` |
| `closed_at` | `timestamptz` |  Nullable |
| `closed_by` | `uuid` |  Nullable FK → auth.users |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

---

## Table `corrective_actions`

One or more corrective actions per nonconformity. Tracks owner, due date, progress, and effectiveness verification.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `nonconformity_id` | `uuid` | FK → supplier_nonconformities |
| `action_description` | `text` |  |
| `owner_id` | `uuid` |  Nullable FK → auth.users |
| `due_date` | `date` |  Nullable |
| `status` | `text` | `'open'` \| `'in_progress'` \| `'completed'` \| `'closed'` |
| `effectiveness_verification` | `text` |  Nullable |
| `completed_at` | `timestamptz` |  Nullable |
| `closed_at` | `timestamptz` |  Nullable |
| `closed_by` | `uuid` |  Nullable FK → auth.users |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

---

## Table `supplier_conditions`

Individual outstanding conditions on a conditional approval. Each must be explicitly marked met by Martyn with linked evidence before the condition is cleared.

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `supplier_id` | `uuid` | FK → contacts |
| `onboarding_id` | `uuid` | FK → supplier_onboarding |
| `condition_text` | `text` |  |
| `condition_type` | `text` | `'document_required'` \| `'certification_required'` \| `'audit_required'` \| `'remediation_required'` \| `'other'` |
| `due_date` | `date` |  Nullable |
| `is_met` | `bool` |  Default false |
| `met_at` | `timestamptz` |  Nullable |
| `met_by` | `uuid` |  Nullable FK → auth.users |
| `evidence_document_id` | `uuid` |  Nullable FK → supplier_documents |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

