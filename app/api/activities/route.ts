import {getChatGPTUser} from '../../chatgpt-auth';
import {storage} from '../../../db/state';
import {readState,readStateRevision,writeState} from '../../../lib/state-store.mjs';
import {receivePersonalActivities} from '../../../lib/activity-import.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión.'},401);
 try{return json({revision:await readStateRevision(storage(),user.userId)});}catch{return json({error:'No se pudo comprobar el estado recibido.'},503);}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión con tu propia cuenta.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
 try{
  const text=await request.text();if(text.length>2000000)return json({error:'El archivo supera 2 MB.'},413);
  const body=JSON.parse(text);if(body.source!=='personal-file'||body.consent!==true)return json({error:'Esta recepción solo admite archivos propios autorizados.'},400);
  const db=storage(),snapshot=await readState(db,user.userId);if(!snapshot.state)return json({error:'Crea tu perfil antes de recibir actividades.'},400);
  if(body.revision!==snapshot.revision)return json({error:'Tus datos han cambiado. Recarga antes de recibir actividades.'},409);
  const result=receivePersonalActivities(snapshot.state,body.activities,{consent:true});
  if(!result.received.length)return json({received:[],duplicates:result.duplicates,invalid:result.invalid,revision:snapshot.revision,issues:result.preview.filter(r=>r.status!=='ready').map(r=>({index:r.index,reason:r.reason}))});
  const saved=await writeState(db,user.userId,result.state,snapshot.revision);if(saved.status!==200)return json({error:saved.error},saved.status);
  return json({received:result.received,duplicates:result.duplicates,invalid:result.invalid,revision:saved.revision,issues:result.preview.filter(r=>r.status!=='ready').map(r=>({index:r.index,reason:r.reason}))});
 }catch(error){return json({error:error instanceof Error?error.message:'No se pudo recibir el archivo.'},400);}
}
