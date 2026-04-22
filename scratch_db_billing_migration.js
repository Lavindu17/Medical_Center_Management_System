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
        console.log("Adding payment_method to bills...");
        await pool.query("ALTER TABLE bills ADD COLUMN payment_method ENUM('CASH','CARD','INSURANCE') NULL AFTER status");
        console.log("  Done.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log("  Skipped: already exists.");
        else console.error("  Error:", e.message);
    }

    try {
        console.log("Adding paid_by to bills (receptionist who marked as paid)...");
        await pool.query("ALTER TABLE bills ADD COLUMN paid_by INT NULL AFTER payment_method");
        console.log("  Done.");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log("  Skipped: already exists.");
        else console.error("  Error:", e.message);
    }

    console.log("\nMigration Complete.");
    process.exit(0);
}

run();
