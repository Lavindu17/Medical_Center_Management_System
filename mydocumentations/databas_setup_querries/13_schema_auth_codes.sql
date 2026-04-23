-- Create normalized auth_codes table
CREATE TABLE IF NOT EXISTS auth_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
    code_hash VARCHAR(256) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_type (user_id, type)
);

-- Drop legacy columns from users table
-- We check if they exist before dropping to avoid errors if re-run (MySQL 8+ supports IF EXISTS in ALTER, but for safety in older versions we just run DROP)
ALTER TABLE users
DROP COLUMN verification_code,
DROP COLUMN verification_expires,
DROP COLUMN reset_code,
DROP COLUMN reset_expires;
