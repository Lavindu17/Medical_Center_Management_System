-- 19_audit_log.sql
-- Audit trail: who did what to which record, when, from where, and with what outcome.
-- Additive and idempotent (safe to run twice), no DELIMITER blocks, runs from any client including mysql2.
--
-- Design (follows common EHR audit guidance, e.g. HIPAA 45 CFR 164.312(b) "audit controls"):
--   * append-only: triggers refuse UPDATE and DELETE, so the application account cannot rewrite history
--   * tamper-evident: every row stores the hash of the previous row (prev_hash UNIQUE, so the chain cannot fork)
--     and its own hash; /api/admin/audit/verify recomputes the chain and reports the first break
--   * no foreign keys: an audit row must outlive the user or patient it describes; names are snapshotted
--   * no PHI values: `details` holds ids, field names and counts, never notes, results or passwords
--   * retention: rows are never purged by the application. Keep at least six years (the HIPAA documentation
--     period) unless local law says otherwise; archive by exporting, not by deleting.

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`             BIGINT AUTO_INCREMENT PRIMARY KEY,
  `occurred_at`    DATETIME(3) NOT NULL,                       -- UTC, set by the application
  `actor_id`       INT NULL,                                   -- the human who acted (NULL: not signed in)
  `actor_role`     VARCHAR(20) NULL,
  `actor_name`     VARCHAR(255) NULL,                          -- snapshot, survives user deletion
  `on_behalf_of_id` INT NULL,                                  -- the account acted as, when a family member switched accounts
  `action`         VARCHAR(30) NOT NULL,                       -- VIEW, CREATE, UPDATE, DELETE, LOGIN, ...
  `entity_type`    VARCHAR(40) NULL,                           -- PATIENT_CHART, CONSULTATION, BILL, USER, ...
  `entity_id`      VARCHAR(64) NULL,
  `patient_id`     INT NULL,                                   -- whose record was touched, for patient access history
  `outcome`        ENUM('SUCCESS','DENIED','FAILURE') NOT NULL DEFAULT 'SUCCESS',
  `ip`             VARCHAR(45) NULL,
  `user_agent`     VARCHAR(255) NULL,
  `details`        TEXT NULL,                                  -- JSON text, kept verbatim so the hash can be recomputed
  `prev_hash`      CHAR(64) NOT NULL,
  `hash`           CHAR(64) NOT NULL,
  UNIQUE KEY `uq_audit_prev_hash` (`prev_hash`),
  KEY `idx_audit_time` (`occurred_at`),
  KEY `idx_audit_actor` (`actor_id`, `occurred_at`),
  KEY `idx_audit_patient` (`patient_id`, `occurred_at`),
  KEY `idx_audit_action` (`action`, `occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only: refuse edits and deletes. MySQL cannot PREPARE a CREATE TRIGGER, so this is the plain
-- drop-and-recreate form (it only ever touches these two triggers, never a table or any data).
DROP TRIGGER IF EXISTS `audit_log_no_update`;
CREATE TRIGGER `audit_log_no_update` BEFORE UPDATE ON `audit_log` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';

DROP TRIGGER IF EXISTS `audit_log_no_delete`;
CREATE TRIGGER `audit_log_no_delete` BEFORE DELETE ON `audit_log` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
