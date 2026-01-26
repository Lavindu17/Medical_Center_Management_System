
-- 08_schema_pharmacy_v2.sql

ALTER TABLE `medicines`
ADD COLUMN `generic_name` VARCHAR(255) AFTER `name`,
ADD COLUMN `manufacturer` VARCHAR(255) AFTER `generic_name`,
ADD COLUMN `min_stock_level` INT DEFAULT 10 AFTER `stock`,
ADD COLUMN `location` VARCHAR(100) AFTER `expiry_date`;
