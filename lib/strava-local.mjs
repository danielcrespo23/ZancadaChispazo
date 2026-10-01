import {StravaService} from './strava-service.mjs';
import {allowedRun,normalizeRun,safeError,ProviderError} from './strava-core.mjs';
import {stravaDiagnostic} from './strava-diagnostics.mjs';

// Activities live only in the current HTTP response. Credentials stay encrypted.
// This class is selected by the development runtime, never by an environment flag.
export class LocalStravaService extends StravaService {
 constructor(db,config,fetcher=fetch,{clock=()=>Date.now(),log=console.info}={}){super(db,{...config,STRAVA_RETENTION_JOB_ENABLED:'true'},fetcher);this.localLive=true;this.clock=clock;this.log=log;}
 diagnostic(event){stravaDiagnostic(event,this.log);}
 checklist(){return super.checklist().map(c=>c.id==='retention'?{...c,label:'Consulta local sin guardar actividades de Strava',done:true}:c.id==='webhook'?{...c,label:'Webhook: no necesario para consulta local',done:true}:c);}
 async purge(){await super.purge();await this.db.batch([this.q('DELETE FROM strava_cache'),this.q('DELETE FROM strava_jobs')]);}
 async sync(user){if(!await this.connection(user))throw Error('not_connected');return this.status(user);}
 async drain(){}
 async background(){await this.purge();}
 async cacheRun(){throw Error('local_storage_disabled');}
 async enqueue(){throw Error('local_storage_disabled');}
 async note(){throw Error('local_notes_disabled');}
 async status(user){
  const result=await super.status(user);
  result.localLive=true;result.retentionConfigured=true;result.policy.retentionDays=0;
  result.pending=0;result.backgroundConfigured=false;result.syncCompleted=false;
  const c=await this.connection(user);if(!c)return result;
  const settings=await this.settings(user),activities=new Map(),started=this.clock();
  const before=Math.floor(started/1000)+1,after=before-1-settings.days*86400;
  result.window={after,before,days:settings.days};
  result.partialVisibility=!JSON.parse(c.scopes).includes('activity:read_all');
  let pages=0,received=0,filtered=0,invalid=0;
  try{
   // Bounded pagination; no activity IDs, responses or retries are persisted.
   for(let page=1;page<=5;page++){
    const list=await this.api(c,`athlete/activities?after=${after-1}&before=${before}&page=${page}&per_page=200`);pages++;
    if(!Array.isArray(list))throw new ProviderError(502);
    received+=list.length;
    for(const raw of list){
     if(raw.athlete?.id&&String(raw.athlete.id)!==c.athlete_id)throw new ProviderError(403);
     const stamp=Date.parse(raw.start_date)/1000;
     if(!allowedRun(raw,settings)){filtered++;continue;}
     if(!Number.isFinite(stamp)){invalid++;continue;}
     if(stamp<after||stamp>=before){filtered++;continue;}
     try{if(raw.id==null)throw Error('missing_id');activities.set(String(raw.id),{id:String(raw.id),...normalizeRun(raw),notes:null});}catch{invalid++;}
    }
    if(list.length<200)break;
    if(page===5)result.truncated=true;
   }
   if((await this.connection(user))?.version!==c.version){result.activities=[];result.state='disconnected';result.account=null;return result;}
   if(invalid>0&&activities.size===0)throw new ProviderError(502);
   const stamp=Math.floor(this.clock()/1000);
   await this.q('UPDATE strava_connection SET status=?,last_sync=?,verified_at=? WHERE user_id=? AND version=?','connected',stamp,stamp,user,c.version).run();
   result.activities=[...activities.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.localTime.localeCompare(a.localTime));result.state='connected';result.syncCompleted=true;
   result.lastSync=result.lastVerified=stamp;result.invalidActivities=invalid;
   this.diagnostic({stage:'activities',outcome:'success',elapsedMs:this.clock()-started,pages,received,runs:activities.size,filtered,invalid,after,before,days:settings.days,privateAccess:!result.partialVisibility});
  }catch(e){
   result.activities=[];result.state=safeError(e);result.code=result.state;
   result.error=result.state==='authorization_expired'?'La autorización ha caducado o se ha revocado. Vuelve a conectar con Strava.':result.state==='insufficient_permissions'?'Strava no ha concedido los permisos necesarios. Vuelve a autorizar la lectura de actividades.':result.state==='rate_limited'?'Strava ha limitado temporalmente las consultas. Espera antes de sincronizar de nuevo.':'No se pudieron consultar las actividades de Strava. Comprueba la conexión a Internet y vuelve a sincronizar.';
   await this.q('UPDATE strava_connection SET status=? WHERE user_id=? AND version=?',result.state,user,c.version).run();
   this.diagnostic({stage:'activities',outcome:result.state,httpStatus:e.status||0,elapsedMs:this.clock()-started,pages,received});
  }
  return result;
 }
}
