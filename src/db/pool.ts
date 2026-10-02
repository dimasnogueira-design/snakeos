import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  options: `-c search_path=${env.DATABASE_SCHEMA},pg_catalog`,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

export async function closePool() {
  await pool.end();
}
