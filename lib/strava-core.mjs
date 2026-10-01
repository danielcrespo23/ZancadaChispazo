// Provider data stays in a transient cache, never in runner_state or the coach.
export const CACHE_SECONDS=7*86400;
export const scopeList=value=>String(value||'').split(/[ ,]+/).filter(Boolean);
export const canReadActivities=scopes=>scopes.includes('activity:read')||scopes.includes('activity:read_all');
export const randomSecret=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return b64(b);};
const b64=b=>btoa(String.fromCharCode(...b));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function digest(value){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
async function key(secret){const b=un64(secret||'');if(b.length!==32)throw Error('encryption_not_configured');return crypto.subtle.importKey('raw',b,'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value,secret,owner){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await key(secret),new TextEncoder().encode(JSON.stringify(value)));return `v1.${b64(iv)}.${b64(new Uint8Array(data))}`;}
export async function open(value,secret,owner){const [v,iv,data]=value.split('.');if(v!=='v1')throw Error('cipher_version');const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:new TextEncoder().encode(owner)},await key(secret),un64(data));return JSON.parse(new TextDecoder().decode(raw));}
const metric=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
export function allowedRun(a,settings={}){const sport=a.sport_type||a.type;if(!['Run','TrailRun','VirtualRun'].includes(sport))return false;if(sport==='TrailRun'&&settings.includeTrail===false)return false;if((sport==='VirtualRun'||a.trainer===true)&&settings.includeTreadmill===false)return false;return true;}
export function normalizeRun(a){
 const meters=metric(a.distance),moving=metric(a.moving_time),km=meters==null?null:meters/1000;
 const local=String(a.start_date_local||'');
 if(!/^\d{4}-\d{2}-\d{2}T/.test(local))throw Error('invalid_local_date');
 return {externalId:String(a.id),name:String(a.name||'Carrera'),date:local.slice(0,10),localTime:local.slice(11,19),startDate:a.start_date||null,timezone:a.timezone||null,sportType:a.sport_type||a.type,terrain:a.trainer||a.sport_type==='VirtualRun'?'treadmill':a.sport_type==='TrailRun'?'trail':null,distance:km,movingSeconds:moving,elapsedSeconds:metric(a.elapsed_time),paceSeconds:km>0&&moving>0?moving/km:null,speedKmh:km>0&&moving>0?km*3600/moving:null,avgHR:metric(a.average_heartrate),maxHR:metric(a.max_heartrate),elevation:metric(a.total_elevation_gain),cadence:metric(a.average_cadence),deviceName:a.device_name||null,url:`https://www.strava.com/activities/${a.id}`,laps:(a.laps||[]).map(l=>({name:l.name||null,distance:metric(l.distance)==null?null:l.distance/1000,movingSeconds:metric(l.moving_time),elapsedSeconds:metric(l.elapsed_time),avgHR:metric(l.average_heartrate),maxHR:metric(l.max_heartrate),cadence:metric(l.average_cadence),paceSeconds:l.distance>0&&l.moving_time>0?l.moving_time/(l.distance/1000):null}))};
}
export class ProviderError extends Error{constructor(status,retryAt=0){super(status===401?'authorization_expired':status===403?'insufficient_permissions':status===429?'rate_limited':'connection_error');this.status=status;this.retryAt=retryAt;}}
export async function rotateTokens(tokens,config,fetcher=fetch){if(!tokens.refreshToken||!config.STRAVA_CLIENT_ID||!config.STRAVA_CLIENT_SECRET)throw new ProviderError(401);const r=await fetcher('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.STRAVA_CLIENT_ID,client_secret:config.STRAVA_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:tokens.refreshToken}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw new ProviderError(r.status===400?401:r.status);const d=await r.json();if(!d.access_token||!d.refresh_token||!Number.isFinite(d.expires_at))throw new ProviderError(502);return {accessToken:d.access_token,refreshToken:d.refresh_token,expiresAt:d.expires_at};}
export const safeError=e=>e instanceof ProviderError?e.message:'connection_error';
