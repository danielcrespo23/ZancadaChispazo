import {getChatGPTUser} from '../../chatgpt-auth';
import {storage} from '../../../db/state';
import {readState,readStateRevision,writeState} from '../../../lib/state-store.mjs';
import {receivePersonalActivities} from '../../../lib/activity-import.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function limitedText(request:Request){
 const limit=2000000;if(Number(request.headers.get('content-length'))>limit)throw Error('El envío supera 2 MB.');const reader=request.body?.getReader();if(!reader)return '';const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw Error('El envío supera 2 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión.'},401);
 try{return json({revision:await readStateRevision(storage(),user.userId)});}catch{return json({error:'No se pudo comprobar el estado recibido.'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión con tu propia cuenta.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
 try{
  const text=await limitedText(request);
  const body=JSON.parse(text);if(body.source!=='personal-file'||body.consent!==true)return json({error:'Esta recepción solo admite archivos propios autorizados.'},400);
  const db=storage(),snapshot=await readState(db,user.userId);if(!snapshot.state)return json({error:'Crea tu perfil antes de recibir actividades.'},400);
  if(body.revision!==snapshot.revision)return json({error:'Tus datos han cambiado. Recarga antes de recibir actividades.'},409);
  const input=body.prepared??body.activities,result=receivePersonalActivities(snapshot.state,input,{consent:true,selectedIndices:body.selectedIndices??null,duplicateDecisions:body.duplicateDecisions??[]});
  if(!result.received.length&&!result.linked.length)return json({received:[],linked:[],duplicates:result.duplicates,invalid:result.invalid,excluded:result.excluded,revision:snapshot.revision,issues:result.preview.filter(r=>r.status!=='ready').map(r=>({index:r.index,reason:r.reason}))});
  const saved=await writeState(db,user.userId,result.state,snapshot.revision);if(saved.status!==200)return json({error:saved.error},saved.status);
  return json({received:result.received,linked:result.linked,duplicates:result.duplicates,invalid:result.invalid,excluded:result.excluded,revision:saved.revision,issues:result.preview.filter(r=>r.status!=='ready').map(r=>({index:r.index,reason:r.reason}))});
 }catch(error){const message=error instanceof Error?error.message:'No se pudo recibir el archivo.';return json({error:message},message==='El envío supera 2 MB.'?413:400);}
}
