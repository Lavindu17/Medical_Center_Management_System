# Sethro Medical Center

A clinic management system where patients, doctors, receptionists, lab assistants, pharmacists and admins work from one record, linked through the **appointment**:

```
Patient books → Receptionist checks in → Doctor consults ─┬→ Prescription → Pharmacist dispenses
                                                          ├→ Lab request  → Lab assistant uploads result
                                                          └→ Bill (fee + service + labs + medicines)
```

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/Radix UI, MySQL (`mysql2`, plain SQL) and `jose` JWT sessions in an httpOnly cookie.

## Roles

| Role | Can do |
|---|---|
| **Patient** | Book / cancel appointments, view prescriptions, lab reports and bills, edit profile and allergies, link family accounts and switch between them |
| **Doctor** | Daily queue, consultation (vitals, notes, prescription, lab requests), patient history, earnings, weekly schedule and leave days |
| **Receptionist** | Register walk-in patients, book / check in / cancel appointments, link patients, view bills |
| **Lab assistant** | See requests, upload result files (PDF / PNG / JPEG), manage the test catalogue |
| **Pharmacist** | Inventory and batches (FEFO), dispense or reject prescription items, expiry / low-stock alerts, charts |
| **Admin** | Manage staff accounts, doctor fees and commission, revenue |

Everyone gets **in-app notifications** (bell in the sidebar): new appointments, check-ins, cancellations, doctor leave, prescriptions, lab requests and results, bills, dispensing, low stock and family-link requests. Nothing is sent by SMS or push; email is used only for verification codes, password resets and family invitations.

## Setup

1. **Requirements:** Node 20+, MySQL 8.
2. `npm install --legacy-peer-deps`
3. Copy `.env.example` to `.env.local` and fill it in. `JWT_SECRET` is mandatory.
4. **Create the database.** In `mydocumentations/databas_setup_querries/`:
   - new install: run `full_setup.sql` (**it drops and recreates the `sethro_medical` tables**), then `18_schema_sync.sql` and `19_audit_log.sql`;
   - existing install: run `18_schema_sync.sql` and `19_audit_log.sql` (the audit trail; see `mydocumentations/audit-trail.md`). It is idempotent and adds everything the code needs (item dispensed amounts, lab report storage, auth attempt counters, rate limits, session revocation, notifications).
5. `npm run dev` → http://localhost:3000

The seeded demo accounts in `full_setup.sql` use the password documented there; change them before any real use.

**Troubleshooting: the page reloads over and over in dev.** The terminal/`.next/dev/logs` show `Failed to write app endpoint ... Next.js package not found`. Turbopack's on-disk cache (`.next/dev/cache`) has gone stale, usually after a dev server was killed mid-write or two were started in this folder. The cache is turned off for dev in `next.config.ts`, but if it ever happens again: stop the server and run `npm run dev:clean` (deletes `.next`, then starts dev). Run only one `next dev` per project folder.

## Testing

```bash
npm test                  # unit + security matrix (no database needed)
npm run test:integration  # real MySQL: flows, rules, concurrency
```

- **Security matrix** (`tests/security-matrix.test.ts`) discovers every route in `src/app/api` and checks that anonymous, wrong-role and forged-token callers are refused. New routes are covered automatically; routes that are meant to be public must be added to its `PUBLIC` list.
- **Integration tests** build an isolated `sethro_medical_test` schema from `full_setup.sql` + `18_schema_sync.sql` + `19_audit_log.sql` on the server named in `.env.local` / the environment, and drop it again on the next run. They refuse any database name not ending in `_test` and any non-local host, and never touch the application schema.
- CI (`.github/workflows/ci.yml`) runs type check, unit and integration tests against a MySQL 8 service.

## Security notes

- Every API route authenticates for itself (`requireRole` in `src/lib/api-auth.ts`); the middleware only guards pages.
- Sessions are re-checked against the database on every request, so deleting an account, changing a role or changing/resetting a password ends existing sessions immediately.
- Verification and reset codes allow 5 wrong guesses; login, reset and resend are rate-limited (MySQL-backed).
- Lab reports are stored outside `public/` and served only to the patient, the requesting doctor, the lab team and admins.
- Security headers are set in `next.config.ts`. A Content-Security-Policy is not yet set; it needs a UI-wide pass.

## Project layout

```
src/app/(auth)         sign-in, register, verify, reset
src/app/(dashboard)    one folder per role
src/app/api            route handlers (auth, appointments, doctor, pharmacist, lab, receptionist, admin, notifications)
src/lib                db, api-auth, booking, notify, rate-limit, session-check, lab-reports, validation helpers
src/services           auth + email services
mydocumentations       schema, migrations, design notes
tests                  unit tests; tests/integration runs against MySQL
```
