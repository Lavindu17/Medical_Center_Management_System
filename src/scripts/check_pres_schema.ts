
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

async function checkPrescriptionSchema() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
    });

    try {
        const [rows] = await connection.query('DESCRIBE prescriptions');
        console.table(rows);
    } catch (e) {
        console.error(e);
    }
    await connection.end();
}
checkPrescriptionSchema();
