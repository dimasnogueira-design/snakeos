import { describe, expect, it } from 'vitest';
import { detectCommitmentLanguage } from '../src/policies/postflight.js';

describe('postflight', () => {
  it('detecta promessa explícita', () => {
    expect(detectCommitmentLanguage('Amanhã eu pago R$ 500')).toBe(true);
  });

  it('não trata atualização neutra como promessa', () => {
    expect(detectCommitmentLanguage('Assim que o documento sair eu te aviso aqui.')).toBe(false);
  });
});
