export type RiskLevel = 'low' | 'medium' | 'high' | 'legal';
export type Intent = 'normal' | 'collection' | 'proposal' | 'conflict' | 'legal' | 'unknown';

export type ContactMode =
  | 'unknown'
  | 'venom_sales'
  | 'venom_support'
  | 'negotiation'
  | 'personal'
  | 'protected'
  | 'system';

export type RoutedIntent =
  | 'sales'
  | 'support'
  | 'collection'
  | 'proposal'
  | 'conflict'
  | 'legal'
  | 'personal'
  | 'system_notification'
  | 'unknown';

export interface IncomingMessage {
  externalMessageId?: string;
  contactId: string;
  contactName?: string;
  chatId: string;
  isGroup: boolean;
  fromMe?: boolean;
  text: string;
  timestamp: string;
  mediaType?: 'audio' | 'image' | 'document' | 'other';
}

export interface ContactProfile {
  contactId: string;
  displayName?: string;
  defaultMode: ContactMode;
  isProtected: boolean;
  isExistingClient?: boolean;
  hasOpenNegotiationCase?: boolean;
  notes?: string;
}

export interface RouteDecision {
  mode: ContactMode;
  intent: RoutedIntent;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  shouldRespond: boolean;
  needsCaseContext: boolean;
}

export interface ConfirmedFact {
  key: string;
  value: string;
  source?: string;
  verifiedAt?: string;
}

export interface NegotiationMandate {
  mayAcknowledgeDebt: boolean;
  mayOfferInstallments: boolean;
  mayOfferDiscount: boolean;
  maxImmediatePaymentCents?: number | null;
  maxInstallmentCents?: number | null;
  earliestCommitmentDate?: string | null;
  forbiddenClaims: string[];
  notes?: string;
}

export interface CaseContext {
  caseId: string;
  contactId: string;
  contactName: string;
  title: string;
  claimedAmountCents?: number | null;
  confirmedAmountCents?: number | null;
  summary: string;
  confirmedFacts: ConfirmedFact[];
  recentMessages: Array<{ role: 'dimas' | 'counterparty'; text: string; at?: string }>;
  mandate: NegotiationMandate;
}

export interface GenericContext {
  contactId?: string;
  contactName: string;
  recentMessages: Array<{ role: 'dimas' | 'counterparty'; text: string; at?: string }>;
  knownFacts?: ConfirmedFact[];
  businessContext?: string;
  memory?: ConversationMemory;
  retrievedMessages?: Array<{ role: string; text: string; at?: string }>;
}

export interface ConversationMemory {
  goal: string;
  pain: string;
  summary: string;
  facts: Array<{ key: string; value: string; source: string; confirmed: boolean }>;
  openQuestions: string[];
  commitments: Array<{ text: string; source: string; confirmed: boolean }>;
  decisions: string[];
  nextAction: string;
  persona: 'CHRISTIAN' | 'JULLY';
  tone: Record<string, string | number>;
}

export interface AgentDecision {
  intent: Intent;
  risk: RiskLevel;
  counterpartyNeed: string;
  strategy: string;
  reply: string;
  createsCommitment: boolean;
  commitmentDescription: string | null;
  requiresApproval: boolean;
  reasonForApproval: string | null;
  factsUsed: string[];
}

export interface ChannelDecision {
  mode: ContactMode;
  route: RouteDecision;
  reply: string | null;
  replyParts?: string[];
  notifyUser?: boolean;
  requiresApproval: boolean;
  autoSend: boolean;
  strategy?: string;
  risk?: RiskLevel;
  memory?: ConversationMemory;
  estimate?: { model: string; inputTokensEstimate: number; inputTokensUpperBound: number; maxOutputTokens: number; maxCostMicros: number };
  dryRun?: boolean;
  reason?: string;
}

export interface PreflightResult {
  allowed: boolean;
  reason?: 'group' | 'protected_contact' | 'empty_message' | 'from_me';
}
