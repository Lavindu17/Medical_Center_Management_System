-- 18_schema_sync.sql
-- Brings a database built from full_setup.sql + 01..17 in line with what the code expects.
-- These columns previously existed only in the root scratch_db_*.js scripts.
-- Idempotent: safe to run more than once.

DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE add_column_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN definition TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL add_column_if_missing('prescription_items', 'dispensed_quantity', 'INT NOT NULL DEFAULT 0');
CALL add_column_if_missing('prescription_items', 'rejection_reason', 'VARCHAR(50) NULL DEFAULT NULL');
CALL add_column_if_missing('prescription_items', 'status', "ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','REJECTED') NOT NULL DEFAULT 'PENDING'");
CALL add_column_if_missing('bills', 'payment_method', "ENUM('CASH','CARD','INSURANCE') NULL");
CALL add_column_if_missing('bills', 'paid_by', 'INT NULL');
CALL add_column_if_missing('lab_tests', 'cost_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0');

DROP PROCEDURE add_column_if_missing;

-- Status values the pharmacist flow writes
ALTER TABLE prescription_items
    MODIFY COLUMN status ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','REJECTED') NOT NULL DEFAULT 'PENDING';
ALTER TABLE prescriptions
    MODIFY COLUMN status ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING';
