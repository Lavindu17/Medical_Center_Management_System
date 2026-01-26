# Email Auth & Forgot Password Implementation Plan

## Overview
Implement secure email verification and password reset functionality using OTPs (One-Time Passwords). This ensures valid user emails and provides account recovery.

## Project Type
**WEB** (Next.js App Router + MySQL + Nodemailer)

## Success Criteria
- [ ] New users MUST verify email with OTP before logging in.
- [ ] Database stores OTPs and verification status securely.
- [ ] Users can request a password reset OTP via email.
- [ ] Users can set a new password using a valid reset OTP.
- [ ] `nodemailer` successfully sends emails via SMTP.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Database**: MySQL (using `mysql2` + raw queries)
- **Email**: `nodemailer` (SMTP)
- **Validation**: `zod`
- **Crypto**: `bcrypt` (passwords), `crypto` (random OTPs)

## File Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── verify-email/       # [NEW] Verify OTP page
│   │   ├── forgot-password/    # [NEW] Request reset page
│   │   └── reset-password/     # [NEW] Enter new password page
│   └── api/
│       └── auth/
│           ├── verify/         # [NEW] POST: Verify OTP
│           ├── send-code/      # [NEW] POST: Resend OTP (optional but good)
│           ├── forgot/         # [NEW] POST: Request reset OTP
│           └── reset/          # [NEW] POST: Update password
├── services/
│   ├── email.service.ts        # [NEW] Nodemailer wrapper
│   └── auth.service.ts         # [MOD] Add OTP methods
└── lib/
    └── db.ts                   # [REF] Ensure query support
```

## Task Breakdown

### Phase 1: Database & Backend Foundation
- [ ] **Schema Update** <!-- agent: database-architect -->
  - Add columns to `users`: `is_verified` (BOOL), `verification_code` (VARCHAR), `verification_expires` (DATETIME), `reset_code` (VARCHAR), `reset_expires` (DATETIME).
  - INPUT: `01_schema.sql` -> OUTPUT: SQL Migration -> VERIFY: `desc users` shows new columns.

- [ ] **Email Service Setup** <!-- agent: backend-specialist -->
  - Install `nodemailer` and `@types/nodemailer`.
  - Create `src/services/email.service.ts` with `sendEmail` function.
  - INPUT: SMTP Credentials -> OUTPUT: Test Email -> VERIFY: Mail received in inbox/trap.

### Phase 2: Registration & Verification
- [ ] **Update Registration API** <!-- agent: backend-specialist -->
  - Mod `src/app/api/auth/register/route.ts`:
  - Generate 6-digit OTP.
  - Save to `verification_code`.
  - Send email via `EmailService`.
  - INPUT: Register Form -> OUTPUT: 201 Created + Email Sent -> VERIFY: Check DB for OTP, Check Inbox.

- [ ] **Create Verify API** <!-- agent: backend-specialist -->
  - `src/app/api/auth/verify/route.ts`.
  - Validate email + OTP.
  - Check expiry.
  - Update `is_verified = true`, clear OTP.
  - INPUT: JSON { email, otp } -> OUTPUT: 200 OK -> VERIFY: `is_verified` is 1 in DB.

- [ ] **Update Login API** <!-- agent: backend-specialist -->
  - Mod `src/app/api/auth/login/route.ts`.
  - Prevent login if `user.is_verified` is false.
  - INPUT: Valid creds, unverified -> OUTPUT: 403 Forbidden -> VERIFY: Login blocked.

- [ ] **Create Verify Page** <!-- agent: frontend-specialist -->
  - `src/app/(auth)/verify-email/page.tsx`.
  - UI: Input for OTP.
  - Auto-redirect to Login (or Dashboard) on success.
  - INPUT: User enters OTP -> OUTPUT: Success Message -> VERIFY: Flow works.

### Phase 3: Forgot Password
- [ ] **Create Forgot API** <!-- agent: backend-specialist -->
  - `src/app/api/auth/forgot/route.ts`.
  - Check user exists.
  - Generate Reset OTP.
  - Save to `reset_code`.
  - Send email.
  - INPUT: JSON { email } -> OUTPUT: 200 OK -> VERIFY: Check DB for `reset_code`.

- [ ] **Create Reset API** <!-- agent: backend-specialist -->
  - `src/app/api/auth/reset/route.ts`.
  - Validate email + OTP.
  - Hash new password.
  - Update `password_hash`, clear `reset_code`.
  - INPUT: { email, otp, newPassword } -> OUTPUT: 200 OK -> VERIFY: Login with new password works.

- [ ] **Create Forgot Pages** <!-- agent: frontend-specialist -->
  - `src/app/(auth)/forgot-password/page.tsx` (Enter Email).
  - `src/app/(auth)/reset-password/page.tsx` (Enter OTP + New Pass).
  - INPUT: User flow -> OUTPUT: Password changed -> VERIFY: Full E2E test.

## Phase X: Verification
- [ ] **Lint**: `npm run lint` matches zero errors.
- [ ] **Type Check**: `npx tsc --noEmit` matches zero errors.
- [ ] **Manual E2E**:
    1. Register new user -> Check Email -> Verify OTP -> Login.
    2. Register new user -> Try Login (Fail) -> Verify OTP -> Login (Success).
    3. Login -> Logout -> Forgot Password -> Get OTP -> Reset Password -> Login with new pass.
