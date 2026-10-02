import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { normalizeForCase, parseWhatsAppExport } from '../src/importers/whatsapp-export.js';

const [, , inputPath, ownerNamesArg = 'Dimas,Dimas Nogueira'] = process.argv;
if (!inputPath) {
  console.error('Uso: npm run import:whatsapp -- /caminho/conversa.txt "Dimas,Dimas Nogueira"');
  process.exit(1);
}

const raw = await readFile(inputPath, 'utf8');
const parsed = parseWhatsAppExport(raw);
const normalized = normalizeForCase(parsed, ownerNamesArg.split(','));
const outputPath = `${inputPath}.snake.json`;

await writeFile(outputPath, JSON.stringify({
  source: basename(inputPath),
  importedAt: new Date().toISOString(),
  messageCount: normalized.length,
  messages: normalized
}, null, 2));

console.log(`Importação preparada: ${normalized.length} mensagens -> ${outputPath}`);
