import { describe, expect, it } from 'vitest';
import { detectSystemMessage } from '../src/core/system-detector.js';
import { splitWhatsAppBubbles } from '../src/core/message-style.js';

describe('system detector', () => {
  it('blocks OTP without IA', () => {
    expect(detectSystemMessage('Seu código de segurança é 123456. Não compartilhe este código.').category).toBe('otp');
  });
  it('detects automatic bank message', () => {
    const r = detectSystemMessage('Santander: mensagem automática. Sua parcela está em atraso. Não responda esta mensagem.');
    expect(r.category).toBe('bank_auto');
    expect(r.severity).toBe('important');
  });
});

describe('WhatsApp bubbles', () => {
  it('keeps short replies compact', () => {
    expect(splitWhatsAppBubbles('Fala, mano! Tudo certo?')).toEqual(['Fala, mano! Tudo certo?']);
  });
  it('splits long text', () => {
    const parts = splitWhatsAppBubbles('Primeira frase bem curta. Segunda frase também curta. Terceira frase para completar.', 35, 4);
    expect(parts.length).toBeGreaterThan(1);
  });
});
