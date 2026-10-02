import { describe, it, expect } from 'vitest';
import { estimateText, calculateCost, selectTier } from '../src/cost/pricing.js';
import { buildCompactInput } from '../src/memory/compact.js';
import { preflight } from '../src/policies/preflight.js';
import { detectSystemMessage } from '../src/core/system-detector.js';
const message = { contactId:'a', chatId:'a', isGroup:false, text:'oi', timestamp:'2026-10-02T12:00:00Z' };
describe('zero-cost gates and conservative pricing', () => {
  it('rejects disguised groups and own messages', () => {
    expect(preflight({...message, chatId:'123@g.us'}).allowed).toBe(false);
    expect(preflight({...message, fromMe:true}).allowed).toBe(false);
  });
  it('protects Rafaella even with a surname or accent', () => {
    expect(preflight({...message, contactName:'Rafáella Silva'}).allowed).toBe(false);
  });
  it('identifies bare codes and WhatsApp system messages', () => {
    expect(detectSystemMessage('123-456').category).toBe('otp');
    expect(detectSystemMessage('As mensagens e ligações são protegidas com a criptografia de ponta a ponta').isSystem).toBe(true);
    expect(detectSystemMessage('Quero negociar minha dívida com desconto').isSystem).toBe(false);
  });
  it('calculates cached input separately without double charging', () => {
    expect(calculateCost('gpt-4.1-mini',1000,100,400)).toBe(440);
    expect(() => calculateCost('unknown',100,10)).toThrow();
  });
  it('reserves an upper bound with no assumed provider cache hit', () => {
    const e = estimateText('gpt-4.1-mini','olá',100);
    expect(e.inputTokensUpperBound).toBeGreaterThanOrEqual(4);
    expect(e.maxCostMicros).toBeGreaterThanOrEqual(160);
  });
  it('routes ambiguity, conflict and sales strategy to strong tier', () => {
    expect(selectTier('unknown','unknown','me ajuda','low')).toBe('strong');
    expect(selectTier('venom_support','support','ajustar cor','high')).toBe('fast');
    expect(selectTier('venom_sales','sales','estratégia para converter','high')).toBe('strong');
    expect(selectTier('personal','personal','você está me enganando','high')).toBe('strong');
  });
  it('bounds recent history and excludes the current message duplicate', () => {
    const recentMessages = Array.from({length:80},(_,i)=>({role:'counterparty' as const,text:`old-${i} ${'x'.repeat(5000)}`}));
    recentMessages.push({role:'counterparty',text:'current'});
    const packed = buildCompactInput({contactName:'Cliente',recentMessages},'current');
    const data=JSON.parse(packed);
    expect(data.recent.length).toBeLessThanOrEqual(16);
    expect(data.recent.some((m:any)=>m.text==='old-0')).toBe(false);
    expect(data.recent.filter((m:any)=>m.text==='current')).toHaveLength(0);
    expect(packed.length).toBeLessThanOrEqual(18000);
  });
});
