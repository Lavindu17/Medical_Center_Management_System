-- Add 'reason' column to appointments table for patient's visit reason
ALTER TABLE `appointments` ADD COLUMN `reason` TEXT AFTER `status`;
