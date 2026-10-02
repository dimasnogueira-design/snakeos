import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
export class BudgetBlocked extends Error { constructor(){super('budget_or_circuit_blocked');} }
type Queryable={query:(text:string,params?:any[])=>Promise<any>};
const periodSQL=`SELECT
 COALESCE(sum(GREATEST(cost_micros,reserved_micros)) FILTER (WHERE created_at >= (date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)::bigint AS today,
 COALESCE(sum(GREATEST(cost_micros,reserved_micros)) FILTER (WHERE created_at >= (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)::bigint AS month,
 count(*) FILTER(WHERE status='unreconciled')::int AS unreconciled FROM ai_usage`;
export async function getCostLimits(db:Queryable=pool) {
  const r=await db.query("SELECT setting_value FROM system_settings WHERE setting_key='cost_limits'");
  return {dailyUsd:env.AI_DAILY_LIMIT_USD,monthlyUsd:env.AI_MONTHLY_LIMIT_USD,softRatio:env.AI_SOFT_LIMIT_RATIO,...r.rows[0]?.setting_value};
}
async function openCircuit(db:Queryable,reason:string) {
  await db.query("UPDATE system_settings SET setting_value=jsonb_build_object('open',true,'reason',$1::text,'failures',0),updated_at=now() WHERE setting_key='ai_circuit'",[reason]);
  await db.query("UPDATE system_settings SET setting_value='\"observation\"'::jsonb,updated_at=now() WHERE setting_key='automation_mode'");
  await db.query('INSERT INTO alerts(code) VALUES($1)',[reason]);
}
export async function reserveUsage(args:{purpose:string;model:string;maxCostMicros:number;externalId?:string;caseId?:string|null}) {
  if(!Number.isSafeInteger(args.maxCostMicros)||args.maxCostMicros<=0) throw new BudgetBlocked();
  const db=await pool.connect(); let committed=false;
  try {
    await db.query('BEGIN'); await db.query('SELECT pg_advisory_xact_lock(706060)');
    const circuit=(await db.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_circuit' FOR UPDATE")).rows[0]?.setting_value;
    const limits=await getCostLimits(db); const totals=(await db.query(periodSQL)).rows[0];
    if(circuit?.open || Number(totals.unreconciled)>0 || Number(totals.today)+args.maxCostMicros>limits.dailyUsd*1e6*limits.softRatio || Number(totals.month)+args.maxCostMicros>limits.monthlyUsd*1e6*limits.softRatio) {
      if(!circuit?.open) await openCircuit(db,Number(totals.unreconciled)>0?'usage_unreconciled':'budget_limit');
      await db.query('COMMIT'); committed=true; throw new BudgetBlocked();
    }
    const r=await db.query(`INSERT INTO ai_usage(contact_id,case_id,purpose,model,status,reserved_micros)
      VALUES((SELECT id FROM contacts WHERE external_id=$1),$2,$3,$4,'reserved',$5) RETURNING id`,
      [args.externalId??null,args.caseId??null,args.purpose,args.model,args.maxCostMicros]);
    await db.query('COMMIT'); committed=true; return String(r.rows[0].id);
  } finally {if(!committed) await db.query('ROLLBACK');db.release();}
}
export async function settleUsage(id:string,args:{inputTokens?:number;outputTokens?:number;cachedTokens?:number;costMicros?:number;durationSeconds?:number;requestId?:string;error?:string}) {
  const db=await pool.connect();let committed=false;
  try {
    await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(706060)');
    await db.query(`UPDATE ai_usage SET status=$2,cost_micros=COALESCE($3,reserved_micros),reserved_micros=0,
      input_tokens=$4::bigint,output_tokens=$5::bigint,total_tokens=COALESCE($4::bigint,0)+COALESCE($5::bigint,0),cached_tokens=$6,error_code=$7,duration_seconds=$8,request_id=$9 WHERE id=$1 AND status='reserved'`,
      [id,args.error?'uncertain':'complete',args.costMicros??null,args.inputTokens??null,args.outputTokens??null,args.cachedTokens??0,args.error??null,args.durationSeconds??null,args.requestId??null]);
    const circuit=(await db.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_circuit' FOR UPDATE")).rows[0].setting_value;
    const failures=args.error?Number(circuit.failures??0)+1:0;
    if(failures>=env.AI_FAILURE_THRESHOLD) await openCircuit(db,'provider_failures');
    else await db.query("UPDATE system_settings SET setting_value=setting_value || jsonb_build_object('failures',$1::int) WHERE setting_key='ai_circuit'",[failures]);
    const limits=await getCostLimits(db), totals=(await db.query(periodSQL)).rows[0];
    if(Number(totals.today)>=limits.dailyUsd*1e6*limits.softRatio || Number(totals.month)>=limits.monthlyUsd*1e6*limits.softRatio) await openCircuit(db,'budget_limit');
    await db.query('COMMIT');committed=true;
  } finally {if(!committed)await db.query('ROLLBACK');db.release();}
}
export async function getUsageDashboard() {
  const r=await pool.query(`SELECT
    COALESCE(sum(cost_micros) FILTER(WHERE created_at >= (date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)::bigint AS today_cost,
    COALESCE(sum(total_tokens) FILTER(WHERE created_at >= (date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)::bigint AS today_tokens,
    COALESCE(sum(cost_micros) FILTER(WHERE created_at >= (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)::bigint AS month_cost,
    COALESCE(sum(total_tokens) FILTER(WHERE created_at >= (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')),0)::bigint AS month_tokens,
    COALESCE(sum(reserved_micros),0)::bigint AS pending FROM ai_usage`);
  const features=await pool.query(`SELECT purpose,model,status,count(*)::int AS calls,COALESCE(sum(total_tokens),0)::bigint AS tokens,
    COALESCE(sum(cached_tokens),0)::bigint AS cached_tokens,COALESCE(sum(cost_micros),0)::bigint AS cost_micros FROM ai_usage
    WHERE created_at >= (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') GROUP BY purpose,model,status ORDER BY purpose`);
  const c=(await pool.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_circuit'")).rows[0]?.setting_value;
  const t=r.rows[0];
  return {currency:'USD',timezone:'America/Sao_Paulo',today:{costMicros:Number(t.today_cost),tokens:Number(t.today_tokens)},month:{costMicros:Number(t.month_cost),tokens:Number(t.month_tokens)},pendingMicros:Number(t.pending),features:features.rows,circuit:c,limits:await getCostLimits(),dryRun:env.AI_DRY_RUN,mock:env.MOCK_AI};
}
export async function resetCircuit() {
  const db=await pool.connect();let committed=false;
  try {
    await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(706060)');
    const limits=await getCostLimits(db), totals=(await db.query(periodSQL)).rows[0];
    if(Number(totals.unreconciled)>0 || Number(totals.today)>=limits.dailyUsd*1e6*limits.softRatio || Number(totals.month)>=limits.monthlyUsd*1e6*limits.softRatio) throw new BudgetBlocked();
    await db.query("UPDATE system_settings SET setting_value='{\"open\":false,\"failures\":0}'::jsonb WHERE setting_key='ai_circuit'");
    await db.query("INSERT INTO audit_logs(event_type) VALUES('circuit_reset')");
    await db.query('COMMIT');committed=true;
  } finally {if(!committed)await db.query('ROLLBACK');db.release();}
}
