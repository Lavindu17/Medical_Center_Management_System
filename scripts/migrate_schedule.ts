
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runMigration() {
    console.log('Starting migration (standalone connection)...');

    if (!process.env.MYSQL_HOST) {
        console.error('Missing env vars');
        process.exit(1);
    }

    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
        waitForConnections: true,
        connectionLimit: 1
    });

    try {
        const sqlPath = path.join(process.cwd(), 'databas_setup_querries', '14_schema_doctor_multi_schedule.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing SQL from ${sqlPath}`);

        await pool.query(sql);
        console.log('Migration committed: doctor_schedules table created.');

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
