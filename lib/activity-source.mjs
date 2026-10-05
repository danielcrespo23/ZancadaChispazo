// Provider data is never made eligible by changing a label or adding consent.
export function isTrainingActivity(a){
 if(!a||a.source==='strava'||a.stravaId||a.provider==='strava'||a.origin==='strava-api')return false;
 if(a.importSources?.some(s=>s.source!=='personal-file'||s.origin!=='personal-device'||s.dataUseConsent!==true||s.provider==='strava'||s.stravaId))return false;
 if(a.source==='personal-file')return a.dataUseConsent===true&&a.origin==='personal-device';
 return (!a.source||a.source==='manual')&&!a.externalId;
}
export const activitySourceLabel=a=>a.source==='personal-file'?'Archivo propio autorizado':a.importSources?.length?'Registro en Zancada con archivo propio vinculado':'Registro en Zancada';
export const hasObservedMovingTime=a=>!a?.timeBasis||a.timeBasis==='moving';
export const activityTimeLabel=a=>({timer:'de cronómetro',recorded:'registrado',elapsed:'transcurrido'}[a?.timeBasis]||'en movimiento');
export const activityToday=timezone=>new Intl.DateTimeFormat('sv-SE',{timeZone:timezone||'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function localActivityDate(a,fallbackZone='Europe/Madrid'){
 if(!a.startedAt)return {date:a.date,timezone:a.timezone||fallbackZone};
 if(typeof a.startedAt!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(a.startedAt)||!Number.isFinite(Date.parse(a.startedAt)))throw Error('La hora de inicio necesita una fecha ISO con zona u offset.');
 const timezone=a.timezone||fallbackZone;let date;
 try{date=new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(a.startedAt));}catch{throw Error('Zona horaria de la actividad no válida.');}
 return {date:a.dateOverride?a.date:date,timezone,reportedDate:date};
}
