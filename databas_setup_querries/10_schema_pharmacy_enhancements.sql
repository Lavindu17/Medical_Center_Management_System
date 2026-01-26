
-- 10_schema_pharmacy_enhancements.sql
-- Pharmacy Module Enhancements: Add dosage form, strength, and optimize queries

-- Add new columns to medicines table
ALTER TABLE `medicines`
ADD COLUMN `dosage_form` ENUM('TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'CREAM', 'OTHER') DEFAULT NULL AFTER `unit`,
ADD COLUMN `strength` VARCHAR(50) DEFAULT NULL AFTER `dosage_form`,
ADD COLUMN `reorder_level` INT DEFAULT 10 AFTER `min_stock_level`;

-- Note: reorder_level added as alias/replacement for min_stock_level if needed
-- If min_stock_level already exists and serves same purpose, this is redundant

-- Add indexes for better query performance
CREATE INDEX `idx_inventory_batches_expiry` ON `inventory_batches`(`expiry_date`);
CREATE INDEX `idx_inventory_batches_status` ON `inventory_batches`(`status`);
CREATE INDEX `idx_inventory_batches_medicine_status` ON `inventory_batches`(`medicine_id`, `status`, `expiry_date`);

-- Update existing batches status for expired items (one-time cleanup)
UPDATE `inventory_batches`
SET `status` = 'EXPIRED'
WHERE `expiry_date` < CURDATE() 
  AND `status` = 'ACTIVE'
  AND `quantity_current` > 0;

-- Optional: Create event to auto-update expired batches daily
-- Note: This requires MySQL event scheduler to be enabled
-- To enable: SET GLOBAL event_scheduler = ON;

DELIMITER $$

CREATE EVENT IF NOT EXISTS `check_batch_expiry_daily`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_DATE + INTERVAL 1 DAY
DO
BEGIN
    -- Mark batches as expired if expiry date has passed
    UPDATE `inventory_batches`
    SET `status` = 'EXPIRED'
    WHERE `expiry_date` < CURDATE() 
      AND `status` = 'ACTIVE'
      AND `quantity_current` > 0;
END$$

DELIMITER ;

-- Verify the changes
-- SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'medicines' AND TABLE_SCHEMA = DATABASE();
