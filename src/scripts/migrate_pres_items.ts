
import { query, pool } from '../lib/db';

async function runMigration() {
    console.log('Starting migration...');
    try {
        // Check if column exists first to avoid error
        const check = await query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'sethro_medical_center' 
            AND TABLE_NAME = 'prescription_items' 
            AND COLUMN_NAME = 'status'
        `);

        // @ts-ignore
        if (check.length > 0) {
            console.log('Column `status` already exists in `prescription_items`.');
        } else {
            await query(`
                ALTER TABLE prescription_items 
                ADD COLUMN status ENUM('PENDING', 'DISPENSED') DEFAULT 'PENDING'
            `);
            console.log('Successfully added `status` column to `prescription_items`.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

runMigration();
