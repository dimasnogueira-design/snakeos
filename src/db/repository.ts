import { pool } from './pool.js';
import { env } from '../config/env.js';
import type {
  CaseContext,
  ConfirmedFact,
  ContactMode,
  ContactProfile,
  GenericContext,
  IncomingMessage,
  NegotiationMandate
} from '../types/domain.js';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function upsertContact(externalId: string, displayName?: string) {
  const name = displayName?.trim() || '';
  const result = await pool.query(
    `INSERT INTO contacts (external_id, display_name)
     VALUES ($1, COALESCE(NULLIF($2,''),$1))
     ON CONFLICT (external_id) DO UPDATE
       SET display_name = CASE
         WHEN $2 <> '' THEN $2
         ELSE contacts.display_name
       END,
       updated_at = now()
     RETURNING *`,
    [externalId, name]
  );
  return result.rows[0];
}

export async function getContactByExternalId(externalId: string) {
  const result = await pool.query('SELECT * FROM contacts WHERE external_id = $1 LIMIT 1', [externalId]);
  return result.rows[0] ?? null;
}

export async function isProtectedContact(externalId: string, displayName?: string): Promise<boolean> {
  const byContact = await pool.query(
    `SELECT 1
       FROM contacts c
      WHERE c.external_id = $1
        AND (c.is_protected = true OR c.contact_mode = 'protected')
      LIMIT 1`,
    [externalId]
  );
  if (byContact.rows.length) return true;

  const result = await pool.query(
    `SELECT 1 FROM protected_contacts
      WHERE external_id = $1
         OR ($2::text IS NOT NULL AND lower(display_name) = lower($2))
      LIMIT 1`,
    [externalId, displayName ?? null]
  );
  return Boolean(result.rows.length);
}

export async function getContactProfile(externalId: string, displayName?: string): Promise<ContactProfile> {
  const contact = await upsertContact(externalId, displayName);
  const openCase = await pool.query(
    `SELECT 1 FROM cases WHERE contact_id = $1 AND status = 'open' LIMIT 1`,
    [contact.id]
  );

  return {
    contactId: externalId,
    displayName: contact.display_name,
    defaultMode: contact.contact_mode as ContactMode,
    isProtected: Boolean(contact.is_protected) || contact.contact_mode === 'protected',
    isExistingClient: Boolean(contact.is_existing_client),
    hasOpenNegotiationCase: Boolean(openCase.rowCount),
    notes: contact.notes ?? undefined
  };
}

export async function saveMessage(
  message: IncomingMessage,
  options?: { caseId?: string | null; author?: 'dimas' | 'counterparty' | 'agent'; body?: string }
) {
  const contact = await upsertContact(message.contactId, message.contactName);
  const author = options?.author ?? (message.fromMe ? 'dimas' : 'counterparty');
  const direction = author === 'counterparty' ? 'inbound' : 'outbound';
  const body = options?.body ?? message.text;
  const result = await pool.query(
    `INSERT INTO messages (
      case_id, contact_id, external_message_id, direction, author, body, media_type, occurred_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)
    ON CONFLICT (external_message_id) WHERE external_message_id IS NOT NULL DO UPDATE
      SET body = EXCLUDED.body,
          media_type = EXCLUDED.media_type
    RETURNING *`,
    [
      options?.caseId ?? null,
      contact.id,
      message.externalMessageId ?? null,
      direction,
      author,
      body,
      message.mediaType ?? null,
      message.timestamp
    ]
  );
  await pool.query(`UPDATE contacts SET last_message_at = GREATEST(COALESCE(last_message_at, '-infinity'::timestamptz), $2::timestamptz), updated_at=now() WHERE id=$1`, [contact.id, message.timestamp]);
  return result.rows[0];
}

async function getRecentMessages(contactUuid: string, caseId?: string | null, limit = 30) {
  const params: unknown[] = [contactUuid, limit];
  let where = 'm.contact_id = $1';
  if (caseId) {
    params.push(caseId);
    where += ` AND m.case_id = $3`;
  }
  const result = await pool.query(
    `SELECT author, COALESCE(NULLIF(transcript, ''), body) AS text, occurred_at
       FROM messages m
      WHERE ${where}
      ORDER BY occurred_at DESC
      LIMIT $2`,
    params
  );
  return result.rows.reverse().map((r) => ({
    role: r.author === 'counterparty' ? 'counterparty' as const : 'dimas' as const,
    text: r.text,
    at: new Date(r.occurred_at).toISOString()
  }));
}

export async function loadGenericContext(externalId: string, businessContext?: string): Promise<GenericContext> {
  const contact = await upsertContact(externalId);
  const recentMessages = await getRecentMessages(contact.id, null, env.CONTEXT_RECENT_MESSAGES);
  const facts = await pool.query(
    `SELECT cf.fact_key, cf.fact_value, cf.verified_at
       FROM confirmed_facts cf
       JOIN cases c ON c.id = cf.case_id
      WHERE c.contact_id = $1 AND cf.superseded_at IS NULL
      ORDER BY cf.verified_at DESC
      LIMIT 20`,
    [contact.id]
  );
  return {
    contactId: externalId,
    contactName: contact.display_name,
    recentMessages,
    knownFacts: facts.rows.map((r): ConfirmedFact => ({
      key: r.fact_key,
      value: r.fact_value,
      verifiedAt: new Date(r.verified_at).toISOString()
    })),
    businessContext,
    memory: await loadMemory(externalId)
  };
}

export async function loadOpenNegotiationContext(externalId: string): Promise<CaseContext | null> {
  const contact = await getContactByExternalId(externalId);
  if (!contact) return null;

  const result = await pool.query(
    `SELECT c.*,
            nm.may_acknowledge_debt,
            nm.may_offer_installments,
            nm.may_offer_discount,
            nm.max_immediate_payment_cents,
            nm.max_installment_cents,
            nm.earliest_commitment_date,
            nm.forbidden_claims,
            nm.notes AS mandate_notes
       FROM cases c
       LEFT JOIN negotiation_mandates nm ON nm.case_id = c.id
      WHERE c.contact_id = $1 AND c.status = 'open'
      ORDER BY c.updated_at DESC
      LIMIT 1`,
    [contact.id]
  );
  const c = result.rows[0];
  if (!c) return null;

  const factsResult = await pool.query(
    `SELECT fact_key, fact_value, verified_at
       FROM confirmed_facts
      WHERE case_id = $1 AND superseded_at IS NULL
      ORDER BY verified_at DESC`,
    [c.id]
  );
  const recentMessages = await getRecentMessages(contact.id, c.id, env.CONTEXT_RECENT_MESSAGES);

  const mandate: NegotiationMandate = {
    mayAcknowledgeDebt: Boolean(c.may_acknowledge_debt),
    mayOfferInstallments: Boolean(c.may_offer_installments),
    mayOfferDiscount: Boolean(c.may_offer_discount),
    maxImmediatePaymentCents: toNumber(c.max_immediate_payment_cents),
    maxInstallmentCents: toNumber(c.max_installment_cents),
    earliestCommitmentDate: c.earliest_commitment_date ? String(c.earliest_commitment_date).slice(0, 10) : null,
    forbiddenClaims: Array.isArray(c.forbidden_claims) ? c.forbidden_claims : [],
    notes: c.mandate_notes ?? undefined
  };

  return {
    caseId: c.id,
    contactId: externalId,
    contactName: contact.display_name,
    title: c.title,
    claimedAmountCents: toNumber(c.claimed_amount_cents),
    confirmedAmountCents: toNumber(c.confirmed_amount_cents),
    summary: c.summary,
    confirmedFacts: factsResult.rows.map((r): ConfirmedFact => ({
      key: r.fact_key,
      value: r.fact_value,
      verifiedAt: new Date(r.verified_at).toISOString()
    })),
    recentMessages,
    mandate
  };
}

export async function setContactMode(externalId: string, mode: ContactMode) {
  const contact = await upsertContact(externalId);
  await pool.query(
    `UPDATE contacts SET contact_mode = $2, is_protected = ($2 = 'protected'), updated_at = now() WHERE id = $1`,
    [contact.id, mode]
  );
}

export async function addConfirmedFact(caseId: string, key: string, value: string) {
  await pool.query(
    `UPDATE confirmed_facts SET superseded_at = now()
      WHERE case_id = $1 AND fact_key = $2 AND superseded_at IS NULL`,
    [caseId, key]
  );
  const result = await pool.query(
    `INSERT INTO confirmed_facts (case_id, fact_key, fact_value)
     VALUES ($1,$2,$3) RETURNING *`,
    [caseId, key, value]
  );
  return result.rows[0];
}

export async function findOpenCaseId(externalId: string): Promise<string | null> {
  const contact = await getContactByExternalId(externalId);
  if (!contact) return null;
  const result = await pool.query(
    `SELECT id FROM cases WHERE contact_id = $1 AND status = 'open' ORDER BY updated_at DESC LIMIT 1`,
    [contact.id]
  );
  return result.rows[0]?.id ?? null;
}


export async function logAiUsage(args: { externalId?: string; caseId?: string | null; purpose: string; model: string; inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null }) {
  let contactUuid: string | null = null;
  if (args.externalId) {
    const contact = await getContactByExternalId(args.externalId);
    contactUuid = contact?.id ?? null;
  }
  await pool.query(
    `INSERT INTO ai_usage (contact_id, case_id, purpose, model, input_tokens, output_tokens, total_tokens)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [contactUuid, args.caseId ?? null, args.purpose, args.model, args.inputTokens ?? null, args.outputTokens ?? null, args.totalTokens ?? null]
  );
}

export type AutomationMode = 'paused' | 'observation' | 'autonomous';

export async function getAutomationMode(): Promise<AutomationMode> {
  const result = await pool.query(
    `SELECT setting_value #>> '{}' AS value FROM system_settings WHERE setting_key = 'automation_mode' LIMIT 1`
  );
  const value = result.rows[0]?.value;
  return value === 'paused' || value === 'autonomous' ? value : 'observation';
}

export async function setAutomationMode(mode: AutomationMode) {
  if(mode==='autonomous' && (!env.AUTO_SEND || !env.QA_APPROVED || !env.AUTONOMOUS_AUTHORIZED || env.AI_DRY_RUN || env.MOCK_AI)) throw new Error('autonomous_not_authorized');
  if(mode==='autonomous') {
    const c=await pool.query("SELECT setting_value FROM system_settings WHERE setting_key='ai_circuit'");
    if(c.rows[0]?.setting_value?.open) throw new Error('circuit_open');
  }
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_at)
     VALUES ('automation_mode', to_jsonb($1::text), now())
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
    [mode]
  );
  await pool.query(
    `INSERT INTO operational_events (event_type, payload) VALUES ('automation_mode_changed', jsonb_build_object('mode',$1::text))`,
    [mode]
  );
  return mode;
}

export async function getWhatsAppStatus(): Promise<string> {
  const result = await pool.query(
    `SELECT setting_value #>> '{}' AS value,updated_at FROM system_settings WHERE setting_key = 'whatsapp_status' LIMIT 1`
  );
  const row=result.rows[0];
  return row && Date.now()-new Date(row.updated_at).getTime()<90000 ? row.value : 'disconnected';
}

export async function setWhatsAppStatus(status: string) {
  await pool.query(
    `INSERT INTO system_settings (setting_key, setting_value, updated_at)
     VALUES ('whatsapp_status', to_jsonb($1::text), now())
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
    [status]
  );
}

export async function getContactAutomationState(externalId: string) {
  const contact = await getContactByExternalId(externalId);
  return {
    paused: Boolean(contact?.automation_paused),
    mode: await getAutomationMode()
  };
}

export async function setContactAutomationPaused(externalId: string, paused: boolean) {
  const contact = await upsertContact(externalId);
  await pool.query(`UPDATE contacts SET automation_paused = $2, updated_at = now() WHERE id = $1`, [contact.id, paused]);
  await pool.query(
    `INSERT INTO operational_events (event_type, contact_id, payload)
     VALUES ($1,$2,jsonb_build_object('paused',$3::boolean))`,
    [paused ? 'contact_takeover' : 'contact_returned_to_snake', contact.id, paused]
  );
  return { externalId, paused };
}

export async function touchContactLastMessage(externalId: string, at: string) {
  const contact = await upsertContact(externalId);
  await pool.query(`UPDATE contacts SET last_message_at = $2::timestamptz, updated_at = now() WHERE id = $1`, [contact.id, at]);
}

export async function getAdminSummary() {
  const [contacts, cases, recent, usage, whatsapp, mode] = await Promise.all([
    pool.query(`SELECT contact_mode, count(*)::int AS count FROM contacts GROUP BY contact_mode`),
    pool.query(`SELECT count(*)::int AS open_cases FROM cases WHERE status='open'`),
    pool.query(`SELECT count(*)::int AS messages_24h FROM messages WHERE occurred_at >= now() - interval '24 hours'`),
    pool.query(`SELECT COALESCE(sum(total_tokens),0)::bigint AS tokens_24h FROM ai_usage WHERE created_at >= now() - interval '24 hours'`),
    getWhatsAppStatus(),
    getAutomationMode()
  ]);
  const byMode = Object.fromEntries(contacts.rows.map((r) => [r.contact_mode, Number(r.count)]));
  return {
    automationMode: mode,
    whatsappStatus: whatsapp,
    openCases: Number(cases.rows[0]?.open_cases ?? 0),
    messages24h: Number(recent.rows[0]?.messages_24h ?? 0),
    tokens24h: Number(usage.rows[0]?.tokens_24h ?? 0),
    contactsByMode: byMode
  };
}

export async function listAdminContacts(limit = 100) {
  const result = await pool.query(
    `SELECT c.external_id, c.display_name, c.contact_mode, c.is_existing_client, c.is_protected,
            c.automation_paused, c.last_message_at,
            (SELECT count(*)::int FROM cases cs WHERE cs.contact_id=c.id AND cs.status='open') AS open_cases,
            (SELECT COALESCE(NULLIF(m.transcript,''),m.body) FROM messages m WHERE m.contact_id=c.id ORDER BY m.occurred_at DESC LIMIT 1) AS last_message
       FROM contacts c
      ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
      LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getAdminContact(externalId: string) {
  const contact = await getContactByExternalId(externalId);
  if (!contact) return null;
  const messages = await pool.query(
    `SELECT author, direction, COALESCE(NULLIF(transcript,''),body) AS text, media_type, occurred_at
       FROM messages WHERE contact_id=$1 ORDER BY occurred_at DESC LIMIT 80`,
    [contact.id]
  );
  const cases = await pool.query(
    `SELECT id, title, status, claimed_amount_cents, confirmed_amount_cents, summary, risk_level, updated_at
       FROM cases WHERE contact_id=$1 ORDER BY updated_at DESC`,
    [contact.id]
  );
  const decisions=await pool.query('SELECT proposed_reply,requires_approval,risk,raw_decision,created_at FROM agent_decisions WHERE contact_id=$1 ORDER BY created_at DESC LIMIT 10',[contact.id]);
  const handoffs=await pool.query('SELECT * FROM handoffs WHERE contact_id=$1 ORDER BY created_at DESC LIMIT 10',[contact.id]);
  return { contact, messages: messages.rows.reverse(), cases: cases.rows, memory:await loadMemory(externalId), decisions:decisions.rows,handoffs:handoffs.rows };
}

import { emptyMemory } from '../memory/compact.js';
import type { ConversationMemory } from '../types/domain.js';
export async function loadMemory(externalId:string):Promise<ConversationMemory> {
  const r=await pool.query(`SELECT s.context_pack FROM conversation_summaries s JOIN contacts c ON c.id=s.contact_id WHERE c.external_id=$1 AND s.case_id IS NULL`,[externalId]);
  return {...emptyMemory(),...r.rows[0]?.context_pack};
}
export async function saveMemory(externalId:string,memory:ConversationMemory) {
  await pool.query(`INSERT INTO conversation_summaries(contact_id,summary,context_pack)
    VALUES((SELECT id FROM contacts WHERE external_id=$1),$2,$3::jsonb)
    ON CONFLICT(contact_id) WHERE case_id IS NULL DO UPDATE SET summary=EXCLUDED.summary,context_pack=EXCLUDED.context_pack,revision=conversation_summaries.revision+1,updated_at=now()`,
    [externalId,memory.summary,JSON.stringify(memory)]);
}
export async function alertAdmin(externalId:string|undefined,code:string) {
  await pool.query(`INSERT INTO alerts(contact_id,code) VALUES((SELECT id FROM contacts WHERE external_id=$1),$2)`,[externalId??null,code]);
}
export async function listAlerts() {return (await pool.query('SELECT a.*,c.display_name FROM alerts a LEFT JOIN contacts c ON c.id=a.contact_id WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 80')).rows;}
export async function retrieveOlderHistory(externalId:string,text:string) {
  // Retrieval only for explicit backward references. Never scan/export full history into prompt.
  if(!/antes|anterior|passad[oa]|combinamos|falamos|voc[eê] disse|lembra|aquele|aquela/i.test(text)) return [];
  const r=await pool.query(`SELECT author AS role,body AS text,occurred_at AS at FROM messages WHERE contact_id=(SELECT id FROM contacts WHERE external_id=$1)
    AND id NOT IN(SELECT id FROM messages WHERE contact_id=(SELECT id FROM contacts WHERE external_id=$1) ORDER BY occurred_at DESC LIMIT $2)
    AND to_tsvector('portuguese',body) @@ plainto_tsquery('portuguese',$3) ORDER BY occurred_at DESC LIMIT 4`,[externalId,env.CONTEXT_RECENT_MESSAGES,text]);
  return r.rows;
}
