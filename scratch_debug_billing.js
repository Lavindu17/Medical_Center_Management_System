require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function debugBilling() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    console.log("=== Debugging Receptionist Billing Page ===\n");

    // 1. Total Pending Bills
    const [stats] = await pool.query("SELECT status, COUNT(*) as count FROM bills GROUP BY status");
    console.log("Bill Status Stats:", stats);

    // 2. Check if there are ANY pending bills
    const [pendingBills] = await pool.query("SELECT id, appointment_id FROM bills WHERE status = 'PENDING'");
    console.log(`\nFound ${pendingBills.length} PENDING bills.`);

    if (pendingBills.length > 0) {
        const billIds = pendingBills.map(b => b.id);
        console.log("Pending Bill IDs:", billIds);

        // 3. Test the JOIN logic for these pending bills
        console.log("\nTesting JOINs for these bills:");
        
        for (const bill of pendingBills) {
            console.log(`\n--- Checking Bill #${bill.id} (Appt #${bill.appointment_id}) ---`);
            
            // Appt check
            const [appt] = await pool.query("SELECT id, patient_id, doctor_id FROM appointments WHERE id = ?", [bill.appointment_id]);
            if (appt.length === 0) {
                console.log("  [FAIL] Appointment record missing!");
                continue;
            }
            console.log(`  [OK] Appointment found (Patient: ${appt[0].patient_id}, Doctor: ${appt[0].doctor_id})`);

            // Patient check
            const [patient] = await pool.query("SELECT name FROM users WHERE id = ?", [appt[0].patient_id]);
            if (patient.length === 0) {
                console.log("  [FAIL] Patient user record missing!");
            } else {
                console.log(`  [OK] Patient user found: ${patient[0].name}`);
            }

            // Doctor user check
            const [docUser] = await pool.query("SELECT name FROM users WHERE id = ?", [appt[0].doctor_id]);
            if (docUser.length === 0) {
                console.log("  [FAIL] Doctor user record missing!");
            } else {
                console.log(`  [OK] Doctor user found: ${docUser[0].name}`);
            }

            // Doctor profile check
            const [docProfile] = await pool.query("SELECT specialization FROM doctors WHERE user_id = ?", [appt[0].doctor_id]);
            if (docProfile.length === 0) {
                console.log("  [FAIL] Doctor profile record (doctors table) missing!");
            } else {
                console.log(`  [OK] Doctor profile found: ${docProfile[0].specialization}`);
            }
        }
    }

    process.exit(0);
}

debugBilling().catch(e => {
    console.error("Debug failed:", e.message);
    process.exit(1);
});
