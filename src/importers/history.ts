import {readFile,stat,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseWhatsAppExport} from './whatsapp-export.js';
import {detectSystemMessage} from '../core/system-detector.js';
import {preflight} from '../policies/preflight.js';
import {isProtectedContact,upsertContact,setContactMode,saveMessage,findOpenCaseId,loadMemory,saveMemory} from '../db/repository.js';
import {pool} from '../db/pool.js';
import {toneFor} from '../memory/compact.js';
import type {ContactMode} from '../types/domain.js';
export function parseExportDate(raw:string,offset='-03:00') {
  const m=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!m||!/^[-+]\d{2}:\d{2}$/.test(offset))throw new Error('invalid_export_date');
  const [d,mo,y,h,mi,s]=[Number(m[1]),Number(m[2]),Number(m[3])<100?2000+Number(m[3]):Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]??0)];
  const utc=new Date(Date.UTC(y,mo-1,d,h,mi,s));
  if(utc.getUTCFullYear()!==y||utc.getUTCMonth()!==mo-1||utc.getUTCDate()!==d||h>23||mi>59||s>59)throw new Error('invalid_export_date');
  const iso=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}${offset}`;
  const timestamp=new Date(iso);if(!Number.isFinite(timestamp.getTime()))throw new Error('invalid_timezone');return timestamp.toISOString();
}
export function mediaReference(text:string) {
  const m=text.match(/^([^\r\n]+?\.(?:opus|ogg|mp3|m4a|wav|jpg|jpeg|png|webp|pdf|mp4|docx))\s*(?:\((?:arquivo anexado|file attached)\)|<anexado:.*>)?$/i);
  if(!m||m[1].includes('/')||m[1].includes('\\')||m[1].includes('..'))return null;return m[1];
}
export async function importHistory(args:{file:string;externalId:string;displayName:string;owners:string[];mode:ContactMode;offset?:string}) {
  const dummy={contactId:args.externalId,contactName:args.displayName,chatId:args.externalId,isGroup:false,text:'history',timestamp:new Date().toISOString()};
  if(!preflight(dummy).allowed||await isProtectedContact(args.externalId,args.displayName))throw new Error('protected_history');
  const input=await readFile(path.resolve(args.file),'utf8');
  const all=parseWhatsAppExport(input).filter(m=>!m.isSystem&&m.author&&!detectSystemMessage(m.text).isSystem);
  const owners=new Set(args.owners.map(n=>n.toLowerCase().trim()));
  // Validate every date before the first mutation.
  const source=all.map(m=>({...m,timestamp:parseExportDate(m.occurredAtRaw,args.offset),fromMe:owners.has(m.author!.toLowerCase().trim())}));
  await upsertContact(args.externalId,args.displayName);await setContactMode(args.externalId,args.mode);
  let caseId=await findOpenCaseId(args.externalId);
  if(args.mode==='negotiation'&&!caseId) {
    const r=await pool.query(`INSERT INTO cases(contact_id,title,summary,risk_level) VALUES((SELECT id FROM contacts WHERE external_id=$1),'Histórico importado','Alegações históricas não confirmam saldo ou mandato.','high') RETURNING id`,[args.externalId]);caseId=r.rows[0].id;
    await pool.query('INSERT INTO negotiation_mandates(case_id) VALUES($1)',[caseId]);
  }
  let mediaCount=0;
  const occurrence=new Map<string,number>();
  const memory=await loadMemory(args.externalId);
  for(const m of source) {
    const digest=createHash('sha256').update(JSON.stringify([args.externalId,m.occurredAtRaw,m.author,m.text])).digest('hex');
    const repeat=occurrence.get(digest)??0;occurrence.set(digest,repeat+1);
    const filename=mediaReference(m.text),audio=filename&&/\.(opus|ogg|mp3|m4a|wav)$/i.test(filename);
    const row=await saveMessage({...dummy,externalMessageId:`history:${digest}:${repeat}`,text:m.text,timestamp:m.timestamp,fromMe:m.fromMe,mediaType:filename?(audio?'audio':'other'):undefined},{caseId,author:m.fromMe?'dimas':'counterparty'});
    await pool.query('UPDATE messages SET occurred_at_raw=$2 WHERE id=$1',[row.id,m.occurredAtRaw]);
    if(filename) {
      const original=path.resolve(path.dirname(args.file),filename);
      const fileInfo=await stat(original).catch(()=>null);
      if(fileInfo?.isFile() && fileInfo.size<=50*1024*1024) {
        const real=await import('node:fs/promises').then(fs=>fs.realpath(original));
        const baseReal=await import('node:fs/promises').then(fs=>fs.realpath(path.dirname(path.resolve(args.file))));
        if(!real.startsWith(baseReal+path.sep))throw new Error('media_outside_export');
        const hash=createHash('sha256').update(await readFile(real)).digest('hex');
        const dest=path.resolve('data/private/media',hash+path.extname(filename).toLowerCase());await mkdir(path.dirname(dest),{recursive:true});await copyFile(real,dest);
        await pool.query('INSERT INTO message_media(message_id,filename,mime_type,sha256,local_path) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[row.id,filename,audio?'audio/ogg':'application/octet-stream',hash,dest]);mediaCount++;
      }
    }else if(!m.fromMe) {
      if(/\b(quero|preciso|busco)\b/i.test(m.text))memory.goal=m.text.slice(0,350);
      if(/\b(tenho|possuo|j[aá] temos|j[aá] tenho)\b/i.test(m.text)&&memory.facts.length<24&&!memory.facts.some(f=>f.source===row.id)) memory.facts.push({key:`relato_${memory.facts.length+1}`,value:m.text.slice(0,350),source:row.id,confirmed:false});
      memory.tone=toneFor(m.text);
    }
  }
  memory.summary=`Histórico importado: ${source.length} mensagens com datas originais. Conteúdo é fonte histórica, não confirmação atual. ${source.filter(m=>!m.fromMe&&!mediaReference(m.text)).slice(-3).map(m=>m.text.slice(0,220)).join(' | ')}`.slice(0,1000);
  memory.nextAction='Revisar fatos e perguntas pendentes do histórico; não pedir briefing já informado.';
  await saveMemory(args.externalId,memory);
  return {imported:source.length,media:mediaCount,caseId,aiCalls:0};
}
