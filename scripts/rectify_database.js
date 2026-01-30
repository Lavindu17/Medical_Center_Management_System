const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function rectifyDatabase() {
    console.log('Starting Database Rectification...');
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: Number(process.env.MYSQL_PORT) || 3306,
            multipleStatements: true
        });

        console.log('Connected to database.');

        // 1. Recreate Users Table with CORRECT Schema (including is_verified)
        const createUsersSQL = `
            SET FOREIGN_KEY_CHECKS = 0;
            DROP TABLE IF EXISTS \`users\`;
            CREATE TABLE \`users\` (
              \`id\` INT AUTO_INCREMENT PRIMARY KEY,
              \`email\` VARCHAR(255) NOT NULL UNIQUE,
              \`password_hash\` VARCHAR(255) NOT NULL,
              \`name\` VARCHAR(255) NOT NULL,
              \`role\` ENUM('PATIENT', 'DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN') NOT NULL,
              \`phone\` VARCHAR(20),
              \`is_verified\` BOOLEAN DEFAULT FALSE,
              \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_email (\`email\`),
              INDEX idx_role (\`role\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            SET FOREIGN_KEY_CHECKS = 1;
        `;
        console.log('Recreating users table...');
        await connection.query(createUsersSQL);

        // 2. Ensure Auth Codes Table Exists (from 13_schema_auth_codes.sql)
        const createAuthCodesSQL = `
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
        `;
        console.log('Ensuring auth_codes table...');
        await connection.query(createAuthCodesSQL);

        // 3. Insert Seed Users with 'password123'
        const password = 'password123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Users from pw file + standard seeds
        const users = [
            [1, 'admin@sethro.com', hash, 'System Admin', 'ADMIN', '0712345678', true],
            [2, 'doc.smith@sethro.com', hash, 'Dr. John Smith', 'DOCTOR', '0771234567', true],
            [3, 'doc.doe@sethro.com', hash, 'Dr. Jane Doe', 'DOCTOR', '0777654321', true],
            [4, 'patient.alice@gmail.com', hash, 'Alice Cooper', 'PATIENT', '0761112233', true],
            [5, 'patient.bob@gmail.com', hash, 'Bob builder', 'PATIENT', '0763334455', true],
            [6, 'pharm.sarah@sethro.com', hash, 'Sarah Conners', 'PHARMACIST', '0719988776', true],
            [7, 'lab.mike@sethro.com', hash, 'Mike Ross', 'LAB_ASSISTANT', '0715566778', true],
            [8, 'recep.lisa@sethro.com', hash, 'Lisa Kudrow', 'RECEPTIONIST', '0721122334', true]
        ];

        const insertSQL = 'INSERT INTO users (id, email, password_hash, name, role, phone, is_verified) VALUES ?';
        console.log('Seeding users...');
        await connection.query(insertSQL, [users]);

        console.log('Rectification Complete.');

    } catch (error) {
        console.error('Rectification Failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

rectifyDatabase();
