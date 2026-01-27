
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runMigration() {
    console.log('Starting migration (allergies)...');

    if (!process.env.MYSQL_HOST) {
        console.error('Missing env vars');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306
    });

    try {
        // 1. Create Table
        const sqlPath = path.join(process.cwd(), 'databas_setup_querries', '16_schema_patient_allergies.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await connection.query(sql);
        console.log('Table patient_allergies created.');

        // 2. Migrate Data
        console.log('Migrating existing allergies...'); // Fetch patients with non-null allergies
        const [patients]: any = await connection.query('SELECT user_id, allergies FROM patients WHERE allergies IS NOT NULL AND allergies != ""');

        for (const p of patients) {
            const allergyList = p.allergies.split(',').map((s: string) => s.trim()).filter((s: string) => s);
            for (const allergy of allergyList) {
                // Insert if not exists (simple check)
                await connection.execute(
                    'INSERT INTO patient_allergies (patient_id, allergy_name) VALUES (?, ?)',
                    [p.user_id, allergy]
                );
            }
        }
        console.log(`Migrated allergies for ${patients.length} patients.`);

        // 3. Drop old column 
        // await connection.query('ALTER TABLE patients DROP COLUMN allergies');
        // console.log('Dropped old allergies column.'); 
        // Keeping it for now for safety, or we can just null it out.

        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
