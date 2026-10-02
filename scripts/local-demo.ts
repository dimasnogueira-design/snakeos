// Development-only demo: embedded PostgreSQL, synthetic data, zero paid calls, no WhatsApp.
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
process.env.NODE_ENV='development';process.env.MOCK_AI='true';process.env.AI_DRY_RUN='true';process.env.AUTO_SEND='false';process.env.WHATSAPP_ENABLED='false';
process.env.PORT='18787';
await mkdir('../../work',{recursive:true});
const workerKey=randomBytes(24).toString('hex'),adminKey=randomBytes(24).toString('hex'),password=randomBytes(18).toString('hex');
process.env.SNAKE_WORKER_KEY=workerKey;process.env.SNAKE_ADMIN_KEY=adminKey;
const db=new PGlite();
for(const name of (await readdir('db/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec((await readFile(`db/migrations/${name}`,'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
const {pool}=await import('../src/db/pool.js');
// One PostgreSQL session in this demo. Serialize complete transactions to emulate pg Pool clients.
let tail=Promise.resolve();
async function acquire(){const previous=tail;let unlock!:()=>void;tail=new Promise<void>(resolve=>{unlock=resolve;});await previous;return unlock;}
async function query(sql:string,args:any[]=[]) {const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};}
(pool as any).query=async(sql:string,args:any[]=[])=>{const unlock=await acquire();try{return await query(sql,args);}finally{unlock();}};
(pool as any).connect=async()=>{const release=await acquire();return {query,release};};
const {processIncomingMessage}=await import('../src/memory/process-message.js');
const {saveMemory}=await import('../src/db/repository.js');
const {emptyMemory}=await import('../src/memory/compact.js');
await processIncomingMessage({externalMessageId:'demo-lead-1',contactId:'demo:clinic',contactName:'Clínica Exemplo · Demonstração',chatId:'demo:clinic',isGroup:false,text:'Quero um site para a clínica',timestamp:new Date().toISOString()});
await saveMemory('demo:clinic',{...emptyMemory(),goal:'Site institucional para clínica fictícia',pain:'Melhorar apresentação dos serviços',summary:'Demonstração sintética. Cliente quer um site e já tem domínio. Nenhum preço ou prazo foi autorizado.',
  facts:[{key:'dominio',value:'clinica.example',source:'demo',confirmed:true}],openQuestions:['Quais serviços precisam aparecer?'],nextAction:'Confirmar serviços e escopo',persona:'CHRISTIAN'});
await writeFile('admin/.env.local',`ADMIN_USER=snake-local\nADMIN_PASSWORD=${password}\nSNAKE_CORE_URL=http://127.0.0.1:18787\nSNAKE_ADMIN_KEY=${adminKey}\n`);
await writeFile('../../work/demo-access.json',JSON.stringify({username:'snake-local',password,workerKey,adminKey}));
const {createServer}=await import('../src/api/server.js');
const server=createServer().listen(18787,'127.0.0.1',()=>console.log('Demo local: http://127.0.0.1:18787 — Observação, dados sintéticos, zero chamadas pagas. Credenciais locais em work/demo-access.json (não publicar).'));
async function shutdown(){server.close();await db.close();process.exit(0);}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
