import {describe,it,expect} from 'vitest';
import {parseExportDate,mediaReference} from '../src/importers/history.js';
import {parseWhatsAppExport} from '../src/importers/whatsapp-export.js';
describe('historical source data without invented dates',()=>{
  it('preserves actual Brazilian export dates with explicit timezone',()=>{
    expect(parseExportDate('02/10/2026, 14:10:22','-03:00')).toBe('2026-10-02T17:10:22.000Z');
    expect(()=>parseExportDate('31/02/2026, 10:00','-03:00')).toThrow();
  });
  it('recognizes real media names and rejects traversal',()=>{
    expect(mediaReference('PTT-20261002-WA0001.opus (arquivo anexado)')).toBe('PTT-20261002-WA0001.opus');
    expect(mediaReference('../secret.txt (arquivo anexado)')).toBeNull();
  });
  it('parses Unicode-marked exports and multiline content',()=>{
    const m=parseWhatsAppExport('\u200e[02/10/2026, 14:10:22] Cliente: Olá\nJá tenho domínio.');
    expect(m).toHaveLength(1);expect(m[0].text).toContain('Já tenho domínio.');
  });
});
