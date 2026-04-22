const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    try {
        console.log("Adding dispensed_quantity to prescription_items...");
        await pool.query("ALTER TABLE prescription_items ADD COLUMN dispensed_quantity INT NOT NULL DEFAULT 0 AFTER quantity");
    } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') console.error(e.message);
    }

    try {
        console.log("Updating prescription_items status ENUM...");
        await pool.query("ALTER TABLE prescription_items MODIFY COLUMN status ENUM('PENDING', 'PARTIALLY_COMPLETED', 'DISPENSED') DEFAULT 'PENDING'");
    } catch (e) {
        console.error(e.message);
    }

    try {
        console.log("Updating prescriptions status ENUM...");
        await pool.query("ALTER TABLE prescriptions MODIFY COLUMN status ENUM('PENDING', 'PARTIALLY_COMPLETED', 'DISPENSED') DEFAULT 'PENDING'");
    } catch (e) {
        console.error(e.message);
    }

    console.log("Migration Complete.");
    process.exit(0);
}

run();
