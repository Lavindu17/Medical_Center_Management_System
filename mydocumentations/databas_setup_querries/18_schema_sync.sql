-- 18_schema_sync.sql
-- Brings a database built from full_setup.sql (01..17) in line with what the code expects.
-- These columns previously existed only in the root scratch_db_*.js scripts.
-- Idempotent and free of DELIMITER blocks, so it runs from any client (including mysql2).

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `dispensed_quantity` INT NOT NULL DEFAULT 0', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'dispensed_quantity');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `rejection_reason` VARCHAR(50) NULL DEFAULT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'rejection_reason');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `status` ENUM(''PENDING'',''PARTIALLY_COMPLETED'',''DISPENSED'',''REJECTED'') NOT NULL DEFAULT ''PENDING''', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'status');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `bills` ADD COLUMN `payment_method` ENUM(''CASH'',''CARD'',''INSURANCE'') NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'payment_method');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `bills` ADD COLUMN `paid_by` INT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'paid_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `lab_tests` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'cost_price');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- What was actually charged for the dispensed part of an item (sum of batch price x quantity).
-- The bill's pharmacy_total is derived from this, so it cannot drift or be lost.
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `prescription_items` ADD COLUMN `dispensed_amount` DECIMAL(10,2) NOT NULL DEFAULT 0', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items' AND COLUMN_NAME = 'dispensed_amount');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill items dispensed before this column existed (estimate at the medicine's list price).
UPDATE prescription_items pi JOIN medicines m ON m.id = pi.medicine_id
   SET pi.dispensed_amount = pi.dispensed_quantity * m.price_per_unit
 WHERE pi.dispensed_amount = 0 AND pi.dispensed_quantity > 0;

-- Lab reports are stored privately and served through /api/lab-reports/:id
SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `lab_requests` ADD COLUMN `result_file` VARCHAR(100) NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests' AND COLUMN_NAME = 'result_file');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `lab_requests` ADD COLUMN `uploaded_by` INT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests' AND COLUMN_NAME = 'uploaded_by');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Status values the pharmacist flow writes
ALTER TABLE prescription_items
    MODIFY COLUMN status ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','REJECTED') NOT NULL DEFAULT 'PENDING';
ALTER TABLE prescriptions
    MODIFY COLUMN status ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING';
