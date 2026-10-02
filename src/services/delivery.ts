import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { isProtectedContact,getContactAutomationState,saveMessage,alertAdmin } from '../db/repository.js';
import { preflight } from '../policies/preflight.js';
export async function claimDeliveryPart(jobId:string,index:number) {
  const r=await pool.query(`SELECT j.*,c.external_id,c.display_name FROM delivery_jobs j JOIN contacts c ON c.id=j.contact_id WHERE j.id=$1`,[jobId]);
  const job=r.rows[0]; if(!job) return {allowed:false};
  const control=await getContactAutomationState(job.external_id);
  const c=(await pool.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_circuit'")).rows[0]?.setting_value;
  const gate=preflight({contactId:job.external_id,contactName:job.display_name,chatId:job.external_id,isGroup:false,text:'delivery',timestamp:new Date().toISOString()});
  if(!env.AUTO_SEND||!env.QA_APPROVED||!env.AUTONOMOUS_AUTHORIZED||env.AI_DRY_RUN||env.MOCK_AI||control.mode!=='autonomous'||control.paused||c?.open||!gate.allowed||await isProtectedContact(job.external_id,job.display_name)) return {allowed:false};
  const claimed=await pool.query(`UPDATE delivery_jobs SET status='in_flight' WHERE id=$1 AND status='pending' AND next_part=$2 AND expires_at>now() RETURNING *`,[jobId,index]);
  if(!claimed.rows.length||!job.parts[index]) return {allowed:false};
  return {allowed:true,text:String(job.parts[index]),contactId:job.external_id};
}
export async function ackDelivery(jobId:string,index:number,args:{externalMessageId?:string;failed?:boolean}) {
  const r=await pool.query(`UPDATE delivery_jobs SET status=CASE WHEN $3::boolean THEN 'uncertain' WHEN next_part+1>=jsonb_array_length(parts) THEN 'complete' ELSE 'pending' END,
    next_part=CASE WHEN $3::boolean THEN next_part ELSE next_part+1 END WHERE id=$1 AND next_part=$2 AND status='in_flight'
    RETURNING *, (SELECT external_id FROM contacts WHERE id=delivery_jobs.contact_id) AS external_id`,[jobId,index,Boolean(args.failed)]);
  const job=r.rows[0];if(!job)return;
  if(args.failed) {await alertAdmin(job.external_id,'delivery_uncertain');return;}
  await saveMessage({externalMessageId:args.externalMessageId??`delivery:${jobId}:${index}`,contactId:job.external_id,chatId:job.external_id,isGroup:false,fromMe:true,text:job.parts[index],timestamp:new Date().toISOString()},{author:'agent'});
}
