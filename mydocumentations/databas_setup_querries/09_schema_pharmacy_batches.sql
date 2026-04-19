
-- 09_schema_pharmacy_batches.sql

-- 1. Create Batches Table
DROP TABLE IF EXISTS `inventory_batches`;
CREATE TABLE `inventory_batches` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `medicine_id` INT NOT NULL,
    `batch_number` VARCHAR(100) NOT NULL,
    `expiry_date` DATE NOT NULL,
    `quantity_initial` INT NOT NULL DEFAULT 0,
    `quantity_current` INT NOT NULL DEFAULT 0,
    `buying_price` DECIMAL(10, 2) NOT NULL,
    `selling_price` DECIMAL(10, 2) NOT NULL,
    `received_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('ACTIVE', 'EXPIRED', 'DEPLETED') DEFAULT 'ACTIVE',
    FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Migrate Existing Data (Create default batches for current stock)
-- We use the existing 'stock', 'expiry_date', 'buying_price', 'selling_price' from medicines table
INSERT INTO `inventory_batches` (medicine_id, batch_number, expiry_date, quantity_initial, quantity_current, buying_price, selling_price, status)
SELECT 
    id, 
    CONCAT('INIT-', DATE_FORMAT(NOW(), '%Y%m%d')), -- Generate a dummy batch number
    expiry_date, 
    stock, 
    stock, 
    buying_price, 
    price_per_unit,
    'ACTIVE'
FROM `medicines`
WHERE stock > 0;

-- 3. Update Medicines Table (Remove stock/price columns as they are now in batches? or keep as aggregates?)
-- The prompt implies strict separation. However, for performance, keeping 'total_stock' might be useful, 
-- but let's stick to the prompt's "Medicine Registry" vs "Inventory Batches" strict split for clarity.
-- We will Make 'stock', 'expiry_date', 'buying_price', 'selling_price' nullable or deprecated in standard queries.
-- But for safety, we won't DROP them yet, just stop using them for calculations.
-- Actually, let's keep 'total_stock' updated via triggers or application logic for easy dashboard views.
