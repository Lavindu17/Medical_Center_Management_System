
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

async function validate() {
    console.log('Validating Query logic...');

    // Create connection
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
    });

    try {
        const sql = `SELECT 
                p.id, 
                p.status, 
                p.created_at,
                pat_user.name as patient_name, 
                pat_user.id as patient_id,
                doc_user.name as doctor_name,
                (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = p.id) as item_count
            FROM prescriptions p
            JOIN appointments a ON p.appointment_id = a.id
            JOIN users pat_user ON a.patient_id = pat_user.id
            JOIN users doc_user ON p.doctor_id = doc_user.id
            WHERE p.status = 'PENDING'
            ORDER BY p.created_at ASC`;

        console.log('Executing SQL:', sql.replace(/\s+/g, ' '));
        const [rows] = await connection.execute(sql);
        console.log('Success! Rows returned:', JSON.stringify(rows));

    } catch (e: any) {
        console.error('SQL ERROR:', e.sqlMessage || e.message);
    } finally {
        await connection.end();
    }
}

validate().catch(console.error);
