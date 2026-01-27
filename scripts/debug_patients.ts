
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugPatients() {
    if (!process.env.MYSQL_HOST) return;
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    try {
        console.log('--- PATIENTS TABLE ---');
        const [cols]: any = await connection.query('DESCRIBE patients');
        console.table(cols);
    } catch (e) { console.error(e); }
    finally { connection.end(); }
}
debugPatients();
