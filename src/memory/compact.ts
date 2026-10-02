import { env } from '../config/env.js';
import type { ConversationMemory, GenericContext } from '../types/domain.js';
export function emptyMemory():ConversationMemory {
  return {goal:'',pain:'',summary:'',facts:[],openQuestions:[],commitments:[],decisions:[],nextAction:'Identificar objetivo',persona:'JULLY',tone:{formality:.5,warmth:.5,pace:'short',sentiment:'neutral'}};
}
export function toneFor(text:string) {
  return {formality:/prezados|solicito|cordialmente/i.test(text)?.9:/mano|irm[aã]o|opa|fala|kkkk/i.test(text)?.2:.5,
    warmth:.5,urgency:/urgente|agora|hoje/i.test(text)?.9:.3,
    technicality:/api|dns|backend|ssl|webhook/i.test(text)?.8:.3,
    verbosity:text.length>400?.6:.2,emoji_level:/\p{Extended_Pictographic}/u.test(text)?.3:0,
    slang_level:/mano|irm[aã]o|kkkk/i.test(text)?.4:0,pace:text.length<100?'short':'normal',
    sentiment:/absurdo|irritado|enrolando|calote/i.test(text)?'frustrated':'neutral'};
}
export function buildCompactInput(context:GenericContext,incoming:string) {
  if(Buffer.byteLength(incoming,'utf8')>4000) throw new Error('message_too_large');
  const recent=context.recentMessages.slice(-env.CONTEXT_RECENT_MESSAGES).map(m=>({role:m.role,text:m.text.slice(0,700)}));
  if(recent.at(-1)?.text===incoming) recent.pop();
  const data={name:context.contactName.slice(0,80),memory:context.memory??emptyMemory(),confirmed:(context.knownFacts??[]).slice(0,20),
    retrieved:(context.retrievedMessages??[]).slice(0,4).map(m=>({...m,text:m.text.slice(0,700)})),recent,incoming};
  let json=JSON.stringify(data);
  while(Buffer.byteLength(json,'utf8')>env.AI_CONTEXT_MAX_BYTES && data.recent.length) {data.recent.shift();json=JSON.stringify(data);}
  if(Buffer.byteLength(json,'utf8')>env.AI_CONTEXT_MAX_BYTES) throw new Error('context_too_large');
  return json;
}
