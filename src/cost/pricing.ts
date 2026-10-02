// USD microdollars; rates per million tokens. Unknown model => fail closed.
const prices: Record<string, {input:number;cached:number;output:number}> = {
  'gpt-4.1-mini': {input:.4,cached:.1,output:1.6},
  'gpt-4.1-mini-2025-04-14': {input:.4,cached:.1,output:1.6},
  'gpt-4.1': {input:2,cached:.5,output:8},
  'gpt-4.1-2025-04-14': {input:2,cached:.5,output:8}
};
export function calculateCost(model:string,input:number,output:number,cached=0) {
  const p=prices[model]; if(!p) throw new Error('unpriced_model');
  if([input,output,cached].some(n=>!Number.isFinite(n)||n<0)||cached>input) throw new Error('invalid_usage');
  return Math.ceil((input-cached)*p.input+cached*p.cached+output*p.output);
}
export function estimateText(model:string,payload:string,maxOutputTokens:number) {
  const bytes=Buffer.byteLength(payload,'utf8');
  // 1 token/byte + 512 framing/schema margin, deliberately pessimistic.
  const upper=bytes+512;
  return {model,inputTokensEstimate:Math.ceil(bytes/3),inputTokensUpperBound:upper,maxOutputTokens,
    maxCostMicros:calculateCost(model,upper,maxOutputTokens)};
}
export function selectTier(mode:string,intent:string,text:string,confidence:string) {
  return mode==='negotiation' || mode==='unknown' || confidence==='low' || ['conflict','legal'].includes(intent)
    || /estrat[eé]gia|convers[aã]o|funil|campanha|contrato|d[ií]vida|cobran[cç]a|pagamento|processo|calote|enganando|mentindo|reembolso|cancelamento|garantia/i.test(text)
    ? 'strong' : 'fast';
}
