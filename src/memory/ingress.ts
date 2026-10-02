import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { preflight } from '../policies/preflight.js';
import { detectSystemMessage } from '../core/system-detector.js';
import { isProtectedContact,getContactAutomationState } from '../db/repository.js';
import type { IncomingMessage } from '../types/domain.js';
export function eventKey(message:IncomingMessage) {
  return createHash('sha256').update(JSON.stringify([message.contactId,message.externalMessageId??[message.timestamp,message.text,message.mediaType]])).digest('hex');
}
export async function ingressGate(message:IncomingMessage) {
  const gate=preflight(message);if(!gate.allowed) return gate;
  if(await isProtectedContact(message.contactId,message.contactName)) return {allowed:false,reason:'protected_contact'};
  const system=detectSystemMessage(message.text);
  if(system.isSystem) return {allowed:false,reason:system.category??'system',notify:system.severity==='important'};
  const control=await getContactAutomationState(message.contactId);
  if(control.paused||control.mode==='paused') return {allowed:false,reason:control.paused?'contact_takeover':'global_pause'};
  return {allowed:true,reason:undefined};
}
export async function acquireContactLease(externalId:string) {
  const token=randomUUID();
  const r=await pool.query(`INSERT INTO contact_leases(external_id,token,expires_at) VALUES($1,$2,now()+interval '90 seconds')
    ON CONFLICT(external_id) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE contact_leases.expires_at<now() RETURNING token`,[externalId,token]);
  return r.rows.length?token:null;
}
export async function releaseContactLease(externalId:string,token:string){await pool.query('DELETE FROM contact_leases WHERE external_id=$1 AND token=$2',[externalId,token]);}
export async function claimEvent(message:IncomingMessage) {
  const r=await pool.query('INSERT INTO ingress_events(event_key,contact_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_key',[eventKey(message),message.contactId]);
  return r.rows.length>0;
}
