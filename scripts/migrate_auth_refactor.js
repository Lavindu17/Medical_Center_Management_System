const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: Number(process.env.MYSQL_PORT) || 3306,
            multipleStatements: true
        });

        console.log('Connected to database.');

        const sqlPath = path.join(__dirname, '../databas_setup_querries/13_schema_auth_codes.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running auth refactor migration...');
        try {
            await connection.query(sql);
            console.log('Migration successful!');
        } catch (err) {
            if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log('Columns might already be dropped. Continuing...');
            } else {
                throw err;
            }
        }

        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
