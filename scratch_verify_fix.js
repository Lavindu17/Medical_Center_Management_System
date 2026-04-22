require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function verifyFix() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    console.log("Verifying fix for ONLY_FULL_GROUP_BY issue...\n");

    try {
        const sql = `
            SELECT medicine_id, MAX(selling_price) as selling_price 
            FROM inventory_batches 
            WHERE expiry_date >= CURDATE() 
            GROUP BY medicine_id
        `;
        console.log("Executing Updated Query:", sql);
        const [rows] = await pool.query(sql);
        console.log("\n[SUCCESS] Query worked! Rows returned:", rows.length);
        if (rows.length > 0) {
            console.log("Sample result row:", rows[0]);
        }
    } catch (e) {
        console.error("\n[FAILED] Query still failing:", e.message);
    }

    process.exit(0);
}

verifyFix().catch(e => {
    console.error(e);
    process.exit(1);
});
