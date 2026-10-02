import OpenAI,{toFile} from 'openai';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {env} from '../config/env.js';
import {pool} from '../db/pool.js';
import {ingressGate,acquireContactLease,releaseContactLease} from '../memory/ingress.js';
import {getContactProfile,upsertContact,alertAdmin} from '../db/repository.js';
import {reserveUsage,settleUsage} from '../cost/budget.js';
import type {IncomingMessage} from '../types/domain.js';
import {detectSystemMessage} from '../core/system-detector.js';
const execFileAsync=promisify(execFile);
export async function transcribeBase64Audio(args:{filename:string;mimeType:string;dataBase64:string;message:IncomingMessage}) {
  const gate=await ingressGate({...args.message,mediaType:'audio'});
  if(!gate.allowed)return {text:'',ignored:true,reason:gate.reason};
  const profile=await getContactProfile(args.message.contactId,args.message.contactName);
  if(['unknown','system','protected'].includes(profile.defaultMode)) {
    await alertAdmin(args.message.contactId,'audio_needs_relevance_review');return {text:'',ignored:true,reason:'audio_not_relevant'};
  }
  const bytes=Buffer.from(args.dataBase64,'base64');
  if(!args.mimeType.startsWith('audio/')||!bytes.length||bytes.length>10*1024*1024)throw new Error('invalid_audio');
  const hash=createHash('sha256').update(bytes).digest('hex');
  const contact=await upsertContact(args.message.contactId,args.message.contactName);
  const cached=(await pool.query('SELECT transcript FROM audio_transcripts WHERE contact_id=$1 AND content_hash=$2',[contact.id,hash])).rows[0];
  if(cached)return {text:cached.transcript,cached:true};
  if(!env.AUDIO_ENABLED||env.AI_DRY_RUN||env.MOCK_AI)return {text:'',ignored:true,reason:'audio_disabled'};
  if(env.OPENAI_TRANSCRIBE_MODEL!=='gpt-4o-mini-transcribe')throw new Error('unpriced_audio_model');
  const token=await acquireContactLease(`audio:${args.message.contactId}`);
  if(!token)return {text:'',ignored:true,reason:'audio_busy'};
  let dir:string|undefined;
  try {
    const again=(await pool.query('SELECT transcript FROM audio_transcripts WHERE contact_id=$1 AND content_hash=$2',[contact.id,hash])).rows[0];
    if(again)return {text:again.transcript,cached:true};
    // Hash claim survives timeout/restart; paid uncertain audio is not automatically retried.
    const claim=await pool.query("INSERT INTO ingress_events(event_key,contact_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_key",[`audio:${contact.id}:${hash}`,args.message.contactId]);
    if(!claim.rows.length)return {text:'',ignored:true,reason:'audio_already_attempted'};
    dir=await mkdtemp(path.join(tmpdir(),'snake-audio-'));
    const filename=path.join(dir,'received.audio');await writeFile(filename,bytes);
    const result=await execFileAsync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',filename],{timeout:5000,maxBuffer:1000});
    const duration=Number(result.stdout.trim());
    if(!Number.isFinite(duration)||duration<=0||duration>env.AUDIO_MAX_SECONDS)throw new Error('audio_duration_invalid');
    // Conservative audio bound: 200 input tokens/second + maximum transcript of 2000 output tokens.
    const reserved=Math.ceil(duration*200*1.25+2000*5+512*1.25);
    const id=await reserveUsage({purpose:'audio:transcription',model:env.OPENAI_TRANSCRIBE_MODEL,maxCostMicros:reserved,externalId:args.message.contactId});
    let settled=false;
    try {
      const client=new OpenAI({apiKey:env.OPENAI_API_KEY,maxRetries:0,timeout:env.AI_TIMEOUT_MS});
      const file=await toFile(bytes,path.basename(args.filename),{type:args.mimeType});
      const output=await client.audio.transcriptions.create({file,model:env.OPENAI_TRANSCRIBE_MODEL,language:'pt',response_format:'json'});
      const u=(output as any).usage;
      const actual=u?.type==='tokens'?Math.ceil(Number(u.input_tokens)*1.25+Number(u.output_tokens)*5):reserved;
      await settleUsage(id,{costMicros:actual,inputTokens:u?.input_tokens,outputTokens:u?.output_tokens,durationSeconds:duration});settled=true;
      if(detectSystemMessage(output.text).isSystem)return {text:'',ignored:true,reason:'audio_system_filtered'};
      const latest=await ingressGate({...args.message,mediaType:'audio'});if(!latest.allowed)return {text:'',ignored:true,reason:latest.reason};
      await pool.query('INSERT INTO audio_transcripts(contact_id,content_hash,transcript,duration_seconds,model) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[contact.id,hash,output.text,duration,env.OPENAI_TRANSCRIBE_MODEL]);
      return {text:output.text,cached:false};
    }catch(error){if(!settled)await settleUsage(id,{error:'audio_provider_error',durationSeconds:duration});throw error;}
  }finally{if(dir)await rm(dir,{recursive:true,force:true});await releaseContactLease(`audio:${args.message.contactId}`,token);}
}
