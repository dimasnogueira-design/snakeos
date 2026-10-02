import type { IncomingMessage } from '../types/domain.js';
import type { OrchestratorContext } from '../core/orchestrator.js';
import {
  getContactProfile,
  loadGenericContext,
  loadOpenNegotiationContext,
  retrieveOlderHistory
} from '../db/repository.js';

const VENOM_CONTEXT = `Venom Code é uma empresa de tecnologia e soluções digitais. Atua com sites, automações, presença digital e produtos digitais. O atendimento deve descobrir o problema antes de oferecer solução. Não inventar preço, prazo, portfólio ou condição comercial.`;

export async function buildContextForMessage(message: IncomingMessage): Promise<OrchestratorContext> {
  const profile = await getContactProfile(message.contactId, message.contactName);
  const [generic, negotiation] = await Promise.all([
    loadGenericContext(message.contactId, VENOM_CONTEXT),
    profile.hasOpenNegotiationCase ? loadOpenNegotiationContext(message.contactId) : Promise.resolve(null)
  ]);

  return {
    profile,
    generic: {
      ...generic,
      retrievedMessages: await retrieveOlderHistory(message.contactId,message.text),
      contactName: message.contactName || generic.contactName
    },
    negotiation: negotiation ?? undefined
  };
}
