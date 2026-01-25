-- Add Vitals columns to appointments table
ALTER TABLE `appointments`
ADD COLUMN `weight` DECIMAL(5,2) DEFAULT NULL COMMENT 'Weight in Kg',
ADD COLUMN `blood_pressure` VARCHAR(20) DEFAULT NULL COMMENT 'e.g. 120/80',
ADD COLUMN `temperature` DECIMAL(4,1) DEFAULT NULL COMMENT 'Celsius',
ADD COLUMN `pulse` INT DEFAULT NULL COMMENT 'Beats per minute';
