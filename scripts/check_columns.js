
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function check() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        const [rows] = await connection.query('DESCRIBE medicines');
        console.log('Columns in medicines table:');
        rows.forEach(row => console.log(row.Field));

        await connection.end();
    } catch (err) {
        console.error(err);
    }
}

check();
