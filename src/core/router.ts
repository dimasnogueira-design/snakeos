import type { ContactProfile, IncomingMessage, RouteDecision, RoutedIntent } from '../types/domain.js';
import { detectSystemMessage } from './system-detector.js';

const salesPatterns = [
  /\b(site|website|landing page|e-?commerce|loja virtual|automa[cç][aã]o|sistema|app|aplicativo|or[cç]amento|proposta|quanto custa|valor do site|venom)\b/i,
  /\b(quero contratar|preciso de um site|preciso de uma loja|fazer um site|desenvolver)\b/i
];
const supportPatterns = [/\b(erro|bug|ajuste|altera[cç][aã]o|dom[ií]nio|hospedagem|publica[cç][aã]o|meu site|nosso site|projeto)\b/i];
const collectionPatterns = [/\b(me deve|devendo|d[ií]vida|cobran[cç]a|pagamento|pagar|pagou|pix|transfer[eê]ncia|parcela|acordo|prazo combinado)\b/i];
const legalPatterns = [/\b(advogado|a[cç][aã]o judicial|processo|protesto|notifica[cç][aã]o|cart[oó]rio|jur[ií]dico)\b/i];
const conflictPatterns = [/\b(enrolando|enganando|mentindo|mentiroso|calote|caloteiro|absurdo|irrespons[aá]vel)\b/i];
const personalPatterns = [/\b(fala mano|fala irm[aã]o|e a[ií] mano|saudade|como voc[eê] t[aá]|beleza mano|bora|kkkk)\b/i];

function matchesAny(text: string, patterns: RegExp[]) { return patterns.some((pattern) => pattern.test(text)); }

function detectIntent(message: IncomingMessage, profile: ContactProfile): RoutedIntent {
  const text = message.text.trim();
  if (matchesAny(text, legalPatterns)) return 'legal';
  if (matchesAny(text, conflictPatterns) && (profile.hasOpenNegotiationCase || profile.defaultMode === 'negotiation')) return 'conflict';
  if (matchesAny(text, collectionPatterns) && (profile.hasOpenNegotiationCase || profile.defaultMode === 'negotiation')) return 'collection';
  if (matchesAny(text, salesPatterns)) return 'sales';
  if (matchesAny(text, supportPatterns) && profile.isExistingClient) return 'support';
  if (matchesAny(text, personalPatterns)) return 'personal';
  return 'unknown';
}

export function routeMessage(message: IncomingMessage, profile: ContactProfile): RouteDecision {
  if (profile.isProtected || profile.defaultMode === 'protected') {
    return { mode: 'protected', intent: 'unknown', confidence: 'high', reason: 'Contato protegido: sem IA e sem resposta.', shouldRespond: false, needsCaseContext: false };
  }

  const system = detectSystemMessage(message.text);
  if (system.isSystem) {
    return {
      mode: 'system', intent: 'system_notification', confidence: 'high',
      reason: system.reason,
      shouldRespond: false, needsCaseContext: false
    };
  }

  const intent = detectIntent(message, profile);
  if (intent === 'legal' && (profile.hasOpenNegotiationCase || profile.defaultMode === 'negotiation')) {
    return { mode: 'negotiation', intent, confidence: 'high', reason: 'Caso de negociação com linguagem jurídica detectada.', shouldRespond: true, needsCaseContext: true };
  }
  if ((intent === 'collection' || intent === 'conflict') && (profile.hasOpenNegotiationCase || profile.defaultMode === 'negotiation')) {
    return { mode: 'negotiation', intent, confidence: 'high', reason: 'Cobrança/conflito relacionado a caso conhecido.', shouldRespond: true, needsCaseContext: true };
  }
  if (intent === 'sales') return { mode: 'venom_sales', intent, confidence: 'high', reason: 'Intenção comercial detectada.', shouldRespond: true, needsCaseContext: false };
  if (intent === 'support' || (profile.defaultMode === 'venom_support' && intent === 'unknown')) return { mode: 'venom_support', intent: intent === 'unknown' ? 'support' : intent, confidence: 'medium', reason: 'Cliente existente em contexto de suporte.', shouldRespond: true, needsCaseContext: false };
  if (profile.defaultMode === 'negotiation') return { mode: 'negotiation', intent: intent === 'unknown' ? 'collection' : intent, confidence: 'medium', reason: 'Contato cadastrado como negociação ativa.', shouldRespond: true, needsCaseContext: true };
  if (profile.defaultMode === 'personal') return { mode: 'personal', intent: intent === 'unknown' ? 'personal' : intent, confidence: 'high', reason: 'Contato pessoal conhecido.', shouldRespond: true, needsCaseContext: false };
  if (profile.defaultMode === 'venom_sales') return { mode: 'venom_sales', intent: intent === 'unknown' ? 'sales' : intent, confidence: 'high', reason: 'Contato comercial conhecido.', shouldRespond: true, needsCaseContext: false };
  if (profile.isExistingClient) return { mode: 'venom_support', intent: intent === 'unknown' ? 'support' : intent, confidence: 'medium', reason: 'Cliente existente.', shouldRespond: true, needsCaseContext: false };
  return { mode: 'unknown', intent, confidence: 'low', reason: 'Contato ainda não classificado.', shouldRespond: true, needsCaseContext: false };
}
