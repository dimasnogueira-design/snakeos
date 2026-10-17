export type CommanderAgentId =
  | 'COMMANDER'
  | 'GMAIL_SECRETARY'
  | 'SNAKE_WHATSAPP'
  | 'CONFLICT_MANAGER'
  | 'COLLECTION_TRACKER'
  | 'FINANCE_PRIVATE'
  | 'WEB_HUNTER'
  | 'DIGITAL_AUDITOR'
  | 'PROTOTYPE_FACTORY'
  | 'QA_DIRECTOR';

export type CommanderJob = {
  agentId: CommanderAgentId;
  dependsOn: CommanderAgentId[];
  requiresDirectorReview: boolean;
  externalAction: false;
};
export type CommanderPlan = {
  title: string;
  domain: 'private_operations' | 'commercial_research' | 'director_operations';
  jobs: CommanderJob[];
  status: 'QUEUED_FOR_REVIEW';
};

const definitions: Array<{
  id: CommanderAgentId;
  match: RegExp;
  review: boolean;
}> = [
  { id: 'GMAIL_SECRETARY', match: /gmail|e-?mail|caixa de entrada|mensagem recebida|notifica[cç][aã]o/i, review: false },
  { id: 'SNAKE_WHATSAPP', match: /whats?app|mensagem|conversa|atendimento/i, review: false },
  { id: 'CONFLICT_MANAGER', match: /conflito|briga|discuss[aã]o|reclama[cç][aã]o|amea[cç]a|advogado|processo/i, review: true },
  { id: 'COLLECTION_TRACKER', match: /cobrar|cobran[cç]a|devedor|pend[eê]ncia|retorno|acompanhar/i, review: true },
  { id: 'FINANCE_PRIVATE', match: /finan[cç]as?|d[ií]vida|credor|boleto|saldo|vencimento|pagamento|acordo|negocia[cç][aã]o/i, review: true },
  { id: 'WEB_HUNTER', match: /lead|prospec[cç][aã]o|empresa|pesquisar.*site|buscar.*site/i, review: false },
  { id: 'DIGITAL_AUDITOR', match: /site|auditoria|diagn[oó]stico digital|seo|velocidade|acessibilidade/i, review: false },
  { id: 'PROTOTYPE_FACTORY', match: /prot[oó]tipo|mockup|landing page|criar.*site/i, review: true },
];

const agentOrder: CommanderAgentId[] = [
  'GMAIL_SECRETARY', 'SNAKE_WHATSAPP', 'CONFLICT_MANAGER', 'COLLECTION_TRACKER',
  'FINANCE_PRIVATE', 'WEB_HUNTER', 'DIGITAL_AUDITOR', 'PROTOTYPE_FACTORY',
];

export function planCommanderMission(rawMission: string): CommanderPlan {
  const mission = rawMission.trim();
  if (!mission) throw new Error('A missão não pode ficar vazia.');
  if (mission.length > 4000) throw new Error('A missão ultrapassa 4.000 caracteres.');

  const selected = new Map<CommanderAgentId, boolean>();
  for (const definition of definitions) {
    if (definition.match.test(mission)) selected.set(definition.id, definition.review);
  }

  // The Commander is always the first job. Specialist rows are a plan only;
  // no provider or external integration is called here.
  if (selected.has('FINANCE_PRIVATE') || selected.has('COLLECTION_TRACKER') || selected.has('CONFLICT_MANAGER')) {
    selected.set('QA_DIRECTOR', true);
  }

  const ids = agentOrder.filter(id => selected.has(id));
  const jobs: CommanderJob[] = [{
    agentId: 'COMMANDER',
    dependsOn: [],
    requiresDirectorReview: false,
    externalAction: false as const,
  }, ...ids.map((agentId, index): CommanderJob => ({
    agentId,
    dependsOn: [index ? ids[index - 1] : 'COMMANDER'],
    requiresDirectorReview: selected.get(agentId) === true,
    externalAction: false,
  }))];
  if (selected.has('QA_DIRECTOR')) jobs.push({
    agentId: 'QA_DIRECTOR',
    dependsOn: ids,
    requiresDirectorReview: true,
    externalAction: false,
  });

  const privateOps = jobs.some(job => [
    'GMAIL_SECRETARY', 'SNAKE_WHATSAPP', 'CONFLICT_MANAGER', 'COLLECTION_TRACKER', 'FINANCE_PRIVATE',
  ].includes(job.agentId));
  return {
    title: mission.length > 84 ? `${mission.slice(0, 81)}…` : mission,
    domain: privateOps ? 'private_operations' : jobs.some(job => ['WEB_HUNTER','DIGITAL_AUDITOR','PROTOTYPE_FACTORY'].includes(job.agentId)) ? 'commercial_research' : 'director_operations',
    jobs,
    status: 'QUEUED_FOR_REVIEW',
  };
}
