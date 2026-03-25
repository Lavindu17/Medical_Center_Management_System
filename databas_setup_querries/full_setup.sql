-- ============================================================
-- FULL DATABASE SETUP: Sethro Medical Center
-- Consolidated from all migration files (01-17)
-- Run this to recreate the entire database from scratch
-- ============================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS `sethro_medical`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sethro_medical`;

-- Disable FK checks for clean drop/create
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. USERS TABLE (Base for all roles)
-- ============================================================
DROP TABLE IF EXISTS `auth_codes`;
DROP TABLE IF EXISTS `patient_family_links`;
DROP TABLE IF EXISTS `family_links`;
DROP TABLE IF EXISTS `patient_allergies`;
DROP TABLE IF EXISTS `doctor_schedules`;
DROP TABLE IF EXISTS `doctor_leaves`;
DROP TABLE IF EXISTS `bills`;
DROP TABLE IF EXISTS `lab_requests`;
DROP TABLE IF EXISTS `prescription_items`;
DROP TABLE IF EXISTS `prescriptions`;
DROP TABLE IF EXISTS `appointments`;
DROP TABLE IF EXISTS `inventory_batches`;
DROP TABLE IF EXISTS `lab_tests`;
DROP TABLE IF EXISTS `medicines`;
DROP TABLE IF EXISTS `doctors`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('PATIENT', 'DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN') NOT NULL,
  `phone` VARCHAR(20),
  `is_verified` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (`email`),
  INDEX idx_role (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. PATIENTS TABLE (Extension of Users)
-- ============================================================
CREATE TABLE `patients` (
  `user_id` INT PRIMARY KEY,
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
  `address` TEXT NOT NULL,
  `medical_history` TEXT,
  `blood_group` VARCHAR(10) NULL DEFAULT NULL,
  `emergency_contact_name` VARCHAR(100) NULL DEFAULT NULL,
  `emergency_contact_phone` VARCHAR(20) NULL DEFAULT NULL,
  `allergies` TEXT NULL DEFAULT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. DOCTORS TABLE (Extension of Users)
-- ============================================================
CREATE TABLE `doctors` (
  `user_id` INT PRIMARY KEY,
  `specialization` VARCHAR(100) NOT NULL,
  `license_number` VARCHAR(50) NOT NULL,
  `consultation_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `commission_rate` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  `start_time` TIME DEFAULT '09:00:00',
  `end_time` TIME DEFAULT '17:00:00',
  `slot_duration` INT DEFAULT 15 COMMENT 'Minutes per slot',
  `working_days` JSON DEFAULT NULL COMMENT 'Array of days e.g. ["Monday", "Tuesday"]',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. MEDICINES TABLE (Inventory Master Data)
-- ============================================================
CREATE TABLE `medicines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `generic_name` VARCHAR(255),
  `manufacturer` VARCHAR(255),
  `category` VARCHAR(100),
  `stock` INT NOT NULL DEFAULT 0,
  `min_stock_level` INT DEFAULT 10,
  `reorder_level` INT DEFAULT 10,
  `unit` VARCHAR(50) NOT NULL,
  `dosage_form` ENUM('TABLET','SYRUP','CAPSULE','INJECTION','CREAM','OTHER'),
  `strength` VARCHAR(50),
  `price_per_unit` DECIMAL(10, 2) NOT NULL,
  `buying_price` DECIMAL(10, 2) DEFAULT 0,
  `expiry_date` DATE,
  `location` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_generic_name (`generic_name`),
  INDEX idx_category (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. INVENTORY BATCHES TABLE
-- ============================================================
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
  FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE CASCADE,
  INDEX `idx_inventory_batches_expiry` (`expiry_date`),
  INDEX `idx_inventory_batches_status` (`status`),
  INDEX `idx_inventory_batches_medicine_status` (`medicine_id`, `status`, `expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. LAB TESTS TABLE (Catalog)
-- ============================================================
CREATE TABLE `lab_tests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. APPOINTMENTS TABLE
-- ============================================================
CREATE TABLE `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `time_slot` VARCHAR(20) NOT NULL,
  `queue_number` INT NOT NULL,
  `status` ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ABSENT', 'NO_SHOW') NOT NULL DEFAULT 'PENDING',
  `reason` TEXT,
  `notes` TEXT,
  `weight` DECIMAL(5,2) DEFAULT NULL COMMENT 'Weight in Kg',
  `blood_pressure` VARCHAR(20) DEFAULT NULL COMMENT 'e.g. 120/80',
  `temperature` DECIMAL(4,1) DEFAULT NULL COMMENT 'Celsius',
  `pulse` INT DEFAULT NULL COMMENT 'Beats per minute',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`),
  INDEX idx_date_doctor (`date`, `doctor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. PRESCRIPTIONS TABLE
-- ============================================================
CREATE TABLE `prescriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `appointment_id` INT NOT NULL UNIQUE,
  `doctor_id` INT NOT NULL,
  `status` ENUM('PENDING', 'DISPENSED') DEFAULT 'PENDING',
  `issued_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. PRESCRIPTION ITEMS TABLE
-- ============================================================
CREATE TABLE `prescription_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `prescription_id` INT NOT NULL,
  `medicine_id` INT NOT NULL,
  `dosage` VARCHAR(100) NOT NULL,
  `frequency` VARCHAR(100) NOT NULL,
  `duration` VARCHAR(50) NOT NULL,
  `quantity` INT NOT NULL,
  FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. LAB REQUESTS TABLE
-- ============================================================
CREATE TABLE `lab_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `appointment_id` INT NOT NULL,
  `test_id` INT NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED') DEFAULT 'PENDING',
  `result_url` VARCHAR(512),
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`test_id`) REFERENCES `lab_tests`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. BILLS TABLE
-- ============================================================
CREATE TABLE `bills` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `appointment_id` INT NOT NULL UNIQUE,
  `doctor_fee` DECIMAL(10, 2) NOT NULL,
  `service_charge` DECIMAL(10, 2) NOT NULL,
  `pharmacy_total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `lab_total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('PENDING', 'PAID') DEFAULT 'PENDING',
  `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `paid_at` TIMESTAMP NULL,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. DOCTOR LEAVES TABLE
-- ============================================================
CREATE TABLE `doctor_leaves` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `doctor_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `reason` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_leave` (`doctor_id`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. DOCTOR SCHEDULES TABLE (Multi-schedule)
-- ============================================================
CREATE TABLE `doctor_schedules` (
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

-- ============================================================
-- 14. AUTH CODES TABLE (Email verification / Password reset)
-- ============================================================
CREATE TABLE `auth_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `type` ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
  `code_hash` VARCHAR(256) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_type` (`user_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. PATIENT ALLERGIES TABLE
-- ============================================================
CREATE TABLE `patient_allergies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `allergy_name` VARCHAR(255) NOT NULL,
  `severity` ENUM('MILD', 'MODERATE', 'SEVERE') DEFAULT 'MILD',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. PATIENT FAMILY LINKS TABLE
-- ============================================================
CREATE TABLE `patient_family_links` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `requester_id` INT NOT NULL,
  `member_id` INT NOT NULL,
  `relationship` ENUM('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER') NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_family_link` (`requester_id`, `member_id`),
  CONSTRAINT `chk_no_self_link` CHECK (`requester_id` <> `member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. FAMILY LINKS TABLE (Receptionist-verified)
-- ============================================================
CREATE TABLE `family_links` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `primary_patient_id` INT NOT NULL,
  `linked_patient_id` INT NOT NULL,
  `relationship` ENUM('PARENT', 'CHILD', 'SPOUSE', 'OTHER') NOT NULL,
  `verified_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`primary_patient_id`) REFERENCES `patients`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`linked_patient_id`) REFERENCES `patients`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `unique_link` (`primary_patient_id`, `linked_patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED DATA
-- ============================================================
-- Password for all test accounts: password123
-- (These are placeholder hashes - you'll need real bcrypt hashes)
-- To generate: node -e "require('bcrypt').hash('password123',10).then(h=>console.log(h))"

INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `role`, `phone`, `is_verified`) VALUES
(1, 'admin@sethro.com',          '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'System Admin',   'ADMIN',         '0712345678', TRUE),
(2, 'doc.smith@sethro.com',      '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Dr. John Smith', 'DOCTOR',        '0771234567', TRUE),
(3, 'doc.doe@sethro.com',        '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Dr. Jane Doe',   'DOCTOR',        '0777654321', TRUE),
(4, 'patient.alice@gmail.com',   '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Alice Cooper',   'PATIENT',       '0761112233', TRUE),
(5, 'patient.bob@gmail.com',     '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Bob Builder',    'PATIENT',       '0763334455', TRUE),
(6, 'pharm.sarah@sethro.com',    '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Sarah Conners',  'PHARMACIST',    '0719988776', TRUE),
(7, 'lab.mike@sethro.com',       '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Mike Ross',      'LAB_ASSISTANT', '0715566778', TRUE),
(8, 'recep.lisa@sethro.com',     '$2b$10$xQtcNhKLC5JMmuvx0ail/uJDuUGU5UBKr5wMho7B/CCrGeN5ZVKU2', 'Lisa Kudrow',    'RECEPTIONIST',  '0721122334', TRUE);

-- Doctor Profiles
INSERT INTO `doctors` (`user_id`, `specialization`, `license_number`, `consultation_fee`, `commission_rate`) VALUES
(2, 'Cardiologist', 'SLMC-1001', 2500.00, 100.00),
(3, 'Pediatrician', 'SLMC-1002', 2000.00, 100.00);

-- Patient Profiles
INSERT INTO `patients` (`user_id`, `date_of_birth`, `gender`, `address`, `medical_history`) VALUES
(4, '1990-05-15', 'FEMALE', '123 Lotus Rd, Colombo', 'Asthma'),
(5, '1985-08-20', 'MALE', '45 Galle Rd, Matara', 'None');

-- Medicines
INSERT INTO `medicines` (`name`, `stock`, `unit`, `price_per_unit`, `expiry_date`) VALUES
('Paracetamol 500mg',  1000, 'tablets',  5.00,   '2027-12-31'),
('Amoxicillin 250mg',  500,  'capsules', 15.00,  '2026-06-30'),
('Cetirizine 10mg',    750,  'tablets',  8.00,   '2027-01-01'),
('Vitamin C 500mg',    200,  'tablets',  12.00,  '2026-12-31'),
('Cough Syrup 100ml',  100,  'bottles',  350.00, '2026-09-15');

-- Lab Tests
INSERT INTO `lab_tests` (`name`, `description`, `price`) VALUES
('Full Blood Count (FBC)',      'Complete blood count analysis',      850.00),
('Fasting Blood Sugar (FBS)',   'Glucose level test',                 400.00),
('Lipid Profile',               'Cholesterol and triglycerides check', 1500.00),
('Urine Full Report',           'Basic urine analysis',               500.00);

SELECT '✅ Database setup complete! All tables created and seed data inserted.' AS Status;
