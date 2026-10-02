import { handleIncoming } from '../src/core/orchestrator.js';
import type { IncomingMessage } from '../src/types/domain.js';

const now = new Date().toISOString();

const samples: Array<{ label: string; message: IncomingMessage; context: any }> = [
  {
    label: 'Lead Venom',
    message: { contactId: 'lead-1', contactName: 'Novo Lead', chatId: 'lead-1', isGroup: false, text: 'Quero fazer um e-commerce. Quanto custa?', timestamp: now },
    context: {
      profile: { contactId: 'lead-1', displayName: 'Novo Lead', defaultMode: 'unknown', isProtected: false },
      generic: { contactName: 'Novo Lead', recentMessages: [] }
    }
  },
  {
    label: 'Amigo',
    message: { contactId: 'friend-1', contactName: 'Amigo', chatId: 'friend-1', isGroup: false, text: 'Fala mano, beleza?', timestamp: now },
    context: {
      profile: { contactId: 'friend-1', displayName: 'Amigo', defaultMode: 'personal', isProtected: false },
      generic: { contactName: 'Amigo', recentMessages: [] }
    }
  },
  {
    label: 'Rafaella',
    message: { contactId: 'rafa', contactName: 'Rafaella', chatId: 'rafa', isGroup: false, text: 'Oi', timestamp: now },
    context: {
      profile: { contactId: 'rafa', displayName: 'Rafaella', defaultMode: 'protected', isProtected: true },
      generic: { contactName: 'Rafaella', recentMessages: [] }
    }
  }
];

for (const sample of samples) {
  const result = await handleIncoming(sample.message, sample.context);
  console.log(`\n=== ${sample.label} ===`);
  console.log(JSON.stringify(result, null, 2));
}
