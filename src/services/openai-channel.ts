import type { ContactMode, GenericContext } from '../types/domain.js';
import { handleIncoming } from '../core/orchestrator.js';
export async function getChannelReply(mode:ContactMode,context:GenericContext,incoming:string):Promise<string> {
  const id=context.contactId??'preview';
  const result=await handleIncoming({contactId:id,chatId:id,contactName:context.contactName,isGroup:false,text:incoming,timestamp:new Date().toISOString()},
    {profile:{contactId:id,defaultMode:mode,isProtected:false},generic:context});
  return result.reply??'Recebi. Estou conferindo esse ponto.';
}
