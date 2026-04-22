require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function test() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    console.log("=== Billing Engine End-to-End Verification ===\n");

    // 1. What consultation/save now computes for lab_total
    const [labByAppt] = await pool.query(`
        SELECT lr.appointment_id, COALESCE(SUM(lt.price),0) as computed_lab_total
        FROM lab_requests lr
        JOIN lab_tests lt ON lt.id = lr.test_id
        GROUP BY lr.appointment_id
        LIMIT 5
    `);
    console.log("1. Lab total per appointment (what billing engine will write):");
    labByAppt.forEach(r => console.log(`   Appt #${r.appointment_id} → LKR ${r.computed_lab_total}`));

    // 2. Current bills table state (the stored source of truth)
    const [bills] = await pool.query(`
        SELECT id, appointment_id, doctor_fee, service_charge, lab_total, pharmacy_total, total_amount, status
        FROM bills ORDER BY id DESC LIMIT 5
    `);
    console.log("\n2. Current bills table (head 5):");
    bills.forEach(b => console.log(`   Bill #${b.id}: doc=${b.doctor_fee} svc=${b.service_charge} lab=${b.lab_total} pharm=${b.pharmacy_total} total=${b.total_amount} [${b.status}]`));

    // 3. Admin revenue: reads directly from bills
    const [rev] = await pool.query(`
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
    console.log("\n3. Admin Revenue (from bills where PAID):", rev[0]);

    // 4. COGS (from actual dispensed items and lab cost_price)
    const [medicineCogs] = await pool.query(`
        SELECT COALESCE(SUM(pi.dispensed_quantity * COALESCE(m.buying_price, 0)), 0) as medicine_cogs
        FROM prescription_items pi
        JOIN medicines m ON m.id = pi.medicine_id
        WHERE pi.status IN ('DISPENSED','PARTIALLY_COMPLETED') AND pi.dispensed_quantity > 0
    `);
    const [labCogs] = await pool.query(`
        SELECT COALESCE(SUM(lt.cost_price), 0) as lab_cogs
        FROM lab_requests lr
        JOIN lab_tests lt ON lt.id = lr.test_id
        WHERE lr.status = 'COMPLETED'
    `);
    console.log("\n4. COGS:");
    console.log("   Medicine COGS:", medicineCogs[0].medicine_cogs);
    console.log("   Lab COGS:", labCogs[0].lab_cogs);

    // 5. Inventory valuation
    const [inv] = await pool.query(`
        SELECT
            COALESCE(SUM(CASE WHEN expiry_date >= CURDATE() THEN quantity_current * buying_price ELSE 0 END),0) as asset_value,
            COALESCE(SUM(CASE WHEN expiry_date < CURDATE() AND quantity_current > 0 THEN quantity_current * buying_price ELSE 0 END),0) as write_off
        FROM inventory_batches
    `);
    console.log("\n5. Inventory:");
    console.log("   Assets (unexpired):", inv[0].asset_value);
    console.log("   Write-offs (expired):", inv[0].write_off);

    console.log("\n=== All queries passed ===");
    process.exit(0);
}
test().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
