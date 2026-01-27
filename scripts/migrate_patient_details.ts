
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runMigration() {
    console.log('Starting migration (patient details)...');

    if (!process.env.MYSQL_HOST) {
        console.error('Missing env vars');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_PORT) || 3306,
        multipleStatements: true // Required for Stored Procedures
    });

    try {
        const sqlPath = path.join(process.cwd(), 'databas_setup_querries', '15_schema_patient_details.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing SQL from ${sqlPath}`);

        // Remove DELIMITER commands as mysql2 does not support them
        const cleanedSql = sql
            .replace(/DELIMITER \/\/|DELIMITER ;/g, '')
            .replace(/\/\/$/gm, ';'); // Replace // at end of lines with ; if needed for split, but actually standard mysql2 driver handles create procedure if sent as one block?

        // Actually, mysql2 with multipleStatements doesn't parse DELIMITER. 
        // We should just send the CREATE PROCEDURE block as one statement.
        // But the file has multiple statements.
        // Simple hack: Replace // with ; and remove DELIMITER lines.
        const executableSql = sql
            .replace(/DELIMITER \/\/|DELIMITER ;/g, '') // Remove delimiter commands
            .replace(/\/\//g, ';'); // Replace // with ;

        await connection.query(executableSql);
        console.log('Migration committed: Patient columns added.');

        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
