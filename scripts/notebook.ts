// Single-process local runtime. Persistent PostgreSQL files; never expose this port to the internet.
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {config} from 'dotenv';
config({path:'.env'});
let aiSettings:{testContactId?:string,aiEnabled?:boolean}={};
try{aiSettings=JSON.parse(await readFile('data/private/ai-test-settings.json','utf8'));}catch(error:any){if(error.code!=='ENOENT')throw error;}
const paidTest=Boolean(aiSettings.aiEnabled && aiSettings.testContactId && process.env.OPENAI_API_KEY);
process.env.AI_TEST_ONLY='true';process.env.AI_TEST_CONTACT_IDS=aiSettings.testContactId??'';
process.env.OPENAI_MODEL_FAST='gpt-4.1-mini';process.env.OPENAI_MODEL_NEGOTIATION='gpt-4.1';
process.env.AI_DAILY_LIMIT_USD='0.10';process.env.AI_MONTHLY_LIMIT_USD='0.50';
process.env.MOCK_AI=String(!paidTest);process.env.AI_DRY_RUN=String(!paidTest);process.env.AUTO_SEND='false';
process.env.QA_APPROVED='false';process.env.AUTONOMOUS_AUTHORIZED='false';process.env.AUDIO_ENABLED='false';
process.env.WHATSAPP_ENABLED='false';process.env.PORT='18788';
await mkdir('data/private',{recursive:true});
const credentialsPath='data/private/local-access.json';
let credentials:{username:string,password:string,workerKey:string,adminKey:string};
try{credentials=JSON.parse(await readFile(credentialsPath,'utf8'));}
catch(error:any){if(error.code!=='ENOENT')throw error;credentials={username:'snake-local',password:randomBytes(18).toString('hex'),workerKey:randomBytes(24).toString('hex'),adminKey:randomBytes(24).toString('hex')};await writeFile(credentialsPath,JSON.stringify(credentials,null,2));}
process.env.SNAKE_WORKER_KEY=credentials.workerKey;process.env.SNAKE_ADMIN_KEY=credentials.adminKey;
const db=new PGlite('data/private/postgres');await db.waitReady;
await db.exec('CREATE SCHEMA IF NOT EXISTS snake; SET search_path=snake,pg_catalog; CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());');
for(const name of (await readdir('db/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  const source=await readFile(`db/migrations/${name}`,'utf8'), hash=createHash('sha256').update(source).digest('hex');
  const old=await db.query<{sha256:string}>('SELECT sha256 FROM schema_migrations WHERE name=$1',[name]);
  if(old.rows.length){if(old.rows[0].sha256!==hash)throw new Error(`Migration modificada: ${name}`);continue;}
  await db.exec('BEGIN');try{await db.exec(source.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));await db.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)',[name,hash]);await db.exec('COMMIT');}catch(error){await db.exec('ROLLBACK');throw error;}
}
// One embedded PostgreSQL session: serialize transactions and standalone queries together.
const {pool}=await import('../src/db/pool.js');let tail=Promise.resolve();
async function acquire(){const previous=tail;let unlock!:()=>void;tail=new Promise<void>(resolve=>{unlock=resolve;});await previous;return unlock;}
async function query(sql:string,args:any[]=[]){const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};}
(pool as any).query=async(sql:string,args:any[]=[])=>{const release=await acquire();try{return await query(sql,args);}finally{release();}};
(pool as any).connect=async()=>{const release=await acquire();return {query,release};};
await pool.query("UPDATE system_settings SET setting_value='\"observation\"'::jsonb WHERE setting_key='automation_mode'");
await writeFile('admin/.env.local',`ADMIN_USER=${credentials.username}\nADMIN_PASSWORD=${credentials.password}\nSNAKE_CORE_URL=http://127.0.0.1:18788\nSNAKE_ADMIN_KEY=${credentials.adminKey}\n`);
const {createServer}=await import('../src/api/server.js');
const server=createServer().listen(18788,'127.0.0.1');
const admin=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','13001'],{cwd:'admin',stdio:'inherit',windowsHide:true});
console.log(`SNAKE CONTROL: http://127.0.0.1:13001 | Observação, ${paidTest?'IA somente no contato de teste':'simulação'}, sem envios. Acesso em data/private/local-access.json.`);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;admin.kill();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();process.exit(0);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
admin.on('exit',()=>void stop());
