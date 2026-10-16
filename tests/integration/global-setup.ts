import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const TEST_DB = 'sethro_medical_test';
const SQL_DIR = path.resolve(__dirname, '../../mydocumentations/databas_setup_querries');

/**
 * Rebuilds the isolated test schema from full_setup.sql + 18_schema_sync.sql.
 * Safety: only ever touches a database whose name ends in `_test`, on a local server.
 */
export default async function setup() {
    const host = process.env.MYSQL_HOST ?? 'localhost';
    if (!/^[a-z0-9_]+_test$/.test(TEST_DB)) throw new Error(`Refusing to use non-test database "${TEST_DB}"`);
    if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`Refusing to run integration tests against remote host "${host}"`);

    // full_setup.sql creates/uses/drops the real `sethro_medical` schema. Strip that, keep the table DDL + seed data.
    let ddl = fs.readFileSync(path.join(SQL_DIR, 'full_setup.sql'), 'utf8');
    ddl = ddl.replace(/CREATE DATABASE[\s\S]*?;/i, '').replace(/^\s*USE\s+[^;]+;/gim, '');
    if (/\bUSE\s+`?\w|CREATE\s+DATABASE|DROP\s+DATABASE/i.test(ddl)) throw new Error('full_setup.sql still contains database-level statements');
    const sync = fs.readFileSync(path.join(SQL_DIR, '18_schema_sync.sql'), 'utf8');
    const auditLog = fs.readFileSync(path.join(SQL_DIR, '19_audit_log.sql'), 'utf8');
    const hr = fs.readFileSync(path.join(SQL_DIR, '20_hr.sql'), 'utf8');
    const orders = fs.readFileSync(path.join(SQL_DIR, '21_orders.sql'), 'utf8');
    const access = fs.readFileSync(path.join(SQL_DIR, '22_access_control.sql'), 'utf8');
    const accessSeed = fs.readFileSync(path.join(SQL_DIR, '23_access_seed.sql'), 'utf8');

    const admin = await mysql.createConnection({
        host,
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        multipleStatements: true,
    });
    try {
        await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
        await admin.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await admin.query(`USE \`${TEST_DB}\``);
        await admin.query(ddl);
        await admin.query(sync);
        await admin.query(auditLog);
        await admin.query(hr);
        await admin.query(orders);
        await admin.query(access);
        await admin.query(accessSeed);
        // Booking only accepts times a doctor offers, so the seeded doctors need working hours: every day, all day, 15-minute slots
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        await admin.query(
            'INSERT INTO doctor_schedules (doctor_id, day, start_time, end_time) VALUES ?',
            [[2, 3].flatMap((doctor) => days.map((day) => [doctor, day, '00:00:00', '23:59:00']))]);
    } finally {
        await admin.end();
    }
}
