
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
    console.log("Connecting to DB:", process.env.MYSQL_DATABASE);
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT,
    });

    console.log("Migrating...");
    try {
        await pool.query("ALTER TABLE prescription_items ADD COLUMN status ENUM('PENDING', 'DISPENSED') DEFAULT 'PENDING'");
        console.log("Migration Success: Added 'status' column.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column 'status' already exists. Skipping.");
        } else {
            console.error("Migration Error:", e);
        }
    }
    await pool.end();
}
run();
