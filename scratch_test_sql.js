require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function testSql() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    console.log("Testing item enrichment queries...\n");

    try {
        const sql = `
            SELECT medicine_id, selling_price 
            FROM inventory_batches 
            WHERE expiry_date >= CURDATE() 
            GROUP BY medicine_id
        `;
        console.log("Executing Query 1 (Potential ONLY_FULL_GROUP_BY issue):", sql);
        const [rows] = await pool.query(sql);
        console.log("Query 1 Success! Rows returned:", rows.length);
    } catch (e) {
        console.error("\n[CRITICAL] Query 1 failed:", e.message);
        if (e.message.includes("ONLY_FULL_GROUP_BY")) {
            console.log("\nREASON IDENTIFIED: The MySQL 'ONLY_FULL_GROUP_BY' mode is enabled, and the query is invalid because it selects 'selling_price' without grouping by it or using an aggregate function.");
        }
    }

    try {
        const sql2 = `
            SELECT 
                b.id, b.status,
                a.id as appointment_id,
                p.name as patient_name,
                d.name as doctor_name, doc.specialization
            FROM bills b
            JOIN appointments a ON b.appointment_id = a.id
            JOIN users p ON a.patient_id = p.id
            JOIN users d ON a.doctor_id = d.id
            JOIN doctors doc ON doc.user_id = d.id
            WHERE b.status = 'PENDING'
        `;
        console.log("\nExecuting Query 2 (Main Billing List):", sql2);
        const [rows2] = await pool.query(sql2);
        console.log("Query 2 Success! Rows returned:", rows2.length);
    } catch (e) {
        console.error("\n[CRITICAL] Query 2 failed:", e.message);
    }

    process.exit(0);
}

testSql().catch(e => {
    console.error("Test execution failed:", e.message);
    process.exit(1);
});
