-- ============================================================
-- 21_orders.sql : faster, safer ordering on the consultation screen
--
--   * prescription lines: free-text instructions, food timing, "only when needed"
--   * lab requests: priority (routine / urgent) and a clinical note for the lab
--   * doctor favourites: a medicine with the doctor's usual dose, frequency and duration
--   * lab panels: a doctor's saved sets of tests ("Fever workup")
--
-- Safe to run more than once. It only adds: no table or column is dropped or changed.
-- The application keeps working without it (the new fields are simply not offered), so it can be applied at any time.
-- ============================================================

-- 1. Prescription lines
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `instructions` VARCHAR(255) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'instructions');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `food_timing` ENUM(''BEFORE'',''AFTER'',''WITH'') NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'food_timing');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `as_needed` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'as_needed');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Lab requests
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `lab_requests` ADD COLUMN `priority` ENUM(''ROUTINE'',''URGENT'') NOT NULL DEFAULT ''ROUTINE''', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests' AND COLUMN_NAME = 'priority');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `lab_requests` ADD COLUMN `clinical_note` VARCHAR(255) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests' AND COLUMN_NAME = 'clinical_note');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. A doctor's favourite medicines, with their usual line
CREATE TABLE IF NOT EXISTS `doctor_favourites` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `doctor_id`     INT NOT NULL,
  `medicine_id`   INT NOT NULL,
  `dosage`        VARCHAR(50)  NOT NULL,
  `frequency`     VARCHAR(50)  NOT NULL,
  `duration`      VARCHAR(50)  NOT NULL,
  `instructions`  VARCHAR(255) NULL,
  `food_timing`   ENUM('BEFORE','AFTER','WITH') NULL,
  `as_needed`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_fav_doctor_medicine` (`doctor_id`, `medicine_id`),
  FOREIGN KEY (`doctor_id`)   REFERENCES `users`(`id`)     ON DELETE CASCADE,
  FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. A doctor's saved sets of lab tests
CREATE TABLE IF NOT EXISTS `lab_panels` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `doctor_id`   INT NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_panel_doctor_name` (`doctor_id`, `name`),
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lab_panel_tests` (
  `panel_id`  INT NOT NULL,
  `test_id`   INT NOT NULL,
  PRIMARY KEY (`panel_id`, `test_id`),
  FOREIGN KEY (`panel_id`) REFERENCES `lab_panels`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`test_id`)  REFERENCES `lab_tests`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
