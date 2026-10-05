import {known,realDate} from './profile-evidence.mjs';
import {isTrainingActivity} from './activity-source.mjs';

// These limits and weights are product choices, not validated probabilities.
export const REFERENCE_RULES={exponent:1.06,currentDays:90,maximumDays:180,conflictFraction:.08,progressDays:21,minimumRuns:3,minimumSpanDays:7,paceStepSeconds:5};
const elapsed=v=>{if(typeof v==='number')return v;const parts=String(v||'').split(':');return parts.length>=2&&parts.length<=3&&parts.every(p=>/^\d+$/.test(p))&&parts.slice(1).every(p=>+p<60)?parts.reduce((n,p)=>n*60+(+p),0):NaN;};
const age=(a,b)=>Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000);
export const median=values=>{const sorted=[...values].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;};
export const readableRange=range=>range?range.map(s=>{const n=Math.round(s);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}).join('–')+' min/km':'Por esfuerzo';
export const roundedRange=(fast,slow)=>[Math.floor(fast/5)*5,Math.ceil(slow/5)*5];

export function evaluateMark(mark,start){
 const reasons=[],limitations=[],days=realDate(mark.date)?age(mark.date,start):null,time=elapsed(mark.time),total=mark.elapsedTime?elapsed(mark.elapsedTime):time;
 if(!isTrainingActivity(mark))reasons.push('Origen no autorizado para calibración.');
 if(days==null||days<0)reasons.push('Fecha ausente, inválida o futura.');
 else if(days>180)reasons.push('Más de 180 días: se conserva como historial, sin fijar ritmos actuales.');
 if(!(known(mark.distance)&&+mark.distance>=1.5&&+mark.distance<=42.3&&time>0&&total>=time&&total<=86400))reasons.push('Distancia o duración insuficientes para comparar.');
 if(!['competition','test'].includes(mark.context))reasons.push(mark.context==='training'?'Es entrenamiento: no demuestra una capacidad máxima.':'Falta confirmar competición o prueba.');
 if(mark.effort!=='race')reasons.push('Falta confirmar esfuerzo máximo sostenible.');
 if(mark.measurement!=='measured')reasons.push('Distancia o tiempo estimados o sin origen confirmado; no son una medición.');
 if(mark.terrain!=='asphalt')reasons.push('Terreno distinto de asfalto o desconocido: no se normaliza a ritmo llano.');
 if(known(mark.elevation)&&+mark.elevation/+mark.distance>15)reasons.push('Desnivel elevado: no se extrapola rendimiento llano.');
 if(total>time*1.05)reasons.push('Pausas superiores al 5 %: no es una referencia continua comparable.');
 if(mark.pain&&mark.pain!=='none')reasons.push('Molestias declaradas o sin confirmar en la referencia.');
 if(!mark.elapsedTime)limitations.push('Pausas sin confirmar: falta tiempo total.');
 if(!known(mark.elevation))limitations.push('Desnivel sin confirmar.');
 if(!known(mark.temperature))limitations.push('Temperatura desconocida; no se corrige ni se inventa.');
 else if(+mark.temperature>=25)limitations.push('Calor declarado: menor comparabilidad, sin corrección numérica del tiempo.');
 if(!mark.conditions||mark.conditions==='unknown')limitations.push('Viento y otras condiciones sin confirmar.');
 else if(mark.conditions==='windy')limitations.push('Viento relevante declarado: menor comparabilidad, sin corregir el tiempo.');
 else if(mark.conditions==='hot')limitations.push('Calor relevante declarado: menor comparabilidad, sin corregir el tiempo.');
 if(days>90&&days<=180)limitations.push('Más de 90 días: capacidad actual provisional; hace falta una referencia reciente para competir.');
 const recency=days<=30?1:days<=90?.85:.4;
 const completeness=(mark.elapsedTime?1:.8)*(known(mark.elevation)?1:.85)*(known(mark.temperature)?1:.85)*(mark.conditions&&mark.conditions!=='unknown'?1:.9);
 const quality=completeness*(mark.context==='competition'?1:.9)*(known(mark.elevation)&&+mark.elevation/+mark.distance>5?.65:1)*(known(mark.temperature)&&+mark.temperature>=25?.6:1)*(mark.conditions==='hot'?.65:mark.conditions==='windy'?.7:1)*(total>time? .8:1);
 return {id:mark.id||[mark.date,mark.distance,mark.time].join(':'),mark,ageDays:days,distance:known(mark.distance)&&Number.isFinite(+mark.distance)?+mark.distance:null,totalSeconds:Number.isFinite(total)?total:null,eligible:reasons.length===0,quality,recency,limitations,reasons};
}

export function evaluateReferences(p,start,targetDistance=5,{currentOnly=false,marathonGuard=false}={}){
 const assessments=(p.marks||[]).map(m=>({...evaluateMark(m,start),used:false,targetReason:null})),seen=new Set();
 const candidates=[...assessments].sort((a,b)=>b.quality-a.quality||a.limitations.length-b.limitations.length||a.id.localeCompare(b.id)).filter(v=>{
  if(!v.eligible)return false;
  if(currentOnly&&v.ageDays>90){v.targetReason='No es reciente para este objetivo de competición.';return false;}
  const ratio=Math.max(v.distance/targetDistance,targetDistance/v.distance);
  if(marathonGuard&&targetDistance>=30&&Math.abs(v.distance/targetDistance-1)>.1){v.targetReason='Distancia demasiado corta o distinta para extrapolar a maratón.';return false;}
  if(ratio>4.3||v.distance!==targetDistance&&(v.totalSeconds<210||v.totalSeconds>13800)){v.targetReason='Distancia o duración fuera del margen de extrapolación para este ritmo.';return false;}
  const key=[v.mark.date,v.distance,v.totalSeconds].join(':');if(seen.has(key)){v.targetReason='Referencia duplicada: no cuenta como apoyo independiente.';return false;}seen.add(key);v.used=true;return true;
 }).map(v=>({...v,predictedSeconds:v.totalSeconds*Math.pow(targetDistance/v.distance,REFERENCE_RULES.exponent),weight:v.quality*v.recency/(1+Math.abs(Math.log(v.distance/targetDistance)))}));
 const warnings=[],conflicts=[];
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
  const a=candidates[i],b=candidates[j],spread=Math.max(a.predictedSeconds,b.predictedSeconds)/Math.min(a.predictedSeconds,b.predictedSeconds)-1;
  if(spread>=REFERENCE_RULES.conflictFraction)conflicts.push({ids:[a.id,b.id],differencePercent:Math.round(spread*1000)/10,conditionsComparable:known(a.mark.temperature)&&known(b.mark.temperature)&&Math.abs(+a.mark.temperature-+b.mark.temperature)<=5&&a.quality>=.8&&b.quality>=.8});
 }
 if(conflicts.length)warnings.push('Las referencias se contradicen al compararlas por distancia. Puede influir la preparación, la antigüedad o las condiciones; no se atribuye automáticamente a progreso. Confianza reducida.');
 const sorted=[...candidates].sort((a,b)=>b.weight-a.weight||a.ageDays-b.ageDays||a.id.localeCompare(b.id)),anchor=sorted[0];
 if(!anchor)return {kind:'estimate',targetDistance,seconds:null,paceSeconds:null,secondsRange:null,paceRange:null,confidence:'none',assessments,references:[],conflicts,warnings,limitations:[...new Set(assessments.flatMap(v=>v.reasons))],anchor:null};
 const totalWeight=sorted.reduce((n,v)=>n+v.weight,0);
 let prediction=candidates.length===1?anchor.predictedSeconds:Math.exp(sorted.reduce((n,v)=>n+Math.log(v.predictedSeconds)*v.weight,0)/totalWeight);
 // A conflicting fast result cannot pull a slower comparable result upwards.
 if(conflicts.length){const trusted=candidates.filter(v=>v.weight>=anchor.weight*.6);prediction=Math.max(prediction,...trusted.map(v=>v.predictedSeconds));}
 const limitations=[...new Set(candidates.flatMap(v=>v.limitations))];
 const confidence=conflicts.length?'low':new Set(candidates.map(v=>v.mark.date)).size>=2&&candidates.every(v=>v.ageDays<=90&&v.quality>=.8&&v.limitations.length===0)?'reference':'provisional';
 const margin=confidence==='reference'?.03:confidence==='low'?.08:.06,lo=Math.min(prediction*(1-margin),...candidates.map(v=>v.predictedSeconds)),hi=Math.max(prediction*(1+margin),...candidates.map(v=>v.predictedSeconds));
 return {kind:'estimate',targetDistance,seconds:prediction,paceSeconds:prediction/targetDistance,secondsRange:[Math.floor(lo/5)*5,Math.ceil(hi/5)*5],paceRange:roundedRange(lo/targetDistance,hi/targetDistance),confidence,assessments,references:candidates.map(value=>{const summary={...value};delete summary.mark;return summary;}),conflicts,warnings,limitations,anchor:anchor.mark};
}

// A rodaje is an observation of comfortable pace, never a race-equivalent mark.
export function comfortableObservation(p,start,history=[]){
 const exclusions=[];
 const training=(p.marks||[]).filter(m=>m.context==='training'&&m.effort==='easy').map(m=>({...m,id:'mark-'+(m.id||m.date),type:'easy',seconds:elapsed(m.time),elapsedSeconds:m.elapsedTime?elapsed(m.elapsedTime):null}));
 const runs=[...history,...training].filter(a=>isTrainingActivity(a)&&['easy','recovery','long'].includes(a.type)&&realDate(a.date)&&age(a.date,start)>=0&&age(a.date,start)<=28&&a.distance>=1&&a.seconds>0&&!a.groupId);
 const usable=runs.filter(a=>{
  const why=[];
  if(!known(a.rpe)||+a.rpe<2||+a.rpe>Math.min(4,known(p.easyEffort)?+p.easyEffort:3))why.push('esfuerzo cómodo sin confirmar o mayor al declarado');
  if(!known(a.fatigue)||+a.fatigue>4||a.pain!=='none'||a.feeling==='mal')why.push('recuperación o molestias');
  if(a.terrain!==p.terrain||a.terrain==='unknown'||a.terrain==='trail')why.push('terreno no comparable');
  if(a.conversation&&a.conversation!=='yes')why.push('conversación cómoda sin confirmar');
  if(a.measurement==='estimated')why.push('distancia o tiempo estimados');
  if(known(a.temperature)&&+a.temperature>=25)why.push('calor');
  if(['hot','windy'].includes(a.conditions))why.push('calor o viento relevante declarado');
  if(known(a.elevation)&&+a.elevation/a.distance>15)why.push('desnivel');
  if(known(a.elapsedSeconds)&&a.elapsedSeconds>a.seconds*1.1)why.push('pausas');
  if(why.length)exclusions.push({id:a.id,reasons:why});return !why.length;
 });
 const selected=['easy','recovery','long'].sort((a,b)=>new Set(usable.filter(v=>v.type===b).map(v=>v.date)).size-new Set(usable.filter(v=>v.type===a).map(v=>v.date)).size)[0],pool=usable.filter(a=>a.type===selected).sort((a,b)=>b.date.localeCompare(a.date)||String(a.id).localeCompare(String(b.id))),center=pool.length?median(pool.map(a=>a.distance)):0;
 const comparable=pool.filter(a=>Math.abs(a.distance/center-1)<=.2);
 const distinct=comparable.filter((a,i)=>comparable.findIndex(b=>b.date===a.date)===i);
 const limitations=[];
 if(distinct.some(a=>a.measurement!=='measured'))limitations.push('Medición de distancia y tiempo sin confirmar: no se acelera desde estimaciones.');
 if(distinct.some(a=>!known(a.temperature)))limitations.push('Temperatura desconocida: el ritmo es descriptivo; no autoriza acelerarlo.');
 if(distinct.some(a=>!known(a.elapsedSeconds)))limitations.push('Pausas sin confirmar: registra el tiempo total.');
 if(distinct.some(a=>!known(a.elevation)))limitations.push('Desnivel sin confirmar: la comparación sigue siendo provisional.');
 if(distinct.some(a=>!a.conversation||a.conversation==='unknown'))limitations.push('Falta confirmar conversación cómoda; se utiliza únicamente el esfuerzo declarado.');
 const temperatures=distinct.filter(a=>known(a.temperature)).map(a=>+a.temperature);
 if(temperatures.length&&Math.max(...temperatures)-Math.min(...temperatures)>5)limitations.push('Temperaturas separadas por más de 5 °C; no se asumen condiciones equivalentes.');
 const span=distinct.length?age([...distinct].sort((a,b)=>a.date.localeCompare(b.date))[0].date,[...distinct].sort((a,b)=>b.date.localeCompare(a.date))[0].date):0;
 const observed=distinct.length?median(distinct.map(a=>a.seconds/a.distance)):null;
 return {kind:'observation',paceSeconds:observed,paceRange:observed?roundedRange(Math.min(...distinct.map(a=>a.seconds/a.distance)),Math.max(...distinct.map(a=>a.seconds/a.distance))):null,count:distinct.length,spanDays:span,evidenceIds:distinct.map(a=>a.id),eligible:distinct.length>=3&&span>=7&&limitations.length===0,limitations,exclusions};
}

export const REFERENCE_SOURCES=[
 {title:'Vickers y Vertosick (2016): validación de predicción de tiempos',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC5000509/'},
 {title:'Persinger et al. (2004): prueba de conversación y esfuerzo',url:'https://pubmed.ncbi.nlm.nih.gov/15354048/'},
 {title:'Ely et al. (2007): condiciones ambientales y rendimiento',url:'https://pubmed.ncbi.nlm.nih.gov/17473775/'}
];
export function performanceReferences(history,start){
 const clock=value=>{const s=Math.round(value);return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(n=>String(n).padStart(2,'0')).join(':');};
 return history.filter(a=>isTrainingActivity(a)&&a.type==='race'&&a.raceEffort==='race'&&a.measurement==='measured'&&a.rpe>=7&&a.pain==='none'&&realDate(a.date)&&age(a.date,start)>=0&&age(a.date,start)<=180&&a.distance>=1.5&&a.seconds>0).map(a=>({id:'race-'+a.id,date:a.date,distance:a.distance,time:clock(a.seconds),elapsedTime:known(a.elapsedSeconds)?clock(a.elapsedSeconds):'',context:a.context==='test'?'test':'competition',effort:'race',measurement:a.measurement,terrain:a.terrain,elevation:a.elevation,temperature:a.temperature,conditions:a.conditions||'unknown',source:a.source,dataUseConsent:a.dataUseConsent,origin:a.origin})).map(mark=>Object.fromEntries(Object.entries(mark).filter(([,value])=>value!==undefined)));
}
