const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs'); // Using bcryptjs as it is in package.json
require('dotenv').config({ path: '.env.local' });

async function resetPasswords() {
    console.log('Resetting all user passwords...');
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: Number(process.env.MYSQL_PORT) || 3306
        });

        // Hash 'password123'
        const password = 'password123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        console.log(`Generated hash for '${password}'`);

        const [result] = await connection.execute(
            'UPDATE users SET password_hash = ?',
            [hashedPassword]
        );

        console.log(`Updated ${result.affectedRows} users.`);
        await connection.end();
        console.log('Password reset complete.');

    } catch (error) {
        console.error('Password reset failed:', error);
        process.exit(1);
    }
}

resetPasswords();
