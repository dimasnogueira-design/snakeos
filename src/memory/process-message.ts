import { env } from '../config/env.js';
import { handleIncoming } from '../core/orchestrator.js';
import type { IncomingMessage } from '../types/domain.js';
import { findOpenCaseId,getContactAutomationState,saveMessage,saveMemory,alertAdmin,setContactAutomationPaused,setContactMode,isProtectedContact } from '../db/repository.js';
import { buildContextForMessage } from './context-builder.js';
import { acquireContactLease,releaseContactLease,claimEvent,ingressGate,eventKey } from './ingress.js';
import { pool } from '../db/pool.js';
import { BudgetBlocked } from '../cost/budget.js';
export async function processIncomingMessage(message:IncomingMessage) {
  const gate=await ingressGate(message);
  if(!gate.allowed) {
    if(gate.reason==='contact_takeover'||gate.reason==='global_pause'){
      // Keep the handoff history while the human is in control. No AI or draft.
      if(await claimEvent(message))await saveMessage(message,{caseId:await findOpenCaseId(message.contactId)});
    }
    if('notify' in gate && gate.notify) await alertAdmin(undefined,'important_system_notification');
    return {ignored:true,reason:gate.reason,autoSend:false,reply:null};
  }
  const token=await acquireContactLease(message.contactId);
  if(!token) return {ignored:true,reason:'contact_busy',autoSend:false,reply:null};
  try {
    if(!await claimEvent(message)) return {ignored:true,reason:'duplicate',autoSend:false,reply:null};
    const caseId=await findOpenCaseId(message.contactId);
    const source=await saveMessage(message,{caseId});
    const context=await buildContextForMessage(message);
    const decision=await handleIncoming(message,context);
    if(decision.memory) {
      const previous=context.generic.memory;
      if(previous&&previous.persona!==decision.memory.persona) await pool.query(`INSERT INTO handoffs(contact_id,source_message_id,from_persona,to_persona,context_packet)
        VALUES($1,$2,$3,$4,$5::jsonb)`,[source.contact_id,source.id,previous.persona,decision.memory.persona,
          JSON.stringify({from:previous.persona,to:decision.memory.persona,reason:decision.route.intent,briefing:previous,next:decision.memory,lastIntent:message.text,recent:context.generic.recentMessages})]);
      await saveMemory(message.contactId,decision.memory);
    }
    // Reuse known classification; only persist a new material route with high confidence.
    if(decision.route.confidence==='high' && decision.mode!==context.profile.defaultMode && !['protected','system','unknown'].includes(decision.mode)) await setContactMode(message.contactId,decision.mode);
    await pool.query(`INSERT INTO agent_decisions(contact_id,case_id,source_message_id,intent,risk,strategy,proposed_reply,requires_approval,raw_decision,reply_parts)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,[source.contact_id,caseId,source.id,decision.route.intent,decision.risk??'low',decision.strategy??'local',decision.reply??'',decision.requiresApproval,JSON.stringify(decision),JSON.stringify(decision.replyParts??[])]);
    await pool.query("INSERT INTO audit_logs(event_type,payload) VALUES('message_decision',jsonb_build_object('messageId',$1::text,'requiresApproval',$2::boolean))",[source.id,decision.requiresApproval]);
    if(decision.requiresApproval && !decision.dryRun) {
      await alertAdmin(message.contactId,'human_review_required');
      await setContactAutomationPaused(message.contactId,true);
    }
    const control=await getContactAutomationState(message.contactId);
    const canAutoSend=control.mode==='autonomous'&&!control.paused&&env.AUTO_SEND&&env.QA_APPROVED&&env.AUTONOMOUS_AUTHORIZED&&decision.autoSend
      &&!await isProtectedContact(message.contactId,message.contactName);
    let deliveryId:string|undefined;
    if(canAutoSend) {
      const r=await pool.query('INSERT INTO delivery_jobs(source_message_id,contact_id,parts) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING RETURNING id',[source.id,source.contact_id,JSON.stringify(decision.replyParts)]);
      deliveryId=r.rows[0]?.id;
    }
    await pool.query("UPDATE ingress_events SET status='complete' WHERE event_key=$1",[eventKey(message)]);
    return {ignored:false,automationMode:control.mode,...decision,autoSend:canAutoSend&&Boolean(deliveryId),deliveryId};
  } catch(error) {
    const budget=error instanceof BudgetBlocked;
    await alertAdmin(message.contactId,budget?'budget_blocked':'processing_failed');
    if(!budget) await setContactAutomationPaused(message.contactId,true);
    return {ignored:false,reason:budget?'budget_blocked':'review_required',reply:null,replyParts:[],autoSend:false,requiresApproval:true};
  } finally {await releaseContactLease(message.contactId,token);}
}
