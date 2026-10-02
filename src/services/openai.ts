import type { AgentDecision,CaseContext } from '../types/domain.js';
import { handleIncoming } from '../core/orchestrator.js';
export async function getAgentDecision(context:CaseContext,incoming:string):Promise<AgentDecision> {
  const r=await handleIncoming({contactId:context.contactId,chatId:context.contactId,contactName:context.contactName,isGroup:false,text:incoming,timestamp:new Date().toISOString()},
    {profile:{contactId:context.contactId,defaultMode:'negotiation',isProtected:false,hasOpenNegotiationCase:true},
      generic:{contactId:context.contactId,contactName:context.contactName,recentMessages:context.recentMessages,knownFacts:context.confirmedFacts},negotiation:context});
  return {intent:'collection',risk:r.risk??'high',counterpartyNeed:'Revisão do histórico',strategy:r.strategy??'Revisar fatos',reply:r.reply??'Recebi. Estou conferindo esse ponto.',
    createsCommitment:false,commitmentDescription:null,requiresApproval:true,reasonForApproval:'Negociação exige revisão humana.',factsUsed:[]};
}
