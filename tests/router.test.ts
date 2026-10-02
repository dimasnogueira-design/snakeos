import { describe, expect, it } from 'vitest';
import { routeMessage } from '../src/core/router.js';
import type { ContactProfile, IncomingMessage } from '../src/types/domain.js';

const baseMessage: IncomingMessage = {
  contactId: '1', chatId: 'chat', isGroup: false, text: 'oi', timestamp: new Date().toISOString()
};

function profile(p: Partial<ContactProfile> = {}): ContactProfile {
  return { contactId: '1', defaultMode: 'unknown', isProtected: false, ...p };
}

describe('SNAKE OS router', () => {
  it('bloqueia contato protegido', () => {
    const r = routeMessage(baseMessage, profile({ isProtected: true }));
    expect(r.mode).toBe('protected');
    expect(r.shouldRespond).toBe(false);
  });

  it('manda lead para Snake Comercial', () => {
    const r = routeMessage({ ...baseMessage, text: 'Quero fazer um site para minha empresa' }, profile());
    expect(r.mode).toBe('venom_sales');
  });

  it('manda cobrança conhecida para Seu Dimas', () => {
    const r = routeMessage({ ...baseMessage, text: 'E o pagamento, quando você vai pagar?' }, profile({ defaultMode: 'negotiation', hasOpenNegotiationCase: true }));
    expect(r.mode).toBe('negotiation');
    expect(r.needsCaseContext).toBe(true);
  });

  it('mantém amigo conhecido no modo pessoal', () => {
    const r = routeMessage({ ...baseMessage, text: 'fala mano, beleza?' }, profile({ defaultMode: 'personal' }));
    expect(r.mode).toBe('personal');
  });

  it('permite que um amigo com intenção comercial entre em vendas', () => {
    const r = routeMessage({ ...baseMessage, text: 'mano quanto custa fazer um site?' }, profile({ defaultMode: 'personal' }));
    expect(r.mode).toBe('venom_sales');
  });
});
