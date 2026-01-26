-- Pharmacist Module Enhancement: Add missing columns to medicines table
-- This script adds columns for better medicine master data management

-- Add new columns to medicines table (only if they don't exist)
-- We do this by checking information_schema first

-- Add generic_name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'generic_name');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN generic_name VARCHAR(255) AFTER name', 
    'SELECT "Column generic_name already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add manufacturer
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'manufacturer');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN manufacturer VARCHAR(255) AFTER generic_name', 
    'SELECT "Column manufacturer already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add category
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'category');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN category VARCHAR(100) AFTER manufacturer', 
    'SELECT "Column category already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add dosage_form
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'dosage_form');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN dosage_form ENUM(''TABLET'',''SYRUP'',''CAPSULE'',''INJECTION'',''CREAM'',''OTHER'') AFTER unit', 
    'SELECT "Column dosage_form already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add strength
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'strength');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN strength VARCHAR(50) AFTER dosage_form', 
    'SELECT "Column strength already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add location
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'location');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN location VARCHAR(100) AFTER expiry_date', 
    'SELECT "Column location already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add buying_price
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'buying_price');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN buying_price DECIMAL(10,2) DEFAULT 0 AFTER price_per_unit', 
    'SELECT "Column buying_price already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add min_stock_level if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'min_stock_level');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE medicines ADD COLUMN min_stock_level INT DEFAULT 10 AFTER stock', 
    'SELECT "Column min_stock_level already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Optional: Set min_stock_level default if NULL
UPDATE medicines SET min_stock_level = 10 WHERE id > 0 AND (min_stock_level IS NULL OR min_stock_level = 0);

-- Add index for generic name searches (for finding substitutes)
-- Drop if exists first to avoid duplicate key errors
DROP INDEX IF EXISTS idx_generic_name ON medicines;
CREATE INDEX idx_generic_name ON medicines(generic_name);

-- Add index for category filtering
DROP INDEX IF EXISTS idx_category ON medicines;
CREATE INDEX idx_category ON medicines(category);

-- Add index for expiry date on batches (improves FEFO query performance)
DROP INDEX IF EXISTS idx_expiry_date ON inventory_batches;
CREATE INDEX idx_expiry_date ON inventory_batches(expiry_date);

-- Add index for medicine_id + status on batches (improves stock calculations)
DROP INDEX IF EXISTS idx_medicine_status ON inventory_batches;
CREATE INDEX idx_medicine_status ON inventory_batches(medicine_id, status);

-- Display summary
SELECT 
    'Enhancement Complete' as status,
    COUNT(*) as total_medicines,
    COUNT(generic_name) as medicines_with_generic_name,
    COUNT(manufacturer) as medicines_with_manufacturer
FROM medicines;
