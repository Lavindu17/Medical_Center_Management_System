const { createPool } = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    const pool = createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const sqlPath = path.join(process.cwd(), 'databas_setup_querries', '03_schema_updates.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon to run multiple statements
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        console.log(`Found ${statements.length} statements to execute.`);

        const connection = await pool.getConnection();

        for (const stmt of statements) {
            try {
                await connection.query(stmt);
                console.log('Executed:', stmt.substring(0, 50) + '...');
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log('Skipping: Column already exists.');
                } else {
                    console.error('Error executing statement:', err.message);
                }
            }
        }

        connection.release();
        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
