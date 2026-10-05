import {today,uid,monday,addDays,daysBetween,day,round,planKm,pace,duration,seconds,generate,session,reduceSession,TYPES,preparationCheck,referenceWorkout,withRaceDay,metrics} from './engine.mjs';

import {isTrainingActivity} from './activity-source.mjs';
import {activityAssessment,aggregateActivities} from './activity-evidence.mjs';
import {acceptedGoal,goalAwaitingReview} from './plan-goal.mjs';
import {fingerprint,stableStringify} from './plan-review.mjs';
import {preparationContinuity} from './planning-rules.mjs';
import {performanceReferences} from './reference-evidence.mjs';
import {sessionLoad} from './session-library.mjs';
export const isOwnActivity=isTrainingActivity;
const running=a=>isOwnActivity(a)&&!['cycling','crossfit','strength','other','rest'].includes(a.type)&&Number.isFinite(a.distance)&&a.distance>0&&Number.isFinite(a.seconds)&&a.seconds>0;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+'T12:00:00Z').getTime())&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const median=values=>{const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
export function recentTraining(state,start=today()){
 const records=(state.activities||[]).filter(a=>running(a)&&a.date<start&&a.date>=addDays(start,-35)),seenGroups=new Set();
 const activities=records.flatMap(a=>{if(!a.groupId)return [a];if(seenGroups.has(a.groupId))return [];seenGroups.add(a.groupId);return [aggregateActivities(records.filter(v=>v.groupId===a.groupId))];});
 const first=monday(start),weeks=Array.from({length:4},(_,i)=>{const date=addDays(first,-7*(4-i)),runs=activities.filter(a=>a.date>=date&&a.date<addDays(date,7));return {date,km:round(runs.reduce((n,a)=>n+a.distance,0)),runs:new Set(runs.map(a=>a.date)).size,minutes:Math.round(runs.reduce((n,a)=>n+a.seconds,0)/60)};});
 const easy=activities.filter(a=>['easy','recovery','long'].includes(a.type)&&a.rpe>=2&&a.rpe<=4&&a.fatigue<=4&&a.pain==='none'&&a.terrain===state.profile?.terrain&&(a.temperature==null||a.temperature<25)&&!(+a.elevation/a.distance>15)&&!(a.elapsedSeconds>a.seconds*1.1));
 const center=easy.length?median(easy.map(a=>a.distance)):1;const comparable=easy.filter(a=>Math.abs(a.distance/center-1)<=.25);
 const hr=comparable.filter(a=>+a.avgHR>=30&&+a.avgHR<=240&&(!a.maxHR||+a.avgHR<=+a.maxHR));
 const excludedEasy=activities.filter(a=>['easy','recovery','long'].includes(a.type)).length-comparable.length;
 const early=weeks.slice(0,2).reduce((n,w)=>n+w.km,0)/2,late=weeks.slice(2).reduce((n,w)=>n+w.km,0)/2;
 const completeRuns=activities.filter(a=>a.date>=weeks[0].date&&a.date<first),longestRun=[...completeRuns].sort((a,b)=>b.distance-a.distance||b.date.localeCompare(a.date))[0];
 const last=weeks.at(-1),lastTwo=weeks.slice(-2),consecutive=weeks.slice().reverse().findIndex(w=>!w.runs),trailingWeeks=consecutive<0?4:consecutive;
 const load={km:Math.min(median(weeks.map(w=>w.km)),last.km,lastTwo.reduce((n,w)=>n+w.km,0)/2),minutes:Math.min(median(weeks.map(w=>w.minutes)),last.minutes,lastTwo.reduce((n,w)=>n+w.minutes,0)/2),frequency:Math.min(median(weeks.map(w=>w.runs)),last.runs),trailingWeeks};
 const recent=activities.filter(a=>daysBetween(a.date,start)<=7);
 return {load,completeCount:completeRuns.length,longestRun:longestRun?{date:longestRun.date,seconds:longestRun.seconds,rpe:longestRun.rpe??null,pain:longestRun.pain??'unknown'}:null,weeks,regularity:weeks.filter(w=>w.runs>0).length/4,medianFrequency:median(weeks.map(w=>w.runs)),trend:{earlierWeeklyKm:round(early),recentWeeklyKm:round(late),changeKm:round(late-early),interpretation:'Evolución descriptiva de volumen registrado; no demuestra mejora de forma ni recuperación.'},quality:{comparableEasy:comparable.length,excludedEasy,heartRateCount:hr.length,observedEasyHR:hr.length>=3?Math.round(median(hr.map(a=>+a.avgHR))):null,notes:['No se comparan ritmos con desnivel >15 m/km, pausas >10 % o calor declarado. Son límites de diseño, no correcciones de ritmo validadas.','La FC observada solo apoya el contexto; no calcula umbrales ni prescribe nuevos ritmos.']},count:activities.length,activeWeeks:weeks.filter(w=>w.runs>0).length,medianWeeklyKm:median(weeks.map(w=>w.km)),longest:longestRun?.distance??null,easyPace:comparable.length>=3?median(comparable.map(a=>a.seconds/a.distance)):null,easyCount:comparable.length,temperatureKnown:comparable.every(a=>a.temperature!=null),caution:recent.some(a=>a.pain&&a.pain!=='none'||a.fatigue>=7||a.feeling==='mal'),source:'Registros propios de Zancada. Strava no interviene en este análisis.'};
}
export function sessionStatus(s,state){
 if((state.sessionCompletions||[]).some(c=>c.sessionId===s.id))return 'completed';
 const runs=(state.activities||[]).filter(a=>a.sessionId===s.id&&isOwnActivity(a));
 if(runs.length)return activityAssessment(aggregateActivities(runs),s).status;
 return s.skipped?'skipped':s.type==='rest'?'rest':s.date<today()?'missed':'pending';
}
export const statusLabels={completed:'Completada',changed:'Realizada con cambios',skipped:'Omitida',rest:'Descanso',missed:'Sin registrar',pending:'Pendiente'};
export const isFinished=(s,state)=>['completed','changed'].includes(sessionStatus(s,state));
export function missedTraining(state,start=today()){
 const due=(state.plan?.sessions||[]).filter(s=>s.date<start&&s.date>=addDays(start,-14)&&!['rest','race','strength'].includes(s.type)&&!isFinished(s,state));
 return {confirmed:due.filter(s=>s.skipped).length,unconfirmed:due.filter(s=>!s.skipped),note:'Un registro ausente no demuestra que no hayas entrenado. Confirma omisiones antes de cambiar la base.'};
}
export function confirmMissedSessions(state,ids,start=today()){
 const allowed=new Set(missedTraining(state,start).unconfirmed.map(s=>s.id));
 if(!ids.length||ids.some(id=>!allowed.has(id)))throw Error('Confirma solo sesiones pasadas sin registrar de los últimos 14 días.');
 const confirmed=new Set(ids),after={...state.plan,sessions:state.plan.sessions.map(s=>confirmed.has(s.id)?{...s,skipped:true}:s)};
 return {...state,plan:after,changes:[{id:uid(),date:new Date().toISOString(),type:'Sesiones omitidas confirmadas',reason:`Has confirmado ${ids.length} sesiones no realizadas. No se trasladan ni se compensa su carga; revisa la preparación si necesitas retomar.`,before:state.plan,after},...state.changes]};
}
export function weekSummary(state,date=today()){
 const start=monday(date),end=addDays(start,7),sessions=(state.plan?.sessions||[]).filter(s=>s.date>=start&&s.date<end),scheduled=sessions.filter(s=>s.type!=='rest'&&!s.skipped),runs=(state.activities||[]).filter(a=>running(a)&&a.date>=start&&a.date<end);
 return {start,sessions,scheduled:scheduled.length,completed:scheduled.filter(s=>isFinished(s,state)).length,actualKm:round(runs.reduce((n,a)=>n+a.distance,0)),plannedMinutes:Math.round(scheduled.filter(s=>s.type!=='race').reduce((n,s)=>n+s.seconds,0)/60),timedMinutes:Math.round(scheduled.filter(s=>s.distance==null&&s.type!=='strength').reduce((n,s)=>n+s.seconds,0)/60),raceKm:round(scheduled.filter(s=>s.type==='race').reduce((n,s)=>n+s.distance,0)),plannedKm:round(scheduled.filter(s=>s.type!=='race').reduce((n,s)=>n+(s.distance||0),0)),minutes:Math.round(runs.reduce((n,a)=>n+a.seconds,0)/60),effortCount:runs.filter(a=>a.rpe>0).length,load:Math.round(runs.reduce((n,a)=>n+(a.rpe>0?a.seconds/60*a.rpe:0),0)),quality:scheduled.filter(s=>['interval','tempo','hills','progressive'].includes(s.type)).length,phase:sessions.find(s=>s.phase)?.phase||null};
}
// Planned versus done since the plan began. Today counts only once it is registered.
export function goalProgress(state,start=today()){
 const plan=state.plan;if(!plan)return null;
 const active=plan.sessions.filter(s=>!['rest','race'].includes(s.type)),due=active.filter(s=>s.date<start||(s.date===start&&isFinished(s,state)));
 const statuses=due.map(s=>sessionStatus(s,state)),count=k=>statuses.filter(v=>v===k).length;
 const runs=(state.activities||[]).filter(a=>running(a)&&a.date>=plan.start&&a.date<=start);
 const goal=acceptedGoal(state),race=plan.sessions.find(s=>s.type==='race'&&s.date===goal.date)||null;
 return {goal,goalPending:goalAwaitingReview(state),pendingGoal:goalAwaitingReview(state)?state.profile?.goal:null,due:due.length,completed:count('completed'),changed:count('changed'),skipped:count('skipped'),missed:count('missed'),extra:runs.filter(a=>!a.sessionId&&a.linkMode==='none').length,unlinked:runs.filter(a=>!a.sessionId&&a.linkMode!=='none').length,remaining:active.filter(s=>s.date>start&&!s.skipped).length,plannedKm:round(due.reduce((n,s)=>n+(s.distance||0),0)),actualKm:round(runs.reduce((n,a)=>n+a.distance,0)),week:Math.max(1,Math.min(Math.floor(daysBetween(plan.start,start)/7)+1,Math.max(1,Math.ceil(daysBetween(plan.start,plan.end)/7)))),totalWeeks:Math.max(1,Math.ceil(daysBetween(plan.start,plan.end)/7)),daysLeft:Math.max(0,daysBetween(start,goal.date||plan.end)),race};
}
export function reviewLoad(state,evidence,continuity,start=today()){
 const declared=state.profile.weeklyKm!==''&&state.profile.weeklyKm!=null?+state.profile.weeklyKm:null;
 if(!state.plan)return {source:'declared',referenceWeeklyKm:declared,growthAllowed:true,reasons:[],longest:null};
 if(!continuity.historyComplete){
  const previous=continuity.mode==='adjust'?state.plan.continuity?.load?.referenceWeeklyKm??state.plan.basis?.profile?.weeklyKm:declared;
  const reference=previous!==''&&previous!=null?+previous:declared;
  return {source:'incomplete-history',referenceWeeklyKm:declared==null?reference:reference==null?declared:Math.min(declared,reference),growthAllowed:false,longest:null,
   reasons:['Historial sin confirmar: no se deduce inactividad ni adaptación por el calendario. Se mantiene una base declarada limitada y se congela su crecimiento hasta contrastar lo realizado.']};
 }
 const normal=[],recoveryWeeks=[];
 for(const w of evidence.weeks){
  const sessions=state.plan.sessions.filter(s=>s.date>=w.date&&s.date<addDays(w.date,7)&&!['race','rest','strength'].includes(s.type));
  const reduced=sessions.length&&sessions.every(s=>s.phase?.loadFactor<1),factor=reduced?Math.max(...sessions.map(s=>s.phase.loadFactor)):1;
  const planned=sessions.reduce((n,s)=>n+(s.distance||0),0),done=sessions.filter(s=>isFinished(s,state)).length;
  // Only an actually completed deload may be excluded from the load baseline.
  // Missing or uncompleted recovery weeks remain evidence of a real drop.
  if(reduced&&w.runs>0&&done>=sessions.length*.8&&w.km>=planned*.8&&!evidence.caution)recoveryWeeks.push({...w,factor});
  else normal.push(w);
 }
 const last=normal.at(-1),lastTwo=normal.slice(-2),safe=normal.length?Math.min(median(normal.map(w=>w.km)),last.km,lastTwo.reduce((n,w)=>n+w.km,0)/lastTwo.length):0;
 const minutes=normal.length?Math.min(median(normal.map(w=>w.minutes)),last.minutes,lastTwo.reduce((n,w)=>n+w.minutes,0)/lastTwo.length):0;
 const frequency=normal.length?Math.floor(Math.min(median(normal.map(w=>w.runs)),last.runs)):0;
 const zero=evidence.weeks.slice().reverse().findIndex(w=>!w.runs),trailingWeeks=zero<0?evidence.weeks.length:zero;
 let referenceWeeklyKm=planKm(safe);
 const originalDeclared=state.plan.continuity?.declaredWeeklyKm??state.plan.basis?.profile?.weeklyKm;
 if(declared!=null&&declared!==+originalDeclared)referenceWeeklyKm=Math.min(referenceWeeklyKm,declared);
 const recent=(state.activities||[]).filter(a=>running(a)&&a.date<start&&a.date>=addDays(start,-7));
 const controls=recent.length>0&&recent.every(a=>a.pain==='none'&&a.rpe>0&&Number.isFinite(a.fatigue)&&a.fatigue<=4);
 const complete=evidence.completeCount>=6&&evidence.activeWeeks>=3&&!evidence.caution&&controls;
 const own=(state.activities||[]).filter(a=>running(a)&&a.date<start&&a.date>=addDays(start,-28)&&a.pain==='none'&&a.rpe>0&&a.rpe<=4&&a.fatigue!=null&&a.fatigue<=4);
 const longest=complete?[...own].sort((a,b)=>b.distance-a.distance||b.date.localeCompare(a.date))[0]||null:null;
 const reasons=[`Historial confirmado completo: base futura de ${referenceWeeklyKm} km desde semanas realmente registradas (mediana, última semana y últimas dos comparables). No se añade la progresión prevista de semanas que solo han transcurrido.`];
 if(recoveryWeeks.length)reasons.push(`${recoveryWeeks.length} semana(s) de descarga o puesta a punto realmente completadas no se interpretan como pérdida de base. Se conserva la referencia de las semanas normales; no se recuperan sus kilómetros.`);
 if(!complete)reasons.push('Todavía no hay seis carreras en tres semanas con sensaciones compatibles: el volumen observado limita la carga y no autoriza nuevos incrementos.');
 return {source:'complete-history',referenceWeeklyKm,observedWeeklyKm:round(safe),minutes,frequency,trailingWeeks,longest,growthAllowed:complete&&referenceWeeklyKm>0,recoveryWeeks:recoveryWeeks.map(w=>w.date),reasons};
}
export function planComparison(state,plan,reasons,start=today()){
 const describe=(p,date)=>{
  const sessions=(p?.sessions||[]).filter(s=>s.date>=date&&s.date<addDays(date,7)&&!s.skipped&&!['race','rest','strength'].includes(s.type));
  return {phases:[...new Set(sessions.map(s=>s.phase?.label||'Sin fase documentada'))],km:round(sessions.reduce((n,s)=>n+(s.distance||0),0)),minutes:Math.round(sessions.reduce((n,s)=>n+s.seconds,0)/60),
   keySessions:sessions.filter(s=>['long','tempo','interval','hills','progressive'].includes(s.type)).map(s=>({date:s.date,type:s.type,distance:s.distance,minutes:Math.round(s.seconds/60)}))};
 };
 return [...new Set(plan.sessions.filter(s=>s.date>=start).map(s=>monday(s.date)))].map(date=>{
  const before=describe(state.plan,date),after=describe(plan,date),phase=plan.sessions.find(s=>s.date>=date&&s.date<addDays(date,7)&&s.phase)?.phase;
  const why=[plan.continuity.reason,phase?.reason,...reasons.filter(r=>/Historial confirmado|Historial sin confirmar|Vuelta tras|carga inicial más suave|Hoy has declarado|Fatiga alta|molestias o fatiga|sesiones confirmadas/.test(r))].filter(Boolean);
  return {date,before,after,reasons:why};
 });
}
/** @param {{revision?:number|null,originRevision?:number|null,activityScope?:string}} context */
export function buildPlanPreview(state,{useHistory=false,completeHistory=false,conservative=false,returnAfterBreak=false,calibratePaces=false,mode='auto'}={},start=today(),context={}){
 const {revision=null,originRevision=revision,activityScope='own'}=context;
 if(!state.profile)throw Error('Guarda primero tu perfil y objetivo.');
 if(!['own','manual'].includes(activityScope))throw Error('Origen de actividades no permitido.');
 const source={version:1,generatedOn:start,revision,originRevision,planId:state.plan?.id||null,signature:preparationSignature(state),activityScope,options:{useHistory,completeHistory,conservative,returnAfterBreak,calibratePaces,mode}};
 if(activityScope==='manual')state={...state,activities:(state.activities||[]).filter(a=>(!a.source||a.source==='manual')&&!a.stravaId&&!a.externalId&&a.provider!=='strava'&&a.origin!=='strava-api')};
 const evidence=recentTraining(state,start),profile={...state.profile},continuity=preparationContinuity(state,start,{mode,completeHistory,returnAfterBreak}),reasons=[continuity.reason];
 if(calibratePaces||useHistory){
  const performances=performanceReferences(state.activities||[],start);
  profile.marks=[...(profile.marks||[]),...performances.filter(m=>!profile.marks?.some(v=>v.id===m.id))];
  if(performances.length)reasons.push('Se consideran '+performances.length+' referencias propias de competición con medición y esfuerzo confirmados. Se conservan sus condiciones; no se convierten entrenamientos ni estimaciones en marcas.');
 }
 if(state.plan){
  profile.sessionDoseBaselines=Object.fromEntries(state.plan.sessions.filter(s=>s.date>=start&&s.format?.id&&['tempo','interval','progressive','hills'].includes(s.type)).map(s=>[s.format.id,{dose:s.dose||null,distance:s.distance,seconds:s.seconds,rpe:s.rpe,blocks:s.blocks,format:s.format}]).reverse());
  profile.sessionSelectionHistory=state.plan.sessions.filter(s=>s.date<start&&!s.skipped&&['tempo','interval','progressive','hills'].includes(s.type)).map(s=>({date:s.date,type:s.type,phase:s.phase||null}));
  profile.paceCalibrationBaseline=Object.fromEntries(['easy','recovery','long'].flatMap(type=>{const s=state.plan.sessions.find(s=>s.date>=start&&s.type===type&&s.range);return s?[[type,[...s.range]]]:[];}));
  profile.qualityPaceBaseline={};
  for(const s of state.plan.sessions.filter(s=>s.date>=start&&['tempo','interval','progressive'].includes(s.type))){const key=s.type+':'+(s.phase?.key||'general');if(!Object.hasOwn(profile.qualityPaceBaseline,key))profile.qualityPaceBaseline[key]=s.range?[...s.range]:null;}
  const sameReferences=fingerprint(profile.marks||[])===fingerprint(state.plan.basis?.profile?.marks||[]);
  profile.holdQualityPaces=metrics(profile,start).confidence!=='reference'||sameReferences;
  if(profile.holdQualityPaces)reasons.push(sameReferences?'Ritmos de calidad conservados: las referencias de rendimiento no han cambiado. Recalcular no acredita progreso ni acumula aceleraciones.':'Ritmos de calidad conservados: una marca aislada, antigua, incompleta o contradictoria no autoriza acelerarlos. Hace falta apoyo independiente y comparable.');
 }
 if(calibratePaces||state.plan?.basis?.profile?.paceEvidence){
  profile.paceCalibrationBaseline=Object.fromEntries(['easy','recovery','long'].flatMap(type=>{const s=state.plan?.sessions.find(s=>s.date>=start&&s.type===type&&s.range);return s?[[type,[...s.range]]]:[];}));
  profile.paceEvidence=calibratePaces?(state.activities||[]).filter(a=>isOwnActivity(a)&&a.date<=start&&a.date>=addDays(start,-28)).map(a=>Object.fromEntries(['id','date','type','distance','seconds','elapsedSeconds','rpe','fatigue','pain','feeling','terrain','temperature','elevation','conversation','measurement','raceEffort','conditions','groupId','source','dataUseConsent','origin'].filter(k=>a[k]!=null).map(k=>[k,a[k]]))):state.plan.basis.profile.paceEvidence;
  profile.paceReferenceSignature=fingerprint({activities:profile.paceEvidence,marks:profile.marks});
  const sameEvidence=profile.paceReferenceSignature===state.plan?.basis?.profile?.paceReferenceSignature;
  profile.paceCalibrationRequest=!!calibratePaces&&!sameEvidence;
  const calibrated=metrics(profile,start),observed=calibrated.observedComfortable;
  if(calibratePaces)reasons.push(sameEvidence?'Ritmos ya revisados con estos registros: no se acumulan aceleraciones al recalcular.':observed.eligible?'Calibración desde '+observed.count+' rodajes comparables: ritmo cómodo observado '+pace(observed.paceSeconds)+' min/km. Se propone como máximo 5 s/km en ritmos cómodos; calidad y objetivo de carrera no se aceleran desde esos rodajes.':'Calibración pendiente: '+(observed.limitations.join(' ')||'Necesitamos tres rodajes comparables en al menos una semana con condiciones y sensaciones confirmadas.')+' Se mantienen los ritmos vigentes.');
 }
 if(useHistory){
  if(!completeHistory)throw Error('Confirma que has registrado todas tus carreras de las últimas cuatro semanas. Un historial incompleto no permite medir tu volumen real.');
  if(evidence.completeCount<6||evidence.activeWeeks<3)throw Error('Necesitamos al menos seis carreras propias repartidas en tres de las últimas cuatro semanas completas. Usa por ahora tu volumen declarado.');
  const declared=profile.weeklyKm!==''&&profile.weeklyKm!=null?+profile.weeklyKm:null,observed=evidence.load.km;
  profile.weeklyKm=planKm(declared!=null?Math.min(declared,observed):observed);if(declared==null||observed<=declared)profile.weeklySource='measured';profile.recentFrequency=Math.min(7,Math.floor(evidence.load.frequency));profile.consistentWeeks=Math.min(+profile.consistentWeeks||4,evidence.load.trailingWeeks);
  if(evidence.longest&&(!profile.longest||evidence.longest<=+profile.longest)){profile.longest=evidence.longest;profile.longestSource='measured';profile.longestDate=evidence.longestRun?.date||'';profile.longestResult=['mild','relevant'].includes(evidence.longestRun?.pain)?'pain':evidence.longestRun?.rpe>4?'hard':'unknown';}
  reasons.push(`Base semanal usada: ${profile.weeklyKm} km. Se toma el menor volumen entre mediana de cuatro semanas (${evidence.medianWeeklyKm}), última semana (${evidence.weeks.at(-1).km}), media de las últimas dos y volumen declarado (${declared??'sin dato'}). Una caída reciente no queda oculta por semanas antiguas; no se aumenta por una carrera aislada.`);
  const declaredPace=seconds(profile.easyPace);
  if(evidence.easyPace&&(!declaredPace||evidence.easyPace>declaredPace)){profile.easyPace=pace(Math.ceil(evidence.easyPace/5)*5);profile.easySource='measured';profile.easyEffort='';profile.easyConversation='unknown';reasons.push(`Referencia suave provisional: ${profile.easyPace} min/km, desde ${evidence.easyCount} sesiones de esfuerzo y terreno comparables. No mide tu umbral.${evidence.temperatureKnown?'':' Temperatura incompleta: precisión limitada.'}`);}

 }else reasons.push('Base semanal, tirada reciente y referencias del perfil guardado. El historial incompleto no sustituye los datos declarados.');
 const load=reviewLoad(state,evidence,continuity,start);
 if(state.plan&&!useHistory){
  profile.weeklyKm=load.referenceWeeklyKm;
  if(completeHistory){profile.weeklySource='measured';profile.recentFrequency=load.frequency;profile.consistentWeeks=load.trailingWeeks;}
  if(load.longest){profile.longest=load.longest.distance;profile.longestDate=load.longest.date;profile.longestSource='measured';profile.longestResult='comfortable';}
 }
 if((useHistory||state.plan&&completeHistory)&&evidence.caution){
  if((state.activities||[]).some(a=>isOwnActivity(a)&&a.date<start&&a.date>=addDays(start,-7)&&a.pain&&a.pain!=='none'))profile.pain=profile.pain==='relevant'?'relevant':'mild';
  profile.fatigue=Math.max(+profile.fatigue||0,7);reasons.push('Hay molestias o fatiga declaradas recientemente. Se suprime la calidad y se reduce la carga inicial. No es una medición de recuperación.');
 }
 continuity.declaredWeeklyKm=state.profile.weeklyKm;
 continuity.load={...load,referenceWeeklyKm:profile.weeklyKm};reasons.push(...load.reasons);
 if(continuity.historyQuestion)reasons.push(continuity.historyQuestion);
 if(continuity.mode==='adjust'&&load.growthAllowed)reasons.push('La continuidad registrada y las sensaciones permiten proponer un incremento pequeño desde la carga observada. No se recuperan los incrementos previstos de las semanas anteriores.');
 const missed=missedTraining(state,start);if(missed.confirmed>=2){profile.weeklyKm=planKm((+profile.weeklyKm||0)*.8);reasons.push(`${missed.confirmed} sesiones confirmadas como omitidas en 14 días: se reduce la propuesta de base un 20 % y se retoma cómodo. No se acumula lo pendiente.`);}
 const check=(state.checkIns||[]).find(c=>c.date===start);
 if(check?.pain==='relevant'){profile.pain='relevant';reasons.push('Hoy has declarado molestias que afectan la zancada. Se prescribe pausa; revisa la situación antes de retomar.');}
 else if(check?.pain==='mild'){if(profile.pain!=='relevant')profile.pain='mild';reasons.push('Hoy has declarado molestias leves. La propuesta suprime intensidad hasta que revises tus sensaciones.');}
 if(check&&+check.fatigue>=7){profile.fatigue=+check.fatigue;reasons.push('Fatiga alta en el registro de hoy: la nueva propuesta reduce carga y suprime intensidad.');}
 if(continuity.loadRestart){
  profile.weeklyKm=planKm((+profile.weeklyKm||0)*.6);
  if(+profile.longest>0)profile.longest=planKm(+profile.longest*.7);
  continuity.load.referenceWeeklyKm=profile.weeklyKm;
  reasons.push('Vuelta tras una pausa: se usa el 60 % de la base semanal y el 70 % de la tirada reciente como punto de partida provisional. Las primeras dos semanas serán cómodas. Revisa esta base con tus sensaciones; no se recupera la carga perdida para llegar a la carrera.');
 }
 if(conservative){profile.weeklyKm=planKm((+profile.weeklyKm||0)*.85);reasons.push('Has elegido una carga inicial más suave: se reduce un 15 % antes de aplicar límites de tiempo y tirada reciente.');}
 let generated=generate(profile,start,{continuity,growthAllowed:load.growthAllowed,easyUntil:continuity.reentryUntil|| (missed.confirmed>=2?addDays(start,14):null),recentMinutes:useHistory?evidence.load.minutes:completeHistory&&state.plan?load.minutes:null,longestMinutes:useHistory?evidence.longestRun?.seconds/60:load.longest?.seconds/60||null}),old=state.plan;
 reasons.push(...generated.context.notes);
 reasons.push('El reparto reserva la mayor distancia para la tirada larga y limita los rodajes al 90 % de ella. Si la disponibilidad o la tirada reciente limitan el volumen, no se compensa con otros días.');
 const preserved=(old?.sessions||[]).filter(s=>s.date<start||isFinished(s,state)),dates=new Set(preserved.map(s=>s.date));
 generated={...generated,start:old?.start<generated.start?old.start:generated.start,sessions:[...preserved,...generated.sessions.filter(s=>!dates.has(s.date)).map(s=>{const previous=old?.sessions.find(v=>v.date===s.date);return previous?{...s,id:previous.id}:s;})].sort((a,b)=>a.date.localeCompare(b.date)),basis:{source:useHistory?'own-history':'profile',profile,reasons,generatedOn:start}};
 if(generated.referenceSession?.sessionId)generated.referenceSession={...generated.referenceSession,sessionId:generated.sessions.find(s=>s.date===generated.referenceSession.date)?.id||null};
 const recentHard=[...(state.activities||[]).filter(a=>running(a)&&a.date<=start&&a.date>=addDays(start,-2)&&a.rpe>=6),...(state.sessionCompletions||[]).filter(c=>c.date<=start&&c.date>=addDays(start,-2)&&c.rpe>=6&&state.plan?.sessions.some(s=>s.id===c.sessionId&&s.type==='strength'))];
 const retainedHard=preserved.filter(s=>s.hard&&!s.skipped&&isFinished(s,state));
 if(recentHard.length||retainedHard.length){generated={...generated,sessions:generated.sessions.map(s=>s.date>=start&&s.type!=='race'&&s.hard&&!isFinished(s,state)&&[...recentHard,...retainedHard].some(a=>Math.abs(daysBetween(a.date,s.date))<2)?reduceSession(profile,s,.3,start):s)};reasons.push('Se evita exigencia junto a carreras propias recientes de esfuerzo alto y sesiones exigentes ya completadas, incluidas las tiradas largas. El ritmo más rápido no se interpreta como mejor cumplimiento.');}
 const blocked=(state.unavailable||[]).filter(b=>b.end>=start);
 generated={...generated,sessions:generated.sessions.map(s=>s.date>=start&&s.type!=='race'&&!isFinished(s,state)&&blocked.some(b=>s.date>=b.start&&s.date<=b.end)?restSession(s,'Periodo sin entrenamiento. No se trasladan sesiones para compensar.'):s)};
 const assessment=preparationCheck(profile,generated,null,start);generated=withRaceDay({...generated,viability:assessment.viability,racePreparation:{...generated.racePreparation,...assessment.summary}},profile);
 const immutable=new Map(preserved.map(s=>[s.id,s]));generated={...generated,sessions:generated.sessions.map(s=>immutable.get(s.id)||s)};
 if(generated.referenceSession){const reference=referenceWorkout(profile,start,generated.context,[],generated.sessions.filter(s=>!isFinished(s,state)));generated={...generated,referenceSession:reference,reference:reference?.description||null};}
 generated={...generated,basis:{...generated.basis,review:source}};
 return {source,plan:generated,evidence,reasons,continuity:generated.continuity,historyQuestion:continuity.historyQuestion,comparison:planComparison(state,generated,reasons,start),changedCount:generated.sessions.filter(s=>s.date>=start&&!isFinished(s,state)).length,retained:preserved.length,raceConflict:blocked.some(b=>profile.goal.date>=b.start&&profile.goal.date<=b.end)};
}
/** @param {number|null} revision */
export function validatePlanPreview(state,preview,start=today(),revision=null){
 const source=preview?.source;
 if(!preview?.plan||!source||source.version!==1||source.generatedOn!==start||preview.plan.basis?.generatedOn!==start)throw Error('La propuesta está desactualizada o no conserva su origen. Vuelve a calcular la propuesta.');
 if(source.signature!==preparationSignature(state)||source.planId!==(state.plan?.id||null)||revision!=null&&source.revision!=null&&source.revision!==revision)throw Error('Tus datos o la revisión del calendario han cambiado. Vuelve a calcular la propuesta antes de aceptarla.');
 if(stableStringify(source)!==stableStringify(preview.plan.basis?.review))throw Error('El origen de la propuesta ha cambiado. Vuelve a calcular la propuesta.');
 // Rebuild with current inputs as well as checking the fingerprint. A browser
 // cannot make an unsafe calendar acceptable by editing its source metadata.
 const fresh=buildPlanPreview(state,source.options,start,source);
 const comparable=plan=>{
  const copy=structuredClone(plan);delete copy.id;delete copy.basis.review;delete copy.basis.profile.name;delete copy.basis.profile.email;
  for(const s of copy.sessions){const original=state.plan?.sessions.find(v=>v.id===s.id);if(!original||s.date>=start&&!isFinished(original,state))s.id=`date:${s.date}`;}
  if(copy.referenceSession?.sessionId)copy.referenceSession.sessionId=`date:${copy.referenceSession.date}`;
  return stableStringify(copy);
 };
 if(comparable(preview.plan)!==comparable(fresh.plan))throw Error('La propuesta ya no coincide con el plan calculado para tus datos. Vuelve a calcular la propuesta.');
 return preview;
}
/** @param {number|null} revision */
export function acceptPlanPreview(state,preview,start=today(),revision=null){
 validatePlanPreview(state,preview,start,revision);
 return {...state,plan:preview.plan,planProposals:(state.planProposals||[]).map(v=>v.status==='pending'?{...v,status:'superseded'}:v),proposals:state.proposals.map(v=>v.status==='pending'?{...v,status:'superseded'}:v),changes:[{id:uid(),date:new Date().toISOString(),type:state.plan?'Plan revisado':'Plan creado',reason:preview.reasons.join(' '),before:state.plan,after:preview.plan},...state.changes]};
}
export function restSession(before,reason){return {...before,type:'rest',distance:null,seconds:0,blocks:[],load:sessionLoad([]),format:null,dose:null,strength:null,repetitions:null,range:null,hr:null,rpe:0,hard:false,purpose:reason,alternative:'Descansa. No acumules la carga omitida.',progression:'Pausa sin compensación posterior.',durationUnknown:false,estimated:false};}
export function wellnessProposal(state,check,start=today()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(check.date)||check.date!==start||![0,1,2,3,4,5,6,7,8,9,10].includes(+check.fatigue)||!['none','mild','relevant'].includes(check.pain))throw Error('Revisa fecha, fatiga y molestias.');
 if(check.sleep!==''&&check.sleep!=null&&(!Number.isFinite(+check.sleep)||+check.sleep<0||+check.sleep>16))throw Error('Las horas de sueño deben estar entre 0 y 16, o quedar vacías.');
 const pain=check.pain!=='none',tired=+check.fatigue>=7;
 const reason=check.pain==='relevant'?'Has declarado molestias relevantes: pausa la carrera y valora la situación con un profesional antes de retomarla.':pain||tired?'Tus sensaciones sugieren reducir la próxima carga; no confirman por sí solas tu estado de recuperación.':'Tus sensaciones no justifican cambiar la carga ahora. Dormir poco de forma aislada no se convierte en un diagnóstico.';
 const next=state.plan?.sessions.filter(s=>s.date>start&&!s.skipped&&!isFinished(s,state)&&!['race','rest'].includes(s.type)&&s.date<=addDays(start,3)).slice(0,check.pain==='relevant'?2:1)||[];
 const changes=next.map(before=>{
  const after=check.pain==='relevant'||before.type==='strength'?restSession(before,reason):reduceSession(state.profile,before,.3,start);
  return {sessionId:before.id,before,after};
 });
 return {reason,proposal:(pain||tired)&&changes.length?{id:uid(),created:start,source:'wellness',status:'pending',direction:'reduce',reason,changes,sessionId:changes[0].sessionId,before:changes[0].before,after:changes[0].after}:null};
}
export function unavailabilityProposal(state,input,start=today()){
 if(!state.plan)throw Error('Genera primero tu plan.');
 if(!validDate(input.start)||!validDate(input.end)||input.start<=start||input.end<input.start||daysBetween(input.start,input.end)>60)throw Error('Elige un periodo futuro de hasta 61 días, con el final posterior al inicio.');
 const reason=`Periodo sin entrenamiento: ${String(input.reason||'Disponibilidad personal').slice(0,200)}. Se conserva el pasado y no se acumulan sesiones para compensar.`;
 const changes=state.plan.sessions.filter(s=>s.date>=input.start&&s.date<=input.end&&s.type!=='race'&&s.type!=='rest'&&!s.skipped&&!isFinished(s,state)).map(before=>({sessionId:before.id,before,after:restSession(before,reason)}));
 if(!changes.length)throw Error('No hay sesiones futuras pendientes que cambiar en este periodo.');
 return {id:uid(),created:start,status:'pending',source:'availability',direction:'reduce',reason,changes,sessionId:changes[0].sessionId,before:changes[0].before,after:changes[0].after,unavailable:{id:uid(),start:input.start,end:input.end,reason:input.reason||'Disponibilidad personal'},raceConflict:state.plan.sessions.some(s=>s.type==='race'&&s.date>=input.start&&s.date<=input.end)};
}
export function undoProposal(state,id,start=today()){
 const changes=state.changes.filter(c=>c.proposalId===id&&!c.undoOf),proposal=state.proposals.find(v=>v.id===id);
 if(!proposal||proposal.status!=='accepted'||!changes.length)throw Error('Este ajuste no está aplicado.');
 for(const c of changes){if(c.before.date<=start||isFinished(c.after,state)||JSON.stringify(state.plan.sessions.find(s=>s.id===c.after.id))!==JSON.stringify(c.after))throw Error('Solo puedes deshacer el conjunto si todas sus sesiones siguen futuras y sin cambios posteriores.');}
 const restored={...state.plan,sessions:state.plan.sessions.map(s=>changes.find(c=>c.after.id===s.id)?.before||s)};
 const hard=restored.sessions.filter(s=>s.hard&&!s.skipped&&s.date>start).sort((a,b)=>a.date.localeCompare(b.date));
 if(hard.some((s,i)=>i>0&&daysBetween(hard[i-1].date,s.date)<2))throw Error('Deshacer dejaría sesiones exigentes demasiado cerca.');
 return {...state,plan:restored,proposals:state.proposals.map(v=>v.id===id?{...v,status:'undone'}:v),unavailable:(state.unavailable||[]).filter(b=>b.id!==proposal.unavailable?.id),changes:[{id:uid(),date:new Date().toISOString(),type:'Ajuste deshecho',reason:'Restauración conjunta de las sesiones del ajuste.',before:proposal.after,after:proposal.before,undoOf:id},...state.changes]};
}
export function completeStrength(state,s,minutes,rpe,start=today()){
 if(!s||!state.plan?.sessions.some(v=>v.id===s.id&&v.type==='strength')||s.type!=='strength'||s.date>start||s.skipped||!(+minutes>0&&+minutes<=240)||!(+rpe>=1&&+rpe<=10))throw Error('Elige una sesión de fuerza de hoy o anterior e indica minutos y esfuerzo válidos.');
 return {...state,sessionCompletions:[...(state.sessionCompletions||[]).filter(c=>c.sessionId!==s.id),{id:uid(),sessionId:s.id,date:s.date,minutes:+minutes,rpe:+rpe}],changes:[{id:uid(),date:new Date().toISOString(),type:'Fuerza registrada',reason:`${minutes} minutos realizados; esfuerzo declarado ${rpe}/10. No suma kilómetros de carrera.`,before:null,after:null},...state.changes]};
}
export function preparationSignature(state){const {name,email,...profile}=state.profile||{};return fingerprint({profile,plan:state.plan,activities:(state.activities||[]).filter(isOwnActivity),unavailable:state.unavailable||[],sessionCompletions:state.sessionCompletions||[],checkIns:state.checkIns||[]});}
/** @param {number|null} revision */
export function acceptAIPlan(state,id,start=today(),revision=null){
 const v=(state.planProposals||[]).find(v=>v.id===id&&v.status==='pending');
 if(!v||v.signature!==preparationSignature(state)||v.created!==start)throw Error('La propuesta ya no refleja tus datos actuales. Vuelve a calcular la propuesta en Mi plan.');
 const next=acceptPlanPreview(state,v.preview,start,revision);return {...next,planProposals:state.planProposals.map(x=>x.id===id?{...x,status:'accepted'}:x.status==='pending'?{...x,status:'superseded'}:x)};
}
export function restorePreviousPlan(state,id,start=today()){
 const c=state.changes.find(v=>v.id===id);if(!c?.before?.sessions||!c?.after?.sessions||JSON.stringify(state.plan)!==JSON.stringify(c.after))throw Error('El plan tiene cambios posteriores o no hay un plan anterior que restaurar.');
 if((state.activities||[]).some(a=>a.sessionId&&!c.before.sessions.some(s=>s.id===a.sessionId))||(state.sessionCompletions||[]).some(a=>!c.before.sessions.some(s=>s.id===a.sessionId)))throw Error('Hay registros vinculados a sesiones nuevas. Revisa el calendario antes de restaurarlo.');
 const passed=state.plan.sessions.filter(s=>s.date<start||isFinished(s,state)),dates=new Set(passed.map(s=>s.date));
 const restored={...c.before,sessions:[...passed,...c.before.sessions.filter(s=>!dates.has(s.date))].sort((a,b)=>a.date.localeCompare(b.date))};
 if(state.profile?.goal?.date&&['race','time'].includes(state.profile.goal.type)&&!restored.sessions.some(s=>s.type==='race'&&s.date===state.profile.goal.date&&s.distance===(state.profile.goal.distance!==''&&state.profile.goal.distance!=null?+state.profile.goal.distance:null)))throw Error('El objetivo actual tiene otra carrera. Revisa el perfil antes de restaurar.');
 return {...state,plan:restored,changes:[{id:uid(),date:new Date().toISOString(),type:'Plan anterior restaurado',reason:'Restauración del calendario anterior conservando las sesiones ya pasadas.',before:state.plan,after:restored,undoOf:id},...state.changes],proposals:state.proposals.map(v=>v.status==='pending'?{...v,status:'superseded'}:v),planProposals:(state.planProposals||[]).map(v=>v.status==='pending'?{...v,status:'superseded'}:v)};
}
const icsText=v=>String(v).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const fold=line=>{let parts=[],part='';for(const c of line){if(new TextEncoder().encode(part+c).length>72){parts.push(part);part=' '+c;}else part+=c;}parts.push(part);return parts.join('\r\n');};
export function calendarICS(plan){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zancada//Plan running//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 for(const s of plan?.sessions||[]){if(s.skipped||s.type==='rest')continue;const description=[s.purpose,...s.blocks.map(b=>`${b.label}: ${b.distance?`${b.distance} km` :duration(b.seconds)}${b.targetPace?` a ${pace(b.targetPace)} min/km`:''}; esfuerzo ${b.effort}/10`),s.alternative].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT',`UID:${s.id}@zancada`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${s.date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${addDays(s.date,1).replace(/-/g,'')}`,`SUMMARY:${icsText(`${TYPES[s.type]} · ${s.distance!=null?`${s.distance} km`:duration(s.seconds)}`)}`,`DESCRIPTION:${icsText(description)}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function shiftMonth(date,amount){const d=new Date(date+'T12:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount);return d.toISOString().slice(0,10);}
