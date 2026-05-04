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
| `notes` | `text` |  Nullable |
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
| `status` | `text` |  |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `product_line_id` | `uuid` |  Nullable |

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

