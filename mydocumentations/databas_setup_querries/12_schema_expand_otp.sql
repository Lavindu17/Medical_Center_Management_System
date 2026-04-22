-- Expand OTP columns to store SHA-256 hashes
ALTER TABLE users 
MODIFY COLUMN verification_code VARCHAR(64),
MODIFY COLUMN reset_code VARCHAR(64);
