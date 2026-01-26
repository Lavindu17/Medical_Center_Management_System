-- 14_schema_doctor_multi_schedule.sql

-- Create table for flexible doctor schedules
CREATE TABLE IF NOT EXISTS `doctor_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `doctor_id` INT NOT NULL,
  `day` ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_doctor_day` (`doctor_id`, `day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Data migration from old columns (working_days, start_time, end_time) 
-- will be handled by a separate script or lazily if needed. 
-- For now, we keep the old columns in `doctors` for safety but will rely on `doctor_schedules`.
