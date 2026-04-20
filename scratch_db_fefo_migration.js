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
        console.log("Adding rejection_reason to prescription_items...");
        await pool.query("ALTER TABLE prescription_items ADD COLUMN rejection_reason VARCHAR(50) NULL DEFAULT NULL AFTER dispensed_quantity");
        console.log("  Done: rejection_reason added.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("  Skipped: rejection_reason already exists.");
        } else {
            console.error("  Error:", e.message);
        }
    }

    try {
        console.log("Updating prescription_items status ENUM to include REJECTED...");
        await pool.query("ALTER TABLE prescription_items MODIFY COLUMN status ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','REJECTED') DEFAULT 'PENDING'");
        console.log("  Done: REJECTED status added.");
    } catch (e) {
        console.error("  Error:", e.message);
    }

    try {
        console.log("Updating prescriptions status ENUM to include COMPLETED...");
        await pool.query("ALTER TABLE prescriptions MODIFY COLUMN status ENUM('PENDING','PARTIALLY_COMPLETED','DISPENSED','COMPLETED') DEFAULT 'PENDING'");
        console.log("  Done: COMPLETED status added.");
    } catch (e) {
        console.error("  Error:", e.message);
    }

    console.log("\nMigration Complete.");
    process.exit(0);
}

run();
