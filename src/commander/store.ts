import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { decryptCommanderData, encryptCommanderData } from './crypto.js';
import { planCommanderMission, type CommanderAgentId, type CommanderPlan } from './planner.js';

type MissionRow = { id: string; domain: CommanderPlan['domain']; status: string; payload_ciphertext: string; created_at: string };
type JobRow = { mission_id: string; agent_id: CommanderAgentId; status: string; requires_director_review: boolean; created_at: string };

export async function createCommanderMission(rawMission: string, idempotencyKey: string = randomUUID()) {
  const plan = planCommanderMission(rawMission);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ciphertext = encryptCommanderData(rawMission.trim());
    const inserted = await client.query<MissionRow>(
      `INSERT INTO commander_missions(idempotency_key,domain,status,payload_ciphertext)
       VALUES($1,$2,'awaiting_review',$3) ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id,domain,status,payload_ciphertext,created_at`,
      [idempotencyKey, plan.domain, ciphertext],
    );
    if (!inserted.rows[0]) {
      const existing = await client.query<MissionRow>(
        'SELECT id,domain,status,payload_ciphertext,created_at FROM commander_missions WHERE idempotency_key=$1', [idempotencyKey],
      );
      await client.query('COMMIT');
      return missionForDisplay(existing.rows[0], await getJobs(existing.rows[0].id, client), true);
    }
    const mission = inserted.rows[0];
    const jobIds = new Map<CommanderAgentId, string>();
    for (const job of plan.jobs) {
      const dependencies = job.dependsOn.map(id => jobIds.get(id)).filter((id): id is string => Boolean(id));
      const status = job.requiresDirectorReview ? 'awaiting_review' : 'queued';
      const row = await client.query<{ id: string }>(
        `INSERT INTO commander_jobs(mission_id,agent_id,status,depends_on,requires_director_review,external_action_enabled,execution_enabled)
         VALUES($1,$2,$3,$4,$5,false,false) RETURNING id`,
        [mission.id, job.agentId, status, dependencies, job.requiresDirectorReview],
      );
      jobIds.set(job.agentId, row.rows[0].id);
    }
    await client.query("INSERT INTO commander_audit_events(mission_id,event_type) VALUES($1,'mission_created')", [mission.id]);
    for (const job of plan.jobs) {
      await client.query("INSERT INTO commander_audit_events(mission_id,event_type,agent_id) VALUES($1,'job_planned',$2)", [mission.id, job.agentId]);
    }
    await client.query('COMMIT');
    return missionForDisplay(mission, await getJobs(mission.id));
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally { client.release(); }
}

async function getJobs(missionId: string, client: any = pool): Promise<JobRow[]> {
  const result = await client.query(
    'SELECT mission_id,agent_id,status,requires_director_review,created_at FROM commander_jobs WHERE mission_id=$1 ORDER BY created_at,agent_id',
    [missionId],
  );
  return result.rows as JobRow[];
}

function missionForDisplay(row: MissionRow, jobs: JobRow[], duplicate = false) {
  const mission = decryptCommanderData(row.payload_ciphertext);
  const plan = planCommanderMission(mission);
  return {
    id: row.id, title: plan.title, mission, domain: row.domain, status: row.status,
    createdAt: row.created_at, duplicate, jobs: jobs.map(job => ({
      agentId: job.agent_id, status: job.status, requiresDirectorReview: job.requires_director_review,
      executionEnabled: false,
    })),
    executionEnabled: false,
  };
}

export async function listCommanderMissions(limit = 20) {
  const rows = await pool.query<MissionRow>(
    'SELECT id,domain,status,payload_ciphertext,created_at FROM commander_missions ORDER BY created_at DESC LIMIT $1', [limit],
  );
  const missions = [];
  for (const row of rows.rows) missions.push(missionForDisplay(row, await getJobs(row.id)));
  return missions;
}

export async function getCommanderStatus() {
  const hasKey = Boolean(process.env.COMMANDER_DATA_KEY);
  let tablesAvailable = false;
  let whatsappStatus = 'desconhecido';
  try {
    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('commander_missions','commander_jobs')",
    );
    tablesAvailable = tables.rows.length === 2;
    const whatsapp = await pool.query<{ setting_value: string }>(
      "SELECT setting_value FROM system_settings WHERE setting_key='whatsapp_status'",
    );
    whatsappStatus = String(whatsapp.rows[0]?.setting_value ?? 'desconhecido').replace(/^\"|\"$/g, '');
  } catch { /* status response explains the unavailable database separately */ }
  return {
    hierarchy: ['COMMANDER', 'GMAIL_SECRETARY', 'SNAKE_WHATSAPP', 'CONFLICT_MANAGER', 'COLLECTION_TRACKER', 'FINANCE_PRIVATE', 'WEB_HUNTER', 'DIGITAL_AUDITOR', 'PROTOTYPE_FACTORY', 'QA_DIRECTOR'],
    commandCaptureReady: hasKey && tablesAvailable,
    durableQueueReady: tablesAvailable,
    executionWorkersReady: false,
    externalActionsEnabled: false,
    gmail: { connected: false, mode: 'não conectado; aguardando OAuth autorizado' },
    whatsapp: { connected: whatsappStatus === 'ready', status: whatsappStatus, mode: 'observação; envio automático desligado' },
    finance: { connected: false, mode: 'privado; sem importação de dados financeiros' },
    agents: [
      { id: 'COMMANDER', name: 'Commander', status: hasKey && tablesAvailable ? 'ready_for_planning' : 'configuration_required', scope: 'recebe, classifica e coordena missões' },
      { id: 'GMAIL_SECRETARY', name: 'Secretaria de e-mail', status: 'specification_only', scope: 'leitura, triagem e rascunhos após conexão OAuth' },
      { id: 'SNAKE_WHATSAPP', name: 'WhatsApp SNAKE', status: whatsappStatus === 'ready' ? 'observation_connected' : 'disconnected', scope: 'observação local; sem envio automático' },
      { id: 'CONFLICT_MANAGER', name: 'Gestão de conflitos', status: 'specification_only', scope: 'análise e propostas para revisão humana' },
      { id: 'COLLECTION_TRACKER', name: 'Acompanhamento de cobranças', status: 'specification_only', scope: 'organização e rascunhos; sem aceitar acordos' },
      { id: 'FINANCE_PRIVATE', name: 'Finanças privadas', status: 'specification_only', scope: 'não conectado; separado de CRM comercial' },
      { id: 'WEB_HUNTER', name: 'Pesquisa web', status: 'deferred', scope: 'fase comercial posterior' },
      { id: 'DIGITAL_AUDITOR', name: 'Auditoria digital', status: 'deferred', scope: 'fase comercial posterior' },
      { id: 'PROTOTYPE_FACTORY', name: 'Protótipos', status: 'deferred', scope: 'fase comercial posterior' },
      { id: 'QA_DIRECTOR', name: 'QA independente', status: 'policy_gate', scope: 'revisão e segurança antes de qualquer ação externa' },
    ],
  };
}
