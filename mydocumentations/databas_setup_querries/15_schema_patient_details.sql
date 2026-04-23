-- 15_schema_patient_details.sql

-- Add new columns to patients table if they don't exist
-- Using a stored procedure approach for idempotency (safe to run multiple times)

DROP PROCEDURE IF EXISTS AddPatientColumns;

DELIMITER //

CREATE PROCEDURE AddPatientColumns()
BEGIN
    -- 1. Blood Group
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'patients' AND COLUMN_NAME = 'blood_group' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE `patients` ADD COLUMN `blood_group` VARCHAR(10) NULL DEFAULT NULL;
    END IF;

    -- 2. Emergency Contact Name
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'patients' AND COLUMN_NAME = 'emergency_contact_name' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE `patients` ADD COLUMN `emergency_contact_name` VARCHAR(100) NULL DEFAULT NULL;
    END IF;

    -- 3. Emergency Contact Phone
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'patients' AND COLUMN_NAME = 'emergency_contact_phone' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE `patients` ADD COLUMN `emergency_contact_phone` VARCHAR(20) NULL DEFAULT NULL;
    END IF;

    -- 4. Allergies (Stored as JSON string or CSV text)
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'patients' AND COLUMN_NAME = 'allergies' AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE `patients` ADD COLUMN `allergies` TEXT NULL DEFAULT NULL;
    END IF;

END //

DELIMITER ;

CALL AddPatientColumns();
DROP PROCEDURE AddPatientColumns;
