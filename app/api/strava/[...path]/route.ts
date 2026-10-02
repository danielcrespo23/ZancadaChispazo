import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {stravaService} from '../../../../lib/strava-runtime';
import {oauthCookie,oauthCookieValue,stravaDiagnostic} from '../../../../lib/strava-diagnostics.mjs';
import {STRAVA_API,randomSecret,ProviderError} from '../../../../lib/strava-core.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const messages:Record<string,string>={authorization_denied:'Has cancelado la autorización en Strava. Puedes volver a conectar cuando quieras.',connection_busy:'Espera unos segundos antes de volver a validar una conexión.',configuration_pending:'Falta configurar la aplicación de Strava en el servidor.',retention_pending:'Falta activar y comprobar el proceso de limpieza y sincronización del servidor.',invalid_oauth_state:'La autorización ha caducado o pertenece a otra sesión. Vuelve a conectar.',athlete_already_linked:'Esta cuenta de Strava ya está asociada a otro usuario de Zancada.',disconnect_first:'Desconecta la cuenta anterior antes de conectar otra.',authorization_expired:'La autorización ha caducado. Vuelve a conectar Strava.',insufficient_permissions:'Strava no ha concedido los permisos de lectura necesarios.',not_connected:'Conecta tu cuenta antes de sincronizar.',invalid_token:'Introduce un access token válido.',invalid_note:'Revisa esfuerzo, fatiga y molestias.',not_found:'No se encuentra esta actividad en tu cuenta.'};
const failure=(e:any)=>json({error:messages[e.message]||'No se pudo contactar con Strava. Reintenta más tarde.',code:messages[e.message]?e.message:e instanceof ProviderError?e.message:'connection_error'},e.message==='not_found'?404:e instanceof ProviderError&&[401,403].includes(e.status)?422:400);
const path=(r:Request)=>new URL(r.url).pathname.split('/').filter(Boolean).slice(2);
const cfg=()=>env as any;
export async function GET(request:Request){const parts=path(request),service=stravaService(request),config=cfg();
 try{
 if(parts[0]==='webhook'){if(!config.STRAVA_WEBHOOK_PATH_SECRET||parts[1]!==config.STRAVA_WEBHOOK_PATH_SECRET)return json({error:'No disponible'},404);const u=new URL(request.url);if(u.searchParams.get('hub.mode')!=='subscribe'||u.searchParams.get('hub.verify_token')!==config.STRAVA_WEBHOOK_VERIFY_TOKEN)return json({error:'No autorizado'},403);return json({'hub.challenge':u.searchParams.get('hub.challenge')});}
 const user=await getChatGPTUser();if(!user){if(parts[0]==='callback'){stravaDiagnostic({stage:'callback',outcome:'login_required'});return new Response(null,{status:303,headers:{Location:'/?strava=login_required','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}return json({error:'Inicia sesión con tu propia cuenta.'},401);}
 if(parts[0]==='status')return json(await service.status(user.userId));
 if(parts[0]==='diagnostics'){
  if(!await service.lock('diagnostic:'+user.userId,30))return json({error:'Espera 30 segundos antes de repetir el diagnóstico.'},429);
  const connection=await service.connection(user.userId);
  let network:any;
  try{
   // No token is sent: 401 is the expected authenticated-endpoint response.
   const probe=await service.fetcher(STRAVA_API+'/athlete',{signal:AbortSignal.timeout(8000)});
   network={reachable:true,httpStatus:probe.status};
   stravaDiagnostic({stage:'network_probe',outcome:'reachable',httpStatus:probe.status});
  }catch(e:any){
   network={reachable:false,code:e.cause?.code==='EACCES'?'network_blocked':e.name==='TimeoutError'?'network_timeout':'network_unreachable'};
   stravaDiagnostic({stage:'network_probe',outcome:network.code});
  }
  return json({network,configured:service.configured(),accountLinked:Boolean(connection),connected:false,verification:'La comprobación de red no valida el token ni confirma conexión.',localLive:service.localLive,scopes:connection?JSON.parse(connection.scopes):[],lastSync:connection?.last_sync||null});
 }
 if(parts[0]==='callback'){const url=new URL(request.url),cookie=oauthCookieValue(request);let code='connected';try{if(url.searchParams.get('error'))throw Error('authorization_denied');const initial:any=await service.finish(user.userId,url.searchParams.get('state')||'',cookie,url.searchParams.get('code')||'',url.searchParams.get('scope')||'');if(initial?.error)code='sync_failed';else if(!initial?.syncCompleted)code='authorized';stravaDiagnostic({stage:'callback',outcome:code});}catch(e:any){stravaDiagnostic({stage:'callback',outcome:e instanceof ProviderError?e.message:messages[e.message]?e.message:'connection_error',httpStatus:e.status||0,cookiePresent:Boolean(cookie)});code=messages[e.message]?e.message:e instanceof ProviderError?e.message:'connection_error';}return new Response(null,{status:303,headers:{Location:`/?strava=${encodeURIComponent(code)}`,'Set-Cookie':oauthCookie(request,'',{local:service.localLive,clear:true}),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
 return json({error:'No disponible'},404);
 }catch(e){return failure(e);}}
export async function POST(request:Request){const parts=path(request),service=stravaService(request),config=cfg();try{
 if(parts[0]==='tick'){if(!config.STRAVA_JOB_SECRET||request.headers.get('authorization')!==`Bearer ${config.STRAVA_JOB_SECRET}`)return json({error:'No autorizado'},403);await service.background();return json({ok:true});}
 if(parts[0]==='webhook'){if(!config.STRAVA_WEBHOOK_PATH_SECRET||parts[1]!==config.STRAVA_WEBHOOK_PATH_SECRET)return json({error:'No disponible'},404);const raw=await request.text();if(raw.length>10000)return json({error:'Evento inválido'},413);await service.webhook(JSON.parse(raw));return json({ok:true});}
 const user=await getChatGPTUser();if(!user)return json({error:'Inicia sesión con tu propia cuenta.'},401);
 // Browser mutations require an exact origin, including token submission.
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido'},403);
 const raw=await request.text();if(raw.length>12000)return json({error:'Solicitud demasiado grande'},413);const body=raw?JSON.parse(raw):{};
 if(parts[0]==='connect'){const cookie=randomSecret();const url=await service.begin(user.userId,body,cookie);return Response.json({url},{headers:{'Set-Cookie':oauthCookie(request,cookie,{local:service.localLive}),'Cache-Control':'no-store'}});}
 if(parts[0]==='sync'){await service.setSettings(user.userId,body);const status:any=await service.sync(user.userId,body.fullHistory?body.days:undefined);await service.drain();return status?.error?json(status,status.state==='rate_limited'?429:502):json({ok:true,...(status?{status}:{})});}
 if(parts[0]==='process'){await service.drain();return json({ok:true});}
 if(parts[0]==='disconnect')return json(await service.disconnect(user.userId));
 if(parts[0]==='notes'){await service.note(user.userId,String(body.id),body);return json({ok:true});}
 if(parts[0]==='delete-notes'){await service.q('DELETE FROM strava_notes WHERE id=? AND user_id=?',String(body.id),user.userId).run();return json({ok:true});}
 return json({error:'No disponible'},404);
 }catch(e){return failure(e);}}
