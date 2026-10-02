import {known,recentLong} from './profile-evidence.mjs';

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

export function phaseSchedule(p,start,context){
 const demand=raceDemand(p),days=p.goal.date?delta(start,p.goal.date):84;
 const race=['race','time'].includes(p.goal.type)&&!!p.goal.date;
 const taperDays=race?Math.min(days,demand.taper):0,preparationDays=Math.max(0,days-taperDays);
 // A short deadline removes development; it never compresses months into days.
 const baseDays=Math.min(preparationDays,Math.max(context.cautious?14:7,Math.min(28,Math.floor(preparationDays*.2/7)*7)));
 const specificDays=demand.distance&&p.goal.date&&preparationDays>=21?Math.min(preparationDays-baseDays,Math.max(7,Math.floor(preparationDays*.35/7)*7)):0;
 const baseEnd=plus(start,baseDays),specificStart=plus(start,preparationDays-specificDays),taperStart=plus(start,preparationDays);
 return {start,end:plus(start,days),days,baseDays,developmentDays:preparationDays-baseDays-specificDays,specificDays,taperDays,baseEnd,specificStart,taperStart,
  deload:preparationDays>=28&&!context.paused&&!context.recovery&&!context.injury,
  reason:preparationDays<21?'Plazo corto: se mantiene la base y se reduce carga antes de la fecha; no hay un bloque específico completo.':'Las fases reservan adaptación inicial, desarrollo, trabajo específico cuando hay margen y puesta a punto.'};
}

export function phaseAt(p,date,schedule){
 const demand=raceDemand(p),remaining=delta(date,schedule.end),index=Math.max(0,Math.floor(delta(schedule.start,date)/7));
 if(schedule.taperDays&&date>=schedule.taperStart)return {key:'taper',label:'Puesta a punto',reason:`Menos carga en los últimos ${schedule.taperDays} días. No se añade intensidad ni se recuperan sesiones perdidas.`,loadFactor:remaining<=Math.ceil(schedule.taperDays/2)?.45:.7};
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
