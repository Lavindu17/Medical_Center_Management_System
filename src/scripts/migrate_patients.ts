
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT)
    });

    try {
        console.log('Adding allergies column to patients...');

        // check if column already exists
        const [columns]: any = await connection.query("SHOW COLUMNS FROM patients LIKE 'allergies'");
        if (columns.length > 0) {
            console.log('Column already exists.');
        } else {
            await connection.execute(`
                ALTER TABLE patients
                ADD COLUMN allergies TEXT DEFAULT NULL
            `);
            console.log('Success: allergies column added.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
