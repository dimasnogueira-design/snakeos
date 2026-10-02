import { describe,it,expect } from 'vitest';
import { validateReply,mergeMemory } from '../src/policies/output-safety.js';
import { emptyMemory } from '../src/memory/compact.js';
import { localReply } from '../src/core/orchestrator.js';
import { splitWhatsAppBubbles } from '../src/core/message-style.js';
describe('customer safety and briefing preservation',()=>{
  it('blocks technical errors and phone disclosure',()=>{
    expect(validateReply('OpenAI timeout: Error 500','low',false).reply).toBeNull();
    expect(validateReply('Telefone: +55 11 99999-9999','low',false).reply).toBeNull();
    expect(validateReply('Vou pagar R$ 500 amanhã','low',false).requiresApproval).toBe(true);
    expect(validateReply('Recebi sua mensagem','high',false).requiresApproval).toBe(true);
  });
  it('never turns a generated allegation into a confirmed fact or loses prior briefing',()=>{
    const prior={...emptyMemory(),goal:'Site clínica',facts:[{key:'dominio',value:'clinic.test',source:'admin',confirmed:true}],openQuestions:['Qual prazo?']};
    const next={...emptyMemory(),facts:[{key:'invented',value:'R$ 1000',source:'incoming',confirmed:true},{key:'objetivo',value:'site',source:'incoming',confirmed:true}]};
    const result=mergeMemory(prior,next,'Quero um site','event');
    expect(result.facts.find(f=>f.key==='dominio')?.confirmed).toBe(true);
    expect(result.facts.some(f=>f.key==='invented')).toBe(false);
    expect(result.facts.find(f=>f.key==='objetivo')?.confirmed).toBe(false);
    expect(result.goal).toBe('Site clínica');
    expect(result.openQuestions).toContain('Qual prazo?');
  });
  it('provides local personal email and refuses personal phones',()=>{
    expect(localReply('Quero falar com Dimas sobre um assunto pessoal')).toContain('venomcodeos@gmail.com');
    expect(localReply('Qual o telefone pessoal do Christian?')).not.toMatch(/\d{8}/);
  });
  it('splits into at most three bubbles without discarding content',()=>{
    const parts=splitWhatsAppBubbles('Um.\n\nDois.\n\nTrês.\n\nQuatro.');
    expect(parts.length).toBeLessThanOrEqual(3);expect(parts.join(' ')).toContain('Quatro.');
  });
});
