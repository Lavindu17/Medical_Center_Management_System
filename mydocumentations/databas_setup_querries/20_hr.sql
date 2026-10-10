-- 20_hr.sql
-- HR module: employee profiles, shifts, attendance, leave, holidays and settings.
-- Additive and idempotent (safe to run twice). No DELIMITER blocks, so it runs from any client including mysql2.
-- Needs 18_schema_sync.sql and 19_audit_log.sql to have been applied first.

-- 1. A new role for the HR manager (administrators see the HR portal too)
SET @ddl = (SELECT IF(COLUMN_TYPE LIKE '%HR_MANAGER%', 'SELECT 1',
  'ALTER TABLE `users` MODIFY `role` ENUM(''PATIENT'',''DOCTOR'',''PHARMACIST'',''LAB_ASSISTANT'',''RECEPTIONIST'',''ADMIN'',''HR_MANAGER'') NOT NULL')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Employee master data (one row per staff member, created by HR)
CREATE TABLE IF NOT EXISTS `employee_profiles` (
  `user_id`       INT PRIMARY KEY,
  `employee_no`   VARCHAR(30) NULL,
  `department`    VARCHAR(80) NULL,
  `designation`   VARCHAR(80) NULL,
  `join_date`     DATE NULL,
  `status`        ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_employee_no` (`employee_no`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Shift presets: quick-fill buttons for the roster form (a shift itself is just a date with start and end times)
CREATE TABLE IF NOT EXISTS `shift_templates` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(60) NOT NULL,
  `start_time`  TIME NOT NULL,
  `end_time`    TIME NOT NULL,                      -- earlier than start_time means the shift ends the next day
  `active`      TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_shift_template_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. The roster: any number of shifts per person per day (split shifts are fine; overlaps are refused by the application)
CREATE TABLE IF NOT EXISTS `shift_assignments` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `shift_date`  DATE NOT NULL,
  `start_time`  TIME NOT NULL,
  `end_time`    TIME NOT NULL,
  `label`       VARCHAR(60) NULL,
  `created_by`  INT NULL,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_shift_user_date` (`user_id`, `shift_date`),
  KEY `idx_shift_date` (`shift_date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Clock in and out. Times are UTC and always come from the server.
CREATE TABLE IF NOT EXISTS `attendance_records` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `work_date`   DATE NOT NULL,                      -- the clinic-local day the work belongs to
  `shift_id`    INT NULL,                           -- the shift this punch was matched to, if any
  `clock_in`    DATETIME(3) NOT NULL,
  `clock_out`   DATETIME(3) NULL,
  `source`      ENUM('SELF','CORRECTION','HR') NOT NULL DEFAULT 'SELF',
  `in_ip`       VARCHAR(45) NULL,
  `out_ip`      VARCHAR(45) NULL,
  `note`        VARCHAR(255) NULL,
  `created_by`  INT NULL,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_att_user_date` (`user_id`, `work_date`),
  KEY `idx_att_date` (`work_date`),
  KEY `idx_att_open` (`user_id`, `clock_out`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. "Fix this day" requests (missed clock-out, forgot to clock in)
CREATE TABLE IF NOT EXISTS `attendance_corrections` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`         INT NOT NULL,
  `work_date`       DATE NOT NULL,
  `record_id`       INT NULL,                       -- the punch being corrected, or NULL to add a missing one
  `requested_in`    TIME NOT NULL,                  -- clinic-local times on work_date
  `requested_out`   TIME NULL,                      -- earlier than requested_in means the next day
  `reason`          VARCHAR(500) NOT NULL,
  `status`          ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `decided_by`      INT NULL,
  `decided_at`      TIMESTAMP NULL,
  `decision_note`   VARCHAR(500) NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_corr_user` (`user_id`, `status`),
  KEY `idx_corr_status` (`status`, `created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Leave
CREATE TABLE IF NOT EXISTS `leave_types` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `code`             VARCHAR(20) NOT NULL,
  `name`             VARCHAR(60) NOT NULL,
  `days_per_year`    DECIMAL(5,1) NOT NULL DEFAULT 0,
  `paid`             TINYINT(1) NOT NULL DEFAULT 1,
  `allows_half_day`  TINYINT(1) NOT NULL DEFAULT 1,
  `unlimited`        TINYINT(1) NOT NULL DEFAULT 0,  -- no balance limit (for example unpaid leave)
  `active`           TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order`       INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_leave_type_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `leave_entitlements` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`        INT NOT NULL,
  `leave_type_id`  INT NOT NULL,
  `year`           SMALLINT NOT NULL,
  `days`           DECIMAL(5,1) NOT NULL,           -- overrides the type's default for this person and year
  UNIQUE KEY `uq_entitlement` (`user_id`, `leave_type_id`, `year`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`         INT NOT NULL,
  `leave_type_id`   INT NOT NULL,
  `start_date`      DATE NOT NULL,
  `end_date`        DATE NOT NULL,
  `day_part`        ENUM('FULL','FIRST_HALF','SECOND_HALF') NOT NULL DEFAULT 'FULL',  -- half days apply to a single day
  `days`            DECIMAL(4,1) NOT NULL,
  `reason`          VARCHAR(500) NULL,
  `status`          ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `decided_by`      INT NULL,
  `decided_at`      TIMESTAMP NULL,
  `decision_note`   VARCHAR(500) NULL,
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_leave_user` (`user_id`, `start_date`),
  KEY `idx_leave_status` (`status`, `start_date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `public_holidays` (
  `holiday_date`  DATE PRIMARY KEY,
  `name`          VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_settings` (
  `setting_key`    VARCHAR(50) PRIMARY KEY,
  `setting_value`  VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Doctor leave that came from an approved HR leave request can be undone with it
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `doctor_leaves` ADD COLUMN `leave_request_id` INT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'doctor_leaves' AND COLUMN_NAME = 'leave_request_id');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. Defaults. All editable in the HR portal. The leave numbers are PLACEHOLDERS to confirm against the Shop and
--    Office Employees Act (or the applicable Wages Board order); sources disagree on some of them.
INSERT IGNORE INTO `hr_settings` (`setting_key`, `setting_value`) VALUES
  ('timezone', 'Asia/Colombo'),
  ('grace_minutes', '10'),
  ('early_window_minutes', '180'),
  ('missing_clock_out_hours', '16');

INSERT IGNORE INTO `leave_types` (`code`, `name`, `days_per_year`, `paid`, `allows_half_day`, `unlimited`, `sort_order`) VALUES
  ('ANNUAL', 'Annual leave', 14, 1, 1, 0, 1),
  ('CASUAL', 'Casual leave', 7, 1, 1, 0, 2),
  ('UNPAID', 'Unpaid leave', 0, 0, 1, 1, 3);

INSERT IGNORE INTO `shift_templates` (`name`, `start_time`, `end_time`) VALUES
  ('Day', '08:00:00', '17:00:00'),
  ('Morning', '08:00:00', '13:00:00'),
  ('Evening', '13:00:00', '18:00:00'),
  ('Night', '19:00:00', '07:00:00');
