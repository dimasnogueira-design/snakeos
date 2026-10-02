import { env } from '../config/env.js';
import type { IncomingMessage, PreflightResult } from '../types/domain.js';

export function preflight(message: IncomingMessage): PreflightResult {
  if (message.isGroup || message.chatId.endsWith('@g.us') || message.contactId.endsWith('@g.us')) return { allowed: false, reason: 'group' };
  if (message.fromMe) return { allowed: false, reason: 'from_me' };

  const protectedById = env.protectedContactIds.includes(message.contactId);
  const normalizedName = (message.contactName ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const protectedByName = env.protectedContactNames.some(n => normalizedName === n || normalizedName.startsWith(`${n} `));
  if (protectedById || protectedByName) return { allowed: false, reason: 'protected_contact' };
  if (!message.text.trim() && message.mediaType !== 'audio') return { allowed: false, reason: 'empty_message' };

  return { allowed: true };
}
