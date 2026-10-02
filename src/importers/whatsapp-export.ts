export interface ParsedWhatsAppMessage {
  occurredAtRaw: string;
  author: string | null;
  text: string;
  isSystem: boolean;
}

// Aceita formatos comuns de exportação do WhatsApp, por exemplo:
// 02/10/2026, 14:10 - Daniel: Deu certo?
// [02/10/2026, 14:10:22] Daniel: Deu certo?
const patterns = [
  /^(\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s?(.*)$/,
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s?(.*)$/
];

const systemPatterns = [
  /^(\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(.*)$/,
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/
];

export function parseWhatsAppExport(input: string): ParsedWhatsAppMessage[] {
  const lines = input.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g,'').replace(/\r\n/g, '\n').split('\n');
  const messages: ParsedWhatsAppMessage[] = [];
  let current: ParsedWhatsAppMessage | null = null;

  const pushCurrent = () => {
    if (current) messages.push({ ...current, text: current.text.trimEnd() });
    current = null;
  };

  for (const line of lines) {
    let matched = false;

    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (m) {
        pushCurrent();
        current = { occurredAtRaw: m[1], author: m[2].trim(), text: m[3] ?? '', isSystem: false };
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const pattern of systemPatterns) {
      const m = line.match(pattern);
      if (m) {
        pushCurrent();
        current = { occurredAtRaw: m[1], author: null, text: m[2] ?? '', isSystem: true };
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (current) current.text += `${current.text ? '\n' : ''}${line}`;
  }

  pushCurrent();
  return messages;
}

export function normalizeForCase(
  messages: ParsedWhatsAppMessage[],
  ownerNames: string[]
): Array<{ role: 'dimas' | 'counterparty'; text: string; at: string }> {
  const owners = new Set(ownerNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  return messages
    .filter((m) => !m.isSystem && m.author && m.text.trim())
    .map((m) => ({
      role: owners.has(m.author!.trim().toLowerCase()) ? 'dimas' as const : 'counterparty' as const,
      text: m.text.trim(),
      at: m.occurredAtRaw
    }));
}
