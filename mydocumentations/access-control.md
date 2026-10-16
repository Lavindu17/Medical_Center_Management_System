# Access control (staff)

The organization side of the system is configurable per site. Patients (the customer side) are fixed and are not part of this.

## Model

- **Screens** (`src/lib/access/registry.ts`): the catalogue of things staff can be given. Each offers some of four levels:
  **view** (see it), **add** (create), **change** (edit), **approve** (the final decision: dispense, mark paid, decide leave...).
  Each screen says what each level means in plain words, shown in the configuration window.
- **Role defaults** (`defaults.ts`): what each role could always do. They equal the old fixed rules, so nothing changes until someone configures something.
- **Profiles** (tables in `22_access_control.sql`): a role's stored copy (edited at this site), profiles you create ("Pharmacist with billing"),
  and a person's own extra ticks. A person's access is the role's profile plus any profiles they hold plus their own ticks; permissions add up.
  Add, change and approve always bring view.
- Administrators can always change access (so a site cannot lock itself out).
- Without the migration the app works with the built-in role defaults; the configuration window says saving needs the update.

## Where it is enforced

1. Every staff API route: `requirePermission(screen, level)` / `requireAccess(...)` (`src/lib/api-auth.ts`). Patients use `requireRole('PATIENT')`.
   `tests/route-guards.test.ts` fails if a route has no guard or names a fixed staff role.
2. The staff app: one shell (`src/components/StaffShell.tsx`) builds the menu from what the person may open and shows "no access" for other pages.
3. Permissions are read fresh on each request, so a change applies on the person's next click.

## Configuration window

`/admin/access` (needs `access.config`): **People** (search a person, give profiles, tick their own permissions),
**Profiles and roles** (edit what a role starts with, create profiles), **Who can use a screen**.
Risky combinations (dispense + edit stock, ...) show a warning but are allowed. Every change is audited (entity ACCESS).

## Adding a screen

Add it to `RESOURCE_LIST`, give roles their defaults in `defaults.ts`, add the menu entry in `screens.ts`, and guard its routes with `requirePermission`.
