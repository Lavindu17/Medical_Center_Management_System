
-- 10_schema_receptionist.sql

-- 1. Ensure bills table has payment tracking columns
-- Checking if columns exist or modifying them (status enum updates)
-- ALTER TABLE `bills`
-- ADD COLUMN `payment_method` ENUM('CASH', 'CARD', 'INSURANCE') NULL AFTER `status`,
-- ADD COLUMN `transaction_id` VARCHAR(100) NULL AFTER `payment_method`,
-- MODIFY COLUMN `status` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- 2. Create Family Links Table (if not exists)
CREATE TABLE IF NOT EXISTS `family_links` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `primary_patient_id` INT NOT NULL,
    `linked_patient_id` INT NOT NULL,
    `relationship` ENUM('PARENT', 'CHILD', 'SPOUSE', 'OTHER') NOT NULL,
    `verified_by` INT NULL, -- Receptionist User ID who verified
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`primary_patient_id`) REFERENCES `patients`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`linked_patient_id`) REFERENCES `patients`(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_link` (`primary_patient_id`, `linked_patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Update Appointments for Check-in status
-- Adding 'ARRIVED' status if not present (assuming ENUM needs update)
-- Merging old and new values to prevent data truncation
ALTER TABLE `appointments`
MODIFY COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'ABSENT', 'NO_SHOW') NOT NULL DEFAULT 'PENDING';
