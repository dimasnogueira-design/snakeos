import { describe, expect, it } from 'vitest';
import { normalizeForCase, parseWhatsAppExport } from '../src/importers/whatsapp-export.js';

describe('WhatsApp export parser', () => {
  it('lê mensagens e continuação de linha', () => {
    const text = `02/10/2026, 09:10 - Daniel: Deu certo já?\n02/10/2026, 09:11 - Dimas: Estou aguardando o documento\ne te aviso assim que sair.`;
    const parsed = parseWhatsAppExport(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].text).toContain('e te aviso');
    const normalized = normalizeForCase(parsed, ['Dimas']);
    expect(normalized[0].role).toBe('counterparty');
    expect(normalized[1].role).toBe('dimas');
  });
});
