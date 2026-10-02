import type { CaseContext, IncomingMessage } from '../types/domain.js';
import { preflight } from '../policies/preflight.js';
import { enforcePostflight } from '../policies/postflight.js';
import { getAgentDecision } from '../services/openai.js';
import { env } from '../config/env.js';

export async function evaluateMessage(message: IncomingMessage, context: CaseContext) {
  const gate = preflight(message);
  if (!gate.allowed) {
    return {
      status: 'ignored' as const,
      reason: gate.reason,
      autoSend: false
    };
  }

  const initial = await getAgentDecision(context, message.text);
  const decision = enforcePostflight(initial, context);

  return {
    status: 'evaluated' as const,
    decision,
    autoSend: env.AUTO_SEND && !decision.requiresApproval
  };
}
