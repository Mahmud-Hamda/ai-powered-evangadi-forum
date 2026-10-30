import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

/**
 * MySQL connection pool from `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
 * `DB_SSL=true` turns on TLS, which TiDB Cloud requires.
 *
 * @type {import('mysql2/promise').Pool}
 */
const useSsl = process.env.DB_SSL === 'true';

export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'evangadi_forum',
  ssl: useSsl
    ? {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
      }
    : undefined,
  waitForConnections: true,
  connectionLimit: process.env.VERCEL ? 1 : 10,
});

/**
 * Rejects missing or non-array/object SQL bind params.
 *
 * @param {unknown} params - Bind values for `db.execute`.
 * @returns {void}
 * @throws {Error} When params are missing or not an array/object.
 */
const ensureParams = params => {
  if (params === undefined || params === null) {
    throw new Error('SQL parameters are required');
  }
  const isArray = Array.isArray(params);
  const isObject = !isArray && typeof params === 'object';
  if (!isArray && !isObject) {
    throw new Error('SQL parameters must be an array or object');
  }
};

/**
 * Runs a parameterized SQL statement and returns the result rows (or ResultSetHeader).
 *
 * @param {string} sql - Non-empty SQL with `?` placeholders.
 * @param {unknown[] | Record<string, unknown>} params - Bind values (required).
 * @returns {Promise<any>} mysql2 execute result (rows for SELECT).
 */
export const safeExecute = async (sql, params) => {
  if (typeof sql !== 'string' || sql.trim().length === 0) {
    throw new Error('SQL query must be a non-empty string');
  }
  ensureParams(params);
  // mysql2 execute() fails on queries with no placeholders + [].
  if (Array.isArray(params) && params.length === 0 && !sql.includes('?')) {
    const [result] = await db.query(sql);
    return result;
  }
  const [result] = await db.execute(sql, params);
  return result;
};
