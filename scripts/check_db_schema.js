const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: Number(process.env.MYSQL_PORT) || 3306
        });

        console.log('--- USERS TABLE ---');
        const [usersCols] = await connection.query('DESCRIBE users');
        const userFields = usersCols.map(c => c.Field);
        console.log('Columns:', userFields.join(', '));

        console.log('\n--- AUTH_CODES TABLE ---');
        try {
            const [authCols] = await connection.query('DESCRIBE auth_codes');
            console.log('Columns:', authCols.map(c => c.Field).join(', '));
        } catch (e) {
            console.log('Table auth_codes does not exist.');
        }

        await connection.end();
    } catch (error) {
        console.error('Check failed:', error);
    }
}

check();
