const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function restoreUsers() {
    console.log('Starting Users Table Restoration...');
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: Number(process.env.MYSQL_PORT) || 3306,
            multipleStatements: true
        });

        console.log('Connected to database.');

        // 1. Create Users Table
        const createTableSQL = `
            SET FOREIGN_KEY_CHECKS = 0;
            DROP TABLE IF EXISTS \`users\`;
            CREATE TABLE \`users\` (
              \`id\` INT AUTO_INCREMENT PRIMARY KEY,
              \`email\` VARCHAR(255) NOT NULL UNIQUE,
              \`password_hash\` VARCHAR(255) NOT NULL,
              \`name\` VARCHAR(255) NOT NULL,
              \`role\` ENUM('PATIENT', 'DOCTOR', 'PHARMACIST', 'LAB_ASSISTANT', 'RECEPTIONIST', 'ADMIN') NOT NULL,
              \`phone\` VARCHAR(20),
              \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_email (\`email\`),
              INDEX idx_role (\`role\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            SET FOREIGN_KEY_CHECKS = 1;
        `;

        console.log('Creating users table...');
        await connection.query(createTableSQL);
        console.log('Users table created.');

        // 2. Insert Seed Data
        const seedUsersSQL = `
            SET FOREIGN_KEY_CHECKS = 0;
            INSERT INTO \`users\` (\`id\`, \`email\`, \`password_hash\`, \`name\`, \`role\`, \`phone\`) VALUES 
            (1, 'admin@sethro.com', '$2b$10$YourHashedPasswordHere', 'System Admin', 'ADMIN', '0712345678'),
            (2, 'doc.smith@sethro.com', '$2b$10$YourHashedPasswordHere', 'Dr. John Smith', 'DOCTOR', '0771234567'),
            (3, 'doc.doe@sethro.com', '$2b$10$YourHashedPasswordHere', 'Dr. Jane Doe', 'DOCTOR', '0777654321'),
            (4, 'patient.alice@gmail.com', '$2b$10$YourHashedPasswordHere', 'Alice Cooper', 'PATIENT', '0761112233'),
            (5, 'patient.bob@gmail.com', '$2b$10$YourHashedPasswordHere', 'Bob builder', 'PATIENT', '0763334455'),
            (6, 'pharm.sarah@sethro.com', '$2b$10$YourHashedPasswordHere', 'Sarah Conners', 'PHARMACIST', '0719988776'),
            (7, 'lab.mike@sethro.com', '$2b$10$YourHashedPasswordHere', 'Mike Ross', 'LAB_ASSISTANT', '0715566778'),
            (8, 'recep.lisa@sethro.com', '$2b$10$YourHashedPasswordHere', 'Lisa Kudrow', 'RECEPTIONIST', '0721122334');
            SET FOREIGN_KEY_CHECKS = 1;
        `;

        console.log('Seeding users...');
        await connection.query(seedUsersSQL);
        console.log('Seed data inserted.');

        await connection.end();
        console.log('Restoration Complete.');
    } catch (error) {
        console.error('Restoration Failed:', error);
        process.exit(1);
    }
}

restoreUsers();
