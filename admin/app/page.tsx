'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import UsagePanel from './UsagePanel';
import ContactDetail from './ContactDetail';

type AutomationMode = 'paused' | 'observation' | 'autonomous';
type Summary = { automationMode: AutomationMode; whatsappStatus: string; openCases: number; messages24h: number; tokens24h: number; contactsByMode: Record<string, number> };
type Contact = { external_id: string; display_name: string; contact_mode: string; is_existing_client: boolean; is_protected: boolean; automation_paused: boolean; last_message_at: string | null; open_cases: number; last_message: string | null };

const modeLabel: Record<string,string> = { unknown:'A classificar', venom_sales:'Lead', venom_support:'Cliente', negotiation:'Cobrança', personal:'Pessoal', protected:'Protegido', system:'Automático' };

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`/api/core/${path}`, { ...init, headers: { 'content-type':'application/json', ...(init?.headers ?? {}) }, cache:'no-store' });
  if (!r.ok) throw new Error('Não foi possível concluir. Confira a conexão e tente novamente.');
  return r.json();
}

export default function Home() {
  const [summary,setSummary]=useState<Summary|null>(null);
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [usage,setUsage]=useState<any>(null),[alerts,setAlerts]=useState<any[]>([]),[selected,setSelected]=useState('');
  const [master,setMaster]=useState(false);

  const load = useCallback(async()=>{
    try {
      const [s,c,u,a,control]=await Promise.all([api('summary'), api('contacts?limit=120'),api('usage'),api('alerts'),api('automation')]);
      setUsage(u);setAlerts(a.alerts??[]);setMaster(control.masterAutoSend);
      setSummary(s); setContacts(c.contacts ?? []); setError('');
    } catch(e){ setError(e instanceof Error ? e.message : 'Falha ao carregar'); }
  },[]);
  useEffect(()=>{ load(); const id=setInterval(load,5000); return()=>clearInterval(id); },[load]);

  async function setMode(mode:AutomationMode){ setBusy(`mode:${mode}`); try{ await api('automation',{method:'PATCH',body:JSON.stringify({mode})}); await load(); } catch{setError('Não foi possível mudar o modo. Autonomia exige QA e autorização.');} finally{setBusy('');} }
  async function patchContact(id:string, body:object){ setBusy(id); try{ await api(`contacts/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)}); await load(); } catch{setError('Não foi possível atualizar o contato.');} finally{setBusy('');} }
  async function onAction(path:string,method:string,body:unknown){await api(path,{method,body:JSON.stringify(body)});await load();}

  const active = useMemo(()=>contacts.filter(c=>c.last_message_at).slice(0,30),[contacts]);
  return <main>
    <header><div className="brand"><span className="mark">V</span><div><strong>SNAKE CONTROL</strong><small>VENOM CODE • ADMIN</small></div></div><div className={`status ${summary?.whatsappStatus==='ready'?'ok':''}`}><span/>WhatsApp {summary?.whatsappStatus ?? '...'}</div></header>

    {error && <div className="error">{error}</div>}

    <section className="hero">
      <div><p className="eyebrow">CONTROLE OPERACIONAL</p><h1>{summary?.automationMode==='autonomous'?'Snake operando.':summary?.automationMode==='paused'?'Snake pausado.':'Snake observando.'}</h1><p className="muted">Atualização automática a cada 5 segundos. Você pode assumir qualquer conversa sem desligar o restante.</p></div>
      <div className="modeSwitch">
        <button className={summary?.automationMode==='paused'?'active danger':''} disabled={!!busy} onClick={()=>setMode('paused')}>Pausar</button>
        <button className={summary?.automationMode==='observation'?'active':''} disabled={!!busy} onClick={()=>setMode('observation')}>Observar</button>
        <button className={summary?.automationMode==='autonomous'?'active':''} disabled={!!busy||!master||usage?.dryRun||usage?.mock||usage?.circuit.open} title="Habilitado somente após QA e autorização" onClick={()=>setMode('autonomous')}>Autônomo</button>
      </div>
    </section>

    <UsagePanel usage={usage} onAction={onAction}/>
    {alerts.length>0&&<section className="panel"><h2>Alertas para revisão</h2>{alerts.slice(0,20).map(a=><div className="alert" key={a.id}><span>{a.display_name??'Sistema'} · {a.code}</span><button className="ghost" onClick={()=>onAction(`alerts/${a.id}`,'PATCH',{}).catch(()=>setError('Não foi possível concluir.'))}>Marcar como revisado</button></div>)}</section>}
    {selected&&<ContactDetail key={selected} id={selected} request={api} onClose={()=>setSelected('')}/>}

    <section className="metrics">
      <article><span>Mensagens 24h</span><b>{summary?.messages24h ?? '—'}</b></article>
      <article><span>Negociações abertas</span><b>{summary?.openCases ?? '—'}</b></article>
      <article><span>Leads</span><b>{summary?.contactsByMode?.venom_sales ?? 0}</b></article>
      <article><span>Tokens 24h</span><b>{summary?.tokens24h?.toLocaleString('pt-BR') ?? '—'}</b></article>
    </section>

    <section className="panel">
      <div className="panelHead"><div><p className="eyebrow">AGORA</p><h2>Conversas recentes</h2></div><button className="ghost" onClick={load}>Atualizar</button></div>
      <div className="contactList">
        {active.length===0 && <div className="empty">As conversas aparecerão aqui quando o Core estiver conectado ao WhatsApp.</div>}
        {active.map(c=><article className="contact" key={c.external_id}>
          <div className="contactMain"><div className="avatar">{(c.display_name||'?').slice(0,1).toUpperCase()}</div><div className="contactText"><div className="nameRow"><strong>{c.display_name}</strong><span className={`pill mode-${c.contact_mode}`}>{modeLabel[c.contact_mode] ?? c.contact_mode}</span>{c.automation_paused&&<span className="pill takeover">VOCÊ ASSUMIU</span>}</div><p>{c.last_message || 'Sem mensagem de texto'}</p><small>{c.last_message_at?new Date(c.last_message_at).toLocaleString('pt-BR'):'—'} • {c.open_cases||0} caso(s) aberto(s)</small></div></div>
          <div className="actions">
            <button className="ghost" onClick={()=>setSelected(c.external_id)}>Abrir briefing</button>
            <button className="ghost" disabled={busy===c.external_id} onClick={()=>patchContact(c.external_id,{mode:'protected'})}>Proteger</button>
            <select value={c.contact_mode} disabled={busy===c.external_id} onChange={e=>patchContact(c.external_id,{mode:e.target.value})}>
              <option value="unknown">A classificar</option><option value="venom_sales">Lead</option><option value="venom_support">Cliente</option><option value="negotiation">Cobrança</option><option value="personal">Pessoal</option><option value="protected">Protegido</option><option value="system">Automático</option>
            </select>
            <button className={c.automation_paused?'return':'takeover'} disabled={busy===c.external_id} onClick={()=>patchContact(c.external_id,{automationPaused:!c.automation_paused})}>{c.automation_paused?'Devolver ao Snake':'Assumir conversa'}</button>
          </div>
        </article>)}
      </div>
    </section>
    <footer>SNAKE OS • painel de controle Venom Code</footer>
  </main>;
}
