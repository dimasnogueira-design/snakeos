import { describe, expect, it } from 'vitest';
import { preflight } from '../src/policies/preflight.js';

const base = {
  contactId: 'x',
  chatId: 'x',
  isGroup: false,
  text: 'oi',
  timestamp: new Date().toISOString()
};

describe('preflight', () => {
  it('bloqueia grupos antes da IA', () => {
    expect(preflight({ ...base, isGroup: true })).toEqual({ allowed: false, reason: 'group' });
  });

  it('bloqueia Rafaella pelo nome em modo seguro', () => {
    expect(preflight({ ...base, contactName: 'Rafaella' })).toEqual({ allowed: false, reason: 'protected_contact' });
  });

  it('permite contato comum', () => {
    expect(preflight({ ...base, contactName: 'Daniel' })).toEqual({ allowed: true });
  });
});
