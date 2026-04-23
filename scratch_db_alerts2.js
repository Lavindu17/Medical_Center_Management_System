const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    console.log("--- Testing Admin Revenue Query 1 (Gross Revenue) ---");
    try {
        const [r] = await pool.query(`
            SELECT
                COALESCE(SUM(b.service_charge), 0) as service_charges,
                COALESCE(SUM(b.doctor_fee * d.commission_rate / 100), 0) as doctor_commissions,
                COALESCE(SUM(b.lab_total), 0) as lab_revenue,
                COALESCE(SUM(b.pharmacy_total), 0) as pharmacy_revenue
            FROM bills b
            JOIN appointments a ON a.id = b.appointment_id
            JOIN doctors d ON d.user_id = a.doctor_id
            WHERE b.status = 'PAID'
        `);
        console.log("OK:", r[0]);
    } catch(e) { console.error("FAIL Q1:", e.message); }

    console.log("\n--- Testing Doctor Earnings Query (Profile) ---");
    try {
        // simulate with first doctor
        const [doctors] = await pool.query("SELECT user_id FROM doctors LIMIT 1");
        if (doctors.length === 0) { console.log("No doctors in DB, skipping"); }
        else {
            const docId = doctors[0].user_id;
            const rows = await pool.query(
                'SELECT d.commission_rate, d.consultation_fee, u.name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?',
                [docId]
            );
            // rows[0] = array of rows  
            console.log("Raw rows type:", Array.isArray(rows[0]) ? "array" : typeof rows[0]);
            console.log("rows[0][0]:", rows[0][0]);
            // The destructure bug:
            const [doctorProfile] = rows; // this is rows[0] = array of results
            console.log("doctorProfile (should be array):", Array.isArray(doctorProfile));
            console.log("doctorProfile[0]:", doctorProfile[0]); // CORRECT: first row
        }
    } catch(e) { console.error("FAIL Doctor Profile:", e.message); }

    console.log("\n--- Testing Doctor Earnings Summary Query ---");
    try {
        const [doctors] = await pool.query("SELECT user_id FROM doctors LIMIT 1");
        if (doctors.length > 0) {
            const docId = doctors[0].user_id;
            const commissionRate = 10;
            const rows = await pool.query(`
                SELECT
                    COUNT(a.id) as total_appointments,
                    COALESCE(SUM(b.doctor_fee), 0) as gross_earned,
                    COALESCE(SUM(b.doctor_fee * ? / 100), 0) as center_commission,
                    COALESCE(SUM(b.doctor_fee * (1 - ? / 100)), 0) as net_earnings
                FROM appointments a
                JOIN bills b ON b.appointment_id = a.id
                WHERE a.doctor_id = ?
                  AND a.status = 'COMPLETED'
                  AND b.status = 'PAID'
            `, [commissionRate, commissionRate, docId]);
            const summaryRows = rows[0];
            console.log("Summary row[0]:", summaryRows[0]);
        }
    } catch(e) { console.error("FAIL Doctor Summary:", e.message); }

    console.log("\nDone.");
    process.exit(0);
}

run();
