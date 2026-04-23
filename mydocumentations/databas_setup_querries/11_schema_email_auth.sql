-- Add verification and reset columns to users table
ALTER TABLE users 
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verification_code VARCHAR(10),
ADD COLUMN verification_expires DATETIME,
ADD COLUMN reset_code VARCHAR(10),
ADD COLUMN reset_expires DATETIME;
