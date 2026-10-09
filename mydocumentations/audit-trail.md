# Audit trail

Introduced 2026-10-09. Run `databas_setup_querries/19_audit_log.sql` once (it is idempotent) to create the table and its triggers.

## What it is for

An audit trail answers: **who** did **what** to **which record**, **when**, from **where**, and **did it succeed**. It is the control that lets a clinic detect inappropriate access (staff looking at a neighbour's chart), investigate incidents, and show patients and regulators that access is accountable. It follows the common structure recommended for electronic health records (for example the HIPAA "audit controls" standard, 45 CFR 164.312(b)); it is not a certification of legal compliance for Sri Lanka, which still needs to be confirmed (see `gap-analysis.md`, section 9).

## What is recorded

| Column | Meaning |
|---|---|
| `occurred_at` | UTC time, millisecond precision, set by the application server |
| `actor_id`, `actor_role`, `actor_name` | The **human** who acted. The name is copied into the row, so it survives deletion of the user |
| `on_behalf_of_id` | Set when a family member switched into another account: the row names the real person and the account they were acting as |
| `action` | `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGE`, `PASSWORD_RESET`, `ACCOUNT_SWITCH`, `VIEW`, `SEARCH`, `DOWNLOAD`, `EXPORT`, `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `DISPENSE`, `REJECT`, `ACCESS_DENIED`, `VERIFY_CHAIN` |
| `entity_type`, `entity_id` | What was touched (`PATIENT_CHART`, `CONSULTATION`, `PRESCRIPTION`, `LAB_REPORT`, `BILL`, `USER`, ...) |
| `patient_id` | Whose record it concerns. This drives the patient's own access history |
| `outcome` | `SUCCESS`, `DENIED` (not allowed) or `FAILURE` |
| `ip`, `user_agent` | From the request headers. Only trustworthy behind a proxy you control (see "Operating it") |
| `details` | Ids, field names, counts. **Never** clinical notes, results, passwords, codes or tokens (a filter drops any key that looks like a credential) |

### What triggers an entry

- **Authentication:** every sign-in, failed sign-in (with the email tried and why), sign-out, password change and reset, and family account switch.
- **Reading patient information:** opening a chart, a consultation, an appointment, a prescription; downloading a lab report; patient searches by staff (the entry records that a search happened and how many results, not the text typed).
- **Changing anything:** consultations and their completion, dispensing and rejecting medicines, lab uploads, bookings, cancellations and status changes, bills marked paid, patient and account profile edits, family links, user create, update (which fields, and role changes) and delete, doctor fee and schedule changes, medicine and batch changes, lab test catalogue changes.
- **Refusals:** a signed-in person calling something their role does not allow.
- **The audit log itself:** viewing it, exporting it and verifying it are all recorded.

A patient reading **their own** record is not recorded (the patient's history is about everyone else). A family member acting as the patient **is**, under their own name.

## How tampering is prevented and detected

1. **Append-only.** Database triggers refuse every `UPDATE` and `DELETE` on `audit_log`, so the application cannot rewrite history even if it has a bug.
2. **Hash chain.** Each row stores the SHA-256 of the previous row (`prev_hash`) and of itself (`hash`). `prev_hash` is `UNIQUE`, so the chain cannot fork. Someone with administrator rights on the database who drops the triggers and edits or deletes a row **breaks the chain**, and **Audit log, Check integrity** (or `POST /api/admin/audit/verify`) names the first bad row.
3. **No foreign keys.** An audit row must outlive the person or patient it describes.

**Known limits.** (a) Deleting rows from the very **end** of the trail leaves a valid chain. The fingerprint shown after each integrity check is the countermeasure: copy it somewhere outside the database and compare next time. (b) Someone who can drop the triggers *and* recompute every later hash can forge a clean chain; that needs a database administrator, which is why database accounts must be tightly held (below). (c) Direct database access (not through the app) is not logged.

## Who can read it

- **Administrators:** `Admin, Audit log`: filter by dates, action, record type, outcome, staff member and patient; export up to 10,000 rows as CSV; check integrity. Viewing the first page of results, exporting and verifying are themselves logged.
- **Patients:** `Account, Who has accessed your record`: people, roles, what they did, and when. Never addresses or details. Repeated identical views within half an hour are shown as one line.
- Nobody else. Every other role gets 403.

## Operating it

- **Alert on `AUDIT_WRITE_FAILED`.** A failing audit write never blocks patient care (the usual availability trade-off), but it is reported on the server log with that exact text. Someone should be alerted when it appears; a silent audit failure defeats the purpose.
- **Retention.** The application never deletes audit rows. Keep them for at least six years unless local law says otherwise. To archive, export and store the file; do not delete rows.
- **Database accounts.** The application account should not have `DROP`, `ALTER` or `TRIGGER` privileges in production. If you can, grant it only `SELECT` and `INSERT` on `audit_log`.
- **Time.** Keep the server clock synchronised (NTP); times are recorded in UTC.
- **IP addresses** come from `X-Forwarded-For` or `X-Real-IP`. Run behind a proxy that overwrites these headers; otherwise a client can forge its address.
- **Failed sign-ins** record the email entered. That is normal for security monitoring but it means the log can contain mistyped addresses; treat the log as confidential.
- **Backups.** Include `audit_log` in backups and test restoring it, then run Check integrity on the restored copy.

## Not covered yet (next steps)

- **Chart-access rule and break-glass.** Any doctor can still open any patient's chart; it is now logged, but not restricted. A care-relationship rule with a reasoned, reviewed emergency override is the next step.
- **Alerting and review.** No automatic flagging of unusual access (bursts of chart opens, after-hours access, repeated denials). The data to build it is now there.
- **Reads of lists** (the pharmacist's prescription queue, the receptionist's appointment list) are not logged per patient; individual records opened from them are.
- **Digital signatures or external anchoring** of the chain head (for example, emailing the fingerprint daily to a compliance mailbox).
