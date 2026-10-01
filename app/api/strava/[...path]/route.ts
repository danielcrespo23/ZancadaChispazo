import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {stravaService} from '../../../../lib/strava-runtime';
import {randomSecret,ProviderError} from '../../../../lib/strava-core.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const messages:Record<string,string>={connection_busy:'Espera unos segundos antes de volver a validar una conexión.',configuration_pending:'Falta configurar la aplicación de Strava en el servidor.',retention_pending:'Falta activar y comprobar el proceso de limpieza y sincronización del servidor.',invalid_oauth_state:'La autorización ha caducado o pertenece a otra sesión. Vuelve a conectar.',athlete_already_linked:'Esta cuenta de Strava ya está asociada a otro usuario de Zancada.',disconnect_first:'Desconecta la cuenta anterior antes de conectar otra.',authorization_expired:'La autorización ha caducado. Vuelve a conectar Strava.',insufficient_permissions:'Strava no ha concedido los permisos de lectura necesarios.',not_connected:'Conecta tu cuenta antes de sincronizar.',invalid_token:'Introduce un access token válido.',invalid_note:'Revisa esfuerzo, fatiga y molestias.',not_found:'No se encuentra esta actividad en tu cuenta.'};
const failure=(e:any)=>json({error:messages[e.message]||'No se pudo contactar con Strava. Reintenta más tarde.',code:messages[e.message]?e.message:e instanceof ProviderError?e.message:'connection_error'},e.message==='not_found'?404:e instanceof ProviderError&&[401,403].includes(e.status)?422:400);
const path=(r:Request)=>new URL(r.url).pathname.split('/').filter(Boolean).slice(2);
const cfg=()=>env as any;
export async function GET(request:Request){const parts=path(request),service=stravaService(),config=cfg();
 try{
 if(parts[0]==='webhook'){if(!config.STRAVA_WEBHOOK_PATH_SECRET||parts[1]!==config.STRAVA_WEBHOOK_PATH_SECRET)return json({error:'No disponible'},404);const u=new URL(request.url);if(u.searchParams.get('hub.mode')!=='subscribe'||u.searchParams.get('hub.verify_token')!==config.STRAVA_WEBHOOK_VERIFY_TOKEN)return json({error:'No autorizado'},403);return json({'hub.challenge':u.searchParams.get('hub.challenge')});}
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión con tu propia cuenta.'},401);
 if(parts[0]==='status')return json(await service.status(user.userId));
 if(parts[0]==='callback'){const url=new URL(request.url),cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('zancada-strava='))?.slice(15)||'';let code='connected';try{if(url.searchParams.get('error'))throw Error('invalid_oauth_state');await service.finish(user.userId,url.searchParams.get('state')||'',cookie,url.searchParams.get('code')||'',url.searchParams.get('scope')||'');}catch(e:any){code=messages[e.message]?e.message:e instanceof ProviderError?e.message:'connection_error';}return new Response(null,{status:303,headers:{Location:`/?strava=${encodeURIComponent(code)}`,'Set-Cookie':'zancada-strava=; Max-Age=0; Path=/api/strava; HttpOnly; Secure; SameSite=Lax','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
 return json({error:'No disponible'},404);
 }catch(e){return failure(e);}}
export async function POST(request:Request){const parts=path(request),service=stravaService(),config=cfg();try{
 if(parts[0]==='tick'){if(!config.STRAVA_JOB_SECRET||request.headers.get('authorization')!==`Bearer ${config.STRAVA_JOB_SECRET}`)return json({error:'No autorizado'},403);await service.background();return json({ok:true});}
 if(parts[0]==='webhook'){if(!config.STRAVA_WEBHOOK_PATH_SECRET||parts[1]!==config.STRAVA_WEBHOOK_PATH_SECRET)return json({error:'No disponible'},404);const raw=await request.text();if(raw.length>10000)return json({error:'Evento inválido'},413);await service.webhook(JSON.parse(raw));return json({ok:true});}
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión con tu propia cuenta.'},401);
 // Browser mutations require an exact origin, including token submission.
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido'},403);
 const raw=await request.text();if(raw.length>12000)return json({error:'Solicitud demasiado grande'},413);const body=raw?JSON.parse(raw):{};
 if(parts[0]==='connect'){const cookie=randomSecret();const url=await service.begin(user.userId,body,cookie);return Response.json({url},{headers:{'Set-Cookie':`zancada-strava=${cookie}; Max-Age=900; Path=/api/strava; HttpOnly; Secure; SameSite=Lax`,'Cache-Control':'no-store'}});}
 if(parts[0]==='sync'){await service.setSettings(user.userId,body);await service.sync(user.userId,body.fullHistory?body.days:undefined);await service.drain();return json({ok:true});}
 if(parts[0]==='process'){await service.drain();return json({ok:true});}
 if(parts[0]==='disconnect')return json(await service.disconnect(user.userId));
 if(parts[0]==='notes'){await service.note(user.userId,String(body.id),body);return json({ok:true});}
 if(parts[0]==='delete-notes'){await service.q('DELETE FROM strava_notes WHERE id=? AND user_id=?',String(body.id),user.userId).run();return json({ok:true});}
 return json({error:'No disponible'},404);
 }catch(e){return failure(e);}}
