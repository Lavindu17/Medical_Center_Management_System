
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            multipleStatements: true
        });

        const sql = fs.readFileSync(path.join(__dirname, '../databas_setup_querries/10_schema_receptionist.sql'), 'utf8');
        console.log('Running migration...');
        await connection.query(sql);
        console.log('Migration successful!');

        await connection.end();
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
