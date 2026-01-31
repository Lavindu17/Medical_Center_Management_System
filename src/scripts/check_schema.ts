
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mysql from 'mysql2/promise';

async function checkSchema() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
    });

    try {
        const [users] = await pool.query('DESCRIBE users');
        console.log('USERS:', users);

        const [appointments] = await pool.query('DESCRIBE appointments');
        console.log('APPOINTMENTS:', appointments);

        const [prescriptions] = await pool.query('DESCRIBE prescriptions');
        console.log('PRESCRIPTIONS:', prescriptions);

    } catch (e) {
        console.error(e);
    }
    process.exit();
}
checkSchema();
