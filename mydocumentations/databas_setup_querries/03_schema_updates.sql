-- Update Doctors table to include financial details
ALTER TABLE `doctors`
ADD COLUMN `consultation_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN `commission_rate` DECIMAL(5, 2) NOT NULL DEFAULT 100.00; -- Percentage (e.g., 100% means doctor keeps all, 0% means hospital keeps all)

-- Update Medicines table to include buying price for profit calculation
ALTER TABLE `medicines`
ADD COLUMN `buying_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER `stock`;
