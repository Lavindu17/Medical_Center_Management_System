-- Run this script in MySQL Workbench or via command line
USE sethro_medical;

-- Add the missing 'category' column which is causing the 500 Error
ALTER TABLE `medicines`
ADD COLUMN `category` VARCHAR(100) DEFAULT NULL AFTER `manufacturer`;

-- Ensure 'dosage_form' and 'strength' exist (in case previous migration failed)
-- If these fail with "Duplicate column", that's fine - just means they already exist.
-- Run them one by one if errors occur.

ALTER TABLE `medicines`
ADD COLUMN `dosage_form` ENUM('TABLET', 'SYRUP', 'CAPSULE', 'INJECTION', 'CREAM', 'OTHER') DEFAULT NULL AFTER `unit`;

ALTER TABLE `medicines`
ADD COLUMN `strength` VARCHAR(50) DEFAULT NULL AFTER `dosage_form`;

-- Show the final structure to verify
SELECT 'Migration Complete' as Status;
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'medicines' AND TABLE_SCHEMA = 'sethro_medical'
ORDER BY ORDINAL_POSITION;
