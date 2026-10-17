import { afterEach, describe, expect, it } from 'vitest';
import { decryptCommanderData, encryptCommanderData } from './crypto.js';

const oldKey = process.env.COMMANDER_DATA_KEY;
afterEach(() => { if (oldKey === undefined) delete process.env.COMMANDER_DATA_KEY; else process.env.COMMANDER_DATA_KEY = oldKey; });

describe('Commander mission encryption', () => {
  it('encrypts and decrypts mission text with authenticated AES-GCM', () => {
    process.env.COMMANDER_DATA_KEY = '11'.repeat(32);
    const text = 'Organizar meu e-mail privado';
    const encrypted = encryptCommanderData(text);
    expect(encrypted).not.toContain(text);
    expect(decryptCommanderData(encrypted)).toBe(text);
  });

  it('rejects a missing or malformed key and tampered ciphertext', () => {
    delete process.env.COMMANDER_DATA_KEY;
    expect(() => encryptCommanderData('privado')).toThrow('not configured');
    process.env.COMMANDER_DATA_KEY = 'too-short';
    expect(() => encryptCommanderData('privado')).toThrow('32 bytes');
    process.env.COMMANDER_DATA_KEY = '22'.repeat(32);
    const parts = encryptCommanderData('privado').split('.');
    parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;
    const encrypted = parts.join('.');
    expect(() => decryptCommanderData(encrypted)).toThrow();
  });
});
