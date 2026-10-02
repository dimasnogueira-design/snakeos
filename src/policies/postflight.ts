import type { AgentDecision, CaseContext } from '../types/domain.js';

const commitmentPatterns = [
  /\b(pago|pagarei|vou pagar|transfiro|transferirei|deposito|depositarei)\b/i,
  /\b(garanto|prometo|fica combinado|fechado)\b/i,
  /\b(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)\b.*\b(pago|transfiro|deposito)\b/i,
  /R\$\s?\d+[\d.,]*/i
];

export function detectCommitmentLanguage(text: string): boolean {
  return commitmentPatterns.some((pattern) => pattern.test(text));
}

export function enforcePostflight(decision: AgentDecision, context: CaseContext) {
  const textLooksLikeCommitment = detectCommitmentLanguage(decision.reply);
  const noFinancialMandate = !context.mandate.maxImmediatePaymentCents && !context.mandate.maxInstallmentCents;
  const createsCommitment = decision.createsCommitment || textLooksLikeCommitment;

  const requiresApproval =
    decision.requiresApproval ||
    decision.risk === 'legal' ||
    (createsCommitment && noFinancialMandate);

  return {
    ...decision,
    createsCommitment,
    requiresApproval,
    reasonForApproval: requiresApproval
      ? decision.reasonForApproval ?? (decision.risk === 'legal' ? 'Assunto jurídico exige revisão humana.' : 'A resposta pode criar compromisso financeiro ou temporal fora do mandato.')
      : null
  };
}
