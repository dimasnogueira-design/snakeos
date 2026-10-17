import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
const state=vi.hoisted(()=>({db:null as any}));
vi.mock('../src/db/pool.js',()=>({pool:{query:async(sql:string,args:any[]=[])=>{
  const r=await state.db.query(sql,args); return {...r,rowCount:r.affectedRows ?? r.rows.length};
},connect:async()=>({query:async(sql:string,args:any[]=[])=>{
  const r=await state.db.query(sql,args); return {...r,rowCount:r.affectedRows ?? r.rows.length};
},release(){}})}}));
import { reserveUsage, settleUsage, getUsageDashboard, resetCircuit } from '../src/cost/budget.js';
import { processIncomingMessage } from '../src/memory/process-message.js';
import { pool } from '../src/db/pool.js';
import { env } from '../src/config/env.js';
import { setContactMode,setContactAutomationPaused } from '../src/db/repository.js';
import { createCommanderMission, listCommanderMissions } from '../src/commander/store.js';
beforeAll(async()=>{
  state.db=new PGlite();
  for(const f of readdirSync('db/migrations').filter(f=>f.endsWith('.sql')).sort()){
    // PGlite supplies gen_random_uuid natively; extension package not needed in this test engine.
    await state.db.exec(readFileSync(`db/migrations/${f}`,'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  }
},30000);
afterAll(async()=>{await state.db?.close();});
describe('PostgreSQL cost and ingress integration',()=>{
  it('stores a private Commander mission encrypted with durable, disabled jobs and idempotency',async()=>{
    const oldKey=process.env.COMMANDER_DATA_KEY;process.env.COMMANDER_DATA_KEY='33'.repeat(32);
    try {
      const raw='Ler meus e-mails privados e organizar as cobranças pendentes';
      const key='1b478b38-7138-4b28-a48b-4b5ad057f80e';
      const created=await createCommanderMission(raw,key);
      expect(created.executionEnabled).toBe(false);expect(created.jobs.map(j=>j.agentId)).toContain('GMAIL_SECRETARY');
      const stored=(await pool.query('SELECT payload_ciphertext,status FROM commander_missions WHERE id=$1',[created.id])).rows[0];
      expect(stored.payload_ciphertext).not.toContain(raw);expect(stored.status).toBe('awaiting_review');
      const jobs=(await pool.query('SELECT external_action_enabled,execution_enabled FROM commander_jobs WHERE mission_id=$1',[created.id])).rows;
      expect(jobs.length).toBeGreaterThan(1);expect(jobs.every((j:any)=>j.external_action_enabled===false&&j.execution_enabled===false)).toBe(true);
      const duplicate=await createCommanderMission('conteúdo diferente não deve substituir',key);
      expect(duplicate.duplicate).toBe(true);expect(duplicate.id).toBe(created.id);
      expect((await listCommanderMissions()).map(m=>m.id)).toContain(created.id);
    } finally {if(oldKey===undefined)delete process.env.COMMANDER_DATA_KEY;else process.env.COMMANDER_DATA_KEY=oldKey;}
  });
  it('preserves takeover history without creating a draft or consuming AI',async()=>{
    await setContactMode('qa-takeover-customer','venom_sales');await setContactAutomationPaused('qa-takeover-customer',true);
    const message={externalMessageId:'takeover-inbound-1',contactId:'qa-takeover-customer',chatId:'qa-takeover-customer',isGroup:false,text:'Ja tenho dominio para meu site',timestamp:'2026-10-02T12:00:00Z'};
    const result=await processIncomingMessage(message);await processIncomingMessage(message);
    expect(result.reason).toBe('contact_takeover');expect(result.autoSend).toBe(false);
    const rows=(await pool.query("SELECT id FROM messages WHERE external_message_id='takeover-inbound-1'")).rows;
    expect(rows).toHaveLength(1);expect((await pool.query('SELECT id FROM agent_decisions WHERE source_message_id=$1',[rows[0].id])).rows).toHaveLength(0);
  });
  it('blocks database-protected contacts before storing messages or generating decisions',async()=>{
    await setContactMode('qa-protected-customer','protected');
    const result=await processIncomingMessage({contactId:'qa-protected-customer',chatId:'qa-protected-customer',isGroup:false,text:'PRIVATE-PROTECTED-CONTENT',timestamp:'2026-10-02T12:00:00Z'});
    expect(result.ignored).toBe(true);expect(result.reason).toBe('protected_contact');
    expect((await pool.query("SELECT id FROM messages WHERE body='PRIVATE-PROTECTED-CONTENT'")).rows).toHaveLength(0);
  });
  it('reserves before calls, blocks over budget and exposes today/month totals',async()=>{
    env.AI_DAILY_LIMIT_USD=0.001; env.AI_MONTHLY_LIMIT_USD=0.002; env.AI_SOFT_LIMIT_RATIO=1;
    const id=await reserveUsage({purpose:'test',model:'gpt-4.1-mini',maxCostMicros:800});
    await settleUsage(id,{inputTokens:1000,outputTokens:100,cachedTokens:0,costMicros:560});
    await expect(reserveUsage({purpose:'test',model:'gpt-4.1-mini',maxCostMicros:500})).rejects.toThrow();
    const dashboard=await getUsageDashboard();
    expect(dashboard.today.costMicros).toBe(560);
    expect(dashboard.month.costMicros).toBe(560);
    expect(dashboard.circuit.open).toBe(true);
    expect((await pool.query("SELECT setting_value FROM system_settings WHERE setting_key='automation_mode'")).rows[0].setting_value).toBe('observation');
    env.AI_DAILY_LIMIT_USD=1; env.AI_MONTHLY_LIMIT_USD=10; env.AI_SOFT_LIMIT_RATIO=.8;
    await resetCircuit();
  });
  it('does not lose reservations when provider errors may be charged',async()=>{
    const id=await reserveUsage({purpose:'failed',model:'gpt-4.1-mini',maxCostMicros:900});
    await settleUsage(id,{error:'provider_unavailable'});
    const row=(await pool.query('SELECT cost_micros,status FROM ai_usage WHERE id=$1',[id])).rows[0];
    expect(Number(row.cost_micros)).toBe(900); expect(row.status).toBe('uncertain');
  });
  it('never persists OTP, groups or protected inbound contents',async()=>{
    const base={contactId:'secret',chatId:'secret',isGroup:false,text:'Seu código de acesso é 778899',timestamp:'2026-10-02T12:00:00Z'};
    expect((await processIncomingMessage(base)).autoSend).toBe(false);
    await processIncomingMessage({...base,text:'private',contactName:'Rafaella'});
    await processIncomingMessage({...base,text:'private',chatId:'group@g.us'});
    expect((await pool.query("SELECT * FROM messages WHERE body LIKE '%778899%' OR body='private'")).rows).toHaveLength(0);
  });
  it('deduplicates the entire pipeline and persists one decision',async()=>{
    const base={externalMessageId:'event-1',contactId:'customer',contactName:'Cliente',chatId:'customer',isGroup:false,text:'Quero fazer um site',timestamp:'2026-10-02T12:00:00Z'};
    const first=await processIncomingMessage(base);
    const duplicate=await processIncomingMessage(base);
    expect(first.autoSend).toBe(false); expect(duplicate.reason).toBe('duplicate');
    expect((await pool.query("SELECT * FROM agent_decisions WHERE source_message_id IN (SELECT id FROM messages WHERE external_message_id='event-1')")).rows).toHaveLength(1);
  });
});
