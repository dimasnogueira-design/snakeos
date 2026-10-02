import type { CaseContext, ChannelDecision, ContactProfile, GenericContext, IncomingMessage } from '../types/domain.js';
import { preflight } from '../policies/preflight.js';
import { routeMessage } from './router.js';
import { env } from '../config/env.js';
import { splitWhatsAppBubbles } from './message-style.js';
import { selectTier } from '../cost/pricing.js';
import { buildCompactInput, emptyMemory, toneFor } from '../memory/compact.js';
import { generateJoint } from '../services/intelligence.js';
import { mergeMemory, validateReply } from '../policies/output-safety.js';
export interface OrchestratorContext {profile:ContactProfile;generic:GenericContext;negotiation?:CaseContext;}
export function localReply(text:string):string|null {
  if(/(?:telefone|n[uú]mero|whatsapp).*(?:pessoal|dimas|christian|jully)|(?:pessoal).*(?:telefone|n[uú]mero)/i.test(text)) return 'Os contatos pessoais da equipe não são disponibilizados. Seguimos o atendimento por este canal.';
  if(/dimas/i.test(text) && /pessoal|falar|contato|chama|cad[eê]/i.test(text)) return 'Assuntos pessoais com Dimas podem ser tratados pelo e-mail venomcodeos@gmail.com.';
  if(/(?:voc[eê]|isso|atendimento).*(?:rob[oô]|automatiz|intelig[eê]ncia artificial|\bia\b)/i.test(text)) return 'Este atendimento utiliza automação da Venom Code. Você pode solicitar atendimento humano.';
  if(/^(?:ok|okay|beleza|obrigad[oa]|valeu|certo|entendi|👍|🙏)[.!\s]*$/i.test(text.trim())) return 'Recebido, obrigado!';
  return null;
}
export async function handleIncoming(message:IncomingMessage,context:OrchestratorContext,options?:{estimateOnly?:boolean}):Promise<ChannelDecision> {
  const route=routeMessage(message,context.profile), gate=preflight(message);
  if(!gate.allowed || !route.shouldRespond) return {mode:route.mode,route,reply:null,replyParts:[],requiresApproval:false,autoSend:false,reason:gate.reason};
  const local=localReply(message.text);
  if(local) return {mode:route.mode,route,reply:local,replyParts:splitWhatsAppBubbles(local),requiresApproval:false,autoSend:env.AUTO_SEND,risk:'low'};
  const prior=context.generic.memory??emptyMemory();
  const persona=route.mode==='venom_sales'?'CHRISTIAN':'JULLY';
  const generic={...context.generic,memory:{...prior,tone:toneFor(message.text)}};
  const packed=buildCompactInput(generic,message.text);
  const caseData=context.negotiation?{id:context.negotiation.caseId,summary:context.negotiation.summary.slice(0,1500),
    confirmedFacts:context.negotiation.confirmedFacts.slice(0,24),mandate:context.negotiation.mandate,
    claimedAmountCents:context.negotiation.claimedAmountCents,confirmedAmountCents:context.negotiation.confirmedAmountCents}:undefined;
  const input=JSON.stringify({mode:route.mode,persona,context:JSON.parse(packed),case:caseData});
  if(Buffer.byteLength(input)>env.AI_CONTEXT_MAX_BYTES+6000) throw new Error('context_too_large');
  const tier=selectTier(route.mode,route.intent,message.text,route.confidence);
  const result=await generateJoint({model:tier==='strong'?(env.OPENAI_MODEL_NEGOTIATION||'gpt-4.1'):(env.OPENAI_MODEL_FAST||'gpt-4.1-mini'),
    purpose:`response:${tier}:${route.mode}`,externalId:message.contactId,caseId:context.negotiation?.caseId,input,memory:generic.memory,persona,estimateOnly:options?.estimateOnly});
  const memory=mergeMemory(prior,result.memory,message.text,message.externalMessageId??message.timestamp);
  memory.persona=persona;memory.tone=toneFor(message.text);
  const highRisk=route.mode==='negotiation'||route.confidence==='low'|| /d[ií]vida|cobran[cç]a|calote|advogado|processo|enganando|mentindo|reembolso|contrato/i.test(message.text);
  const safety=validateReply(result.reply,result.risk,result.requiresApproval||highRisk||Boolean(context.negotiation));
  return {mode:route.mode,route,reply:safety.reply,replyParts:safety.reply?splitWhatsAppBubbles(safety.reply):[],memory,
    requiresApproval:safety.requiresApproval,autoSend:env.AUTO_SEND&&!safety.requiresApproval&&!result.dryRun,
    risk:highRisk?'high':result.risk,estimate:result.estimate,dryRun:result.dryRun,strategy:result.nextAction};
}
