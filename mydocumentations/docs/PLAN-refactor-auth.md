# Authentication Refactor Plan (Normalized Schema)

## Goal
Improve database normalization and security by moving OTPs and short-lived tokens out of the main `users` table into a dedicated `auth_codes` table.

## Architecture Change

### Current Schema (Anti-Pattern)
`users` table contains:
- `verification_code`
- `verification_expires`
- `reset_code`
- `reset_expires`

### New Schema (Normalized)
**Table: `auth_codes`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | Auto Increment |
| `user_id` | INT FK | References `users(id)` |
| `type` | ENUM | 'EMAIL_VERIFICATION', 'PASSWORD_RESET' |
| `code_hash` | VARCHAR(256) | SHA-256 Hash of the OTP |
| `expires_at` | DATETIME | Expiration timestamp |
| `created_at` | TIMESTAMP | Audit trail |

## Task Breakdown

### Phase 1: Database Migration
- [ ] **Create Table**: Create `auth_codes` table. <!-- agent: database-architect -->
- [ ] **Clean Users**: Drop legacy OTP columns from `users`. <!-- agent: database-architect -->
- [ ] **Script**: Create migration script `scripts/migrate_auth_refactor.js`.

### Phase 2: Service Refactor
- [ ] **Update AuthService**:
    - `initiateEmailVerification`: Insert into `auth_codes` instead of `users`.
    - `verifyEmail`: Query `auth_codes` by `user_id` + `type`.
    - `initiatePasswordReset`: Insert into `auth_codes`.
    - `resetPassword`: Validate against `auth_codes`.
    - **Cleanup**: Delete used/expired codes after success.

### Phase 3: Verification
- [ ] **Test**: Register new user (Verification flow).
- [ ] **Test**: Forgot Password flow.
- [ ] **Verify**: Check DB ensures `auth_codes` is populated and cleaned up.
