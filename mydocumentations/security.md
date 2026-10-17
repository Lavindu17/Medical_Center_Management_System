# Security notes

What the system does, and what whoever deploys it must do.

## Built in
- Passwords: at least 8 characters, no common passwords, nothing that contains the person's name or email, at most 72 bytes. Stored with bcrypt.
- Sessions: signed cookie (httpOnly, sameSite=lax, secure in production), valid one day, re-checked against the database on every request. A password change, reset, role change, deleted account or **signing out** ends every session of that person.
- Rate limits (stored in MySQL): sign-in per account and per address, registration per address and per email, codes and resets per account, one-time codes lock after 5 wrong tries.
- Access: every staff window is a permission (see access-control.md). Only an administrator can create, change or delete administrators, or give anyone access to the access configuration itself.
- Doctors only see patients they have an appointment with.
- Headers: Content-Security-Policy (nothing loads from other sites, no framing, forms post only to this site), HSTS in production, nosniff, referrer and permissions policies.
- Database connection refuses stacked statements. Every SQL value is a bound parameter.
- Everything sensitive is recorded in the tamper-evident audit trail (audit-trail.md).

## Deployment checklist
1. Set `JWT_SECRET` (long random value), `NEXT_PUBLIC_APP_URL` (used in reset links) and the `MYSQL_*` variables. Never commit `.env*`.
2. Put the app behind a reverse proxy that **overwrites** `X-Forwarded-For` with the real client address. The address is used for rate limiting; if the proxy lets clients supply it, the limits can be bypassed.
3. Serve only over HTTPS.
4. After loading the demo data, change every demo password (the admin dashboard shows a warning while any account still has it) or delete the demo accounts.
5. Run the SQL updates in `databas_setup_querries` in order (18 to 24).
6. Give the application its own MySQL user with rights on this database only, not `root`.
7. Keep dependencies current: `npm audit`, then upgrade and run the tests.

## Known limits
- Scripts and CSP allow inline scripts and styles, because the framework injects them.
- Rate-limit address detection is only as trustworthy as the proxy in front of it (item 2).
