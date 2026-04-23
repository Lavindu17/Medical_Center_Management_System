-- Seed Data for Sethro Medical Center
-- Usage: Run this AFTER 01_schema.sql

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert Test Users
-- Passwords are 'password123' hashed with bcrypt cost 10
INSERT INTO `users` (`id`, `email`, `password_hash`, `name`, `role`, `phone`) VALUES 
(1, 'admin@sethro.com', '$2b$10$YourHashedPasswordHere', 'System Admin', 'ADMIN', '0712345678'),
(2, 'doc.smith@sethro.com', '$2b$10$YourHashedPasswordHere', 'Dr. John Smith', 'DOCTOR', '0771234567'),
(3, 'doc.doe@sethro.com', '$2b$10$YourHashedPasswordHere', 'Dr. Jane Doe', 'DOCTOR', '0777654321'),
(4, 'patient.alice@gmail.com', '$2b$10$YourHashedPasswordHere', 'Alice Cooper', 'PATIENT', '0761112233'),
(5, 'patient.bob@gmail.com', '$2b$10$YourHashedPasswordHere', 'Bob builder', 'PATIENT', '0763334455'),
(6, 'pharm.sarah@sethro.com', '$2b$10$YourHashedPasswordHere', 'Sarah Conners', 'PHARMACIST', '0719988776'),
(7, 'lab.mike@sethro.com', '$2b$10$YourHashedPasswordHere', 'Mike Ross', 'LAB_ASSISTANT', '0715566778'),
(8, 'recep.lisa@sethro.com', '$2b$10$YourHashedPasswordHere', 'Lisa Kudrow', 'RECEPTIONIST', '0721122334');

-- 2. Insert Doctor Profiles
INSERT INTO `doctors` (`user_id`, `specialization`, `license_number`) VALUES 
(2, 'Cardiologist', 'SLMC-1001'),
(3, 'Pediatrician', 'SLMC-1002');

-- 3. Insert Patient Profiles
INSERT INTO `patients` (`user_id`, `date_of_birth`, `gender`, `address`, `medical_history`) VALUES 
(4, '1990-05-15', 'FEMALE', '123 Lotus Rd, Colombo', 'Asthma'),
(5, '1985-08-20', 'MALE', '45 Galle Rd, Matara', 'None');

-- 4. Insert Medicines
INSERT INTO `medicines` (`name`, `stock`, `unit`, `price_per_unit`, `expiry_date`) VALUES 
('Paracetamol 500mg', 1000, 'tablets', 5.00, '2027-12-31'),
('Amoxicillin 250mg', 500, 'capsules', 15.00, '2026-06-30'),
('Cetirizine 10mg', 750, 'tablets', 8.00, '2027-01-01'),
('Vitamin C 500mg', 200, 'tablets', 12.00, '2026-12-31'),
('Cough Syrup 100ml', 100, 'bottles', 350.00, '2026-09-15');

-- 5. Insert Lab Tests
INSERT INTO `lab_tests` (`name`, `description`, `price`) VALUES 
('Full Blood Count (FBC)', 'Complete blood count analysis', 850.00),
('Fasting Blood Sugar (FBS)', 'Glucose level test', 400.00),
('Lipid Profile', 'Cholesterol and triglycerides check', 1500.00),
('Urine Full Report', 'Basic urine analysis', 500.00);


SET FOREIGN_KEY_CHECKS = 1;
