
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

async function validate() {
    console.log('Validating Dispense Query logic...');

    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
    });

    try {
        const sql = `SELECT 
                pi.id as item_id, 
                pi.medicine_id, 
                pi.quantity as prescribed_quantity, 
                pi.dosage, pi.frequency, pi.duration,
                m.name as medicine_name, 
                m.stock as current_stock, 
                m.selling_price, 
                m.unit,
                pi.status
             FROM prescription_items pi
             LEFT JOIN medicines m ON pi.medicine_id = m.id
             WHERE pi.prescription_id = 1`; // using generic ID 1 for syntax check

        console.log('Executing SQL:', sql.replace(/\s+/g, ' '));
        const [rows] = await connection.execute(sql);
        console.log('Success! Rows returned:', JSON.stringify(rows));

    } catch (e: any) {
        console.error('SQL ERROR:', e.sqlMessage || e.message);
    } finally {
        await connection.end();
        process.exit();
    }
}

validate().catch(console.error);
