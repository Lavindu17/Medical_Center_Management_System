-- Database Schema for Sethro Medical Center

-- Disable foreign key checks for easier drop/create
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table (Base for all roles)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` ENUM('PATIENT', 'DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN') NOT NULL,
  `phone` VARCHAR(20),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (`email`),
  INDEX idx_role (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Patients Table (Extension of Users)
DROP TABLE IF EXISTS `patients`;
CREATE TABLE `patients` (
  `user_id` INT PRIMARY KEY,
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
  `address` TEXT NOT NULL,
  `medical_history` TEXT,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Doctors Table (Extension of Users)
DROP TABLE IF EXISTS `doctors`;
CREATE TABLE `doctors` (
  `user_id` INT PRIMARY KEY,
  `specialization` VARCHAR(100) NOT NULL,
  `license_number` VARCHAR(50) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Medicines Table (Inventory Master Data)
DROP TABLE IF EXISTS `medicines`;
CREATE TABLE `medicines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `generic_name` VARCHAR(255),
  `manufacturer` VARCHAR(255),
  `category` VARCHAR(100), -- e.g., 'Antibiotic', 'Analgesic'
  `stock` INT NOT NULL DEFAULT 0, -- Aggregate from batches
  `min_stock_level` INT DEFAULT 10, -- Reorder threshold
  `unit` VARCHAR(50) NOT NULL, -- e.g., 'tablets', 'ml', 'bottles'
  `dosage_form` ENUM('TABLET','SYRUP','CAPSULE','INJECTION','CREAM','OTHER'),
  `strength` VARCHAR(50), -- e.g., '500mg', '10ml'
  `price_per_unit` DECIMAL(10, 2) NOT NULL, -- Standard selling price
  `buying_price` DECIMAL(10, 2) DEFAULT 0, -- Latest/average buying cost
  `expiry_date` DATE, -- Earliest expiry from active batches (can be NULL if no stock)
  `location` VARCHAR(100), -- Physical location: 'Shelf A1'
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_generic_name (`generic_name`),
  INDEX idx_category (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Lab Tests Table (Catalog)
DROP TABLE IF EXISTS `lab_tests`;
CREATE TABLE `lab_tests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Appointments Table
DROP TABLE IF EXISTS `appointments`;
CREATE TABLE `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `time_slot` VARCHAR(20) NOT NULL, -- e.g., '09:00', '09:15'
  `queue_number` INT NOT NULL,
  `status` ENUM('PENDING', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'ABSENT') DEFAULT 'PENDING',
  `notes` TEXT, -- Doctor's private notes
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_id`) REFERENCES `users`(`id`), -- Use users(id) but logically enforces patient role
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`), -- Use users(id) but logically enforces doctor role
  INDEX idx_date_doctor (`date`, `doctor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Prescriptions Table
DROP TABLE IF EXISTS `prescriptions`;
CREATE TABLE `prescriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `appointment_id` INT NOT NULL UNIQUE,
  `doctor_id` INT NOT NULL,
  `status` ENUM('PENDING', 'DISPENSED') DEFAULT 'PENDING',
  `issued_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Prescription Items Table (Many-to-Many Medicine-Prescription)
DROP TABLE IF EXISTS `prescription_items`;
CREATE TABLE `prescription_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `prescription_id` INT NOT NULL,
  `medicine_id` INT NOT NULL,
  `dosage` VARCHAR(100) NOT NULL, -- e.g., '500mg'
  `frequency` VARCHAR(100) NOT NULL, -- e.g., '1-0-1 (Morning-Noon-Night)'
  `duration` VARCHAR(50) NOT NULL, -- e.g., '5 days'
  `quantity` INT NOT NULL,
  FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Lab Requests Table
DROP TABLE IF EXISTS `lab_requests`;
CREATE TABLE `lab_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `appointment_id` INT NOT NULL,
  `test_id` INT NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED') DEFAULT 'PENDING',
  `result_url` VARCHAR(512), -- URL to uploaded PDF/Image
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`test_id`) REFERENCES `lab_tests`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Bills Table
DROP TABLE IF EXISTS `bills`;
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

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- 11. Seed Data (Optional - for initial testing)
INSERT INTO `users` (`email`, `password_hash`, `name`, `role`, `phone`) VALUES 
('admin@sethro.com', '$2b$10$YourHashedPasswordHere', 'System Admin', 'ADMIN', '1234567890'),
('doctor@sethro.com', '$2b$10$YourHashedPasswordHere', 'Dr. Smith', 'DOCTOR', '0987654321'),
('patient@sethro.com', '$2b$10$YourHashedPasswordHere', 'John Doe', 'PATIENT', '1122334455');
-- Note: You should replace 'YourHashedPasswordHere' with real bcrypt hashes in production.
