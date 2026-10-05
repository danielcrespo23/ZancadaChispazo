import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {storage} from '../../../db/state';
import {readState,readStateRevision} from '../../../lib/state-store.mjs';
import {chatReply,modelStatus} from '../../../lib/coach-chat.mjs';
import {hasAIConsent} from '../../../lib/coach-consent.mjs';
import {coachConversations} from '../../../lib/coach-conversation.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const config=()=>({ZANCADA_OLLAMA_ENABLED:import.meta.env.DEV?(env as Record<string,string>).ZANCADA_OLLAMA_ENABLED:'false',OLLAMA_MODEL:(env as Record<string,string>).OLLAMA_MODEL});
export async function GET(){const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión.'},401);const status=await modelStatus(config());return json({...status,defaultMode:'rules',apiRequired:false,localOnly:true});}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión con tu propia cuenta.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
 try{const text=await request.text();if(text.length>10000)return json({error:'Consulta demasiado grande.'},413);const input=JSON.parse(text);
  if(!input||Object.keys(input).some(k=>!['question','mode','revision','conversationId'].includes(k))||input.conversationId!=null&&(typeof input.conversationId!=='string'||!/^[-a-f0-9]{36}$/.test(input.conversationId)))return json({error:'Envía solo pregunta, modo, revisión e identificador de conversación; el contexto se obtiene de tu cuenta.'},400);
  const db=storage(),snapshot=await readState(db,user.userId);if(!snapshot.state)return json({error:'Crea tu perfil para consultar tu entrenamiento.'},400);
  if(input.revision!==snapshot.revision)return json({error:'Tus datos han cambiado. Recarga antes de consultar.'},409);
  if(input.mode==='ollama'&&!hasAIConsent(snapshot.state))return json({error:'Autoriza los datos manuales con IA en Mi entrenador.'},403);
  const context=coachConversations.read(user.userId,input.conversationId);
  const result=await chatReply(snapshot.state,input,config(),fetch,{context,scopeKey:user.userId+':real'});
  if(await readStateRevision(db,user.userId)!==snapshot.revision)return json({error:'Tu contexto ha cambiado durante la respuesta. Consulta de nuevo.'},409);
  const conversationId=coachConversations.save(user.userId,input.conversationId,result.context);
  return json({...result,conversationId,revision:snapshot.revision,calendarChanged:false});
 }catch{return json({error:'No se pudo procesar la consulta. El asistente por reglas sigue disponible.'},400);}
}
