import { describe, expect, it } from 'vitest';
import { planCommanderMission } from './planner.js';

describe('Commander mission planning', () => {
  it('routes email financial triage to private specialist agents and QA', () => {
    const plan = planCommanderMission('Ler os e-mails de cobrança, organizar vencimentos e preparar respostas para revisão.');
    expect(plan.domain).toBe('private_operations');
    expect(plan.jobs.map(job => job.agentId)).toEqual(['COMMANDER', 'GMAIL_SECRETARY', 'COLLECTION_TRACKER', 'FINANCE_PRIVATE', 'QA_DIRECTOR']);
    expect(plan.jobs.every(job => !job.externalAction)).toBe(true);
    expect(plan.jobs.some(job => job.requiresDirectorReview)).toBe(true);
  });

  it('keeps WhatsApp conflict replies in human review', () => {
    const plan = planCommanderMission('Responder conversa difícil no WhatsApp e mediar o conflito.');
    expect(plan.jobs.map(job => job.agentId)).toEqual(['COMMANDER', 'SNAKE_WHATSAPP', 'CONFLICT_MANAGER', 'QA_DIRECTOR']);
    expect(plan.jobs.find(job => job.agentId === 'CONFLICT_MANAGER')?.requiresDirectorReview).toBe(true);
  });

  it('plans commercial research in the later phase without enabling delivery', () => {
    const plan = planCommanderMission('Pesquisar leads de empresas, auditar site e criar protótipo para revisão.');
    expect(plan.domain).toBe('commercial_research');
    expect(plan.jobs.map(job => job.agentId)).toEqual(['COMMANDER', 'WEB_HUNTER', 'DIGITAL_AUDITOR', 'PROTOTYPE_FACTORY']);
    expect(plan.jobs.every(job => !job.externalAction)).toBe(true);
  });

  it('rejects empty and oversized missions', () => {
    expect(() => planCommanderMission('  ')).toThrow('não pode ficar vazia');
    expect(() => planCommanderMission('x'.repeat(4001))).toThrow('4.000 caracteres');
  });

  it('uses Commander as the mandatory first point of contact', () => {
    const plan = planCommanderMission('Organizar minha semana.');
    expect(plan.domain).toBe('director_operations');
    expect(plan.jobs.map(job => job.agentId)).toEqual(['COMMANDER']);
  });
});
