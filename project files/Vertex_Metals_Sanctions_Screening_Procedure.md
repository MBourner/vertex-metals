# Vertex Metals Ltd
## Sanctions Screening Procedure

---

## Document Control

| Field | Detail |
|---|---|
| **Document title** | Sanctions Screening Procedure |
| **Company** | Vertex Metals Ltd |
| **Document type** | Operational procedure — companion to the AML/KYC/CDD Policy |
| **Parent policy** | Anti-Money Laundering, Counter-Terrorist Financing, and Customer Due Diligence Policy (Version 2.0) |
| **Version** | 1.0 |
| **Date of issue** | To be confirmed at incorporation (targeted May 2026) |
| **Next review** | Annual from date of issue, and on any material change |
| **Procedure owner** | Martyn Bourner, Money Laundering Reporting Officer |
| **Approved by** | Board of Directors, Vertex Metals Ltd |
| **Status** | Draft — for adoption at incorporation |
| **Distribution** | Directors; MLRO; Deputy MLRO; banking counterparties on request; regulatory authorities on request |

---

## 1. Purpose

This Procedure operationalises the sanctions-related commitments in the Company's AML/KYC/CDD Policy. It sets out:

- The sanctions regimes the Company screens against
- The tools, sources, and workflow used to conduct screening
- The frequency and triggers for screening
- The workflow for handling potential and confirmed matches
- The escalation and external reporting obligations
- The record-keeping standards applied to all screening activity

The Procedure is binding on all directors, officers, and persons acting for the Company. It is read alongside the AML/KYC/CDD Policy; where the Procedure and the Policy are inconsistent, the Policy prevails pending reconciliation.

---

## 2. Scope

This Procedure applies to:

- All prospective suppliers and buyers at onboarding
- All existing suppliers and buyers on an ongoing basis
- All individuals connected to a counterparty and within scope of the Company's CDD — directors, beneficial owners (25% or more), authorised signatories, and other persons of material influence
- All entities in the ownership and control structure of a counterparty to the extent identified in CDD
- All vessels, ports, and transit routes relevant to a specific trade where sanctions indicators warrant
- All financial institutions receiving or sending funds in connection with a trade

Screening is required in advance of any commitment — commercial, financial, or documentary — being made in respect of a counterparty or trade.

---

## 3. Sanctions Regimes

### 3.1 Primary regimes

The Company screens against the following regimes in every case:

- **United Kingdom** — UK consolidated list of financial sanctions targets, maintained by the Office of Financial Sanctions Implementation (OFSI) at HM Treasury
- **United Nations** — UN Security Council consolidated sanctions list
- **European Union** — EU consolidated financial sanctions list, including restrictive measures adopted under the Common Foreign and Security Policy

These three regimes apply to the Company's trading activity by operation of law or as a matter of routine commercial practice and are mandatory in every screening event.

### 3.2 United States — OFAC

The Company screens against the **US Office of Foreign Assets Control (OFAC) Specially Designated Nationals and Blocked Persons (SDN) List** and the Consolidated Sanctions List in every case, notwithstanding that the Company is not a US person.

Rationale: supplier-side settlement is routinely denominated in USD. USD payments are cleared through the US correspondent banking system and are subject to OFAC screening by the Company's banking counterparties. An OFAC match on a counterparty is therefore a practical impediment to executing a USD trade, irrespective of the direct legal applicability of OFAC to the Company. In addition, secondary-sanctions exposure arising from dealings with SDN-designated parties can affect correspondent-banking relationships and the Company's ability to transact internationally.

### 3.3 Other regimes — as relevant

The Company screens against additional regimes where relevant to a specific trade or counterparty, including but not limited to:

- Sector-specific UK, EU, or UN measures (for example, goods-specific or technology-specific restrictions)
- Country-specific regimes where a counterparty has a nexus to the country concerned
- Export control and dual-use regimes relevant to specific products (for example, the UK Strategic Export Control Lists for titanium, nickel superalloys, or other dual-use metals)

The MLRO maintains awareness of regimes likely to affect the Company's business and adds screening against additional regimes where required.

### 3.4 PEP and adverse media — screened concurrently

Although not sanctions regimes strictly, Politically Exposed Person (PEP) status and adverse media are screened for at the same time as sanctions, using the same tools and workflow. PEP and adverse media findings are handled under the CDD provisions of the main Policy; they are recorded alongside sanctions results in the counterparty file.

---

## 4. Screening Tools and Sources

### 4.1 Initial operating model — manual screening (pre-subscription)

In its first period of operation, before trade volume justifies subscription to a commercial screening tool, the Company conducts screening manually against the publicly-available consolidated lists at the following sources:

| Regime | Source |
|---|---|
| UK OFSI | gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets |
| UN Security Council | un.org/securitycouncil/content/un-sc-consolidated-list |
| EU | sanctionsmap.eu and the EU Financial Sanctions Files (FSF) |
| US OFAC | treasury.gov/ofac (SDN and Consolidated Sanctions List) |
| UK PEP and adverse media | Companies House, UK gov sources, open-source adverse media search |

Manual screening is performed by the MLRO or Deputy MLRO personally. Each search is documented by saving a timestamped record of the search term used, the list(s) consulted, the version of the list (date of last list update, where published), the result, and a signed or initialled confirmation by the screener. The workflow for manual screening is set out in section 5 below.

Manual screening is defensible for a small counterparty base with straightforward names, but has known limitations: it does not handle fuzzy matching, name variants, transliteration from non-Latin alphabets, or cross-referencing of ownership trees at scale. The MLRO monitors the adequacy of manual screening against the Company's actual counterparty base and recommends migration to a subscription tool when warranted (section 4.2).

### 4.2 Migration to subscription screening tool

The Company migrates to a commercial screening tool when one or more of the following thresholds is met:

- The active counterparty base exceeds approximately twenty relationships
- A trade is executed or in prospect with a counterparty whose name has meaningful transliteration risk (non-Latin alphabets, common name variants) or whose ownership chain has more than two layers
- Any sanctions or PEP match has required meaningful resolution work that a commercial tool would have materially accelerated
- The Company's banking relationship requires it as a condition

Acceptable commercial tools include (in no particular order): ComplyAdvantage, Dow Jones Risk Center, LexisNexis WorldCompliance, Refinitiv World-Check, and equivalent products meeting the following functional requirements:

- Coverage of UK OFSI, UN, EU, and US OFAC sanctions lists with daily update frequency
- PEP database with sectoral coverage relevant to the Company's sourcing geographies
- Adverse media screening
- Fuzzy matching, name-variant handling, and transliteration support
- Automated auditable logging of every screening event
- Match remediation workflow
- Reasonable API or export capability for integration with the Company's management portal

The migration decision is approved by the MLRO and documented. Parallel manual screening continues for a minimum of one month after migration to confirm the commercial tool is performing as expected.

### 4.3 Bank-provided screening

The Company's transaction banking counterparties independently screen all payments they process against sanctions lists. This screening is a parallel control, not a substitute for the Company's own screening — a bank's screening rejects or holds a payment at instruction time, whereas the Company's screening is required before the Company commits to a counterparty commercially. The Company does not rely on bank screening alone.

---

## 5. Screening Workflow

### 5.1 Counterparty onboarding — full screen

At onboarding of every new counterparty (supplier or buyer), the Company screens:

- The legal entity itself
- All directors (current, and typically those appointed in the preceding three years where identifiable)
- All beneficial owners holding 25% or more
- All authorised signatories to the Company's contract with the counterparty
- Any parent company, controlling entity, or known group member identified in CDD
- Any other natural or legal person whose involvement in the relationship is material

The full screen is conducted against all regimes named in section 3 (UK OFSI, UN, EU, US OFAC, plus PEP and adverse media).

The screen is performed before the MLRO approves the counterparty for onboarding. A counterparty with any unresolved sanctions, PEP, or material adverse media match is not approved until the match is resolved (section 6).

### 5.2 Pre-trade screening

Where more than 90 days have elapsed since the last screen of a counterparty, a refresh screen is conducted before any new trade is committed to. The 90-day figure is a maximum — the MLRO may require a shorter interval for elevated-risk counterparties or specific circumstances.

Pre-trade screening additionally covers, as relevant to the specific trade:

- The shipping line, vessel, and principal ports of loading and discharge
- Any freight forwarder, customs broker, or other intermediary named in the trade
- The buyer's and supplier's banking counterparties (where identified)
- Any other party to the documentary flow (for example, an insurance provider named in a marine cargo policy)

### 5.3 Periodic re-screening

Every active counterparty is re-screened at least every six months. "Active" means any counterparty with a trade in progress, a trade completed within the last twelve months, or an onboarding commitment not yet terminated.

Re-screening covers the same scope as onboarding — the entity, directors, UBOs, signatories — and uses the same list sources.

### 5.4 Triggered re-screening

In addition to the periodic cycle, the Company re-screens a counterparty immediately on becoming aware of any of the following:

- A new sanctions designation by any regime in section 3 that is or may be relevant
- A change of directors, UBOs, or authorised signatories at the counterparty
- Adverse media concerning the counterparty or any connected party
- Any event, report, or communication raising doubt about the counterparty's standing
- A change in the counterparty's bank details or payment arrangements
- Any regulatory action concerning the counterparty in its home jurisdiction

### 5.5 Screening on sanctions-list updates

The MLRO monitors for material sanctions-list updates through the OFSI email alert service and equivalent UN, EU, and OFAC subscription feeds where available. Where a material update occurs — for example, a significant expansion of a country-specific regime — the MLRO reviews the Company's active counterparty base against the update and screens any potentially affected counterparty immediately, ahead of the scheduled six-monthly cycle.

### 5.6 Evidence of screening

Every screening event produces documented evidence retained in the counterparty file, containing:

- Date and time of the screen
- Identity of the person performing the screen (MLRO, Deputy MLRO, or, once engaged, a commercial tool with user identification)
- Counterparty and specific individuals/entities screened
- Lists consulted, with the published list version or last-updated date
- Result — no match, potential match, or confirmed match
- Where a potential or confirmed match — the match-resolution record (section 6)
- Screener's initial or digital signature

For manual screening, the evidence is saved as a PDF or screenshot set in the counterparty's file within the Company's document management system. For commercial-tool screening, the system-generated log is the evidence.

---

## 6. Match Handling

### 6.1 Three match categories

Any screening result falls into one of three categories:

- **No match** — no name, entity, or individual in scope matches any entry on any list consulted. The screen is logged and no further action is taken.
- **Potential match (false-positive candidate)** — a screening result produces a name similarity but inspection suggests the counterparty is not the person or entity on the list (for example, a common personal name, a different date of birth, a different jurisdiction of activity). The match is investigated under section 6.2.
- **Confirmed match** — investigation confirms, or cannot rule out, that the counterparty is the person or entity on the list. Section 6.3 applies.

The Company does not treat any screening hit as a "false positive" without a documented investigation and a documented conclusion, signed by the MLRO.

### 6.2 Potential match — investigation workflow

Where a potential match arises, the Company takes all of the following steps before concluding whether the match is false:

- **Compare identifying data.** Date of birth, nationality, place of birth, legal registration number, address, known aliases. Where multiple data points are available and none align, a false-positive conclusion is likely supportable. Where few data points are available or several align, escalation is likely warranted.
- **Compare role and sector.** A listed individual's sectoral role and known geography of activity. Where the counterparty's role and sector are materially different, a false-positive conclusion is likely supportable.
- **Consult supplementary sources.** Listed entity's country of residence, published ownership details, public news coverage. The MLRO may consult the counterparty's CDD pack for corroborating or discriminating information.
- **Consult the counterparty directly where appropriate.** Where necessary to resolve a potential match, the MLRO may ask the counterparty for additional identifying information. This is done with care — the request must not disclose that the query arose from a sanctions screen (that would risk tipping-off concerns, although sanctions screening is generally not subject to the strict tipping-off offence of SAR filings).

The MLRO records the investigation steps taken, the information considered, and the conclusion reached, signed and dated. Where the MLRO concludes the match is false, the counterparty may proceed in the normal course. Where the MLRO cannot satisfactorily conclude the match is false, the match is treated as confirmed for the purposes of section 6.3.

### 6.3 Confirmed match — response

Where a sanctions match is confirmed, or cannot be ruled out:

- **All activity with the counterparty is suspended immediately.** No further commitments are made, no payments are initiated or received, no goods are shipped or accepted.
- **No tipping-off.** The Company does not notify the counterparty or any connected party that the match has been identified or that action is being taken.
- **Review of held assets or obligations.** The MLRO reviews whether the Company holds funds, goods, or documents belonging to or payable to the counterparty, and whether any contractual obligation is outstanding.
- **Report to OFSI.** A report is submitted to OFSI via the Compliance Reporting Form without delay, containing all information required by OFSI guidance including the nature of the match, the value of any held assets or obligations, and the steps taken.
- **Report to equivalent authorities.** Where the match concerns UN, EU, or OFAC designations, the Company assesses whether additional reporting to other authorities is required and acts accordingly. In the Isle of Man, relevant matters are reported to the IOM FIU via THEMIS.
- **Licence application where relevant.** Where the Company holds assets or has obligations that would trigger a breach of sanctions to release, pay, or deliver, the MLRO assesses whether a licence application to OFSI (or the relevant authority) is appropriate.
- **Consider SAR filing.** Where the circumstances suggest money laundering or terrorist financing as well as sanctions exposure, an internal suspicion report is raised under the AML/KYC/CDD Policy and the MLRO considers whether a SAR filing is required.
- **Counterparty file annotation.** The counterparty's record is annotated to prevent inadvertent re-engagement, and the Approved Supplier List or equivalent buyer record is updated.

The MLRO documents the full response in the counterparty file, including timing of each step, parties notified, and the outcome.

### 6.4 PEP match — response

A PEP match or a close-associate-of-a-PEP match is not, in itself, a prohibition on dealing. The response is:

- MLRO review of the PEP's role, jurisdiction, and any associated risk factors
- Enhanced Due Diligence applied under the main Policy
- Source of funds verification for any trade
- Director-level approval before the relationship proceeds
- Enhanced ongoing monitoring

A decision not to proceed with a relationship on PEP grounds is documented with reasoning.

### 6.5 Adverse media — response

Material adverse media — fraud, corruption, sanctions evasion, environmental crime, organised crime nexus, human rights concerns, and similar — is assessed case-by-case by the MLRO. The factors considered include the nature and credibility of the reporting, the jurisdiction of the counterparty, the age of the reporting, and any subsequent developments. The decision to proceed, proceed with enhanced monitoring, or decline is documented with reasoning in the counterparty file.

Mere commercial-sector news coverage — disputes, restructurings, financial results — is not adverse media and does not warrant special treatment.

---

## 7. Ownership and Control Screening

### 7.1 50 percent rule

A counterparty that is itself not listed but that is owned, directly or indirectly, 50 percent or more by one or more listed parties is treated as a listed party for UK OFSI and EU purposes. OFAC applies the same 50-percent rule under its guidance. The Company screens the full ownership chain of each counterparty to the extent identified in CDD, and treats ownership-based exposure as a confirmed match requiring the section 6.3 response.

### 7.2 Control tests

Beyond the 50-percent rule, a counterparty controlled by a listed party — through voting rights, board appointments, contractual rights, or other means — is also treated as exposed. The MLRO assesses control indicators where the ownership picture is complex or ambiguous.

### 7.3 Where ownership cannot be verified

Where the Company cannot satisfactorily verify that a counterparty is free of listed-party ownership or control — for example, where the counterparty is structured through jurisdictions with opaque beneficial-ownership disclosure — the MLRO may decline to approve the counterparty, or may require additional documentary assurance, or may proceed with enhanced monitoring. The decision is documented.

---

## 8. Vessel, Route, and Trade-Specific Screening

### 8.1 When vessel screening applies

For physical trades where the Company is the Importer of Record or otherwise has material exposure to the shipping leg, the MLRO screens the vessel nominated for the shipment against UK OFSI vessel listings, OFAC SDN vessel listings, and reputable maritime sanctions tracking sources.

### 8.2 Flags and ports

The flag state and the intended ports of loading, transshipment, and discharge are screened. Any vessel flagged by a high-risk jurisdiction, any port with a documented sanctions-evasion or dark-fleet association, and any vessel whose AIS (automatic identification system) behaviour is flagged on open-source tracking tools as irregular warrants MLRO scrutiny before the Company commits to the shipment.

### 8.3 Dark fleet and evasion indicators

Specific indicators that warrant elevated scrutiny include:

- Recent flag changes or repeat flag hopping
- AIS gaps or manipulation in the vessel's recent voyage history
- Ownership through single-vessel companies in opaque jurisdictions
- Recent voyages to sanctioned jurisdictions or to ports associated with sanctions evasion

Where such indicators are present, the MLRO consults the supplier, requests an alternative vessel, or declines the shipment as appropriate.

---

## 9. Documentation and Audit Trail

### 9.1 Counterparty file

Each supplier and buyer has a dedicated file in the Company's document management system. The file contains:

- Initial onboarding CDD pack, including the onboarding screening evidence
- Every subsequent screening event's evidence (manual PDFs or commercial-tool logs)
- Every potential-match investigation record with MLRO conclusion
- Every confirmed-match response record
- Annual document refreshes
- Any triggering event that caused a re-screen, with the re-screen evidence

### 9.2 Trade file

Each trade has a dedicated file containing:

- Pre-trade re-screening evidence
- Vessel, route, and ancillary-party screening evidence (where applicable)
- Trade documents (contracts, invoices, LCs, BL, customs documents, payment confirmations)

### 9.3 MLRO log

The MLRO maintains a running log of:

- All confirmed matches
- All external reports (OFSI, FIU, NCA)
- All counterparty declines on sanctions grounds
- All licence applications
- Any material correspondence with a regulatory authority

### 9.4 Retention

All sanctions-screening records are retained for a minimum of five years from the date the relevant relationship ends or the trade is completed, whichever is later — consistent with the AML/KYC/CDD Policy retention standard.

---

## 10. Training

All persons authorised to conduct sanctions screening on behalf of the Company complete training specific to sanctions screening at appointment and annually. Training covers:

- The screening regimes (section 3)
- The tools and sources (section 4)
- The workflow — onboarding, pre-trade, periodic, triggered (section 5)
- Match-handling — including the distinction between potential and confirmed matches, the investigation workflow, and the confirmed-match response (section 6)
- The 50-percent rule and control tests (section 7)
- Vessel, route, and trade-specific screening (section 8)
- Documentation standards (section 9)

Training completion is recorded. In the first period of operations the MLRO personally conducts all screening; as the business grows and additional persons may perform screening, this training becomes a gating control for that authority.

---

## 11. Review and Stress Testing

### 11.1 Review cycle

This Procedure is reviewed annually by the MLRO and approved by the Board, and on any of the triggers specified in the AML/KYC/CDD Policy section 17.

### 11.2 Stress testing

The Procedure is stress-tested pre-launch alongside the main Policy, against scenarios including:

- A UK-based director of a counterparty sharing a common name with a sanctioned individual — resolving a potential match
- An Indian supplier whose UBO chain passes through a third jurisdiction — ownership-tree screening
- A confirmed match discovered at the six-monthly re-screen of an active counterparty with a trade in progress — response workflow
- A new OFSI designation published while a trade is in transit — triggered re-screen workflow
- A USD payment rejected by the correspondent bank on OFAC grounds — post-event reconciliation
- A vessel nominated for an India-to-UK shipment with a flag change in the preceding 12 months — vessel screening
- A proposed counterparty with opaque ownership through multiple jurisdictions — ownership-verification limits

Gaps identified are addressed by amendment to this Procedure before live trading begins.

---

## 12. Related Documents

- **Anti-Money Laundering, Counter-Terrorist Financing, and Customer Due Diligence Policy** — parent policy
- **Customer Onboarding Procedure** — where CDD and sanctions screening are conducted concurrently
- **Supplier Onboarding Procedure** — where supplier DD and sanctions screening are conducted concurrently
- **Credit Management Procedure** — where screening refreshes are required before credit-terms decisions
- **Supplier Code of Conduct and Responsible Sourcing Policy** — where sanctions concerns intersect with responsible-sourcing concerns

---

## 13. Board Approval

| Director / MLRO | Director |
|---|---|
| **Martyn Bourner** | **Jackson Paul** |
| Signature: _______________________ | Signature: _______________________ |
| Date: ___________________________ | Date: ___________________________ |

This Procedure is approved by the Board of Directors of Vertex Metals Ltd and takes effect from the date of signature above.

---

*CONFIDENTIAL — INTERNAL USE ONLY — and for disclosure to banking counterparties and regulatory authorities on a reasonable-need basis*
