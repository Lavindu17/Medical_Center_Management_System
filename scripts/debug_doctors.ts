
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugDoctors() {
    console.log('--- DEBUG DOCTORS ---');

    if (!process.env.MYSQL_HOST) {
        console.error('Missing env vars');
        return;
    }

    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306
    });

    try {
        console.log('1. Checking Users with role LIKE "doctor"...');
        const [users]: any = await connection.query('SELECT id, name, role FROM users WHERE role LIKE "doctor" OR role LIKE "DOCTOR"');
        console.table(users);

        console.log('\n2. Checking Doctors table Schema...');
        const [columns]: any = await connection.query('DESCRIBE doctors');
        console.table(columns);

        /*
        console.log('\n3. Testing API Query...');
        const [apiResult]: any = await connection.query(`
            SELECT 
                d.id, 
                u.name, 
                d.specialization 
            FROM doctors d 
            JOIN users u ON d.user_id = u.id 
            WHERE u.role = 'doctor' OR u.role = 'DOCTOR'
        `);
        console.table(apiResult);
        */

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

debugDoctors();
