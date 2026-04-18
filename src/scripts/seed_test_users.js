
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: '.env.local' });

const SALT_ROUNDS = 10;

const usersToSeed = [
    {
        email: 'admin1@sethro.com',
        password: 'test123',
        name: 'Test Admin',
        role: 'ADMIN'
    },
    {
        email: 'doctor1@sethro.com',
        password: 'test123',
        name: 'Test Doctor',
        role: 'DOCTOR'
    },
    {
        email: 'patient1@sethro.com',
        password: 'test123',
        name: 'Test Patient',
        role: 'PATIENT'
    },
    {
        email: 'pharmacist1@sethro.com',
        password: 'test123',
        name: 'Test Pharmacist',
        role: 'PHARMACIST'
    },
    {
        email: 'receptionist1@sethro.com',
        password: 'test123',
        name: 'Test Receptionist',
        role: 'RECEPTIONIST'
    },
    {
        email: 'lab1@sethro.com',
        password: 'test123',
        name: 'Test Lab Assistant',
        role: 'LAB_ASSISTANT'
    }
];

async function seed() {
    console.log("Starting seed process...");
    
    // Create pool
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
    });

    try {
        const passwordHash = await bcrypt.hash('test123', SALT_ROUNDS);
        console.log("Password hashed successfully.");

        for (const user of usersToSeed) {
            console.log(`Processing user: ${user.email}...`);

            // Check if user exists
            const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [user.email]);
            
            let userId;
            if (existing.length > 0) {
                userId = existing[0].id;
                console.log(`User ${user.email} already exists (ID: ${userId}). Updating password and role.`);
                await pool.execute(
                    'UPDATE users SET password_hash = ?, role = ?, name = ?, is_verified = TRUE WHERE id = ?',
                    [passwordHash, user.role, user.name, userId]
                );
            } else {
                const [result] = await pool.execute(
                    'INSERT INTO users (email, password_hash, name, role, is_verified) VALUES (?, ?, ?, ?, TRUE)',
                    [user.email, passwordHash, user.name, user.role]
                );
                userId = result.insertId;
                console.log(`Inserted user ${user.email} (ID: ${userId}).`);
            }

            // Profile specific insertions
            if (user.role === 'DOCTOR') {
                const [existingDoc] = await pool.execute('SELECT user_id FROM doctors WHERE user_id = ?', [userId]);
                if (existingDoc.length === 0) {
                    await pool.execute(
                        'INSERT INTO doctors (user_id, specialization, license_number) VALUES (?, ?, ?)',
                        [userId, 'General Medicine', `SLMC-TEMP-${userId}`]
                    );
                    console.log(`Inserted doctor profile for ID: ${userId}`);
                }
            } else if (user.role === 'PATIENT') {
                const [existingPatient] = await pool.execute('SELECT user_id FROM patients WHERE user_id = ?', [userId]);
                if (existingPatient.length === 0) {
                    await pool.execute(
                        'INSERT INTO patients (user_id, date_of_birth, gender, address) VALUES (?, ?, ?, ?)',
                        [userId, '1990-01-01', 'OTHER', 'Default Test Address']
                    );
                    console.log(`Inserted patient profile for ID: ${userId}`);
                }
            }
        }

        console.log("\nSeed process completed successfully.");
    } catch (error) {
        console.error("Seed error:", error);
    } finally {
        await pool.end();
    }
}

seed();
