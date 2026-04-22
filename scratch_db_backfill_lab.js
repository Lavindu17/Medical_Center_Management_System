require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function backfill() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    console.log("Backfilling lab_total for existing PENDING bills...\n");

    // Get all PENDING bills that have lab_total = 0 but have lab requests
    const [bills] = await pool.query(`
        SELECT b.id, b.appointment_id, b.doctor_fee, b.service_charge, b.pharmacy_total
        FROM bills b
        WHERE b.status = 'PENDING' AND b.lab_total = 0
    `);

    console.log(`Found ${bills.length} bills to backfill.`);
    let updated = 0;

    for (const bill of bills) {
        const [labRows] = await pool.query(`
            SELECT COALESCE(SUM(lt.price), 0) as lab_total
            FROM lab_requests lr
            JOIN lab_tests lt ON lt.id = lr.test_id
            WHERE lr.appointment_id = ?
        `, [bill.appointment_id]);

        const labTotal = Number(labRows[0].lab_total);
        if (labTotal > 0) {
            const newTotal = Number(bill.doctor_fee) + Number(bill.service_charge) + labTotal + Number(bill.pharmacy_total);
            await pool.query(
                `UPDATE bills SET lab_total = ?, total_amount = ? WHERE id = ?`,
                [labTotal, newTotal, bill.id]
            );
            console.log(`  Bill #${bill.id} (Appt #${bill.appointment_id}): lab_total = LKR ${labTotal}, new total = LKR ${newTotal}`);
            updated++;
        }
    }

    console.log(`\nDone. Updated ${updated} bill(s).`);
    process.exit(0);
}
backfill().catch(e => { console.error("Error:", e.message); process.exit(1); });
