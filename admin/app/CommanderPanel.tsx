'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Agent = { id: string; name: string; status: string; scope: string };
type Status = {
  commandCaptureReady: boolean; durableQueueReady: boolean; executionWorkersReady: boolean; externalActionsEnabled: boolean;
  gmail: { connected: boolean; mode: string }; whatsapp: { connected: boolean; status: string; mode: string };
  finance: { connected: boolean; mode: string }; agents: Agent[];
};
type Mission = { id: string; mission: string; domain: string; status: string; createdAt: string; duplicate: boolean; executionEnabled: boolean; jobs: { agentId: string; status: string; requiresDirectorReview: boolean; executionEnabled: boolean }[] };

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/core/commander/${path}`, {
    ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }, cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Centro de comando indisponível.');
  return data;
}

const statusLabel: Record<string,string> = {
  ready_for_planning: 'Pronto para organizar', configuration_required: 'Configuração necessária',
  specification_only: 'Especificado; integração pendente', observation_connected: 'Conectado em observação',
  disconnected: 'Desconectado', deferred: 'Fase posterior', policy_gate: 'Portão de QA',
};
const jobLabel: Record<string,string> = { COMMANDER:'Commander', GMAIL_SECRETARY:'Secretaria de e-mail', SNAKE_WHATSAPP:'WhatsApp SNAKE', CONFLICT_MANAGER:'Gestão de conflitos', COLLECTION_TRACKER:'Cobranças', FINANCE_PRIVATE:'Finanças privadas', WEB_HUNTER:'Pesquisa web', DIGITAL_AUDITOR:'Auditoria digital', PROTOTYPE_FACTORY:'Protótipos', QA_DIRECTOR:'QA independente' };

export default function CommanderPanel() {
  const [status,setStatus]=useState<Status|null>(null);
  const [missions,setMissions]=useState<Mission[]>([]);
  const [mission,setMission]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    try { const [s,m]=await Promise.all([request('status'),request('missions?limit=15')]);setStatus(s);setMissions(m.missions??[]);setError(''); }
    catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o centro de comando.');}
  },[]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),15000);return()=>clearInterval(timer);},[load]);
  async function submit(event:FormEvent){
    event.preventDefault();if(!mission.trim()||busy)return;setBusy(true);setError('');setNotice('');
    try {const result=await request('missions',{method:'POST',body:JSON.stringify({mission:mission.trim()})});setMission('');setNotice(result.mission.duplicate?'Essa missão já estava registrada.':'Missão registrada na fila privada. Ela ainda não foi executada.');await load();}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a missão.');}
    finally{setBusy(false);}
  }
  return <section className="comm panel">
    <div className="panelHead"><div><p className="eyebrow">CENTRO DE COMANDO PRIVADO</p><h2>Você → Commander → agentes especialistas</h2><p className="commIntro">Registre uma tarefa. O Commander classifica e organiza uma fila local cifrada; a execução fica bloqueada até o worker e as integrações serem validados.</p></div><button className="ghost" onClick={()=>void load()}>Atualizar</button></div>
    <div className="commGrid">
      <div className="commColumn">
        <h3>Comando para o Commander</h3>
        <form onSubmit={submit}>
          <label htmlFor="commander-mission">O que precisa ser organizado?</label>
          <textarea id="commander-mission" maxLength={4000} value={mission} onChange={e=>setMission(e.target.value)} placeholder="Ex.: organizar os e-mails pendentes e preparar rascunhos para minha revisão." />
          <div className="commandFooter"><small>Texto cifrado no banco local. Sem envio de mensagens ou chamadas de IA.</small><button disabled={!status?.commandCaptureReady||busy||!mission.trim()}>{busy?'Registrando…':'Registrar missão'}</button></div>
        </form>
        {!status?.commandCaptureReady&&<p className="agentNotice">A chave privada e as tabelas do Commander precisam estar disponíveis no ambiente. Inicie o SNAKE local para preparar a fila.</p>}
        {notice&&<p className="successNotice">{notice}</p>}
        {error&&<p className="errorNotice">{error}</p>}
        <div className="integrationList"><h3>Conexões atuais</h3>
          <div><span>Gmail</span><b>{status?.gmail.mode??'Verificando'}</b></div>
          <div><span>WhatsApp</span><b>{status?.whatsapp.mode??'Verificando'} · {status?.whatsapp.status??'—'}</b></div>
          <div><span>Finanças pessoais</span><b>{status?.finance.mode??'Verificando'}</b></div>
          <div><span>Worker de execução</span><b>{status?.executionWorkersReady?'Disponível':'Ainda não conectado'}</b></div>
          <div><span>Ações externas</span><b>{status?.externalActionsEnabled?'Habilitadas':'Desligadas'}</b></div>
        </div>
      </div>
      <div className="commColumn"><h3>Estrutura de agentes</h3><div className="agentTree">
        {(status?.agents??[]).map(agent=><article className={`agentCard ${agent.id==='COMMANDER'?'commanderLead':''}`} key={agent.id}>
          <div><strong>{agent.name}</strong><small>{agent.scope}</small></div><span>{statusLabel[agent.status]??agent.status}</span>
        </article>)}
      </div></div>
    </div>
    <div className="missionHistory"><h3>Fila durável · histórico</h3><p className="queueNote">Fila persistente configurada: {status?.durableQueueReady?'sim':'aguardando banco'} · Worker ativo: {status?.executionWorkersReady?'sim':'não'} · Toda ação externa permanece desligada.</p>
      {missions.length===0?<div className="empty">Nenhuma missão registrada neste ambiente.</div>:missions.map(item=><article className="missionCard" key={item.id}>
        <div className="missionMeta"><span>{item.domain==='private_operations'?'Operação privada':item.domain==='commercial_research'?'Comercial (fase posterior)':'Diretor'}</span><small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small><b>Aguardando revisão / worker</b></div>
        <p>{item.mission}</p><div className="jobList">{item.jobs.map((job,index)=><span key={`${job.agentId}-${index}`}>{index+1}. {jobLabel[job.agentId]??job.agentId}{job.requiresDirectorReview?' · revisão':''}</span>)}</div>
      </article>)}
    </div>
  </section>;
}
