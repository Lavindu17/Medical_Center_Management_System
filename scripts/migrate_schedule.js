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

        // 1. Add Schedule Columns to doctors
        console.log('Checking for Schedule columns...');
        const cols = [
            "ADD COLUMN `start_time` TIME DEFAULT '09:00:00'",
            "ADD COLUMN `end_time` TIME DEFAULT '17:00:00'",
            "ADD COLUMN `slot_duration` INT DEFAULT 15 COMMENT 'Minutes per slot'",
            "ADD COLUMN `working_days` JSON DEFAULT NULL COMMENT 'Array of days'"
        ];

        for (const col of cols) {
            try {
                await connection.query(`ALTER TABLE doctors ${col}`);
                console.log(`Added column: ${col.split(' ')[2]}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    // console.log(`Column already exists: ${col.split(' ')[2]}`);
                } else {
                    console.error(err.message);
                }
            }
        }

        // 2. Create Leaves Table
        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS \`doctor_leaves\` (
                  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                  \`doctor_id\` INT NOT NULL,
                  \`date\` DATE NOT NULL,
                  \`reason\` VARCHAR(255),
                  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (\`doctor_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
                  UNIQUE KEY \`unique_leave\` (\`doctor_id\`, \`date\`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            console.log('Verified table: doctor_leaves');
        } catch (err) {
            console.error('Leaves Table Error:', err.message);
        }

        console.log('Schedule Migration Complete.');

    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
