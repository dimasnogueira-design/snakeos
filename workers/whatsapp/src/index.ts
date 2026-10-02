import 'dotenv/config';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import {writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
const {Client,LocalAuth}=pkg;
const CORE=(process.env.SNAKE_CORE_URL||'http://127.0.0.1:8787').replace(/\/$/,'');
const KEY=process.env.SNAKE_WORKER_KEY||'';
const protectedIds=new Set([process.env.RAFAELLA_CONTACT_ID,...(process.env.PROTECTED_CONTACT_IDS||'').split(',')].filter(Boolean));
const protectedNames=['Rafaella',...(process.env.PROTECTED_CONTACT_NAMES||'').split(',')].map(n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()).filter(Boolean);
const enabled=process.env.WHATSAPP_ENABLED==='true';
if(!enabled)throw new Error('WHATSAPP_ENABLED=false: worker desativado.');
if(KEY.length<32)throw new Error('Configure SNAKE_WORKER_KEY com pelo menos 32 caracteres.');
if(!process.env.RAFAELLA_CONTACT_ID)throw new Error('Configure RAFAELLA_CONTACT_ID antes de conectar WhatsApp.');
const client=new Client({authStrategy:new LocalAuth({dataPath:process.env.WHATSAPP_SESSION_PATH||'./.wwebjs_auth'}),authTimeoutMs:120000,webVersionCache:{type:'none'},
  puppeteer:{headless:process.env.PUPPETEER_HEADLESS!=='false',executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-setuid-sandbox']}});
// Even cache type 'none' installs an unsafe async response-body listener in 1.34.7.
// Use the live page and omit HTML caching entirely; LocalAuth still saves login.
(client as any).initWebVersionCache=async()=>{};
// The library polls evaluate() before WhatsApp's initial redirects finish.
// Puppeteer's WaitTask survives navigation; wait for the page before injecting.
const initialInject=(client as any).inject.bind(client);
let injection:Promise<void>|undefined;
(client as any).inject=async()=>{
  if(injection)return injection;
  injection=(async()=>{
    for(let attempt=0;attempt<3;attempt++){
      try{
        await (client as any).pupPage.waitForFunction('window.Debug?.VERSION !== undefined',{timeout:120000,polling:200});
        await initialInject();return;
      }catch(error){
        if(attempt===2 || !(error instanceof Error) || !/Execution context was destroyed|Cannot find context/i.test(error.message))throw error;
        // Retry only page initialization interrupted by navigation. Never resend messages.
        await new Promise(resolve=>setTimeout(resolve,500));
      }
    }
  })();
  try{await injection;}finally{injection=undefined;}
};
async function core(path:string,body:unknown):Promise<any>{
  const r=await fetch(`${CORE}${path}`,{method:'POST',headers:{'content-type':'application/json','x-snake-worker-key':KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});
  if(!r.ok)throw new Error('core_request_failed');return r.json();
}
const logFailure=(code:string)=>console.error(JSON.stringify({code,at:new Date().toISOString()}));
client.on('qr',qr=>qrcode.generate(qr,{small:true}));
client.on('ready',async()=>{console.log('WhatsApp conectado em modo controlado');try{await core('/v5/worker/status',{status:'ready'});}catch{logFailure('status_failed');}});
client.on('disconnected',async()=>{try{await core('/v5/worker/status',{status:'disconnected'});}catch{logFailure('status_failed');}});
setInterval(()=>{if(client.info)void core('/v5/worker/status',{status:'ready'}).catch(()=>logFailure('heartbeat_failed'));},30000);
client.on('incoming_call',async(call:any)=>{
  const from=String(call.from||'');
  // Server policy is authoritative. Unavailable server => reject, except known Rafaella ID.
  let allow=from===process.env.RAFAELLA_CONTACT_ID;
  try{allow=(await core('/v6/worker/call',{from})).allow===true;}catch{logFailure('call_gate_failed');}
  if(!allow)try{await call.reject();}catch{logFailure('call_rejection_failed');}
});
async function metadata(msg:any) {
  const chatId=String(msg.fromMe?msg.to:msg.from||'');
  if(!chatId||chatId.endsWith('@g.us')||chatId.endsWith('@broadcast')||protectedIds.has(chatId))return null;
  const contact=await msg.getContact();
  // WhatsApp can identify chats with @lid; also check the resolved phone number.
  if(contact?.number && protectedIds.has(`${String(contact.number).replace(/\D/g,'')}@c.us`))return null;
  const contactName=contact?.name||contact?.pushname||contact?.shortName||undefined;
  const norm=String(contactName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if(protectedNames.some(n=>norm===n||norm.startsWith(n+' ')))return null;
  return {externalMessageId:String(msg.id?._serialized||msg.id?.id||''),contactId:chatId,contactName,chatId,isGroup:false,fromMe:Boolean(msg.fromMe),
    text:String(msg.body||'').trim(),timestamp:new Date(Number(msg.timestamp)*1000).toISOString(),
    mediaType:msg.type==='ptt'||msg.type==='audio'?'audio':msg.hasMedia?'other':undefined};
}
client.on('message',async(msg:any)=>{
  if(msg.fromMe)return;
  try{
    const message=await metadata(msg);if(!message)return;
    const gate=await core('/v6/worker/gate',message);
    if(!gate.allowed){if(gate.captureOnly && message.text && !message.mediaType)await core('/v3/process',message);return;}
    if(message.mediaType==='audio') {
      if(!gate.canTranscribe)return;
      const media=await msg.downloadMedia();if(!media?.mimetype?.startsWith('audio/'))return;
      const t=await core('/v5/worker/transcribe',{message,filename:`${msg.id?.id||'received'}.ogg`,mimeType:media.mimetype,dataBase64:media.data});
      message.text=String(t.text||'').trim();if(!message.text)return;
    }
    const result=await core('/v3/process',message);
    if(!result.autoSend||!result.deliveryId)return;
    const count=Math.min(3,result.replyParts?.length||0);
    for(let index=0;index<count;index++) {
      const claim=await core(`/v6/worker/delivery/${result.deliveryId}/claim`,{index});
      if(!claim.allowed||claim.contactId!==message.chatId)break;
      try{
        const sent=await client.sendMessage(message.chatId,String(claim.text));
        await core(`/v6/worker/delivery/${result.deliveryId}/ack`,{index,externalMessageId:sent.id?._serialized});
      }catch{await core(`/v6/worker/delivery/${result.deliveryId}/ack`,{index,failed:true});break;}
    }
  }catch{logFailure('message_processing_failed');}
});
client.on('message_create',async(msg:any)=>{
  if(!msg.fromMe)return;
  try{const m=await metadata(msg);if(m?.text)await core('/v6/worker/own',m);}catch{logFailure('own_message_capture_failed');}
});
void client.initialize().catch(async(error:unknown)=>{
  const detail=error instanceof Error?error.message:String(error);
  await writeFile(join(dirname(process.env.WHATSAPP_SESSION_PATH||'./.wwebjs_auth'),'worker-init-error.txt'),detail).catch(()=>{});
  const code=/timeout|timed out/i.test(detail)?'whatsapp_initialization_timeout':/context was destroyed/i.test(detail)?'whatsapp_navigation_changed':/browser|target closed/i.test(detail)?'whatsapp_browser_closed':'whatsapp_initialization_failed';
  logFailure(code);
  console.error('Nao foi possivel conectar. Nenhuma mensagem foi enviada. Reinicie a janela de conexao.');
  try{await core('/v5/worker/status',{status:'disconnected'});}catch{}
  try{await client.destroy();}catch{}
  process.exitCode=1;
  process.exit(1);
});
