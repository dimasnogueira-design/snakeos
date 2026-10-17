import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'v1';

function dataKey(): Buffer {
  const configured = process.env.COMMANDER_DATA_KEY;
  if (!configured) throw new Error('Commander data encryption is not configured.');
  const key = /^[a-f\d]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new Error('Commander data encryption key must contain 32 bytes.');
  return key;
}

export function encryptCommanderData(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptCommanderData(value: string): string {
  const [version, ivText, tagText, ciphertextText, extra] = value.split('.');
  if (version !== PREFIX || !ivText || !tagText || ciphertextText === undefined || extra !== undefined) {
    throw new Error('Stored Commander data has an unsupported format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}
