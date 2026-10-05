import {known,recentLong} from './profile-evidence.mjs';
import {acceptedGoal,goalAwaitingReview} from './plan-goal.mjs';
import {isTrainingActivity} from './activity-source.mjs';

const delta=(a,b)=>Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000);
const plus=(d,n)=>{const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};

// Product defaults, not clinical thresholds or promises of race readiness.
export function raceDemand(p){
 const distance=['race','time','nonstop'].includes(p.goal.type)&&known(p.goal.distance)?+p.goal.distance:null;
 if(!distance)return {kind:'general',distance:null,weeks:12,weekly:0,long:0,longMax:12,longMinutes:90,taper:7};
 if(distance<=5)return {kind:'5k',distance,weeks:8,weekly:3,long:distance,longMax:7,longMinutes:60,taper:7};
 if(distance<=10)return {kind:'10k',distance,weeks:10,weekly:10,long:Math.min(distance,8),longMax:12,longMinutes:90,taper:7};
 if(distance<30)return {kind:'half',distance,weeks:16,weekly:18,long:Math.min(distance*.75,16),longMax:20,longMinutes:120,taper:10};
 return {kind:distance<=42.3?'marathon':'unsupported',distance,weeks:24,weekly:30,long:26,longMax:32,longMinutes:180,taper:14};
}

export function preparationContinuity(state,date,{mode='auto',returnAfterBreak=false,completeHistory=false}={}){
 if(!['auto','adjust','goal_change','resume','new'].includes(mode))throw Error('Elige ajustar, cambiar objetivo, retomar o crear una preparación nueva.');
 const old=state.plan,goal=state.profile?.goal||{},accepted=acceptedGoal(state);
 const changed=old&&['type','distance','date','terrain','elevation'].some(k=>String(goal[k]??'')!==String(accepted[k]??''));
 const previousOrigin=old?.continuity?.phaseOrigin||old?.schedule?.start||old?.start||old?.created;
 const runs=(state.activities||[]).filter(a=>isTrainingActivity(a)&&!['cycling','crossfit','strength','other','rest'].includes(a.type)&&a.distance>0&&a.seconds>0&&a.date<date).sort((a,b)=>b.date.localeCompare(a.date));
 const lastRun=runs[0]?.date||null;
 const confirmedBreak=!!old&&completeHistory&&(lastRun?delta(lastRun,date)>=14:delta(previousOrigin,date)>=14);
 const ongoingReturn=!!old?.continuity?.resumeStarted&&(!lastRun||lastRun<old.continuity.resumeStarted);
 // A retained UI choice describes the same return episode. A new confirmed
 // gap after actually resuming running is a separate episode.
 const returnChoice=returnAfterBreak||mode==='resume';
 const priorChoice=old?.basis?.review?.options?.returnAfterBreak||old?.basis?.review?.options?.mode==='resume';
 const sameReturnFlag=returnChoice&&priorChoice&&!confirmedBreak;
 const repeatedReturn=!!old?.continuity?.resumeStarted&&(sameReturnFlag||ongoingReturn&&(confirmedBreak||returnChoice));
 const kind=mode==='auto'?!old||date>old.end?'new':changed?'goal_change':(returnAfterBreak||confirmedBreak)&&!repeatedReturn?'resume':'adjust':mode==='resume'&&repeatedReturn?'adjust':mode;
 if(kind==='adjust'&&(!old||changed))throw Error('El objetivo ha cambiado o no hay un calendario vigente. Elige cambiar objetivo o crear una preparación nueva.');
 if(kind==='adjust'&&date>old.end)throw Error('Este bloque ya terminó. Crea una preparación nueva.');
 if(mode==='adjust'&&(returnAfterBreak||confirmedBreak)&&!repeatedReturn)throw Error('Has confirmado una pausa real. Elige retomar para reducir la carga y volver a base.');
 if(kind==='goal_change'&&(!old||!goalAwaitingReview(state)))throw Error('Guarda el nuevo objetivo en Perfil antes de revisar su preparación.');
 const loadRestart=kind==='resume'||kind!=='adjust'&&(returnAfterBreak||confirmedBreak)&&!repeatedReturn;
 const phaseOrigin=kind==='adjust'?previousOrigin:date;
 const labels={adjust:'Ajustar el plan vigente',goal_change:'Cambiar de objetivo',resume:'Retomar después de una pausa real',new:'Crear una preparación nueva'};
 let reason=kind==='adjust'?'Se conservan el origen, las fechas de las fases y la cadencia de descargas. Las semanas transcurridas no demuestran adaptación.':kind==='goal_change'?'La carrera o su demanda han cambiado: se calcula una distribución nueva desde esta revisión, sin trasladar adaptación del objetivo anterior.':kind==='resume'?'La pausa está declarada o confirmada con historial completo: se vuelve a carga cómoda y se abre una reentrada de al menos dos semanas, sin compensar lo perdido.':'Se inicia una preparación nueva desde esta fecha; el historial y las sesiones realizadas se conservan.';
 if(loadRestart&&kind!=='resume')reason+=' La pausa real también requiere reducir la carga y una reentrada cómoda.';
 return {mode:kind,label:labels[kind],reason,startedOn:kind==='adjust'||kind==='resume'?old?.continuity?.startedOn||previousOrigin:date,phaseOrigin,reviewedOn:date,
  previousSchedule:kind==='adjust'?old.schedule||null:null,loadRestart,resumeStarted:loadRestart?date:kind==='adjust'?old?.continuity?.resumeStarted||null:null,
  reentryUntil:loadRestart?plus(date,14):kind==='adjust'?old?.continuity?.reentryUntil||null:null,
  historyComplete:completeHistory,confirmedBreak,lastRun,historyQuestion:!!old&&!completeHistory?'¿Has registrado todas tus carreras de las últimas cuatro semanas? Si falta alguna, no interpretaremos los días sin registro como una pausa.':null};
}

export function phaseSchedule(p,start,context,previous=null,reentryUntil=null){
 // Preserve an accepted calendar's phase dates, including its deload origin.
 if(previous&&previous.end===(p.goal.date||previous.end))return {...previous,reentryUntil:reentryUntil||previous.reentryUntil||null};
 const demand=raceDemand(p),days=p.goal.date?delta(start,p.goal.date):84;
 const race=['race','time'].includes(p.goal.type)&&!!p.goal.date;
 const taperDays=race?Math.min(days,demand.taper):0,preparationDays=Math.max(0,days-taperDays);
 // A short deadline removes development; it never compresses months into days.
 const baseDays=Math.min(preparationDays,Math.max(context.cautious?14:7,Math.min(28,Math.floor(preparationDays*.2/7)*7)));
 const specificDays=demand.distance&&p.goal.date&&preparationDays>=21?Math.min(preparationDays-baseDays,Math.max(7,Math.floor(preparationDays*.35/7)*7)):0;
 const baseEnd=plus(start,baseDays),specificStart=plus(start,preparationDays-specificDays),taperStart=plus(start,preparationDays);
 return {start,end:plus(start,days),days,baseDays,developmentDays:preparationDays-baseDays-specificDays,specificDays,taperDays,baseEnd,specificStart,taperStart,deloadOrigin:start,reentryUntil,
  deload:preparationDays>=28&&!context.paused&&!context.recovery&&!context.injury,
  reason:preparationDays<21?'Plazo corto: se mantiene la base y se reduce carga antes de la fecha; no hay un bloque específico completo.':'Las fases reservan adaptación inicial, desarrollo, trabajo específico cuando hay margen y puesta a punto.'};
}

export function phaseAt(p,date,schedule){
 const demand=raceDemand(p),remaining=delta(date,schedule.end),anchor=schedule.deloadOrigin||schedule.start;
 const weekday=new Date(anchor+'T12:00:00Z').getUTCDay(),weekStart=plus(anchor,-((weekday+6)%7));
 const index=Math.max(0,Math.floor(delta(weekStart,date)/7));
 if(schedule.taperDays&&date>=schedule.taperStart)return {key:'taper',label:'Puesta a punto',reason:`Menos carga en los últimos ${schedule.taperDays} días. No se añade intensidad ni se recuperan sesiones perdidas.`,loadFactor:remaining<=Math.ceil(schedule.taperDays/2)?.45:.7};
 if(schedule.reentryUntil&&date<schedule.reentryUntil)return {key:'base',label:'Base de vuelta',reason:'Reentrada cómoda tras una pausa confirmada; la fase del calendario no acredita recuperación ni autoriza intensidad.',loadFactor:1};
 if(schedule.deload&&index%4===3)return {key:'deload',label:'Descarga',reason:'Semana de menor volumen y esfuerzo cómodo, sin compensar después lo reducido.',loadFactor:.8};
 if(date<schedule.baseEnd)return {key:'base',label:demand.distance?'Base':'Base general',reason:'Consolidar tu carga reciente y comprobar tolerancia antes de desarrollar el plan.',loadFactor:1};
 if(schedule.specificDays&&date>=schedule.specificStart)return {key:'specific',label:'Trabajo específico',reason:`Priorizar resistencia y esfuerzos sostenibles para ${demand.distance} km; la meta de tiempo no fija el nivel.`,loadFactor:1};
 return {key:'build',label:demand.distance?'Desarrollo':'Desarrollo general',reason:'Aumentos pequeños de diseño, sujetos a recuperación, tiempo disponible y revisión con lo realizado.',loadFactor:1};
}

export function loadPolicy(p,start,context,count){
 const demand=raceDemand(p),base=context.frequency===0?0:+p.weeklyKm||0,scale=context.initialScale*(p.pain!=='none'?.6:1);
 const initial=base*scale,long=recentLong(p,start).value;
 return {base,scale,initial,longInitial:long!=null?long*scale:Math.min(2,initial/Math.max(1,count)),
  longFraction:count>=4?.45:.5,longStep:context.cautious?.25:long>=12&&demand.distance>=20?.75:.5,
  step:context.stepKm,gain:context.cautious?3:demand.distance>=30?24:demand.distance>=20?16:8,
  growth:base>=5&&p.pain==='none'&&!context.paused&&!context.recovery&&!context.injury&&!context.restricted&&!context.uncertainLoad&&!context.uncomfortable,
  demand};
}

export const PLANNING_SOURCES=[
 {title:'B.A.A.: preparación oficial de 10 km',url:'https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/'},
 {title:'B.A.A.: preparación oficial de maratón',url:'https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/'},
 {title:'Vickers y Vertosick: límites de la predicción de carreras',url:'https://doi.org/10.1186/s13102-016-0052-y'},
 {title:'Shepley et al.: estudio experimental de puesta a punto',url:'https://pubmed.ncbi.nlm.nih.gov/1559951/'},
 {title:'Frandsen et al.: carga por sesión y lesiones, cohorte observacional',url:'https://pubmed.ncbi.nlm.nih.gov/40623829/'}
];
