import {recordActivity,seconds,today,uid,validateActivity} from './engine.mjs';
import {duplicateActivity} from './activity-evidence.mjs';
import {activityToday,localActivityDate} from './activity-source.mjs';
import {known} from './profile-evidence.mjs';
const kinds=['unknown','warmup','main','work','recovery','cooldown'];
const types=['unknown','easy','recovery','long','walk','interval','tempo','hills','progressive','race'];
const optional=n=>known(n)?Number(n):null;
export function normalizePersonalActivity(input,timezone='Europe/Madrid'){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('El registro necesita un objeto de actividad.');
 if(input.source==='strava'||input.provider==='strava'||input.stravaId||input.origin==='strava-api')throw Error('Los datos de la API de Strava no están autorizados para este seguimiento.');
 if(!Array.isArray(input.laps||[]))throw Error('Las vueltas necesitan una lista.');
 for(const lap of input.laps||[]){if(!lap||typeof lap!=='object'||Array.isArray(lap))throw Error('Cada vuelta debe contener un objeto de bloque.');for(const key of ['distance','rpe','recoverySeconds','recoveryDistance'])if(lap[key]!=null&&lap[key]!==''&&!known(lap[key]))throw Error(`El dato ${key} de una vuelta no es numérico; omítelo si no lo sabes.`);}
 const distance=Number(input.distance),duration=known(input.seconds)?Number(input.seconds):seconds(input.time),dateInfo=localActivityDate({...input,dateOverride:false},timezone);
 const activity={id:uid(),...dateInfo,startedAt:input.startedAt||null,source:'personal-file',origin:'personal-device',dataUseConsent:true,
  externalId:String(input.externalId||input.id||`${input.startedAt||dateInfo.date}:${distance}:${duration}:${input.type||'unknown'}`).slice(0,200),
  name:String(input.name||'Actividad del archivo').slice(0,200),distance,seconds:duration,elapsedSeconds:optional(input.elapsedSeconds),
  type:types.includes(input.type)?input.type:'unknown',rpe:optional(input.rpe),fatigue:optional(input.fatigue),pain:['none','mild','relevant'].includes(input.pain)?input.pain:'unknown',
  feeling:['bien','normal','pesado','mal'].includes(input.feeling)?input.feeling:'unknown',performance:['better','expected','worse'].includes(input.performance)?input.performance:'unknown',
  terrain:['asphalt','trail','treadmill'].includes(input.terrain)?input.terrain:'unknown',temperature:optional(input.temperature),elevation:optional(input.elevation),avgHR:optional(input.avgHR),maxHR:optional(input.maxHR),
  measurement:['measured','estimated'].includes(input.measurement)?input.measurement:'unknown',notes:String(input.notes||'').slice(0,10000),sessionId:'',linkMode:'auto',
  laps:(input.laps||[]).map(l=>({id:uid(),kind:kinds.includes(l.kind)?l.kind:'unknown',distance:optional(l.distance)||0,seconds:known(l.seconds)?Number(l.seconds):seconds(l.time),rpe:optional(l.rpe),recoverySeconds:known(l.recoverySeconds)?Number(l.recoverySeconds):l.recovery?seconds(l.recovery):0,recoveryDistance:optional(l.recoveryDistance)||0,recoveryType:['jog','walk','stop'].includes(l.recoveryType)?l.recoveryType:'jog'}))};
 for(const key of ['rpe','fatigue','temperature','elevation','elapsedSeconds'])if(input[key]!=null&&input[key]!==''&&!known(input[key]))throw Error(`El dato ${key} no es numérico; déjalo vacío si no lo sabes.`);
 if(input.type&&!types.includes(input.type))throw Error('Solo se reciben actividades de carrera o caminar; revisa el tipo.');
 const errors=validateActivity(activity,activityToday(activity.timezone));if(errors.length)throw Error(errors.join(' '));
 return activity;
}
export function previewActivityImport(state,input){
 const rows=Array.isArray(input)?input:input?.activities;if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('El archivo debe contener una lista de 1 a 500 actividades.');
 const seen=[...(state.activities||[])];
 return rows.map((row,index)=>{try{const activity=normalizePersonalActivity(row,state.profile?.timezone||'Europe/Madrid'),duplicate=duplicateActivity(activity,seen);if(duplicate)return {index,status:'duplicate',activity,reason:duplicate.reason,duplicateId:duplicate.id};seen.push(activity);return {index,status:'ready',activity};}catch(error){return {index,status:'invalid',reason:error.message};}});
}
/** @param {{consent?:boolean,selectedIndices?:number[]|null}} options */
export function receivePersonalActivities(state,input,options={}){
 const {consent=false,selectedIndices=null}=options;
 if(!consent)throw Error('Confirma que son archivos propios autorizados para el seguimiento.');
 const preview=previewActivityImport(state,input);let next=state;const received=[];
 for(const row of preview){if(row.status!=='ready'||selectedIndices&&!selectedIndices.includes(row.index))continue;const result=recordActivity(next,row.activity);next=result.state;received.push(result.activity.id);}
 if(received.length)next={...next,changes:[{id:uid(),date:new Date().toISOString(),type:'Actividades propias recibidas',reason:`${received.length} actividades autorizadas guardadas en sus fechas locales; el calendario conserva su prescripción y cualquier ajuste requiere revisión.`,receivedActivityIds:received},...next.changes]};
 return {state:next,received,duplicates:preview.filter(r=>r.status==='duplicate').length,invalid:preview.filter(r=>r.status==='invalid').length,preview,date:today()};
}
