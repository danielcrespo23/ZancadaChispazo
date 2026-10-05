import {known} from './profile-evidence.mjs';
export const IMPORT_LIMITS={fileBytes:10*1024*1024,batchBytes:30*1024*1024,files:10,activities:500,laps:1000,points:20000,csvRows:20000,columns:80,cellChars:20000,depth:64,persistedBytes:1800000};
export const normalizedName=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function numeric(value,label,{decimal='.',optional=true}={}){
 if(value==null||String(value).trim()===''){if(optional)return null;throw Error(`Falta ${label}.`);}
 if(typeof value==='number'){if(Number.isFinite(value))return value;throw Error(`${label}: número no válido.`);}
 const raw=String(value).trim(),text=decimal===','?raw.replace(',','.'):raw;
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))throw Error(`${label}: «${raw.slice(0,80)}» no es numérico; confirma el separador decimal.`);
 const result=Number(text);if(!Number.isFinite(result))throw Error(`${label}: número fuera de rango.`);return result;
}
export function distanceKm(value,unit,decimal='.'){
 const amount=numeric(value,'distancia',{decimal});if(amount==null)return null;
 const factor={km:1,m:.001,mi:1.609344}[unit];if(!factor)throw Error('Confirma la unidad de distancia: km, metros o millas.');return amount*factor;
}
export function durationSeconds(value,unit='s',decimal='.'){
 if(value==null||String(value).trim()==='')return null;
 if(String(value).includes(':')){if(!['clock','s'].includes(unit))throw Error('El tiempo contiene dos puntos: confirma mm:ss o hh:mm:ss.');const parts=String(value).trim().split(':');if(![2,3].includes(parts.length)||parts.some(p=>!/^\d+(?:[.,]\d+)?$/.test(p))||parts.slice(1).some(p=>+p.replace(',','.')>=60))throw Error('Tiempo inválido: utiliza mm:ss o hh:mm:ss.');return parts.reduce((sum,p)=>sum*60+Number(p.replace(',','.')),0);}
 if(unit==='clock')throw Error('El tiempo necesita mm:ss o hh:mm:ss, o confirma su unidad numérica.');
 const factor={s:1,min:60,ms:.001,h:3600}[unit];if(!factor)throw Error('Confirma la unidad del tiempo.');return numeric(value,'tiempo',{decimal,optional:false})*factor;
}
export function runningSport(value){const text=normalizedName(value);return /^(running|run|carrera|correr|trail running|trail run|trailrunning|treadmill|treadmill running|cinta|indoor running|virtual run)$/.test(text);}
export function assertPersonalProvenance(value){
 const stack=[{value,depth:0}],visited=new Set();let nodes=0;
 while(stack.length){const entry=stack.pop(),item=entry.value;if(++nodes>250000)throw Error('El archivo contiene demasiados campos.');if(!item||typeof item!=='object'||visited.has(item))continue;visited.add(item);if(entry.depth>IMPORT_LIMITS.depth)throw Error('El archivo está demasiado anidado.');
  for(const [key,v] of Object.entries(item)){const k=normalizedName(key).replace(/[^a-z]/g,'');if(['stravaid','stravaactivityid'].includes(k)&&v!=null&&v!=='')throw Error('El archivo declara origen Strava. No puede utilizarse para el seguimiento propio.');if(['source','provider','origin','platform','exporter','creator','application','manufacturer','productname','author'].includes(k)&&typeof v==='string'&&/strava/i.test(v))throw Error('El archivo declara origen Strava. No puede utilizarse para el seguimiento propio.');if(v&&typeof v==='object')stack.push({value:v,depth:entry.depth+1});}
 }
}
export function validTimezone(zone){try{new Intl.DateTimeFormat('es-ES',{timeZone:zone}).format(0);return typeof zone==='string'&&zone.length<100;}catch{return false;}}
const localParts=(date,zone)=>Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
export function localTimestamp(value,zone,{dateOrder='iso',ambiguity='reject'}={}){
 const original=String(value??'').trim();if(!original)return {startedAt:null,date:null,original,warning:'Falta la hora de inicio.'};if(!validTimezone(zone))throw Error('Selecciona una zona horaria válida.');
 let text=original.replace(' ','T');
 if(dateOrder==='dmy'){const m=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);if(m)text=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}${m[4]}`;}
 if(/^\d{4}-\d{2}-\d{2}$/.test(text)){const check=new Date(text+'T12:00:00Z');if(!Number.isFinite(+check)||check.toISOString().slice(0,10)!==text)throw Error('Fecha local inválida.');return {startedAt:null,date:text,original,warning:'La fecha no incluye hora; no se inventa medianoche.'};}
 const match=text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/);
 if(!match)throw Error('Fecha y hora no reconocidas. Usa ISO o confirma día/mes/año.');
 const plain=`${match[1]}T${match[2]}:${match[3]}:${match[4]||'00'}${match[5]||''}`,wall=Date.parse(plain+'Z');
 if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,19)!==plain.slice(0,19))throw Error('Fecha u hora no válida.');
 if(match[6]){const offset=match[6].replace(/^([+-]\d{2})(\d{2})$/,'$1:$2');if(offset!=='Z'&&(+offset.slice(1,3)>14||+offset.slice(4)>59||+offset.slice(1,3)===14&&+offset.slice(4)>0))throw Error('Offset horario no válido.');const instant=Date.parse(plain+offset);if(!Number.isFinite(instant))throw Error('Hora con offset no válida.');const p=localParts(new Date(instant),zone);return {startedAt:plain+offset,date:`${p.year}-${p.month}-${p.day}`,original,warning:null};}
 // Resolve a local wall clock from explicit IANA zone; reject gaps and ask on folds.
 const offsets=new Set();for(const delta of [-36,-12,0,12,36]){const instant=wall+delta*3600000,p=localParts(new Date(instant),zone);offsets.add(Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)-Math.floor(instant/1000)*1000);}
 const matches=[...offsets].map(offset=>wall-offset).filter(instant=>{const p=localParts(new Date(instant),zone);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`===plain.slice(0,19);}).sort((a,b)=>a-b);
 if(!matches.length)throw Error('Esa hora local no existe por el cambio de horario; indica la hora u offset original correcto.');
 if(matches.length>1&&!['earlier','later'].includes(ambiguity))throw Error('Hora local ambigua por el cambio de horario. Confirma la primera o segunda ocurrencia, o incluye el offset original.');
 return {startedAt:new Date(ambiguity==='later'?matches.at(-1):matches[0]).toISOString(),date:match[1],original,warning:matches.length>1?`Hora ambigua confirmada: ${ambiguity==='later'?'segunda':'primera'} ocurrencia.`:'Hora local interpretada en la zona que has confirmado; el archivo no incluía offset.'};
}
export const presentSum=values=>values.length&&values.every(known)?values.reduce((n,v)=>n+Number(v),0):null;
export function originalMeasures({distance,distanceUnit,moving,elapsed,timer,recorded,timeUnit='s',startedAt,timezone,fields={}}){return {distance:{value:distance??null,unit:distanceUnit},times:{moving:{value:moving??null,unit:timeUnit},elapsed:{value:elapsed??null,unit:timeUnit},timer:{value:timer??null,unit:timeUnit},recorded:{value:recorded??null,unit:timeUnit}},startedAt:startedAt||null,timezone:timezone||null,fields};}
export function importMissing(activity){
 const missing=[];if(!known(activity.avgHR)&&!known(activity.maxHR))missing.push('Sin pulsaciones de resumen.');if(!known(activity.movingSeconds)&&activity.timeBasis&&activity.timeBasis!=='moving')missing.push('Falta tiempo en movimiento: no se equipara al cronómetro o tiempo transcurrido.');if(!known(activity.elapsedSeconds))missing.push('Falta tiempo transcurrido; las pausas no están confirmadas.');if(!activity.startedAt)missing.push('Sin hora de inicio.');if(!activity.laps?.length)missing.push('Sin vueltas utilizables.');if(!known(activity.rpe)||!known(activity.fatigue)||activity.pain==='unknown')missing.push('Faltan sensaciones: esfuerzo, fatiga o molestias.');return missing;
}
