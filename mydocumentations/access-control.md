# Access control (staff)

The organization side of the system is configurable per site. Patients (the customer side) are fixed and are not part of this.

## Model

- **Screens** (`src/lib/access/registry.ts`): every window in the staff app is a screen, including My Work and Account. Each offers some of four
  levels: **view** (see it), **add** (create), **change** (edit), **approve** (the final decision: dispense, mark paid, decide leave...).
  Each screen says what each level means in plain words, shown in the configuration window.
- **The database decides, and only the database.** Access is what is stored in `access_profiles` / `access_grants` (`22_access_control.sql`).
  With nothing stored, nobody on staff can open anything. The one fixed rule: an administrator can always open the Access control window,
  so a site can never lock itself out of setting things up.
- **Starting profiles**: `23_access_seed.sql` writes each role's starting permissions into the database (the access the roles always had).
  It is generated from `ROLE_TEMPLATES` in `defaults.ts` (a test keeps the file equal to it) and only adds missing rows, so re-running it never undoes edits.
  The same starting point can be written from the Access window with "Write the starting permissions" / "Reset to starting point".
- A person's access = their role's stored profile + profiles they hold + their own ticks (permissions add up). Add, change and approve bring view.
- Pages that are not listed as screens are closed to everyone (`screens.ts`; a test fails if a staff page is not a screen).

## Where it is enforced

1. Every staff API route: `requirePermission(screen, level)` / `requireAccess(...)` (`src/lib/api-auth.ts`). Patients use `requireRole('PATIENT')`.
   `tests/route-guards.test.ts` fails if a route has no guard or names a fixed staff role.
2. The staff app: one shell (`src/components/StaffShell.tsx`) builds the menu from what the person may open and shows "no access" for other pages.
3. Permissions are read fresh on each request, so a change applies on the person's next click.

## Configuration window

`/admin/access` (needs `access.config`): **People**, **Profiles and roles**, **Who can use a screen**.
Risky combinations (dispense + edit stock, ...) show a warning but are allowed. Every change is audited (entity ACCESS).

## Adding a screen

Add it to `RESOURCE_LIST`, give roles their starting ticks in `defaults.ts`, add the menu entry in `screens.ts`, guard its routes with
`requirePermission`, then regenerate `23_access_seed.sql` (the seed test tells you) and run it on each site.

## Not (yet) permissions

Notifications (the bell) and signing in/out are available to everyone who is signed in; they only ever show a person their own items.

## "Other staff" (the STAFF role)

For jobs that fit no built-in role (a billing clerk, a pharmacy assistant who must not dispense). `24_staff_role.sql` adds the role; it starts with only
My Work and Account, and everything else comes from the profiles you give the person. (Permissions only ever add up, so to give someone *less* than a
built-in role, use "Other staff" plus profiles instead of trying to subtract from the role.)

## What follows permissions (not job titles)

- **Notifications**: who is told about a new prescription, lab request, bill, doctor leave, leave request or correction is decided by permission
  (`usersWithPermission` in `src/lib/notify.ts`): a person given dispensing through a profile is told, a pharmacist whose dispensing was removed is not.
- **Whose records**: the shared appointment and lab-report routes show a person everything only if they hold the front desk's / the lab's permission;
  otherwise (a doctor) only their own patients' visits. Private clinical notes are shown only to the visit's own doctor.
- **Screens**: buttons a person cannot use are hidden or disabled (`useCan`, `AccessContext.tsx`). The server still checks every request.
  Pages that need more than viewing declare it in `screens.ts` (for example booking needs "add").

## Upgrades

When a release adds a screen, existing sites have no stored row for it, so it is closed to every role until it is added. The Access window shows a
notice per role and "Add them with the starting ticks" fills the missing screens without changing anything that exists (also `23_access_seed.sql`, re-run).

## Worth knowing

- Whoever can *change* Access control can give anyone (themselves included) any permission. Give it only to people you would trust as administrators.
- Two administrators saving at once take turns (the person's or the role's row is locked); a rare lost race is retried.
