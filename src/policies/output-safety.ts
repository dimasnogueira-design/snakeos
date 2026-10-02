import type { ConversationMemory } from '../types/domain.js';
export function validateReply(reply:string,risk:string,requiresApproval:boolean) {
  const prohibited=/\b(?:error\s*\d|stack trace|openai|timeout|postgres|undefined|exception|api key|sou (?:uma pessoa|humano))\b|(?:\+?\d[\d ()-]{8,}\d)/i;
  const commitment=/\b(?:garanto|prometo|fica combinado|pago|pagarei|transfiro|deposito|vou (?:pagar|entregar|publicar)|entrega (?:hoje|amanh[aã])|j[aá] (?:emitido|pago|corrigido|publicado))\b|R\$\s*\d|\d{1,2}\/\d{1,2}/i;
  const blocked=prohibited.test(reply);
  return {reply:blocked?null:reply,requiresApproval:requiresApproval||blocked||commitment.test(reply)||risk!=='low',blocked};
}
export function mergeMemory(previous:ConversationMemory,next:ConversationMemory,incoming:string,sourceId:string):ConversationMemory {
  const facts=[...previous.facts];
  for(const f of next.facts) {
    if(facts.some(old=>old.key===f.key && old.value===f.value)) continue;
    if(incoming.includes(f.value)) facts.push({...f,source:sourceId,confirmed:false});
  }
  const commitments=[...previous.commitments];
  for(const c of next.commitments) if(incoming.includes(c.text)&&!commitments.some(old=>old.text===c.text)) commitments.push({...c,source:sourceId,confirmed:false});
  const openQuestions=[...new Set([...previous.openQuestions,...next.openQuestions])];
  if(facts.length>24||commitments.length>12||openQuestions.length>12) throw new Error('memory_capacity_requires_review');
  return {...next,goal:next.goal||previous.goal,pain:next.pain||previous.pain,summary:next.summary||previous.summary,facts,commitments,openQuestions,decisions:[...new Set([...previous.decisions,...next.decisions])].slice(0,12)};
}
