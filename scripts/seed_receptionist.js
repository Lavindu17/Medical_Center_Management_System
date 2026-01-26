
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function seed() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        // Insert Receptionist
        await connection.query(`
            INSERT IGNORE INTO users (email, password_hash, name, role) 
            VALUES ('reception@sethro.com', '$2b$10$YourHashedPasswordHere', 'Receptionist Clara', 'RECEPTIONIST')
        `);
        console.log('Receptionist seeded successfully!');

        await connection.end();
    } catch (err) {
        console.error('Seeding failed:', err);
    }
}

seed();
