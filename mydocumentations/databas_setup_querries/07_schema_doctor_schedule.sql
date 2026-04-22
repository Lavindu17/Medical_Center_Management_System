-- Add Schedule columns to doctors table
ALTER TABLE `doctors`
ADD COLUMN `start_time` TIME DEFAULT '09:00:00',
ADD COLUMN `end_time` TIME DEFAULT '17:00:00',
ADD COLUMN `slot_duration` INT DEFAULT 15 COMMENT 'Minutes per slot',
ADD COLUMN `working_days` JSON DEFAULT NULL COMMENT 'Array of days e.g. ["Monday", "Tuesday"]';

-- Create table for blocked dates (Leaves)
CREATE TABLE `doctor_leaves` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `doctor_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `reason` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_leave` (`doctor_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
