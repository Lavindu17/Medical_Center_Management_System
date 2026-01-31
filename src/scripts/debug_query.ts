
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT)
    });

    try {
        const [rows] = await connection.execute('SELECT DISTINCT frequency FROM prescription_items');
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

debug();
