const mysql = require('mysql2/promise');

const config = {
    host: 'localhost',
    user: 'root',
    password: 'Ttlshiwwya2002#',
    database: 'sethro_medical'
};

async function migrate() {
    console.log('Connecting to database...');
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected.');

        // 1. Add Vitals Columns
        console.log('Checking for Vitals columns...');
        try {
            // Attempt to add. If fails (exists), it will catch.
            // Better: Check metadata, but brute force ALTER with 'IF NOT EXISTS' logic via catch is common for simple scripts.
            // MySQL 8 supports 'ADD COLUMN IF NOT EXISTS' but older don't.
            // Let's try individual ALTERS.

            const columnsToAdd = [
                "ADD COLUMN `weight` DECIMAL(5,2) DEFAULT NULL COMMENT 'Weight in Kg'",
                "ADD COLUMN `blood_pressure` VARCHAR(20) DEFAULT NULL COMMENT 'e.g. 120/80'",
                "ADD COLUMN `temperature` DECIMAL(4,1) DEFAULT NULL COMMENT 'Celsius'",
                "ADD COLUMN `pulse` INT DEFAULT NULL COMMENT 'Beats per minute'"
            ];

            for (const col of columnsToAdd) {
                try {
                    await connection.query(`ALTER TABLE appointments ${col}`);
                    console.log(`Verified column: ${col.split(' ')[2]}`);
                } catch (err) {
                    if (err.code === 'ER_DUP_FIELDNAME') {
                        console.log(`Column already exists: ${col.split(' ')[2]}`);
                    } else {
                        throw err;
                    }
                }
            }

        } catch (error) {
            console.error('Vitals Migration Warning:', error.message);
        }

        // 2. Update Status Enum
        console.log('Updating Status Enum to Check ONGOING...');
        try {
            await connection.query("ALTER TABLE `appointments` MODIFY COLUMN `status` ENUM('PENDING', 'CHECKED_IN', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ABSENT') DEFAULT 'PENDING'");
            console.log('Status ENUM updated successfully.');
        } catch (error) {
            console.error('Status Enum Update Error:', error.message);
        }

        console.log('Migration Complete.');

    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
