
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function cleanup() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        await connection.query('DROP TABLE IF EXISTS inventory_batches');
        console.log('Dropped inventory_batches');
        await connection.end();
    } catch (err) {
        console.error(err);
    }
}

cleanup();
