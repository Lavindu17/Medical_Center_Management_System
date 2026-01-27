-- 16_schema_patient_allergies.sql

CREATE TABLE IF NOT EXISTS `patient_allergies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `allergy_name` VARCHAR(255) NOT NULL,
  `severity` ENUM('MILD', 'MODERATE', 'SEVERE') DEFAULT 'MILD',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
