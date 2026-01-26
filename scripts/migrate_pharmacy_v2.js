
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const MIGRATION_FILE = '09_schema_pharmacy_batches.sql';

async function migrate() {
    try {
        console.log(`Running Migration: ${MIGRATION_FILE}...`);

        const sql = fs.readFileSync(
            path.join(__dirname, `../databas_setup_querries/${MIGRATION_FILE}`),
            'utf8'
        );

        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        try {
            await connection.beginTransaction();

            for (const statement of statements) {
                await connection.query(statement);
            }

            await connection.commit();
            console.log('Migration successful!');
        } catch (err) {
            await connection.rollback();
            console.error('Migration failed:', err);
        } finally {
            await connection.end();
        }

    } catch (error) {
        console.error('Setup Error:', error);
        process.exit(1);
    }
}

migrate();
