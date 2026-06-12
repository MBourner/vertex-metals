# Supplier Onboarding Portal Redesign Proposal — ISO 9001 Compliance

**Date:** June 2026  
**Prepared For:** Vertex Metals Ltd  
**Purpose:** Redesign the admin portal to support ISO 9001:2015 compliant supplier onboarding

---

## Executive Summary

Vertex Metals' current supplier onboarding process is fragmented across generic contact CRM, KYC records, sanctions screening, and audit forms. This proposal outlines a redesigned supplier onboarding portal that:

1. Implements a controlled workflow aligned with ISO 9001 clauses 4.4, 6.1, 7.2, 7.5, 8.1, 8.4, 8.5, 8.7, 9.1, 9.2, and 10.2
2. Enforces mandatory compliance steps before supplier approval
3. Captures complete audit trail and evidence for external audits
4. Provides risk-based approval routing
5. Centralizes supplier documentation and versioning
6. Enables compliance reporting and dashboards

This redesign positions Vertex Metals for ISO 9001 certification whilst improving operational control and reducing compliance risk.

---

## Current State Assessment

Based on the current portal architecture (`docs/supplier-onboarding-process.md`):

### Strengths
- Basic supplier record creation and tracking exists
- Separate modules for KYC, sanctions, and audit vetting
- Supplier detail pages aggregate historical records
- Role-based portal access is in place

### Gaps (ISO 9001 perspective)
- **No formal workflow:** Supplier creation does not follow a defined process with stages, approvals, or status tracking.
- **Minimal mandatory fields:** Supplier records require only company name; business-critical details like legal entity number, beneficial owners, and bank details are not enforced.
- **No risk assessment:** Supplier approval is manual and not tied to risk scoring or impact analysis.
- **Loose approval controls:** Audit outcome alone determines approval status; no requirement for KYC or sanctions completion before marking `approved`.
- **No document versioning:** Uploaded documents (if stored) lack version control, expiry tracking, or access history.
- **No audit trail:** User actions, approvals, and changes are not comprehensively logged or exportable.
- **No rejection workflow:** Rejected suppliers have no formal remediation pathway.
- **No role/authority matrix:** Approvers are not restricted by role or risk level; any logged-in user can theoretically approve a supplier.

---

## Proposed Workflow

### Supplier Onboarding Process — Structured Stages

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPPLIER ONBOARDING WORKFLOW                     │
└─────────────────────────────────────────────────────────────────────┘

Stage 1: REQUEST & INTAKE
  ├─ Create supplier record (company name, legal entity number, country)
  ├─ Assign initial risk category (Low / Medium / High)
  ├─ Generate onboarding checklist based on risk
  └─ Notify assigned Procurement Manager

        ↓

Stage 2: INITIAL SCREENING
  ├─ Procurement Manager reviews supplier details
  ├─ Performs automatic sanctions list check
  ├─ Confirms supplier details are complete
  ├─ Approves or rejects at this stage (with reason)
  └─ If rejected → Supplier marked 'Screening Failed'; notify requestor

        ↓

Stage 3: RISK ASSESSMENT
  ├─ Quality Manager reviews supplier against risk criteria:
  │   ├─ Financial viability
  │   ├─ Quality certifications (ISO 9001, IATF, etc.)
  │   ├─ Regulatory compliance (country, licenses)
  │   ├─ Information security capability
  │   ├─ Geographic / sanctions exposure
  │   └─ Supply continuity / single-source risk
  ├─ System calculates risk score
  ├─ Risk-based approval authority is determined
  └─ KYC/Sanctions scope is confirmed

        ↓

Stage 4: DOCUMENT COLLECTION & VALIDATION
  ├─ Portal presents mandatory document checklist:
  │   ├─ Business registration certificate
  │   ├─ Tax ID / VAT certificate
  │   ├─ Quality certificate (if applicable)
  │   ├─ Insurance certificate (liability, professional indemnity)
  │   ├─ Bank details (for payment verification)
  │   ├─ Data Processing Agreement (GDPR)
  │   └─ W-9 / Tax form (if applicable)
  ├─ Documents are uploaded with version tracking and expiry dates
  ├─ System validates expiry and flags expired documents
  └─ Document completeness is recorded

        ↓

Stage 5: COMPLIANCE REVIEW
  ├─ KYC Record created:
  │   ├─ Beneficial owner screening
  │   ├─ PEP (Politically Exposed Person) check
  │   ├─ Risk rating (Low / Medium / High)
  │   └─ Review date set for periodic re-screening
  ├─ Sanctions screening performed:
  │   ├─ Multi-list screening (OFAC, EU, UK, UN)
  │   ├─ Result recorded (Clear / Potential Match / Confirmed Match)
  │   └─ Remediation if required
  ├─ AML/KYC policy requirements verified
  └─ Compliance Manager approves or escalates

        ↓

Stage 6: SUPPLIER AUDIT (if required)
  ├─ Initial on-site or remote audit performed
  ├─ Audit report uploaded and linked
  ├─ Outcome recorded (Approved / Approved with Conditions / Not Approved)
  ├─ Conditions documented and tracked
  ├─ Next audit due date set (typically 1 year from approval)
  └─ Audit outcome flows back to approval status

        ↓

Stage 7: FINAL APPROVAL
  ├─ Approval authority determined by risk level:
  │   ├─ Low Risk   → Procurement Manager approval sufficient
  │   ├─ Medium Risk → Procurement Manager + Quality Manager approval
  │   └─ High Risk  → Procurement Manager + Quality Manager + Director approval
  ├─ All required approvals obtained
  ├─ System confirms all mandatory checks and documents are complete
  ├─ Approval decision recorded with justification
  ├─ Supplier status set to 'Approved'
  ├─ Supplier added to Active Supplier Register
  └─ Notification sent to all stakeholders

        ↓

Stage 8: ACTIVATION
  ├─ Supplier record is activated in trading system
  ├─ Supplier can now receive quotes
  ├─ Orders can be placed
  └─ Performance monitoring begins
```

### Alternative Outcomes

**Rejection Path:**
- Any stage can result in rejection with documented reason
- Rejected supplier status is set to `Rejected - [Reason]`
- Requestor is notified with remediation path
- Supplier can be resubmitted after issues are resolved

**Conditional Approval:**
- Supplier approved with outstanding conditions
- Supplier status is set to `Conditionally Approved`
- Conditions tracked and monitored
- Periodic reviews scheduled to verify compliance

---

## ISO 9001 Clause Alignment

### Clause 4.4 — Quality Management System and Processes

**Requirement:** The supplier onboarding process must be a defined, controlled business process.

**Portal Implementation:**
- [ ] Workflow stages defined in portal configuration
- [ ] Each stage has documented entry/exit criteria
- [ ] Responsibilities assigned by role (Procurement Manager, Quality Manager, Compliance Manager, Director)
- [ ] Workflow engine prevents skipping mandatory stages
- [ ] Each action records: User, Date/Time, Action, Outcome, Justification
- [ ] Process completion is recorded and exportable for audits

**Evidence Generated:**
- Supplier onboarding audit trail report showing complete workflow progression
- Approval chain documentation
- User activity log

---

### Clause 6.1 — Risks and Opportunities

**Requirement:** Organization must address risks in its processes, including supplier risks.

**Portal Implementation:**
- [ ] Risk assessment module with criteria:
  - Financial viability (payment history, credit checks if available)
  - Quality certifications and history
  - Regulatory/licensing compliance
  - Country/sanctions exposure
  - Supply continuity (single source vs. multiple suppliers)
  - Data/information security capability
- [ ] Risk scoring engine (automated calculation based on criteria)
- [ ] Risk categories: Low / Medium / High
- [ ] Risk-based approval paths configured (see Stage 7 above)
- [ ] Risk assessment rationale is recorded
- [ ] Risk re-evaluation triggers (e.g., annual, post-incident)

**Evidence Generated:**
- Risk assessment record with scoring and justification
- Approval chain matching risk level
- Risk trend reporting dashboard

---

### Clause 7.2 — Competence

**Requirement:** Personnel making supplier decisions must be competent; organization must define and ensure competence.

**Portal Implementation:**
- [ ] Role-based permissions enforced:
  - **Procurement Manager:** Can approve Low/Medium risk suppliers; initiates workflow
  - **Quality Manager:** Can approve Medium/High risk suppliers; assesses certification/audit readiness
  - **Compliance Manager:** Reviews KYC/Sanctions; has veto on non-compliance
  - **Director:** Final approval for High-risk suppliers; oversees policy
  - **Auditor/Administrator:** View-only access for audit trails
- [ ] Approval authority matrix is configured and enforced
- [ ] System prevents unauthorized approvals (e.g., buyer cannot approve supplier)
- [ ] Training/competency records can be noted in system (link to training records)
- [ ] Approval matrix is reviewed annually

**Evidence Generated:**
- Role configuration and permissions report
- Approval matrix document
- User activity log showing only authorized users performed approvals

---

### Clause 7.5 — Documented Information

**Requirement:** Organization must control documented information (documents, records, data).

**Portal Implementation:**

**Document Management:**
- [ ] Every document upload captures:
  - Document type (e.g., "ISO 9001 Certificate")
  - Upload date
  - Uploaded by (user)
  - Document expiry date (if applicable)
  - Version number
  - File path and storage location
- [ ] Version control: Old versions retained with change history
- [ ] Document expiry monitoring:
  - System flags expiring documents (30 days before expiry)
  - Automated reminders sent to requestor and reviewer
  - Expired documents prevent supplier approval until renewed
- [ ] Access control: Documents restricted to authorized users only
- [ ] Retention policy: Documents retained for full supplier lifecycle + 3 years minimum

**Mandatory Documents by Supplier Type:**

| Supplier Type | Critical Documents |
|---|---|
| Manufacturing partner | ISO certificate, Audit report, Insurance, Bank details, DPA |
| Service provider | Business reg, Tax ID, Insurance, DPA, References |
| Materials/commodities | Quality cert, Compliance cert, Logistics capability, Bank details |
| Logistics/3PL | ISO 9001 or equivalent, Insurance (cargo, liability), Compliance, DPA |

**Evidence Generated:**
- Document inventory report with versions and expiry dates
- Document audit trail (who uploaded, when, changes)
- Expiry compliance report
- Document retention compliance report

---

### Clause 8.1 — Operational Planning and Control

**Requirement:** Organization must control its operational processes to ensure they meet requirements.

**Portal Implementation:**
- [ ] Workflow is mandatory and cannot be bypassed
- [ ] System enforces stage completion before advancing:
  - Cannot approve supplier until all mandatory documents uploaded
  - Cannot approve without risk assessment
  - Cannot approve without required approval signatures
  - Cannot approve if sanctions screening fails
- [ ] Configuration controls prevent circumventing process steps
- [ ] Change control: Any workflow modifications require documented approval
- [ ] Process performance is measured (see Clause 9.1)

**Evidence Generated:**
- Workflow configuration document
- System activity log showing enforced controls
- Change history for workflow modifications

---

### Clause 8.4 — Control of Externally Provided Products and Services

**Requirement:** Organization must control suppliers according to risk and impact.

**Portal Implementation:**

**Supplier Classification & Approval Records:**
- [ ] Each supplier has a classification:
  - `Critical` — Manufacturing partners, sole source, high-impact
  - `Approved` — Standard supplier, meets all requirements
  - `Conditional` — Approved with outstanding conditions
  - `Rejected` — Failed requirements or assessment
  - `Suspended` — Previously approved but no longer compliant
  - `Delisted` — Permanently non-compliant
- [ ] Approval records include:
  - Supplier ID and legal entity number
  - Classification assigned
  - Risk level
  - Decision date and reviewer
  - Justification / notes
  - Approval signatures (electronic)
  - Conditions (if applicable)
  - Next re-evaluation date
- [ ] Capability assessment captured:
  - Quality certifications held
  - Audit results and rating
  - Previous performance (if repeat supplier)
  - Compliance status (sanctions, KYC, regulatory)
- [ ] Approval history is retained (changes to classification trigger audit events)

**Evidence Generated:**
- Supplier approval record (exportable for external audits)
- Supplier classification report
- Approved Supplier List (with risk classification)
- Approval justification records

---

### Clause 8.5 — Identification and Traceability

**Requirement:** System must uniquely identify suppliers and changes must be traceable.

**Portal Implementation:**
- [ ] Unique supplier identifiers:
  - System-assigned Supplier ID (UUID)
  - Legal entity / company registration number (captured)
  - Tax ID / VAT number (captured)
  - ISO entity number (if applicable)
- [ ] Supplier record contains immutable core data:
  - Company name, legal registration, country
  - Primary contact details
- [ ] Change tracking for all supplier record updates:
  - Any field change recorded with: User, Date/Time, Previous Value, New Value
  - Examples:
    - `Approval Status Changed by: John Smith, 10-Jan-2026, From: prospect, To: approved`
    - `Company Name Changed, From: ABC Ltd, To: ABC Manufacturing Ltd`
- [ ] Audit trail exported showing complete supplier lifecycle

**Evidence Generated:**
- Supplier identity verification document (legal name, registration number)
- Supplier change history report
- Audit trail showing traceability of all modifications

---

### Clause 8.7 — Control of Nonconforming Outputs

**Requirement:** Organization must handle and control nonconforming outputs (rejected suppliers, failed audits, etc.).

**Portal Implementation:**
- [ ] Rejection tracking:
  - Supplier can be rejected at any stage
  - Rejection reason documented (dropdown + free-text notes)
  - Rejection reasons include: Sanction match, failed KYC, missing docs, audit failure, etc.
  - Rejected supplier marked with clear status indicator
- [ ] Remediation pathway:
  - Rejected supplier can request re-submission
  - Required remediation actions listed
  - Upon re-submission, workflow restarts from appropriate stage
  - Previous rejection recorded for history
- [ ] Nonconformity alerts:
  - System detects expired documents, failed re-screening, audit failures
  - Alerts generated for Compliance Manager
  - Nonconforming supplier status updated
  - Remediation actions tracked
- [ ] Supplier suspension/delisting:
  - Reason documented
  - Date effective recorded
  - Stakeholders notified
  - Previous orders flagged for review

**Evidence Generated:**
- Rejection log with reasons and outcomes
- Remediation action plan records
- Nonconformity tracking report
- Suspension/delisting audit trail

---

### Clause 9.1 — Monitoring, Measurement, Analysis and Evaluation

**Requirement:** Organization must monitor supplier performance and system effectiveness.

**Portal Implementation:**

**Supplier Onboarding Dashboards:**
| KPI | Dashboard Widget | Benefit |
|---|---|---|
| Suppliers onboarded (YTD) | Count by month | Track onboarding volume |
| Average onboarding time | Days (baseline trend) | Identify bottlenecks |
| Approval cycle time | By risk level | Measure process efficiency |
| Rejection rate | % and trend | Monitor compliance |
| High-risk supplier %age | Of total approved | Risk profile assessment |
| Document completeness | % of suppliers with all docs | Compliance visibility |
| Sanctions screening failures | Count and rate | Compliance alerts |
| Audit overdue | Count of suppliers | Compliance risk |
| Approver performance | Avg cycle time by approver | Workload balance |
| Workflow stage abandonment | % and reason | Process improvement |

- [ ] Real-time dashboard showing key metrics
- [ ] Trend analysis over time (monthly, quarterly, annual)
- [ ] Drill-down capability to underlying supplier records
- [ ] Export capability for management review and board reporting
- [ ] Automated alerts for threshold breaches (e.g., > 20% rejection rate)

**Evidence Generated:**
- Supplier onboarding KPI report
- Compliance metrics dashboard export
- Process improvement analysis

---

### Clause 9.2 — Internal Audit

**Requirement:** Organization must perform internal audits to verify compliance with requirements.

**Portal Implementation:**
- [ ] Complete audit trail accessible to internal auditors:
  - User activity log (who did what, when)
  - Approval history (all approvals, rejections, overrides)
  - Document history (versions, uploads, changes)
  - Supplier record change history
  - System event log (errors, warnings, configuration changes)
- [ ] Audit report generator:
  - Select supplier(s) and date range
  - Generate complete onboarding workflow report
  - Show all documents, approvals, and decisions
  - Export as PDF/Excel
- [ ] Auditor access:
  - Read-only access for designated internal auditors
  - View all supplier records and history
  - View audit trails and user activity logs
  - View system configuration and workflow definitions
- [ ] Audit readiness:
  - Supplier record checklist (all required info complete)
  - Approval completeness verification
  - Document expiry status
  - Compliance flag summary

**Evidence Generated:**
- Complete supplier onboarding audit trail
- Audit report (full workflow documentation)
- User activity and approvals audit log
- Auditor-certified compliance report

---

### Clause 10.2 — Nonconformity and Corrective Action

**Requirement:** Organization must address nonconformities and track corrective actions.

**Portal Implementation:**
- [ ] Incident recording:
  - Record supplier onboarding failures (e.g., approved without required certificate, incorrect banking details)
  - Capture: Incident date, description, supplier affected, severity
  - Link to root cause (system failure, human error, incomplete process, etc.)
- [ ] Root cause analysis:
  - Guided fields: What went wrong? Why? How did we miss it?
  - Attach evidence (email, screenshot, supplier notification)
- [ ] Corrective action tracking:
  - Define corrective action(s)
  - Assign owner and due date
  - Track status (Open / In Progress / Completed / Closed)
  - Verify effectiveness (re-test or audit)
- [ ] Closure approval:
  - Corrective action reviewed and approved
  - Effectiveness verified
  - Incident closed with documentation

**Evidence Generated:**
- Nonconformity and corrective action log
- Root cause analysis report
- Corrective action effectiveness verification record

---

## Proposed Portal Architecture

### Module Structure

```
┌────────────────────────────────────────────────────────────────┐
│               SUPPLIER ONBOARDING PORTAL v2.0                  │
└────────────────────────────────────────────────────────────────┘

┌─ INTAKE LAYER ──────────────────────────────────────────────────┐
│ Supplier Request Portal                                         │
│  ├─ Quick intake form (Company name, country, risk category)   │
│  ├─ Auto-risk pre-assessment based on country/industry         │
│  └─ Workflow initiation                                        │
└─────────────────────────────────────────────────────────────────┘

┌─ WORKFLOW ENGINE ───────────────────────────────────────────────┐
│ Orchestrator & State Machine                                   │
│  ├─ Enforce mandatory stages in sequence                       │
│  ├─ Track current stage and progress                           │
│  ├─ Route to appropriate approver by role/risk                 │
│  ├─ Prevent skipping steps                                     │
│  ├─ Handle rejections and remissions                           │
│  └─ Trigger notifications and reminders                        │
└─────────────────────────────────────────────────────────────────┘

┌─ RISK ASSESSMENT MODULE ────────────────────────────────────────┐
│ Risk Scoring Engine                                            │
│  ├─ Criteria input (financial, quality, regulatory, geo, etc.) │
│  ├─ Automatic risk scoring (Low / Medium / High)               │
│  ├─ Risk category determination                                │
│  ├─ Approval authority mapping                                 │
│  └─ Risk re-evaluation triggers                                │
└─────────────────────────────────────────────────────────────────┘

┌─ DOCUMENT MANAGEMENT ───────────────────────────────────────────┐
│ Document Repository & Version Control                          │
│  ├─ Mandatory document checklist by supplier type              │
│  ├─ Version-controlled uploads (v1, v2, v3...)                 │
│  ├─ Expiry date tracking and alerts                            │
│  ├─ Access control (role-based)                                │
│  ├─ Storage (Supabase bucket)                                  │
│  ├─ Retention policy enforcement                               │
│  └─ Document audit history                                     │
└─────────────────────────────────────────────────────────────────┘

┌─ COMPLIANCE REVIEW MODULE ──────────────────────────────────────┐
│ KYC, Sanctions, AML Checks                                     │
│  ├─ KYC record creation and risk rating                        │
│  ├─ Multi-list sanctions screening (OFAC, EU, UK, UN)         │
│  ├─ Automated screening with result tracking                   │
│  ├─ Remediation pathway for matches                            │
│  ├─ Compliance manager review and approval                     │
│  └─ Periodic re-screening scheduling                           │
└─────────────────────────────────────────────────────────────────┘

┌─ APPROVAL ENGINE ───────────────────────────────────────────────┐
│ Electronic Approvals & Authority Matrix                        │
│  ├─ Role-based approval permissions                            │
│  ├─ Risk-level approval routing (Low→PM, Med→PM+QM, High→+Dir) │
│  ├─ Electronic signature / approval capture                    │
│  ├─ Approval history and audit trail                           │
│  ├─ Rejection handling and escalation                          │
│  └─ Conditional approval tracking                              │
└─────────────────────────────────────────────────────────────────┘

┌─ SUPPLIER MASTER RECORD ────────────────────────────────────────┐
│ Central Supplier Database                                      │
│  ├─ Unique supplier ID and legal identifiers                   │
│  ├─ Classification (Critical / Approved / Conditional / etc.)   │
│  ├─ Risk level and assessment                                  │
│  ├─ Approval status and history                                │
│  ├─ Linked documents, KYC, sanctions records                   │
│  ├─ Conditions tracking (if conditional approval)              │
│  ├─ Next audit due date                                        │
│  └─ Immutable change history                                   │
└─────────────────────────────────────────────────────────────────┘

┌─ AUDIT TRAIL SERVICE ───────────────────────────────────────────┐
│ Comprehensive Logging & Traceability                           │
│  ├─ User activity log (all actions with timestamp)             │
│  ├─ Approval chain documentation                               │
│  ├─ Document version history                                   │
│  ├─ Supplier record change log (field-level tracking)          │
│  ├─ System event log (configuration, errors, warnings)         │
│  ├─ Exportable audit reports (by supplier, date range, user)   │
│  └─ Query interface for auditors                               │
└─────────────────────────────────────────────────────────────────┘

┌─ REPORTING & DASHBOARDS ────────────────────────────────────────┐
│ KPI Monitoring & Analytics                                     │
│  ├─ Real-time onboarding metrics dashboard                     │
│  ├─ Supplier risk profile summary                              │
│  ├─ Approval cycle time analysis                               │
│  ├─ Document completeness report                               │
│  ├─ Compliance status dashboard                                │
│  ├─ Nonconformity and corrective action tracking               │
│  ├─ Trend analysis and forecasting                             │
│  └─ Export capability (PDF, Excel, CSV)                        │
└─────────────────────────────────────────────────────────────────┘

┌─ INTEGRATION LAYER ─────────────────────────────────────────────┐
│ External Systems & APIs                                        │
│  ├─ Supabase (PostgreSQL database, storage, auth)              │
│  ├─ Sanctions API (external vendor if required)                │
│  ├─ Email notifications (Resend via Edge Functions)            │
│  ├─ ERP integration (create supplier in procurement system)     │
│  └─ User authentication (portal auth)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema Additions

**New Tables/Fields Required:**

1. **supplier_onboarding** (new table)
   - `id` (UUID)
   - `contact_id` (FK to contacts)
   - `workflow_stage` (enum: intake, screening, risk_assessment, document_collection, compliance_review, audit, approval, activation)
   - `current_status` (enum: in_progress, approved, rejected, conditional, suspended)
   - `initial_risk_level` (enum: low, medium, high)
   - `assigned_to` (FK to auth.users — Procurement Manager)
   - `created_at`
   - `updated_at`
   - `completed_at` (NULL until approval stage complete)

2. **supplier_risk_assessment** (new table)
   - `id` (UUID)
   - `supplier_id` (FK to contacts)
   - `financial_viability_score` (0-100)
   - `quality_certification_score` (0-100)
   - `regulatory_compliance_score` (0-100)
   - `information_security_score` (0-100)
   - `geographic_risk_score` (0-100)
   - `supply_continuity_score` (0-100)
   - `overall_risk_score` (0-100)
   - `risk_category` (enum: low, medium, high)
   - `assessed_by` (FK to auth.users)
   - `assessment_date`
   - `next_assessment_due` (1 year later)
   - `notes`

3. **supplier_documents** (revised/expanded)
   - `id` (UUID)
   - `supplier_id` (FK to contacts)
   - `document_type` (enum: business_registration, tax_certificate, quality_cert, insurance, bank_details, dpa, etc.)
   - `version` (integer, auto-incrementing)
   - `file_path` (Supabase storage path)
   - `uploaded_by` (FK to auth.users)
   - `uploaded_at`
   - `expiry_date` (nullable)
   - `is_expired` (computed field or trigger-updated)
   - `change_reason` (why document was replaced)
   - `change_history` (JSON array of versions)

4. **supplier_approvals** (new table)
   - `id` (UUID)
   - `supplier_id` (FK to contacts)
   - `approval_stage` (e.g., "screening", "risk_assessment", "compliance", "final")
   - `approver_id` (FK to auth.users)
   - `approval_date`
   - `decision` (enum: approved, rejected, conditional)
   - `justification` (text)
   - `conditions` (nullable, text if conditional)
   - `approval_authority_level` (derived from risk and approver role)

5. **supplier_audit_trail** (new table — comprehensive logging)
   - `id` (UUID)
   - `supplier_id` (FK to contacts)
   - `event_type` (enum: created, status_changed, document_uploaded, approval_granted, rejection, condition_added, etc.)
   - `user_id` (FK to auth.users)
   - `timestamp`
   - `old_value` (nullable, for change tracking)
   - `new_value` (nullable, for change tracking)
   - `description` (human-readable)
   - `metadata` (JSON for additional context)

6. **supplier_nonconformities** (new table)
   - `id` (UUID)
   - `supplier_id` (FK to contacts)
   - `incident_date`
   - `description`
   - `severity` (enum: low, medium, high)
   - `root_cause`
   - `reported_by` (FK to auth.users)
   - `corrective_action_id` (FK to corrective_actions table)

7. **corrective_actions** (new table)
   - `id` (UUID)
   - `nonconformity_id` (FK to supplier_nonconformities)
   - `action_description`
   - `owner_id` (FK to auth.users)
   - `due_date`
   - `status` (enum: open, in_progress, completed, closed)
   - `effectiveness_verification` (text)
   - `closed_at` (nullable)
   - `closed_by` (FK to auth.users)

8. **supplier_conditions** (new table — for conditional approvals)
   - `id` (UUID)
   - `supplier_id` (FK to contacts)
   - `condition_text` (description of condition)
   - `condition_type` (enum: document_required, certification_required, audit_required, etc.)
   - `due_date`
   - `is_met` (boolean, updated when condition satisfied)
   - `met_date` (nullable)
   - `met_by_evidence` (link to document or record)

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1–4)
- [ ] Database schema updates (new tables, fields, audit trail table)
- [ ] Role-based permissions configuration
- [ ] Approval authority matrix setup
- [ ] Basic workflow engine implementation

### Phase 2: Workflow & Approvals (Weeks 5–8)
- [ ] Supplier intake form redesign
- [ ] Workflow stage enforcement
- [ ] Electronic approval mechanism
- [ ] Rejection and remediation flows
- [ ] Status management and transitions

### Phase 3: Risk Assessment & Document Management (Weeks 9–12)
- [ ] Risk assessment module and scoring logic
- [ ] Document checklist by supplier type
- [ ] Version control and expiry tracking
- [ ] Document upload UI improvements

### Phase 4: Compliance & KYC Integration (Weeks 13–16)
- [ ] KYC record linking and workflow integration
- [ ] Sanctions screening integration
- [ ] Compliance review workflow
- [ ] Automated screening reminders

### Phase 5: Audit Trail & Reporting (Weeks 17–20)
- [ ] Comprehensive audit trail logging
- [ ] Audit report generator
- [ ] KPI dashboards
- [ ] Compliance reporting

### Phase 6: Testing & Refinement (Weeks 21–24)
- [ ] UAT with operations team
- [ ] ISO 9001 compliance verification audit
- [ ] Performance optimization
- [ ] Documentation and training

---

## User Experience Improvements

### For Procurement Managers
- Dashboard showing suppliers awaiting screening review
- One-click screening pass/fail workflow
- Clear visibility of bottlenecks and overdue items
- Notification and reminder system

### For Quality Managers
- Risk assessment form with guided criteria
- Document completeness checklist
- Audit scheduling interface
- Performance trending dashboard

### For Compliance Managers
- KYC and sanctions record creation
- Remediation tracking
- Periodic re-screening alerts
- Compliance status summary

### For Auditors & Management
- Complete audit trail reports
- Supplier approval justification records
- Risk dashboard
- Compliance metrics and trend analysis

---

## Expected Compliance Outcomes

Upon completion of this redesign, Vertex Metals will be able to demonstrate to an ISO 9001 auditor:

1. **Defined Process:** "Here is our supplier onboarding workflow with clear stages, responsibilities, and approvals."
2. **Risk Assessment:** "We evaluate supplier risk based on these criteria and approve according to this authority matrix."
3. **Complete Evidence:** "All suppliers have documented risk assessments, required approvals, and linked compliance records."
4. **Document Control:** "All supplier documents are versioned, dated, and tracked for expiry."
5. **Audit Trail:** "We can show every action taken in the onboarding of any supplier, including who approved it and why."
6. **Competence:** "Only authorized users (by role and risk level) can approve suppliers."
7. **Monitoring:** "We track supplier onboarding performance via these KPIs and dashboards."
8. **Nonconformity Management:** "Failed approvals and rejected suppliers are tracked and remediated."

---

## Success Criteria

- [ ] All 8 stages of supplier onboarding workflow operational
- [ ] Risk-based approval routing enforced
- [ ] 100% of suppliers have documented risk assessment
- [ ] 100% of approved suppliers have complete audit trail
- [ ] Document expiry monitoring active with <2% overdue documents
- [ ] Average supplier onboarding cycle time ≤ 15 working days
- [ ] Zero unapproved suppliers used in trades (system enforced)
- [ ] Internal audit can reconstruct any supplier approval from system records
- [ ] ISO 9001 pre-audit assessment passes Clause 8.4 controls

---

## Next Steps

1. **Stakeholder Alignment:** Review this proposal with Procurement, Quality, Compliance, and IT stakeholders.
2. **Detailed Requirements:** Refine specific workflows, roles, approval matrices, and document checklists.
3. **Design Phase:** Develop UI/UX mockups for portal pages and workflows.
4. **Development Planning:** Create sprint roadmap and resource allocation.
5. **Vendor Assessment:** If external services (e.g., sanctions screening API) are required, evaluate options.

---

## Conclusion

This redesigned supplier onboarding portal will transform Vertex Metals from a fragmented, manual process into a controlled, auditable, compliant system aligned with ISO 9001:2015 requirements. It will reduce compliance risk, improve operational efficiency, and provide clear evidence of supplier governance for external audits and regulatory oversight.
