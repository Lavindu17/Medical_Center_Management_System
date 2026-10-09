# Sethro Medical Center: gap analysis against how other systems work

Written 2026-10-08. Scope per the owner: notifications stay **in-app** (no SMS or push), and **payment gateways are ignored**. Billing is still covered as a business process (invoice, discount, refund), because it is part of how clinics operate.

## How to read this

**What the reference systems do** comes from web research. Be aware of its quality: most of it is vendor blogs and product pages. Only OpenEMR's feature page, the Bahmni wiki and one academic paper on overbooking are close to primary sources. Percentages quoted by vendors (for example "reminders cut no-shows by 38%") are marketing figures, so none of them is used here as a fact. Where a topic has legal weight (Sri Lanka's PDPA, NMRA drug schedules, SLMC rules) the research did **not** find authoritative text, so those are listed as "needs checking", not as requirements.

**What we do** comes from reading our code and database schema today (tables, routes, statuses), not from memory.

Rating used below: **Covered**, **Partial**, **Missing**. "Impact" is my judgement of patient-safety, legal or operational weight: **High / Medium / Low**.

---

## 1. Identity and registration

| | |
|---|---|
| **Industry practice** | One identity per person, enforced by a master patient index (MPI): a search before creating a new chart, duplicate detection on name, date of birth, phone and national ID, and a documented **merge/unmerge** process. Merging beats deleting, and a wrong merge (two people in one chart) is the more dangerous error. Patient numbers (MRN) are unique and never reused. OpenEMR also captures language, employer and insurance on the patient; Bahmni registration is a front-desk step that can start a visit. ([ForTheRecord](https://www.fortherecordmag.com/news/enews_1124.shtml), [CapMinds MPI guide](https://www.capminds.com/blog/duplicate-patient-records-implement-mpi-in-7-steps/), [OpenEMR features](https://www.open-emr.org/wiki/index.php/OpenEMR_Features), [Bahmni registration](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/32604190/Patient+Registration)) |
| **What we do** | A patient is a login account (`users` + `patients`). Email is unique. Receptionists can register walk-ins, who get a login. Family accounts are linked through `family_links` with consent (invite, accept, switch). |
| **Gaps** | **No patient number (MRN) and no national ID (NIC) field.** **No duplicate check** when registering (two "Alice Same", born the same day, are two charts). **No merge.** Registration needs an email-style account, which is awkward for patients who have only a phone, children or elderly walk-ins. No guardian concept for minors apart from family links. |
| **Impact** | **High.** Split charts hide allergies and history from the treating doctor. |

## 2. Appointment scheduling and queue

| | |
|---|---|
| **Industry practice** | Self-service **booking, rescheduling and cancelling**; a **waitlist** that offers cancelled slots to waiting patients; **reminders** (typically 24 to 48 hours before) with confirm or cancel; **recurring/follow-up appointments**; appointment **types** with their own durations; written **cancellation window** (24 hours is the common default) and **no-show policy**; tracking of no-show rates by type and lead time; limited **overbooking** driven by data, with caps; **same-day capacity** reserved for walk-ins and urgent cases. OpenEMR has a flow board, repeating appointments, open-slot search and recall reminders. ([Solum overbooking guide](https://getsolum.com/overbooking-limits-policy), [CarePatron no-show policy](https://www.carepatron.com/blog/no-show-policy-for-private-practice), [academic paper on overbooking and walk-ins](https://mayoclinic.elsevierpure.com/en/publications/redefining-policies-to-reduce-the-negative-effects-of-patient-no-), [Arkenea portal guide](https://arkenea.com/blog/patient-portal-features/), [OpenEMR features](https://www.open-emr.org/wiki/index.php/OpenEMR_Features)) |
| **What we do** | Slot-based booking from the doctor's weekly schedule, leave days and slot length. Atomic booking that prevents double-booking. A queue number per doctor per day. Patients, doctors and receptionists can cancel. Receptionists can mark checked-in, absent or no-show with a state machine. A doctor adding leave notifies affected patients. |
| **Gaps** | **No reschedule**: when a doctor goes on leave the notification says "needs rescheduling", but the patient must cancel and book again by hand. **No waitlist.** **No reminders**: notifications fire on events only, there is no scheduled job that reminds anyone before a visit. **No appointment types** (new visit, follow-up, procedure) and no per-type duration. **No cancellation cutoff** and **no no-show consequence or report**. **Queue number is booking order**, not arrival order, and there is no live queue board for the waiting room. No recurring or follow-up booking. No same-day reserve. |
| **Impact** | **High** for reschedule and reminders (most visible to patients and the cheapest levers on no-shows); Medium for the rest. |

## 3. Consultation and clinical record

| | |
|---|---|
| **Industry practice** | Structured encounter: vitals, history, **coded diagnosis (ICD-10)**, orders, prescriptions; configurable forms and order sets; **referrals** to other specialists; **sick notes and medical certificates**; follow-up plans; immunisations; problem list; growth charts. In the sources, the sick note requires a recorded diagnosis first. ([Bahmni consultation](https://bahmni.atlassian.net/wiki/x/gwBDAg), [Bahmni diagnosis](https://bahmni.atlassian.net/wiki/x/dwBqAg), [Bahmni orders](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/115217943/Order+Medications+and+or+Tests), [outpatient workflow examples](https://www.discovery.co.za/assets/discoverycoza/medical-aid/health-id/how-to-hold-an-end-to-end-online-consultation.pdf)) |
| **What we do** | One consultation screen: vitals (weight, blood pressure, temperature, pulse), one **free-text notes field** that doubles as diagnosis, prescription with dose, frequency and duration, lab orders, history panels, draft and complete states. Completing creates the bill. Doctors see the patient's allergies. |
| **Gaps** | **Diagnosis is free text, with no ICD-10 coding**, so nothing can be reported by condition. No **referral letters**, **sick notes or medical certificates**, **follow-up date**, **immunisation record**, **problem list** or **chronic medication list**. Height and BMI are not captured. Prescriptions cannot be **printed or exported** as a document. **Allergy is displayed, not checked**: nothing warns when a prescribed medicine conflicts with a recorded allergy, and there is no **drug-interaction** check. |
| **Impact** | **High** for the allergy/interaction safety check and printable prescriptions; Medium for coding, certificates and referrals. |

## 4. Pharmacy

| | |
|---|---|
| **Industry practice** | Batch and expiry control with **earliest-expiry-first**; **controlled-drug registers**; allergy and **interaction checks at dispensing**; recorded **substitutions** and partial dispenses; **purchase orders** and **supplier** records; goods receipt with batch and expiry; **returns** (to supplier for expiry or damage, and patient returns) with credit notes; reorder points. ([Odoo pharmacy modules](https://ecosire.com/apps/odoo/pharmacy-management), [pharmacy software guide](https://blog.hysabone.com/?p=61), [GoFrugal](https://www.gofrugal.com/blog/pharmacy-solution-highlights)) These are vendor descriptions; their interaction checks depend on a configured list, not a clinical database. |
| **What we do** | Medicines with batches (buying and selling price, expiry, quantity). **Earliest-expiry-first dispensing**, transactional and race-safe. Partial dispensing and rejection with a reason (out of stock or patient declined). Expiry and low-stock alerts, with in-app notifications to the pharmacist. Dispensing writes the amount charged on the bill. |
| **Gaps** | **No suppliers, purchase orders or goods-received notes**: stock is added by hand as a batch. **No returns or write-off workflow** (expired stock cannot be formally written off, only seen). **No controlled-drug register** or prescription-only rules (NMRA schedules, needs checking). **No allergy or interaction warning** at dispensing. **No substitution record** (generic for brand). **No stock movement ledger** (who changed what, when). **No stock-take** or adjustment with a reason. Dispensing shows allergies but does not enforce them. |
| **Impact** | **High**: allergy/interaction and a controlled-drug register (once the legal rule is known); Medium: suppliers, purchase orders, returns, ledger. |

## 5. Laboratory

| | |
|---|---|
| **Industry practice** | Order, **specimen collection with a unique ID and label**, accessioning, result entry **with units and reference ranges**, abnormal and **critical value flags**, **verification** by a second person or rule, **critical-value notification** recorded (who was told, when), then reporting. Bahmni uses a full LIS (OpenELIS). ([LIS workflow](https://www.softcomputer.com/2024/03/31/what-is-the-lis-workflow-process/), [Bahmni lab integration](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/13107215/Features)) |
| **What we do** | A doctor orders a test from a catalogue; the lab assistant uploads a **PDF or image report**; the patient and doctor are notified; the patient can download it from a private, access-controlled URL. Test price and cost price are stored. |
| **Gaps** | **Results are a file, not data.** No result values, units or reference ranges, so nothing can be flagged abnormal, trended over time or charted. **No specimen tracking**, no collected/received states (only pending and completed). **No verification step** and no **critical-value** handling. No turnaround time tracking. No test panels. |
| **Impact** | Medium now; becomes High if you want trends, alerts or doctor sign-off on results. |

## 6. Billing and finance

| | |
|---|---|
| **Industry practice** | Itemised invoice generated from the encounter; **receipts**; **discounts** with approval; **partial payments and deposits**; **refunds and credit notes** (full or per line) to reverse a charge; **insurance and panel billing** with claim tracking; daily **cash reconciliation** of front-desk collections. ([hospital billing workflow](https://www.process.st/templates/hospital-bill-administration-process/), [credit notes](https://learning.goodx.co.za/mod/glossary/showentry.php?eid=4238), [Embodia billing](https://cpa.embodiaapp.com/guides/1169-practice-management-on-embodia-part-3-billing-embodia-team), [OpenEMR billing](https://www.open-emr.org/wiki/index.php/OpenEMR_Features)) Pre-service estimates were not found in the sources. |
| **What we do** | One bill per appointment: doctor fee, service charge (fixed 500), lab total, pharmacy total, total, status pending or paid. The receptionist marks it paid with a method (cash, card, insurance). The patient sees an itemised view. Admin revenue report with doctor commission and COGS. |
| **Gaps** | **No discount or waiver**, **no refund or credit note** (a cancelled completed visit leaves its bill), **no partial payment**, **no printable receipt or invoice**, **no day-end cash reconciliation**, "insurance" is just a label (no insurer, policy number, claim or approval), and the service charge is hard-coded. The bill is not locked after payment against late edits (partly handled; worth re-checking). |
| **Impact** | **High** for refund/credit note and printable receipt (every real clinic needs them); Medium for discounts and reconciliation. |

## 7. Patient portal and engagement

| | |
|---|---|
| **Industry practice** | Booking, reschedule, cancel; records, results and medicines; **secure messaging** with the care team; **prescription refill requests**; **pre-visit forms**; **proxy/family access with controls** over what a proxy can see (one study found only 13 of 69 hospitals offered such controls); video visits; online registration. ([Physicians Practice](https://www.physicianspractice.com/view/must-have-patient-portal-features), [Arkenea](https://arkenea.com/blog/patient-portal-features/), [Pabau](https://pabau.com/blog/what-is-a-patient-portal/)) |
| **What we do** | Mobile-first portal: booking, upcoming and past visits, prescriptions, lab reports, bills, family accounts, profile and allergies, in-app notifications. |
| **Gaps** | No **messaging**, **refill request**, **pre-visit form**, **reschedule**, **waitlist**, **medical record download or share**, or **telemedicine**. Family access is all-or-nothing: a linked member can see and act on the whole account, with **no per-category controls** and **no unlink**. |
| **Impact** | Medium. Family access controls and unlink are **High** for privacy. |

## 8. Security, privacy and audit

| | |
|---|---|
| **Industry practice** | **Audit log** of who viewed or changed which record (user, role, patient, action, time), tamper-evident, with review for unusual access; **break-glass** emergency access with a mandatory reason and after-the-fact review; patients can **see who accessed their record**; **MFA** (step-up for sensitive actions, SMS only as a fallback), idle **session timeouts** (about 10 to 15 minutes for patients, shorter for admins) and an absolute session lifetime; **progressive lockout** instead of long hard locks; "log out of all devices"; breached-password blocklist; least-privilege roles reviewed regularly. HIPAA sets controls to be chosen and documented, not exact numbers. ([audit trail guide](https://www.accountablehq.com/post/ehr-audit-trail-explained-what-it-is-compliance-requirements-and-best-practices), [portal authentication](https://www.accountablehq.com/post/patient-portal-authentication-mfa-sso-and-hipaa-compliant-best-practices), [access control guide](https://www.accountablehq.com/post/healthcare-access-control-guide-hipaa-compliance-best-practices-and-implementation-steps)) |
| **What we do** | Role-based routes and API guards (403 for the wrong role), httpOnly session cookie, session re-checked against the database, sessions revoked when a password changes, rate limiting on login and sensitive actions, email verification and reset codes with attempt limits, security headers, private lab-report storage, ownership checks on patient data, in-app notifications. |
| **Gaps** | ~~No audit log~~ **Done 2026-10-09**: append-only, hash-chained audit trail with an admin viewer, CSV export, integrity check and a patient-visible access history (see `audit-trail.md`). **Still open:** **any doctor can open any patient's chart** (now logged, but no care-relationship rule and no break-glass); **no MFA**; **no idle timeout** (a session lasts a day); **no "sign out of all devices"** control; no alerting on unusual access; no data export or deletion process for patients' own data. |
| **Impact** | **High.** The audit log and chart-access rule are the single biggest compliance gap. |

## 9. Legal and regulatory (needs checking, not asserted)

The research did not return authoritative text for any of this. Treat these as **questions to settle with a lawyer or the regulator**, not as verified requirements:

- **Sri Lanka Personal Data Protection Act No. 9 of 2022.** Sources agree health data is a special category with extra protection, but conflict on commencement dates and I could not confirm exact duties (consent, breach notification, retention, patient rights). Check the Gazette and the Data Protection Authority's guidance.
- **NMRA drug schedules.** Sources describe schedules including prescription-only and narcotics. Whether and how a controlled-drug register must be kept is **not confirmed**.
- **SLMC** requirements for medical records, certificates and confidentiality: **nothing found**.
- **Record retention periods**, and what a patient may request to be deleted: not found.

## 10. Operations and platform

| | |
|---|---|
| **Industry practice** | Reports (appointments, encounters, prescriptions, referrals, collections); multi-facility and multi-language support (OpenEMR supports 30+ languages); document management; interoperability through **FHIR/HL7**; backups and data export. ([OpenEMR](https://www.open-emr.org/wiki/index.php/OpenEMR_Features)) |
| **What we do** | Role dashboards, admin revenue analytics, a single site, English only, an interactive API for our own UI only. Integration and unit tests, CI workflow, README. |
| **Gaps** | Single facility. English only (no Sinhala or Tamil). No FHIR/HL7 or any public API. Few reports beyond revenue and dashboards (no appointments report, no no-show, no top diagnoses, no medicine consumption). No scheduled backups documented in the repo. Dates and money formats are fixed to one locale. |
| **Impact** | Medium. Language is likely important for real Sri Lankan patients and worth deciding early. |

---

## What we have **not** covered yet, prioritised

**P0: patient safety and compliance (do before real patient data)**
1. ~~**Audit log**~~ **Done**: every view and change of patient data, an admin Audit log page, and patient-visible access history. Open follow-ups: alerting on unusual access, external anchoring of the chain fingerprint.
2. **Chart-access rule**: doctors see only patients they have a care relationship with, plus a **break-glass** override that needs a reason and is reviewed.
3. **Allergy and interaction check**: warn the doctor when prescribing and the pharmacist when dispensing. Starts as allergy-name matching; interactions need a curated list or a licensed drug database.
4. **Duplicate prevention and merge**: NIC and/or MRN, a name and date-of-birth match check on registration, and an admin merge tool with undo.
5. **Settle the legal questions** in section 9 before go-live.

**P1: core operations a clinic will hit in week one**
6. **Reschedule** (patient and receptionist), and a doctor-leave flow that offers new slots instead of "cancel and rebook".
7. **Scheduled reminders** (in-app, 24 hours and 2 hours before) with confirm or cancel.
8. **Cancellation window and no-show policy**, plus a no-show report; later, a **waitlist**.
9. **Printable prescription, invoice and receipt** (PDF), with clinic letterhead.
10. **Refund and credit note**, **discount with reason and approval**, and **day-end cash reconciliation**.
11. **Structured diagnosis** (ICD-10 search), **follow-up date**, **sick note and medical certificate**, **referral letter**.
12. **Idle session timeout**, "sign out of all devices", and MFA for admin and pharmacy roles.

**P2: depth and growth**
13. Pharmacy back office: suppliers, purchase orders, goods received, returns and write-offs, stock ledger, stock-take, controlled-drug register (once the rule is known), substitution record.
14. Lab as data: result values, units, reference ranges, abnormal and critical flags, specimen status, verification, trends for patients.
15. Appointment types and durations, recurring or follow-up booking, walk-in handling with reserved capacity, live queue board.
16. Portal depth: secure messaging, refill requests, pre-visit forms, downloadable record, per-category family access controls and unlink.
17. Reports: appointments, no-shows, diagnoses, medicine usage, collections by user.
18. Sinhala and Tamil, multi-branch, FHIR export, documented backups and restore.

**Deliberately out of scope for now (per your instruction):** payment gateway, SMS and push notifications. Reminders in P1 are in-app only, which limits their effect for patients who do not open the app; that trade-off is worth knowing.

## Decisions I need from you

1. **Legal basis:** who confirms PDPA, SLMC and NMRA obligations, and by when? Items 4, 5, 13 depend on it.
2. **Patient identity:** is NIC mandatory, optional, or not collected? Do children and elderly patients need to exist without their own email?
3. **Chart access:** may any doctor open any chart (today), or only doctors with a care relationship plus break-glass?
4. **Cancellation policy:** what window and what consequence (none, warning, block on repeat no-shows)? Fees would need the payment side, so I would not charge fees.
5. **Language:** are Sinhala and Tamil required for launch?
6. **Scope of one clinic:** one site only, or branches?

## Source quality

Used: [OpenEMR features](https://www.open-emr.org/wiki/index.php/OpenEMR_Features) (project wiki), the [Bahmni wiki](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/13107215/Features) (project docs), an [academic paper](https://mayoclinic.elsevierpure.com/en/publications/redefining-policies-to-reduce-the-negative-effects-of-patient-no-) on overbooking and walk-ins (2011, so validate against your own data). Everything else cited above is a vendor or consultancy page: good for a feature checklist, weak as evidence of effectiveness or legal duty. I could not find official Doctolib or Practo documentation, so statements about them rest on third-party summaries and one user review.
