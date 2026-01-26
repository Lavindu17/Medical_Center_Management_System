-- Run this script in your MySQL Workbench or command line
USE sethro_medical;

-- Add new columns to medicines table
-- These are the only two new columns needed for the pharmacy enhancement

ALTER TABLE `medicines`
ADD COLUMN `dosage_form` ENUM('TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'CREAM', 'OTHER') DEFAULT NULL AFTER `unit`;

ALTER TABLE `medicines`
ADD COLUMN `strength` VARCHAR(50) DEFAULT NULL AFTER `dosage_form`;

-- Add indexes for better query performance
-- Note: If you get "Duplicate key name" error, the index already exists - just continue

CREATE INDEX `idx_inventory_batches_expiry` ON `inventory_batches`(`expiry_date`);
CREATE INDEX `idx_inventory_batches_status` ON `inventory_batches`(`status`);
CREATE INDEX `idx_inventory_batches_medicine_status` ON `inventory_batches`(`medicine_id`, `status`, `expiry_date`);

-- Update existing batches status for expired items
UPDATE `inventory_batches`
SET `status` = 'EXPIRED'
WHERE `expiry_date` < CURDATE() 
  AND `status` = 'ACTIVE'
  AND `quantity_current` > 0;

-- Show results
SELECT 'Migration completed successfully!' as Status;
