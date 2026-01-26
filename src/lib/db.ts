import mysql from 'mysql2/promise';
import 'server-only';

if (!process.env.MYSQL_HOST) {
  console.warn('MySQL environment variables are missing!');
}

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: Number(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true // Enable for transactions if needed inline, but pool.execute works fine.
});

export async function query<T>(sql: string, params: any[] = []): Promise<T> {
  const [results] = await pool.execute(sql, params);
  return results as T;
}
