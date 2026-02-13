/**
 * Shared Database Module
 *
 * Minimal pg Pool wrapper used by internal services (for example:
 * credit-as-a-service). The pool is initialized lazily so services that do not
 * need the database are not affected.
 */

'use strict';

const { Pool } = require('pg');

let pool = null;

const resolveConnectionString = () => (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.PG_CONNECTION_STRING ||
  ''
);

const getPool = () => {
  if (pool) return pool;

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error(
      'Database connection not configured. Set DATABASE_URL (or POSTGRES_URL/NEON_DATABASE_URL).'
    );
  }

  pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '5000', 10),
    ssl: process.env.DB_SSL === 'false' ? false : undefined,
  });

  pool.on('error', (error) => {
    // Keep this lightweight to avoid crashing the process on transient errors.
    // Callers receive query errors directly.
    console.error('[database] pool error:', error.message);
  });

  return pool;
};

const query = async (text, params = []) => getPool().query(text, params);

const withTransaction = async (fn) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const end = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = {
  getPool,
  query,
  withTransaction,
  end,
};

