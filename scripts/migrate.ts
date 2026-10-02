import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pool,closePool} from '../src/db/pool.js';
import {env} from '../src/config/env.js';
const db=await pool.connect();
try {
  await db.query('SELECT pg_advisory_lock(706001)');
  await db.query(`CREATE SCHEMA IF NOT EXISTS "${env.DATABASE_SCHEMA}"`);
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir('db/migrations')).filter(n=>n.endsWith('.sql')).sort()) {
    const sql=await readFile(`db/migrations/${name}`,'utf8'), hash=createHash('sha256').update(sql).digest('hex');
    const previous=(await db.query('SELECT sha256 FROM schema_migrations WHERE name=$1',[name])).rows[0];
    if(previous){if(previous.sha256!==hash)throw new Error(`Migration modificada: ${name}`);continue;}
    await db.query('BEGIN');
    try{await db.query(sql);await db.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,hash]);await db.query('COMMIT');console.log(`Aplicada ${name}`);}
    catch(error){await db.query('ROLLBACK');throw error;}
  }
}finally{await db.query('SELECT pg_advisory_unlock(706001)');db.release();await closePool();}
