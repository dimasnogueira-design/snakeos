'use client';
import {useEffect,useState} from 'react';
type Memory={goal:string;pain:string;summary:string;facts:Array<{key:string;value:string;source:string;confirmed:boolean}>;openQuestions:string[];commitments:Array<{text:string;confirmed:boolean}>;decisions:string[];nextAction:string;persona:string;tone:Record<string,string|number>};
type Detail={contact:{display_name:string;external_id:string};memory:Memory;messages:Array<{author:string;text:string;occurred_at:string}>;decisions:Array<{proposed_reply:string;requires_approval:boolean;risk:string}>;handoffs:Array<{from_persona:string;to_persona:string;context_packet:unknown}>};
export default function ContactDetail({id,request,onClose}:{id:string;request:(path:string,init?:RequestInit)=>Promise<any>;onClose:()=>void}) {
  const [data,setData]=useState<Detail|null>(null),[text,setText]=useState(''),[estimate,setEstimate]=useState<any>(null),[error,setError]=useState('');
  useEffect(()=>{request(`contacts/${encodeURIComponent(id)}`).then(setData).catch(()=>setError('Não foi possível abrir a conversa.'));},[id,request]);
  async function save(){if(!data)return;try{await request(`contacts/${encodeURIComponent(id)}/memory`,{method:'PATCH',body:JSON.stringify(data.memory)});setError('');}catch{setError('Não foi possível salvar o briefing.');}}
  async function simulate(){try{const r=await request('estimate',{method:'POST',body:JSON.stringify({contactId:id,contactName:data?.contact.display_name,chatId:id,isGroup:false,text,timestamp:new Date().toISOString()})});setEstimate(r);setError('');}catch{setError('Não foi possível estimar. Mensagem ou contexto excedem o limite.');}}
  const m=data?.memory;
  function field(key:'goal'|'pain'|'summary'|'nextAction',value:string){if(data)setData({...data,memory:{...data.memory,[key]:value}});}
  return <section className="panel detail"><div className="panelHead"><h2>{data?.contact.display_name??'Abrindo conversa…'}</h2><button className="ghost" onClick={onClose}>Fechar</button></div>{error&&<p className="error">{error}</p>}
    {m&&<><p className="eyebrow">{m.persona==='CHRISTIAN'?'Christian · Projetos e Comercial':'Jully · Atendimento e Operações'}</p><div className="detailGrid"><div>
      <label>Objetivo<input value={m.goal} onChange={e=>field('goal',e.target.value)}/></label><label>Problema principal<input value={m.pain} onChange={e=>field('pain',e.target.value)}/></label><label>Resumo vivo<textarea value={m.summary} onChange={e=>field('summary',e.target.value)}/></label><label>Próximo passo<input value={m.nextAction} onChange={e=>field('nextAction',e.target.value)}/></label>
      <h3>Fatos e alegações</h3>{m.facts.map((f,i)=><div key={i} className="fact"><span>{f.key}: {f.value}</span><label><input type="checkbox" checked={f.confirmed} onChange={e=>{if(data)setData({...data,memory:{...m,facts:m.facts.map((old,j)=>j===i?{...old,confirmed:e.target.checked,source:'admin'}:old)}});}}/>Confirmado por você</label></div>)}
      <h3>Perguntas pendentes</h3><textarea value={m.openQuestions.join('\n')} onChange={e=>data&&setData({...data,memory:{...m,openQuestions:e.target.value.split('\n').filter(Boolean)}})}/>
      <h3>Compromissos</h3>{m.commitments.length?m.commitments.map((c,i)=><p key={i}>{c.text} · {c.confirmed?'confirmado':'alegação'}</p>):<p className="muted">Sem compromissos registrados.</p>}
      <button onClick={save}>Salvar briefing</button><h3>Transferências de atendimento</h3>{data?.handoffs.map((h,i)=><p key={i}>{h.from_persona} → {h.to_persona} · briefing completo preservado</p>)}
    </div><div><h3>Histórico recente</h3><div className="messages">{data?.messages.map((msg,i)=><p key={i} className={`message ${msg.author==='counterparty'?'customer':'team'}`}><small>{msg.author==='counterparty'?'Cliente':'Equipe'} · {new Date(msg.occurred_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</small>{msg.text}</p>)}</div><h3>Últimos rascunhos</h3>{data?.decisions.map((d,i)=><p className="draft" key={i}><small>{d.requires_approval?'Aguardando revisão':'Rascunho'} · risco {d.risk}</small>{d.proposed_reply||'Sem resposta segura para enviar.'}</p>)}</div></div>
      <h3>Estimar antes de usar</h3><p className="muted">Não usa a API e não envia mensagem.</p><textarea placeholder="Mensagem para simular" value={text} onChange={e=>setText(e.target.value)}/><button disabled={!text.trim()} onClick={simulate}>Calcular estimativa</button>
      {estimate&&<p className="estimate">{estimate.estimate?`${estimate.estimate.model} · aproximadamente ${estimate.estimate.inputTokensEstimate} tokens de entrada · teto conservador de ${(estimate.estimate.maxCostMicros/1e6).toFixed(5)} USD por chamada, incluindo saída.`:`Sem chamada: ${estimate.reason??'resposta local'}. Custo: zero.`}</p>}
    </>}
  </section>;
}
