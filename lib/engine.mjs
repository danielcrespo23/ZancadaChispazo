import {runnerContext,runningMinutes,nearHardSport,profileContextErrors,QUALITY_TYPES} from './runner-context.mjs';
import {timedSession} from './timed-session.mjs';
import {buildRunningBlocks,buildStrengthBlocks,sessionLoad,progressionAudit,sessionFormat,formatEligibility,selectQualitySession,strengthContext,SESSION_LIBRARY_SOURCES} from './session-library.mjs';
import {known,comfortableEasy,recentLong,endurancePriority} from './profile-evidence.mjs';
import {raceDemand,phaseSchedule,phaseAt,loadPolicy,preparationContinuity,PLANNING_SOURCES} from './planning-rules.mjs';
import {activityToday,isTrainingActivity,localActivityDate,hasObservedMovingTime} from './activity-source.mjs';
import {activityAssessment,aggregateActivities,duplicateActivity,matchActivitySession} from './activity-evidence.mjs';
import {acceptedGoal,pendingGoalMessage} from './plan-goal.mjs';
import {evaluateReferences,comfortableObservation,roundedRange,readableRange,performanceReferences,REFERENCE_RULES,REFERENCE_SOURCES} from './reference-evidence.mjs';
import {coachAssessment} from './coach-dialog.mjs';
import {validateCoachProposal} from './coach-actions.mjs';
export const DAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const TYPES={unknown:'Tipo sin confirmar',easy:'Carrera fácil',recovery:'Recuperación',long:'Carrera larga',race:'Día de la carrera',hills:'Cuestas',tempo:'Tempo',interval:'Intervalos',progressive:'Progresivo',walk:'Correr / caminar',strength:'Fuerza',rest:'Descanso'};
export const uid=()=>globalThis.crypto.randomUUID();
// Calendar dates are local to the runner. The browser sets its zone; the server uses the zone saved in the profile.
let zone='Europe/Madrid';
export function validTimeZone(tz){if(typeof tz!=='string'||!tz||tz.length>64)return false;try{new Intl.DateTimeFormat('en',{timeZone:tz});return true;}catch{return false;}}
export const setTimeZone=tz=>{if(validTimeZone(tz))zone=tz;return zone;};
export const timeZone=()=>zone;
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateObj=d=>new Date(d+'T12:00:00Z');
export const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(dateObj(d).getTime())&&dateObj(d).toISOString().slice(0,10)===d;
export const addDays=(d,n)=>{const v=dateObj(d);v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)};
export const day=d=>dateObj(d).getUTCDay();
export const daysBetween=(a,b)=>Math.round((dateObj(b)-dateObj(a))/86400000);
export const monday=d=>addDays(d,-((day(d)+6)%7));
export const round=n=>Math.round(n*100)/100;
export const planKm=n=>Math.max(0,Math.floor((n+1e-8)*10)/10);
export const targetSeconds=n=>Math.round(n/5)*5;
export const speed=s=>s>0?round(3600/s):null;
export const pace=s=>!s?'Por esfuerzo':`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
export function seconds(v){if(!v)return 0;if(typeof v==='number')return v;const p=String(v).trim().split(':');if(p.length<2||p.length>3||p.some(x=>!/^\d+$/.test(x))||p.slice(1).some(x=>+x>=60))return NaN;return p.reduce((a,x)=>a*60+Number(x),0)}
export const duration=value=>{const s=Math.max(0,Math.round(value));return `${Math.floor(s/3600)?Math.floor(s/3600)+':':''}${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export const empty=()=>({profile:null,plan:null,activities:[],changes:[],proposals:[],version:1});
export const blankProfile=()=>({name:'',age:'',experience:'beginner',weeklyKm:'',weeklySource:'unknown',weeklyTrend:'unknown',pauseWeeks:'',trainingDays:3,longest:'',longestDate:'',longestSource:'unknown',longestResult:'unknown',easyPace:'',easySource:'unknown',easyEffort:'',easyConversation:'unknown',restHR:'',maxHR:'',hrSource:'unknown',injuries:'',pain:'none',restrictions:'',runningRestriction:'unknown',restrictionMinutes:'',days:[1,3,6],minutes:{1:45,3:45,6:60},longDay:6,strength:false,strengthDay:2,terrain:'asphalt',recentFrequency:'',consistentWeeks:'',consistency:'unknown',recentInjury:false,fatigue:'',recovery:'unknown',otherSports:[],marks:[],goal:{type:'routine',distance:5,date:'',time:'',intent:'finish',flexibility:'unknown',terrain:'asphalt',elevation:''}});
export function metrics(p,start=today(),history=p.paceEvidence||[]){
 const capacity=evaluateReferences({...p,marks:[...(p.marks||[]),...performanceReferences(history,start)]},start),m=capacity.anchor||undefined,base=capacity.paceSeconds,observed=comfortableObservation(p,start,history);
 let ranges=base?{easy:[base*1.2,base*1.45],recovery:[base*1.3,base*1.55],long:[base*1.2,base*1.45],tempo:[base*1.04,base*1.13],interval:[base*.98,base*1.02],progressive:[base*1.12,base*1.35]}:{};
 const declared=comfortableEasy(p)?seconds(p.easyPace):0,source=m?'recent-mark':declared>0?'declared-easy':'effort';
 if(!m&&declared>0){const margin=p.easySource==='estimated'?30:15,targets={easy:declared,recovery:declared+30,long:declared+15};ranges=Object.fromEntries(Object.entries(targets).map(([type,value])=>{const target=targetSeconds(value);return [type,[target-margin,target+margin]];}));}
 const missing=[...runnerContext(p,start).notes,...capacity.warnings,...capacity.limitations];
 if((p.marks||[]).length&&!m)missing.push('Tus referencias no reúnen fecha, medición, contexto, esfuerzo máximo confirmado, terreno o pausas comparables. Se conservan, incluidas las antiguas sin contexto, pero no fijan ritmos de rendimiento hasta confirmarlas.');
 if(!m)missing.push(declared>0?'Sin marca normalizable para entrenamiento: los objetivos suaves parten del ritmo cómodo declarado. Son referencias provisionales, no umbral ni rendimiento medidos; manda el esfuerzo.':'Sin referencia válida de ritmo suave: las sesiones se guían por esfuerzo y conversación.');
 if(p.weeklyKm===''||p.weeklyKm==null)missing.push('Sin volumen reciente: empezaremos con sesiones cortas de correr y caminar.');
 if(!p.maxHR||!p.restHR)missing.push('Sin FC máxima y en reposo: no se muestran zonas cardíacas.');
 if(!p.longest)missing.push('Sin tirada reciente: la duración larga se limitará conservadoramente.');
 if(m&&declared>0&&ranges.easy){const center=Math.max(declared,(ranges.easy[0]+ranges.easy[1])/2),margin=p.easySource==='estimated'?30:15;ranges.easy=[center-margin,center+margin];ranges.long=[center+15-margin,center+15+margin];ranges.recovery=[center+30-margin,center+30+margin];}
 const baseline=p.paceCalibrationBaseline||{};
 for(const type of ['easy','recovery','long']){
  if(baseline[type]&&ranges[type]){
   const center=(baseline[type][0]+baseline[type][1])/2,wanted=declared+(type==='recovery'?30:type==='long'?15:0),margin=p.easySource==='estimated'?30:15;
   ranges[type]=declared>0&&wanted>center?roundedRange(wanted-margin,wanted+margin):[...baseline[type]];
  }
  if(p.paceCalibrationRequest&&observed.eligible){
   const previous=ranges[type]||baseline[type],old=previous?(previous[0]+previous[1])/2:observed.paceSeconds;
   const wanted=observed.paceSeconds+(type==='recovery'?30:type==='long'?15:0),center=Math.max(old-REFERENCE_RULES.paceStepSeconds,wanted);
   ranges[type]=roundedRange(center-15,center+15);
  }
 }
 if(capacity.conflicts.length||capacity.references.every(v=>v.ageDays>90))for(const type of ['tempo','interval','progressive'])delete ranges[type];
 if(p.terrain==='trail')ranges={};
 ranges=Object.fromEntries(Object.entries(ranges).map(([type,r])=>[type,roundedRange(...r)]));
 missing.push(...observed.limitations);
 const reference=m?'Estimación desde '+capacity.references.length+' referencia(s), incluida '+m.distance+' km en '+m.time+' el '+m.date+'. Capacidad equivalente de 5 km: '+readableRange(capacity.paceRange)+'; confianza '+capacity.confidence+'.':declared>0?'Ritmo suave declarado: '+p.easyPace+' min/km. No es una marca ni permite estimar tu umbral.':'Sin referencia para ritmos de entrenamiento: partimos de esfuerzo 3/10 y conversación cómoda.';
 return {ranges,rangeLabels:Object.fromEntries(Object.entries(ranges).map(([type,r])=>[type,readableRange(r)])),source,confidence:capacity.confidence,markAgeDays:m?daysBetween(m.date,start):null,mark:m,basePace:base||declared||null,capacity,observedComfortable:observed,desiredRacePace:p.goal?.time&&+p.goal.distance?{kind:'goal',paceSeconds:seconds(p.goal.time)/+p.goal.distance}:null,reference,
  method:p.terrain==='trail'?'En caminos y pendientes prescribimos por tiempo y esfuerzo. Una marca llana no se convierte en un ritmo objetivo de sendero.':m?'Estimación conjunta mediante potencia con exponente 1,06 y ponderación por antigüedad, distancia y comparabilidad. No mide umbral ni adaptación. Los rodajes observados, la capacidad estimada y el objetivo de carrera permanecen separados. Los márgenes y pesos son reglas de diseño; no intervalos estadísticos ni factores universales. No se extrapola ritmo de maratón desde marcas cortas.':declared>0?'Objetivos provisionales desde tu ritmo suave declarado: fácil igual al declarado, recuperación +30 s/km, larga +15 s/km, sin ritmos numéricos para tempo ni repeticiones. Redondeo a 5 s; ajustar por esfuerzo. Estas reglas iniciales no miden tu umbral ni garantizan la marca objetivo.':'Esfuerzo percibido y prueba de conversación. No calculamos ritmos a partir de las pulsaciones.',missing:[...new Set(missing)]};
}

export function feasibility(p,start=today()){
 const g=p.goal;if(g.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(g.date)||Number.isNaN(dateObj(g.date).getTime())||dateObj(g.date).toISOString().slice(0,10)!==g.date))throw Error('Indica una fecha objetivo real.');const weeks=g.date?daysBetween(start,g.date)/7:12, notes=[];let cautious=false;
 if(g.date&&weeks<=0)throw Error('La fecha objetivo debe ser posterior a hoy.');if(weeks>52)throw Error('Elige una fecha dentro de los próximos 12 meses y revisa el objetivo más adelante.');
 if(!p.days.length)throw Error('Selecciona al menos un día disponible.');if(+p.trainingDays<1||+p.trainingDays>p.days.length)throw Error('Los días de entrenamiento no pueden superar los disponibles.');
 if(!p.days.includes(+p.longDay))throw Error('El día de tirada larga debe estar disponible.');if(p.strength&&!p.days.includes(+p.strengthDay))throw Error('El día de fuerza debe estar disponible.');if(p.days.some(d=>known(p.minutes[d])&&+p.minutes[d]<15))throw Error('Indica al menos 15 minutos en cada día disponible, o déjalo vacío si no lo sabes.');
 const distance=+g.distance||0, km=+p.weeklyKm||0,context=runnerContext(p,start);
 const demand=raceDemand(p),recommended=demand.weeks,baseline=demand.weekly;
 if(['race','time','nonstop'].includes(g.type)&&distance>0&&(km<baseline||weeks<recommended&&(context.cautious||!p.longest||+p.longest<distance*.5))){cautious=true;notes.push(`La meta de ${distance} km necesita revisión: dispones de ${Math.floor(weeks)} semanas y vienes de ${known(p.weeklyKm)?`${km} km/semana`:'un volumen semanal sin confirmar'}. Como referencia conservadora proponemos ${recommended} semanas y una base de ${baseline} km/semana. Revisa las opciones según tu flexibilidad. El plan no fuerza el volumen para alcanzar la meta.`);}
 if(p.pain!=='none'){cautious=true;notes.push(p.pain==='unknown'?'Molestias sin confirmar: carga prudente y sin intensidad; revisa cómo te encuentras antes de entrenar.':'Has indicado molestias actuales. El plan limita la carga y sustituye la intensidad por opciones suaves; con dolor relevante, pausa y valora la situación con un profesional.');}
 const alternatives=[];
 if(['race','time','nonstop'].includes(g.type)&&(!known(g.distance)||!g.date)){notes.push('Distancia o fecha sin confirmar: se propone una base general provisional. Sin fecha no se añade un día de carrera ni una puesta a punto específica.');cautious=true;}
 if(['race','time','nonstop'].includes(g.type)&&distance>0&&g.date&&cautious&&weeks<recommended&&recommended<=52)alternatives.push({kind:'date',text:`Mantener ${distance} km con una fecha a partir del ${addDays(start,recommended*7).split('-').reverse().join('/')} (${recommended} semanas).`,goal:{...g,date:addDays(start,recommended*7)}});
 if(['race','time','nonstop'].includes(g.type)&&km<baseline&&distance>5){const shorter=distance>=20?10:5;alternatives.push({kind:'distance',text:`Preparar primero ${shorter} km en la misma fecha y revisar la meta después.`,goal:{...g,distance:shorter,time:''}});}
 notes.push(...context.notes);if(context.cautious)cautious=true;
 if(distance>42.3){cautious=true;notes.push('Este motor no desarrolla una preparación específica de ultradistancia. La fecha se conserva como referencia, pero revisa la meta con un entrenador y considera primero una distancia menor.');alternatives.push({kind:'distance',text:'Preparar primero 21,1 km sin tiempo objetivo.',goal:{...g,distance:21.1,time:'',intent:'finish'}});}
 if(g.terrain==='trail'||g.terrain==='unknown'||+g.elevation/distance>15){notes.push('Carrera con terreno o desnivel: no extrapolamos un tiempo llano como objetivo de ritmo. Prioriza esfuerzo, técnica y terminar.');if(g.time)cautious=true;}
 const {mark}=metrics(p,start);if(g.time&&mark&&daysBetween(mark.date,start)>90){cautious=true;notes.push('La marca tiene más de tres meses. Antes de perseguir un tiempo, confirma una referencia actual comparable; no asumimos que conservas ese rendimiento.');alternatives.push({kind:'finish',text:'Terminar con control hasta confirmar tu nivel actual.',goal:{...g,time:'',intent:'finish'}});}
 const estimate=raceEstimate(p,start);
 if(g.time&&estimate.seconds){const prediction=estimate.seconds;if(seconds(g.time)<prediction*.94){cautious=true;notes.push(`La referencia comparable sugiere aproximadamente ${duration(prediction)} para ${distance} km, por potencia con exponente 1,06. El tiempo deseado exige revisar la meta; esta estimación supone una preparación específica suficiente y condiciones comparables, no demuestra que puedas sostenerla.`);alternatives.push({kind:'time',text:`Usar ${duration(Math.ceil(prediction/60)*60)} como tiempo orientativo y revisable, derivado de tu referencia.`,goal:{...g,time:duration(Math.ceil(prediction/60)*60)}},{kind:'finish',text:'Terminar la distancia sin objetivo de tiempo.',goal:{...g,time:'',intent:'finish'}});}}
 if(g.time&&mark&&!estimate.seconds){cautious=true;notes.push(estimate.reason||'No hay una referencia comparable para valorar el tiempo deseado.');if(!alternatives.some(a=>a.kind==='finish'))alternatives.push({kind:'finish',text:'Preparar la distancia sin extrapolar un tiempo que tus referencias no permiten valorar.',goal:{...g,time:'',intent:'finish'}});}
 if(g.intent==='improve'&&!mark&&!estimate.seconds)notes.push('Mejorar marca necesita una referencia competitiva reciente y comparable. Por ahora el plan trabaja constancia y esfuerzo, sin prometer una mejora concreta.');
 if(g.time&&!mark&&!estimate.seconds){cautious=true;notes.push('Sin marca reciente comparable no podemos valorar el tiempo deseado; registra primero sesiones cómodas y una referencia válida cuando proceda.');alternatives.push({kind:'finish',text:'Terminar sin perseguir un tiempo no contrastado.',goal:{...g,time:'',intent:'finish'}});}
 if(p.days.length<3)notes.push('Con menos de tres días priorizamos rodajes fáciles y constancia, con menor variedad de intensidad.');
 const flexibility=g.flexibility||'unknown',allowed={time:['time','finish'],date:['date'],distance:['distance'],fixed:[]};
 if(flexibility==='fixed'&&cautious)notes.push('Has elegido mantener la meta: la conservamos como referencia, pero no aumentamos la carga para forzarla. Puedes revisar tu flexibilidad.');
 return {cautious,notes:notes.length?notes:['Objetivo orientativamente compatible con los datos aportados. No garantiza una marca ni alcanzar la distancia.'],weeks,alternatives:alternatives.filter(a=>!allowed[flexibility]||allowed[flexibility].includes(a.kind))};
}
export function raceEstimate(p,start=today()){
 const distance=known(p.goal.distance)?+p.goal.distance:0,g=p.goal;
 if(!distance||distance>42.3||g.terrain&&g.terrain!=='asphalt'||+g.elevation/distance>15)return {kind:'estimate',seconds:null,reason:'Distancia o terreno sin una referencia comparable: no se calcula un ritmo de competición.'};
 const evaluation=evaluateReferences(p,start,distance,{currentOnly:true,marathonGuard:true});
 if(!evaluation.anchor)return {...evaluation,reason:distance>=30?'No extrapolamos ritmo de maratón desde una marca corta. Hace falta una referencia reciente de distancia comparable y preparación específica; por ahora manda el esfuerzo.':'La referencia falta, está antigua o requiere extrapolar demasiado entre distancias: no fija un ritmo de competición.'};
 if(evaluation.conflicts.length)return {...evaluation,seconds:null,mark:evaluation.anchor,reason:evaluation.warnings.join(' ')+' Confirma una referencia comparable antes de fijar un objetivo de competición.'};
 return {...evaluation,mark:evaluation.anchor,method:'Potencia entre distancias, exponente de diseño 1,06; combinación ponderada de referencias comparables. El rango expresa incertidumbre de diseño, no una medición ni un intervalo validado. Supone esfuerzos máximos, preparación específica y condiciones similares.'};
}

// Older saved plans have no block kind; the label is enough to recover it.
export function blockKind(label=''){if(/^(Calentamiento|Calienta|Camina cómodo para calentar|Movilidad$|Rodaje de aproximación|Aproximación suave)/.test(label))return 'warmup';if(/^(Vuelta a la calma|Camina para terminar|Movilidad suave)/.test(label))return 'cooldown';if(/^(Recuperación|Baja )/.test(label))return 'recovery';return 'main';}
export const BLOCK_KINDS={warmup:'Calentamiento',main:'Bloque principal',recovery:'Recuperación',cooldown:'Vuelta a la calma'};
export function profileErrors(d,start=today()){
 const e=profileContextErrors(d),n=v=>v===''||v==null?null:+v,g=d.goal||{};
 if(n(d.age)!=null&&!(n(d.age)>=18&&n(d.age)<=100))e.push('Este plan está diseñado para adultos de 18 a 100 años.');
 if(n(d.weeklyKm)!=null&&!(n(d.weeklyKm)>=0&&n(d.weeklyKm)<=250))e.push('Kilómetros semanales: entre 0 y 250.');
 if(n(d.longest)!=null&&!(n(d.longest)>=0&&n(d.longest)<=150))e.push('Tirada más larga: entre 0 y 150 km.');
 if(d.easyPace&&!(seconds(d.easyPace)>=150&&seconds(d.easyPace)<=1200))e.push('Ritmo suave: usa mm:ss por kilómetro, entre 2:30 y 20:00.');
 if(d.maxHR&&d.restHR&&+d.maxHR<=+d.restHR)e.push('La FC máxima debe superar la de reposo.');
 if(['nonstop','time','race'].includes(g.type)&&g.distance!==''&&g.distance!=null&&!(+g.distance>0&&+g.distance<=100))e.push('Indica una distancia objetivo entre 0,1 y 100 km, o No lo sé.');
 if(g.time&&!(seconds(g.time)>0))e.push('Tiempo objetivo: usa mm:ss o hh:mm:ss.');
 if(d.days.some(v=>!Number.isInteger(+v)||+v<0||+v>6)||new Set(d.days).size!==d.days.length)e.push('Revisa los días disponibles: no deben estar repetidos.');
 if(d.days.some(v=>d.minutes[v]!==''&&d.minutes[v]!=null&&!(+d.minutes[v]>=15&&+d.minutes[v]<=360)))e.push('Disponibilidad: entre 15 y 360 minutos al día, o No lo sé.');
 if(d.longestDate&&(!validDate(d.longestDate)||d.longestDate>start))e.push('Tirada reciente: indica una fecha real que no sea futura.');
 if((d.marks||[]).some(m=>m.elapsedTime&&(!(seconds(m.elapsedTime)>0)||m.time&&seconds(m.elapsedTime)<seconds(m.time))))e.push('El tiempo total de tus marcas debe incluir el tiempo en movimiento.');
 if((d.marks||[]).some(m=>m.date&&(!validDate(m.date)||m.date>start)||m.distance!==''&&m.distance!=null&&!(+m.distance>0&&+m.distance<=200)||m.time&&!(seconds(m.time)>0)||m.elevation!==''&&m.elevation!=null&&!(+m.elevation>=0&&+m.elevation<=15000)||m.measurement&&!['unknown','measured','estimated'].includes(m.measurement)||m.context&&!['unknown','competition','training','test'].includes(m.context)))e.push('Revisa fecha, distancia y tiempo de tus marcas. Puedes dejar datos desconocidos vacíos.');
 if((d.marks||[]).some(m=>m.temperature!==''&&m.temperature!=null&&(!known(m.temperature)||m.temperature< -30||m.temperature>60)||m.conditions&&!['unknown','normal','hot','windy'].includes(m.conditions)||m.rpe!==''&&m.rpe!=null&&(!known(m.rpe)||m.rpe<1||m.rpe>10)||m.fatigue!==''&&m.fatigue!=null&&(!known(m.fatigue)||m.fatigue<0||m.fatigue>10)))e.push('Revisa temperatura, condiciones y esfuerzo de las referencias; deja vacío lo desconocido.');
 if(!e.length)try{feasibility(d,start);}catch(x){e.push(x.message);}
 return e;
}
export function hrRange(p,type){if(p.hrSource!=='measured'||!(+p.restHR>=30&&+p.restHR<=140&&+p.maxHR>+p.restHR&&+p.maxHR<=240))return null;const fractions=['tempo','interval','hills'].includes(type)?[.7,.85]:[.5,.7];return fractions.map(f=>Math.round(+p.restHR+(+p.maxHR-p.restHR)*f));}
export function workoutRange(p,type,phase,m=metrics(p),start=today()){
 const key=type+':'+(phase?.key||'general'),baseline=p.qualityPaceBaseline?.[key];
 if(['tempo','interval','progressive'].includes(type)&&p.holdQualityPaces)return m.capacity?.conflicts.length?null:baseline||null;
 const range=performanceWorkoutRange(p,type,phase,m,start);
 return range&&baseline?roundedRange(Math.max(range[0],baseline[0]-5),Math.max(range[1],baseline[1]-5)):range;
}
function performanceWorkoutRange(p,type,phase,m,start){
 if(type==='hills')return null;
 if(!m.mark||m.capacity?.conflicts.length)return m.ranges[type]||null;
 const distance=+p.goal.distance||0;
 if(type==='interval'){
  const estimate=evaluateReferences(p,start,distance>5?10:5,{currentOnly:true});if(!estimate.seconds||estimate.conflicts.length)return null;
  return roundedRange(estimate.paceSeconds*.98,estimate.paceSeconds*(distance>5?1.03:1.02));
 }
 if(phase?.key==='specific'&&distance>=30&&['tempo','progressive'].includes(type))return null;
 if(type==='tempo'&&phase?.key==='specific'&&distance>=20){const estimate=evaluateReferences(p,start,distance,{currentOnly:true});return estimate.seconds&&!estimate.conflicts.length?roundedRange(estimate.paceSeconds,estimate.paceSeconds*1.06):null;}
 return m.ranges[type]||null;
}

function sessionFocus(p,type,phase){
 const demand=raceDemand(p),specific=phase?.key==='specific';
 const reason=type==='long'?`${demand.distance?`Resistencia para ${demand.distance} km`:'Resistencia general'}: tiempo cómodo desde la tirada reciente, sin exigir completar la distancia de carrera en entrenamiento.`:type==='recovery'?'Menos duración y esfuerzo 2/10 alrededor de una sesión exigente; el volumen reducido no se acumula en otro día.':type==='hills'?'El terreno objetivo incluye pendientes: subidas breves controladas para practicar técnica; no se fija velocidad en cuesta.':specific&&demand.distance>=20?'Practicar esfuerzo sostenido para una carrera larga. Sin referencia equivalente de maratón, el bloque se guía por esfuerzo y no por un ritmo extrapolado de una carrera corta.':type==='interval'?'Repeticiones controladas con recuperación para técnica y economía de carrera; su utilidad depende de tu base y objetivo, también en preparaciones largas. No son esprints.':type==='tempo'?'Practicar esfuerzo sostenido controlado, limitado al tiempo disponible; no se afirma que sea tu umbral medido.':'Consolidar carrera cómoda y conversación antes de añadir más carga.';
 return {distance:demand.distance,reason};
}
export function session(p,type,date,km,minutes,week,phase=null,referenceDate=today(),options={}){
 const m=metrics(p,referenceDate),requestedType=type;
 if(type==='rest')return {id:uid(),date,type,week,phase,blocks:[],load:sessionLoad([]),format:null,dose:null,strength:null,repetitions:null,distance:null,seconds:0,estimated:false,range:null,hr:null,rpe:0,hard:false,purpose:'Descanso sin compensar carga.'};
 if(type==='strength')return {id:uid(),date,type,week,phase,...buildStrengthBlocks(minutes>0?minutes:25,p.strengthEquipment),hr:null,reference:'Fuerza moderada: minutos prescritos y esfuerzo declarado, sin kilómetros de carrera.',basePace:null,paceSource:'effort'};
 if(type==='walk'){
  const prescription=sessionFormat(p,type,phase).prescription,total=Math.max(0,Math.floor(minutes*60)),warm=Math.min(300,Math.floor(total*.2)),main=total-2*warm,run=Math.min(prescription.workSeconds,Math.max(0,main-prescription.recoverySeconds)),rec=Math.min(prescription.recoverySeconds,Math.max(0,main-run)),count=Math.max(1,Math.floor(main/(run+rec||1)));
  const block=(label,seconds,effort,kind,role=null)=>({label,seconds,distance:0,effort,kind,role,range:null,targetPace:null,paceSource:'effort',durationType:'prescribed'});
  const blocks=[block('Camina cómodo para calentar',warm,2,'warmup')];
  for(let i=0;i<count;i++)blocks.push(block('Carrera suave '+(i+1)+'/'+count,run,3,'main','work'),block('Recuperación caminando',rec,2,'recovery','recovery'));
  blocks.push(block('Camina cómodo hasta terminar el bloque',main-count*(run+rec),2,'main'),block('Camina para terminar',warm,1,'cooldown'));
  return {id:uid(),date,type,week,phase,blocks:blocks.filter(b=>b.seconds>0),load:sessionLoad(blocks),seconds:total,distance:null,estimated:false,range:null,hr:null,rpe:3,hard:false,basePace:null,reference:m.reference,paceSource:'effort',repetitions:{count,workSeconds:run,recoverySeconds:rec,recoveryCount:count,recoveryPlacement:'after-each',recoveryType:'Caminar'},format:{id:'run-walk',title:'Correr y caminar'},purpose:'Construir tolerancia alternando carrera y caminata.',progression:'La alternancia no crece por avanzar de semana. Revisa el tiempo de carrera tras confirmar tolerancia en sesiones realizadas, sin aumentar también duración o esfuerzo.',conversation:'Conversación cómoda.',advice:'Camina antes si no puedes conversar. Detente si el dolor altera la zancada.',alternative:'Reduce la duración un 30 % o descansa; no compenses después.'};
 }
 let definition=sessionFormat(p,type,phase,{...options,referenceDate}),eligibility=formatEligibility(p,definition,referenceDate),substitution=null;
 if(!eligibility.eligible){substitution={requestedType:type,requestedFormat:definition.id,reason:eligibility.reasons.join(' ')};type='easy';definition=sessionFormat(p,type,phase);}
 const range=workoutRange(p,type,phase,m,referenceDate);
 let built;
 if(!m.ranges.easy&&type!=='hills')built=timedSession({id:uid(),p,type,date,minutes:minutes>0?minutes:Math.min(+p.minutes[day(date)]||20,20),week,phase,reference:m.reference,source:m.source,format:definition.id,dose:options.dose,referenceDate});
 else built=buildRunningBlocks({p,type,phase,km:planKm(km),minutes,ranges:m.ranges,range,source:m.source,format:definition.id,dose:options.dose});
 if(built.failed||built.purposeMet===false||QUALITY_TYPES.includes(type)&&built.seconds<definition.duration.minimumSessionSeconds){const reason=built.failed||'El recorte deja menos tiempo o trabajo útil que el mínimo del formato.';return {...session(p,'easy',date,km,minutes,week,phase,referenceDate),substitution:{requestedType,requestedFormat:definition.id,reason},progression:reason+' Se sustituye por carrera fácil, sin intensidad de relleno.'};}
 if(built.type)type=built.type;
 const prescription={...built};delete prescription.definition;delete prescription.purposeMet;
 return {...prescription,id:built.id||uid(),date,type,week,phase,trainingFocus:sessionFocus(p,type,phase),reference:m.reference,basePace:m.basePace,paceSource:m.source,hr:prescription.distance==null?null:hrRange(p,type),hrSource:p.hrSource,...(substitution?{substitution,progression:substitution.reason+' Se ofrece carrera cómoda.'}:{}),advice:type==='hills'?'Busca una cuesta regular sin tráfico. Pasos cortos y bajada tranquila. Si no tienes una subida segura, realiza carrera fácil de la misma duración.':'En calor o caminos manda el esfuerzo. Detente si el dolor altera la zancada.',alternative:'Reduce la duración un 30 %, mantén conversación cómoda o descansa. No recuperes después lo omitido.'};
}
export function raceSession(p,plan){
 const m=metrics(p,plan.created||plan.start),date=p.goal.date,km=known(p.goal.distance)?+p.goal.distance:null;
 const estimate=raceEstimate(p,plan.created||plan.start),prediction=estimate.seconds;
 const review=p.pain==='relevant'||runnerContext(p,plan.created||plan.start).paused||plan.viability?.cautious;
 const desired=seconds(p.goal.time),safeDesired=desired>0&&prediction&&desired>=prediction*.94&&!plan.viability?.cautious;
 const racePace=review||endurancePriority(p)?null:safeDesired?desired/km:prediction?prediction/km:null,range=racePace?[racePace*.98,racePace*1.04]:null;
 const blocks=[{label:`Día de la carrera · ${km!=null?`${km.toLocaleString('es-ES')} km de distancia oficial`:'distancia sin confirmar'}. Empieza controlado y revisa sensaciones.`,kind:'main',distance:km??0,seconds:racePace?Math.round(km*racePace):0,effort:review?3:6,range,targetPace:racePace?Math.round(racePace):null}];
 return {id:uid(),date,type:'race',week:Math.floor(daysBetween(monday(plan.start),date)/7),distance:km,seconds:blocks[0].seconds,blocks,range,estimated:!!racePace,rpe:review?3:6,hard:true,fixedDate:true,reference:estimate.mark?`Referencia comparable: ${estimate.mark.distance} km en ${estimate.mark.time}, el ${estimate.mark.date}. ${estimate.method}`:m.reference,basePace:m.basePace,hr:null,purpose:review?'Fecha de tu carrera. La participación o el tiempo deseado requieren revisión según tu base y molestias; esta anotación no prescribe competir ni confirma que sea seguro hacerlo.':'Participar en tu carrera objetivo, empezando con control y sin prometer una marca.',conversation:'Primeros kilómetros controlados; no salgas por encima del esfuerzo ensayado.',progression:'Este día sustituye cualquier entrenamiento habitual. Las 48 horas anteriores no incluyen sesiones exigentes.',advice:p.pain==='relevant'?'No tomes la salida con dolor relevante sin valorar la situación con un profesional.':review?'Valora una distancia menor, correr/caminar o posponer según tu preparación. No persigas el tiempo deseado por encima de tus sensaciones.':'Antes de salir, haz 10–15 minutos de movilidad y trote suave, si lo toleras. Ese calentamiento no está incluido en la distancia oficial. Tras la meta, camina para recuperar.',alternative:'Si hay dolor o fatiga importante, no compenses ni fuerces la participación. Revisa el objetivo.',raceNote:racePace?`${safeDesired?'Tiempo deseado compatible con la estimación':'Estimación por tu marca reciente'}: objetivo de ritmo ${pace(racePace)} min/km, con margen ${pace(range[0])}–${pace(range[1])}. No es una garantía.`:'No fijamos ritmo ni duración de carrera con esta prioridad, preparación o información disponible. Revisa participación y esfuerzo según tus datos y sensaciones.',durationUnknown:!racePace};
}
export function withRaceDay(plan,p){
 if(!plan||!p?.goal?.date||!['race','time'].includes(p.goal.type))return plan;
 const event=raceSession(p,plan),old=plan.sessions.find(s=>s.date===event.date);if(old)event.id=old.id;
 const sessions=plan.sessions.filter(s=>s.date!==event.date).map(s=>{
  if(s.date<event.date&&daysBetween(s.date,event.date)<=2&&s.hard){const easy=session(p,'easy',s.date,s.distance||0,0,s.week);if(s.distance===null)return {...s,type:'rest',distance:null,seconds:0,blocks:[],load:sessionLoad([]),format:null,dose:null,strength:null,hard:false,rpe:0,range:null,hr:null,purpose:'Descanso previo a la carrera.',progression:'Pausa antes del objetivo.'};return {...easy,id:s.id};}
  return s;
 });return {...plan,engineVersion:2,sessions:[...sessions,event].sort((a,b)=>a.date.localeCompare(b.date))};
}
export function upgradeRaceDay(state){
 const plan=state.plan,p=plan?.basis?.profile||state.profile;
 // A profile edit is not an accepted plan revision. Migrate only the goal
 // used by this calendar; never append a second race from an unaccepted goal.
 if(!plan||!p?.goal?.date||plan.end!==p.goal.date||!['race','time'].includes(p.goal.type))return state;
 if(plan.sessions.some(s=>s.date===p.goal.date&&s.type==='race'))return state;
 const next=withRaceDay(plan,p);return {...state,plan:next,proposals:state.proposals.map(v=>v.status==='pending'?{...v,status:'superseded'}:v),changes:[{id:uid(),date:new Date().toISOString(),type:'Día de carrera corregido',reason:'La fecha objetivo sustituye la sesión habitual. Las 48 horas anteriores quedan sin sesiones exigentes.',before:plan,after:next},...state.changes]};
}
export function fitSession(p,type,date,km,minutes,week,phase,referenceDate=today(),maximumMinutes=Infinity,options={}){
 const limit=Math.min(runningMinutes(p,day(date)),maximumMinutes)*60,requestedKm=km;
 let s=session(p,type,date,km,Math.min(minutes>0?minutes:limit/60,limit/60),week,phase,referenceDate,options);
 const requested=sessionFormat(p,type,phase,{...options,referenceDate}).id;
 while(s.seconds>limit&&s.distance!=null&&km>.1){km=planKm(km-.1);s=session(p,type,date,km,Math.min(minutes>0?minutes:limit/60,limit/60),week,phase,referenceDate,options);}
 if(QUALITY_TYPES.includes(s.type)&&(s.seconds<1200||s.blocks.filter(b=>b.kind==='warmup').reduce((n,b)=>n+b.seconds,0)<300||s.blocks.filter(b=>b.kind==='cooldown').reduce((n,b)=>n+b.seconds,0)<180))return {...fitSession(p,'easy',date,km,minutes,week,phase,referenceDate,maximumMinutes),substitution:{requestedType:type,requestedFormat:requested,reason:'El tiempo no permite calentamiento, trabajo útil y vuelta a la calma suficientes.'},progression:'El tiempo no permite calentamiento, trabajo controlado y vuelta a la calma suficientes: se mantiene carrera fácil, sin intensidad de relleno.'};
 if(s.seconds>limit)return {...timedSession({id:s.id,p,type:'easy',date,minutes:limit/60,week,phase,reference:s.reference,source:s.paceSource}),trainingFocus:sessionFocus(p,'easy',phase),substitution:{requestedType:type,requestedFormat:requested,reason:'La distancia mínima tampoco cabe; se ofrece carrera cómoda por tiempo.'}};
 if(s.substitution)return s;
 if(s.distance!=null&&s.distance+ .01<planKm(requestedKm))s={...s,fit:{reduced:true,availableSeconds:limit,reason:'Se recortan tramos suaves y después repeticiones completas; se conserva la longitud del trabajo y su recuperación.'}};
 return s;
}
export function reduceSession(p,before,fraction=.3,start=today()){
 const maximum=Math.floor(Math.min(before.seconds*(1-fraction),runningMinutes(p,day(before.date))*60));
 if(before.type==='walk'){
  const scale=before.seconds>0?maximum/before.seconds:0,blocks=before.blocks.map(b=>({...b,seconds:Math.floor(b.seconds*scale)})).filter(b=>b.seconds>0);
  return {...before,blocks,load:sessionLoad(blocks),seconds:blocks.reduce((n,b)=>n+b.seconds,0),hard:false,repetitions:before.repetitions?{...before.repetitions,workSeconds:Math.floor(before.repetitions.workSeconds*scale),recoverySeconds:Math.floor(before.repetitions.recoverySeconds*scale)}:null,progression:'Alternancia correr/caminar reducida sin convertirla en carrera continua ni recuperar después los minutos omitidos.'};
 }
 if(before.distance==null){return {...timedSession({id:before.id,p,type:'recovery',date:before.date,minutes:maximum/60,week:before.week,phase:before.phase,reference:before.reference,source:before.paceSource}),progression:'Duración reducida, sin recuperar carga más adelante.'};}
 let km=planKm(before.distance*(1-fraction)),after=session(p,'recovery',before.date,km,maximum/60,before.week,before.phase,start);
 while(after.seconds>maximum&&km>.1){km=planKm(km-.1);after=session(p,'recovery',before.date,km,maximum/60,before.week,before.phase,start);}
 if(after.seconds>maximum)return {...timedSession({id:before.id,p,type:'recovery',date:before.date,minutes:maximum/60,week:before.week,phase:before.phase,reference:before.reference,source:before.paceSource}),progression:'Rodaje reducido por tiempo y esfuerzo.'};
 return {...after,id:before.id,hard:false,progression:'Se reducen duración e intensidad. No se acumula la carga omitida.'};
}
export function planDiagnostics(plan){
 const warnings=[];
 for(const week of new Set((plan?.sessions||[]).map(s=>monday(s.date)))){
  const runs=plan.sessions.filter(s=>monday(s.date)===week&&!s.skipped&&!['rest','strength','race'].includes(s.type));
  const long=runs.find(s=>s.type==='long');
  if(long&&runs.some(s=>s.id!==long.id&&((s.distance||0)>(long.distance||0)+.01||s.seconds>long.seconds)))warnings.push(`Semana del ${week}: otra sesión supera la tirada larga. Revisa el reparto y los minutos disponibles.`);
 }
 return warnings;
}
export function generate(p,start=today(),options={}){
 const {easyUntil=null,recentMinutes=null,longestMinutes=null,continuity=null,growthAllowed=true}=options;
 const viable=feasibility(p,start),m=metrics(p,start),context=runnerContext(p,start),end=p.goal.date||addDays(start,83);
 let selected=[...context.available].sort((a,b)=>((a+6)%7)-((b+6)%7));
 if(!context.count){context.paused=true;selected=[...p.days].sort((a,b)=>((a+6)%7)-((b+6)%7));viable.cautious=true;const note='No queda tiempo de carrera tras reservar otros deportes: se propone pausa. Revisa disponibilidad o confirma sus horarios para añadir carreras.';context.notes.push(note);viable.notes.push(note);}
 let longDay=selected.includes(+p.longDay)?+p.longDay:selected.reduce((a,b)=>+p.minutes[a]>=+p.minutes[b]?a:b);
 if(longDay!==+p.longDay)context.notes.push(`El día preferido de tirada está reservado o sin tiempo: se utiliza ${DAYS[longDay]} según tu disponibilidad. No se añade otro entrenamiento.`);
 let chosen=selected.slice(0,context.paused?Math.min(+p.trainingDays,selected.length):context.count);if(!chosen.includes(longDay))chosen=[...chosen.slice(0,-1),longDay].sort((a,b)=>((a+6)%7)-((b+6)%7));
 if(context.cautious&&!context.paused){
  const separated=[longDay];for(const d of [...chosen,...selected])if(!separated.includes(d)&&separated.length<context.count&&separated.every(v=>Math.min(Math.abs(v-d),7-Math.abs(v-d))>=2))separated.push(d);
  chosen=separated.sort((a,b)=>((a+6)%7)-((b+6)%7));
  if(chosen.length<context.count)context.notes.push(`Tus días disponibles no permiten separar todas las sesiones suaves: se programan ${chosen.length}, sin acumular carreras consecutivas.`);
 }
 const sessions=[],policy=loadPolicy(p,start,context,chosen.length),{base,scale:initialScale,initial:initialBase}=policy,schedule=phaseSchedule(p,continuity?.phaseOrigin||start,context,continuity?.previousSchedule,continuity?.reentryUntil);
 viable.notes.push(schedule.reason);
 const meanEasy=m.ranges.easy?(m.ranges.easy[0]+m.ranges.easy[1])/2:null;
 let peak=initialBase,growthSteps=0,anchored=false;
 for(let offset=0;offset<=Math.floor(daysBetween(monday(start),end)/7);offset++){
  const weekStart=addDays(monday(start),offset*7),w=Math.max(0,Math.floor(daysBetween(monday(schedule.start),weekStart)/7)),phase=phaseAt(p,weekStart,schedule),fullCount=chosen.length;
  const measuredStart=offset===0&&continuity?.mode==='adjust'&&continuity.load?.growthAllowed;
  if((anchored||measuredStart)&&growthAllowed&&policy.growth&&['build','specific'].includes(phase.key)){peak=Math.min(initialBase+policy.gain,peak+policy.step);growthSteps++;}
  const target=peak;
  const slots=chosen.map(d=>({d,date:addDays(weekStart,(d+6)%7)})).filter(x=>x.date>=start&&x.date<=end);
  const longCap=Math.min(Math.max(policy.longInitial,policy.demand.longMax),policy.longInitial+policy.longStep*growthSteps);
  const longDate=addDays(weekStart,(longDay+6)%7),longPhase=phaseAt(p,longDate,schedule),longFactor=longPhase.loadFactor;
  const longTarget=Math.min(target*policy.longFraction,longCap)*longFactor;
  const timedBase=Math.min(context.cautious?20:30,Math.max(15,(context.cautious?20:30)*initialScale));
  const minuteBudget=recentMinutes>0?recentMinutes*initialScale+context.stepMinutes*growthSteps:Infinity;
  const timedLong=Math.min(runningMinutes(p,longDay),policy.demand.longMinutes,longestMinutes>0?longestMinutes*initialScale+context.stepMinutes*growthSteps:timedBase+context.stepMinutes*growthSteps,minuteBudget*policy.longFraction)*longFactor;
  const longReference=fullCount>=3&&base>=5&&p.goal.type!=='start'?fitSession(p,'long',longDate,planKm(longTarget),meanEasy?0:timedLong,w,longPhase,start,policy.demand.longMinutes):null;
  const ordinaryTarget=fullCount>=3?Math.max(0,target-Math.min(target*policy.longFraction,longCap))/Math.max(1,fullCount-1):target/fullCount;
  for(const {d,date} of slots){
   const long=d===longDay;let km=long&&fullCount>=3?longTarget:ordinaryTarget;
   let type=long&&fullCount>=3?'long':'easy';const previousHard=sessions.filter(s=>s.hard).at(-1);
   const distanceToLong=Math.min(...slots.filter(s=>s.d===longDay).map(s=>Math.abs(daysBetween(date,s.date))).concat(99));
   const sessionPhase=phaseAt(p,date,schedule),factor=sessionPhase.loadFactor;
   if(context.quality&&date>=schedule.baseEnd&&!['deload','taper'].includes(sessionPhase.key)&&!long&&fullCount>=3&&distanceToLong>=2&&!nearHardSport(p,d)&&(!previousHard||daysBetween(previousHard.date,date)>=2)&&!sessions.some(s=>s.week===w&&QUALITY_TYPES.includes(s.type)))type=qualityType(p,sessionPhase,w,[...(p.sessionSelectionHistory||[]),...sessions],start);
   if(!long&&fullCount>=4&&(distanceToLong===1||previousHard&&daysBetween(previousHard.date,date)===1||nearHardSport(p,d)))type='recovery';
   if(!long)km*=factor*(type==='recovery'?.7:1);
   if(meanEasy)km=Math.min(km,planKm(runningMinutes(p,d)*60/meanEasy));
   if(long&&longReference)km=longReference.distance??km;else if(longReference?.distance!=null)km=Math.min(km,planKm(longReference.distance*.9));km=planKm(km);
   if((sessionPhase.key==='taper'||easyUntil&&date<easyUntil)&&QUALITY_TYPES.includes(type))type='easy';
   const ordinaryMinutes=fullCount>=3?Math.max(0,minuteBudget-(longReference?.seconds/60/longFactor||0))/Math.max(1,fullCount-1):minuteBudget/fullCount;
   let minutes=Math.min(runningMinutes(p,d),timedBase+context.stepMinutes*growthSteps,ordinaryMinutes)*factor*(type==='recovery'?.7:1);
   if(long&&longReference&&!meanEasy)minutes=timedLong;
   if(longReference&&!meanEasy)minutes=Math.min(minutes,longReference.seconds/60*(long?1:.9));
   let s;
   if(base<5||p.goal.type==='start')s=session(p,'walk',date,0,Math.max(10,Math.min(runningMinutes(p,d),minutes)),w,sessionPhase,start);
   else{
    if(meanEasy&&km<2&&QUALITY_TYPES.includes(type))type='easy';
    if(type==='hills'){minutes=Math.min(runningMinutes(p,d),meanEasy?Math.max(20,km*meanEasy/60):minutes,longReference?longReference.seconds*.9/60:Infinity);if(minutes<20)type='easy';}
    const format=sessionFormat(p,type,sessionPhase,{referenceDate:start}),previous=sessions.find(s=>s.format?.id===format.id&&QUALITY_TYPES.includes(s.type));
    const prior=previous||p.sessionDoseBaselines?.[format.id]||sessions.findLast(s=>s.type===type&&QUALITY_TYPES.includes(s.type)),sameUnit=prior?.dose?.unit===(meanEasy&&type!=='hills'?'km':'seconds');
    const dose=sameUnit?(prior.format?.id===format.id?prior.dose:type==='tempo'?{...prior.dose,count:format.prescription.count,work:prior.dose.work*(prior.dose.count||1)/format.prescription.count}:null):null;
    if(QUALITY_TYPES.includes(type)&&prior){if(meanEasy&&prior.distance!=null)km=Math.min(km,prior.distance);else minutes=Math.min(minutes,prior.seconds/60);}
    s=fitSession(p,type,date,km,meanEasy&&type!=='hills'?0:minutes,w,sessionPhase,start,Infinity,{format:format.id,dose});
    if(QUALITY_TYPES.includes(s.type)&&prior?.blocks&&!progressionAudit(prior,s).allowed)s={...fitSession(p,'easy',date,km,minutes,w,sessionPhase,start),substitution:{requestedType:type,requestedFormat:format.id,reason:'La propuesta aumentaría varias variables de calidad a la vez. Se conserva carrera cómoda y se revisa una sola variable.'}};
    if(QUALITY_TYPES.includes(s.type))s={...s,selectionReason:selectQualitySession(p,sessionPhase,{previous:[...(p.sessionSelectionHistory||[]),...sessions],date:start}).reason};
    if(s.hard&&(previousHard&&daysBetween(previousHard.date,date)<2||nearHardSport(p,d)))s=fitSession(p,'easy',date,km,meanEasy?0:minutes,w,sessionPhase,start);
   }
   if(sessionPhase.key==='taper'&&s.type==='long')s={...s,hard:false};
   if(p.pain==='relevant'||context.paused)s={...s,type:'rest',distance:null,seconds:0,blocks:[],load:sessionLoad([]),format:null,dose:null,strength:null,repetitions:null,estimated:false,hard:false,range:null,hr:null,rpe:0,progression:'Pausa sin compensar carga.',purpose:context.paused?'Pausa por la restricción de carrera indicada en tu perfil.':'Pausa por molestias relevantes. Valora la situación con un profesional antes de retomar.',conversation:'No se prescribe carrera.',alternative:'Mantén la pausa y revisa las restricciones y molestias.',advice:'El plan no autoriza volver a correr con dolor ni incumplir una restricción.'};
   sessions.push(s);
  }
  // The first complete week and daily caps anchor subsequent budgets. Lost load
  // is not redistributed. A deload is never the baseline for a catch-up jump.
  const runs=sessions.filter(s=>s.week===w&&!['strength','rest','race'].includes(s.type));
  if(!anchored&&meanEasy&&slots.length===fullCount&&runs.every(s=>s.phase.loadFactor===1)){const actual=runs.reduce((n,s)=>n+(s.distance||0),0);if(base>=5)peak=Math.min(peak,actual);anchored=true;}
  else if(!meanEasy&&slots.length===fullCount)anchored=true;
  if(p.strength&&p.pain==='none'&&!context.paused&&p.days.includes(+p.strengthDay)){
   const date=addDays(weekStart,(+p.strengthDay+6)%7),strengthPolicy=strengthContext(p,+p.strengthDay),nearRunningHard=sessions.some(s=>s.hard&&Math.abs(daysBetween(s.date,date))<2);
   if(strengthPolicy.allowed&&!nearRunningHard&&date>=start&&date<end&&runningMinutes(p,+p.strengthDay)>=15){const strengthPhase=phaseAt(p,date,schedule),minutes=Math.min(runningMinutes(p,+p.strengthDay),strengthPhase.key==='taper'?10:strengthPhase.key==='deload'?15:25);sessions.push(session(p,'strength',date,0,minutes,w,strengthPhase,start));}
   else if(offset===0)context.notes.push(strengthPolicy.allowed?'La fuerza complementaria no cabe con recuperación y tiempo suficientes; no se acumula en otro día.':strengthPolicy.reason);
  }
 }
 const referenceSession=m.confidence==='reference'&&m.observedComfortable.eligible?null:referenceWorkout(p,start,context,chosen,sessions);
 const publishedContinuity=continuity?{...continuity}:{mode:'new',label:'Crear una preparación nueva',startedOn:start,phaseOrigin:start,reviewedOn:start};delete publishedContinuity.previousSchedule;
 const result=withRaceDay({structureVersion:6,planningVersion:3,id:uid(),created:start,start,end,continuity:publishedContinuity,basis:{source:'profile',profile:structuredClone(p),generatedOn:start},sessions:sessions.sort((a,b)=>a.date.localeCompare(b.date)),context:{...context,effectiveLongDay:longDay},schedule,method:m.method,missing:m.missing,viability:viable,referenceSession,reference:referenceSession?.description||null,referenceEvaluation:{capacity:m.capacity,comfortable:m.observedComfortable,goal:m.desiredRacePace},sources:[...PLANNING_SOURCES,...REFERENCE_SOURCES,...SESSION_LIBRARY_SOURCES],rules:[
  'El calendario termina en la fecha real de carrera. No se comprime una preparación larga ni se recuperan sesiones perdidas.',
  'El punto de partida usa volumen, frecuencia, constancia, tirada reciente y recuperación declarados. Sin referencia de ritmo se prescribe por minutos y esfuerzo; no se inventan kilómetros.',
  'Incrementos absolutos de diseño según base y constancia, con límites de tiempo y tirada reciente; no constituyen una regla universal ni una predicción de lesión.',
  'Una sesión de calidad por semana como máximo, solo con base regular y sin molestias, lesión reciente o fatiga alta. Al menos 48 horas entre sesiones exigentes.',
  'Fuerza y otros deportes reservan días y recuperación. Nunca suman kilómetros de running.',
  'Descarga tras tres semanas cuando hay un bloque suficiente y no estás en pausa. La puesta a punto reduce progresivamente la carga; no añade intensidad nueva.',
  'Las duraciones por distancia son estimaciones de tiempo total de los bloques, incluidas recuperaciones. No representan un tiempo en movimiento garantizado.'
 ]},p);
 const errors=validatePlan(result,p);if(errors.length)throw Error('No se pudo validar el plan: '+errors.join(' '));
 const preparation=preparationCheck(p,result,policy,start);
 return {...withRaceDay({...result,viability:preparation.viability},p),racePreparation:{distance:policy.demand.distance,totalDays:daysBetween(start,end),totalWeeks:round(daysBetween(start,end)/7),initialWeeklyKm:initialBase,initialLong:recentLong(p,start).value,desiredPace:p.goal.time&&+p.goal.distance?seconds(p.goal.time)/+p.goal.distance:null,paceSource:m.source,...preparation.summary,description:'Las fases responden al tiempo disponible y a tu base. El tiempo deseado es una meta, no una medición del nivel.'},qualitySummary:qualitySummary(p,result)};
}
export function referenceWorkout(p,start,context,chosen,sessions){
 if(context.paused||p.pain==='relevant')return {kind:'deferred',sessionId:null,description:'La referencia se aplaza mientras exista una restricción de carrera o dolor relevante. No se propone una prueba máxima.'};
 const first=sessions.find(s=>s.date>=start&&['walk','easy','recovery'].includes(s.type));
 if(!first)return null;
 return {kind:'comfortable',sessionId:first.id,date:first.date,seconds:first.seconds,minutes:round(first.seconds/60),blocks:first.blocks,
  description:`Utiliza la sesión cómoda del ${first.date} (${Math.round(first.seconds/60)} min, incluido calentamiento y vuelta a la calma) como referencia inicial. ${first.type==='walk'?'Alterna correr y caminar según sus bloques.':'Mantén esfuerzo 2–3/10 y conversación completa.'} Registra distancia, tiempo total y en movimiento, esfuerzo, conversación y sensaciones. No es una contrarreloj ni permite estimar el umbral. Para ritmos de rendimiento, confirma después una competición o prueba máxima reciente y comparable, solo cuando tu base y recuperación lo permitan.`};
}
export function calibrationAssessment(state,start=today()){
 if(!state.profile)return null;
 const history=(state.activities||[]).filter(isTrainingActivity),p={...state.profile,goal:acceptedGoal(state),marks:[...(state.profile.marks||[]),...performanceReferences(history,start)]},m=metrics(p,start,history),context=runnerContext(p,start);
 const check=(state.checkIns||[]).find(c=>c.date===start),recent=history.filter(a=>a.date<=start&&a.date>=addDays(start,-7));
 const unsafe=check?.pain&&check.pain!=='none'||known(check?.fatigue)&&+check.fatigue>4||recent.some(a=>a.pain!=='none'||!known(a.fatigue)||+a.fatigue>4||a.feeling==='mal');
 const next=referenceWorkout({...p,pain:check?.pain==='relevant'?'relevant':p.pain},start,context,[],(state.plan?.sessions||[]).filter(s=>!(state.activities||[]).some(a=>a.sessionId===s.id)&&!(state.sessionCompletions||[]).some(a=>a.sessionId===s.id)));
 const ready=!unsafe&&!context.cautious&&p.pain==='none'&&p.recovery==='good'&&known(p.fatigue)&&p.fatigue<=4&&+p.consistentWeeks>=8&&+p.recentFrequency>=3&&m.observedComfortable.eligible;
 const missing=[...m.capacity.warnings,...m.capacity.limitations,...m.capacity.assessments.flatMap(v=>v.reasons),...m.observedComfortable.limitations];
 if(m.observedComfortable.count<3)missing.push('Registra al menos tres rodajes del mismo tipo y distancia similar, repartidos en una semana, con esfuerzo y sensaciones.');
 if(!m.capacity.references.length)missing.push('Sin referencia de rendimiento comparable: los rodajes cómodos no permiten predecir una marca máxima.');
 return {capacity:m.capacity,comfortable:m.observedComfortable,goal:m.desiredRacePace,race:raceEstimate(p,start),missing:[...new Set(missing)],nextReference:next,performanceTestAllowed:ready,
  performanceStep:ready?'Si quieres estimar capacidad de competición, utiliza una competición o prueba de 5–10 km medida, reciente, llana y con esfuerzo máximo confirmado. No se añade al calendario automáticamente.':'La calibración usa carrera cómoda o correr/caminar. Todavía no se propone una prueba máxima; confirma constancia, recuperación y tolerancia primero.',
  reviewStep:'Después de registrar la referencia, abre Revisar plan y activa Revisar ritmos. Una sola carrera no acelera el plan; la propuesta gradual requiere varias sesiones comparables y tu aceptación.'};
}
export function preparationCheck(p,plan,policy=null,start=plan.basis?.generatedOn||plan.created||today()){
 policy||=loadPolicy(p,start,plan.context||runnerContext(p,start),Math.min(+p.trainingDays,p.days.length));
 const runs=plan.sessions.filter(s=>s.date>=start&&!s.skipped&&!['rest','strength','race'].includes(s.type)),longs=runs.filter(s=>s.type==='long'),distanceKnown=longs.some(s=>s.distance!=null);
 const projectedLongKm=distanceKnown?round(Math.max(0,...longs.map(s=>s.distance||0))):null,projectedLongMinutes=Math.round(Math.max(0,...longs.map(s=>s.seconds))/60);
 const completeWeeks=[...new Set(runs.map(s=>monday(s.date)))].filter(w=>w>=start&&addDays(w,7)<=plan.end);
 const weekKm=w=>round(runs.filter(s=>monday(s.date)===w).reduce((n,s)=>n+(s.distance||0),0));
 const initialPlannedKm=runs.some(s=>s.distance!=null)?completeWeeks.length?weekKm(completeWeeks[0]):round(runs.reduce((n,s)=>n+(s.distance||0),0)):null;
 const summary={initialPlannedKm,projectedLongKm,projectedLongMinutes,projectedPeakKm:runs.some(s=>s.distance!=null)?Math.max(0,...completeWeeks.map(weekKm)):null};
 const viability={...plan.viability,notes:[...plan.viability.notes],alternatives:[...plan.viability.alternatives]},demand=policy.demand;
 if(p.days.every(d=>known(p.minutes[d])))viability.notes.push(`Tiempo disponible: ${p.days.map(d=>`${DAYS[d]} ${p.minutes[d]} min`).join(', ')}. Los bloques completos se ajustan a cada día, incluidas recuperaciones; no se trasladan minutos ni sesiones perdidas a otros días.`);
 if(demand.distance&&p.goal.date&&demand.kind!=='unsupported'){
  const minimumMinutes=demand.kind==='marathon'?120:demand.kind==='half'?80:demand.kind==='10k'?40:20;
  const insufficient=projectedLongKm!=null?Math.max(projectedLongKm,policy.longInitial)+.1<demand.long:projectedLongMinutes<minimumMinutes;
  if(insufficient){viability.cautious=true;viability.notes.push(projectedLongKm!=null?`Con tu base, plazo y minutos, la tirada más larga prevista llega a ${projectedLongKm} km; la referencia de diseño para ${demand.distance} km es ${round(demand.long)} km, no una obligación. No añadimos carga para alcanzarla.`:`Sin un ritmo comparable no sabemos qué distancia cubrirás. La tirada prevista llega a ${projectedLongMinutes} min: preparación de ${demand.distance} km limitada; registra primero tolerancia cómoda y revisa el objetivo.`);
   const flexibility=p.goal.flexibility||'unknown';if(['unknown','any','distance'].includes(flexibility)&&demand.distance>5&&!viability.alternatives.some(a=>a.kind==='distance')){const shorter=demand.distance>=20?10:5;viability.alternatives.push({kind:'distance',text:`Preparar primero ${shorter} km: la carga y disponibilidad actuales no permiten desarrollar la tirada orientativa de ${demand.distance} km.`,goal:{...p.goal,distance:shorter,time:'',intent:'finish'}});}
  }
 }
 return {summary,viability:{...viability,notes:[...new Set(viability.notes)]}};
}
export function validatePlan(plan,p){
 const errors=[],hard=[];
 for(const s of plan.sessions){
  if(!Array.isArray(s.blocks)){errors.push('Faltan los bloques de la sesión.');continue;}
  if(s.date<plan.created||s.date>plan.end)errors.push('Sesión fuera del intervalo.');
  if(!validDate(s.date))errors.push('La sesión necesita una fecha real.');
  if(s.type!=='race'&&!p.days.includes(day(s.date)))errors.push('Sesión en día no disponible.');
  if(!Number.isFinite(s.seconds)||s.seconds<0||s.seconds!==s.blocks.reduce((n,b)=>n+b.seconds,0))errors.push('Duración no coincide con bloques.');
  const expectedLoad=sessionLoad(s.blocks);
  if(s.load&&(s.load.kind!=='planned'||s.load.effortMinutes!==expectedLoad.effortMinutes||s.load.workSeconds!==expectedLoad.workSeconds))errors.push('La carga pautada no coincide con sus bloques.');
  if(s.blocks.some(b=>!Number.isFinite(b.seconds)||b.seconds<0||!Number.isFinite(b.distance)||b.distance<0))errors.push('Bloque inválido.');
  if(s.distance!=null&&Math.abs(s.distance-s.blocks.reduce((n,b)=>n+b.distance,0))>.001)errors.push('Distancia no coincide con bloques.');
  if(s.type!=='race'&&s.seconds>runningMinutes(p,day(s.date))*60)errors.push('Sesión excede disponibilidad.');
  if(s.type!=='race'&&s.type!=='strength'&&s.type!=='rest'&&runnerContext(p).blockedDays.includes(day(s.date)))errors.push('Carrera en día reservado.');
  if(s.hard&&s.type!=='race'&&nearHardSport(p,day(s.date)))errors.push('Intensidad junto a deporte exigente.');
  if(s.hard)hard.push(s);
 }
 hard.sort((a,b)=>a.date.localeCompare(b.date));if(hard.some((s,i)=>i&&daysBetween(hard[i-1].date,s.date)<2))errors.push('Sesiones exigentes consecutivas.');
 return [...new Set(errors)];
}
export function validateActivity(a,referenceDay=today()){
 if(a.timeBasis&&!['moving','timer','recorded','elapsed'].includes(a.timeBasis))return ['El significado del tiempo no es válido.'];
 if(a.movingSeconds!=null&&(!Number.isFinite(a.movingSeconds)||a.movingSeconds<=0||Math.abs(a.movingSeconds-a.seconds)>.001||!hasObservedMovingTime(a)))return ['El tiempo en movimiento debe ser coherente con el tiempo principal.'];
 if(a.timerSeconds!=null&&(!Number.isFinite(a.timerSeconds)||a.timerSeconds<=0||a.elapsedSeconds!=null&&a.timerSeconds>a.elapsedSeconds+.001))return ['Revisa el tiempo de cronómetro y el tiempo transcurrido.'];
 if(a.measurement&&!['unknown','measured','estimated'].includes(a.measurement)||a.conversation&&!['unknown','yes','short','no'].includes(a.conversation))return ['Revisa origen de medición y conversación de la actividad.'];
 if(a.conditions&&!['unknown','normal','hot','windy'].includes(a.conditions)||a.temperature!==''&&a.temperature!=null&&(!Number.isFinite(+a.temperature)||+a.temperature< -30||+a.temperature>50))return ['Revisa la temperatura y las condiciones declaradas de la actividad.'];
 const errors=[];if(a.elapsedSeconds!=null&&(!Number.isFinite(a.elapsedSeconds)||a.elapsedSeconds<a.seconds||a.elapsedSeconds>172800))errors.push('El tiempo total debe incluir el tiempo principal registrado y no superar 48 horas.');if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||'')||Number.isNaN(dateObj(a.date).getTime())||dateObj(a.date).toISOString().slice(0,10)!==a.date||a.date>referenceDay)errors.push('Introduce una fecha real que no sea futura.');if(!(Number.isFinite(a.distance)&&a.distance>0&&a.distance<=200))errors.push('Introduce una distancia mayor que 0 y hasta 200 km.');if(!(Number.isFinite(a.seconds)&&a.seconds>0&&a.seconds<=172800))errors.push('Duración válida: mm:ss o hh:mm:ss, hasta 48 horas.');
 for(const k of ['avgHR','maxHR'])if(a[k]!=null&&a[k]!==''&&(!known(a[k])||+a[k]<30||+a[k]>240))errors.push('Pulsaciones: entre 30 y 240 ppm, o ausentes.');
 const calculated=a.seconds/a.distance;if(a.manualPace&&(!Number.isFinite(seconds(a.manualPace))||Math.abs(seconds(a.manualPace)-calculated)>5))errors.push('El ritmo introducido no coincide con tiempo ÷ distancia (tolerancia de 5 s/km).');
 if(a.elevation!=null&&(!Number.isFinite(+a.elevation)||+a.elevation<0||+a.elevation>15000))errors.push('Desnivel positivo: entre 0 y 15000 m.');
 if(a.avgHR&&a.maxHR&&+a.avgHR>+a.maxHR)errors.push('Las pulsaciones medias no pueden superar las máximas.');if(a.rpe!=null&&a.rpe!==''&&(!known(a.rpe)||!(+a.rpe>=1&&+a.rpe<=10)))errors.push('El esfuerzo debe estar entre 1 y 10, o No lo sé.');
 if(a.fatigue!=null&&a.fatigue!==''&&(!known(a.fatigue)||!(+a.fatigue>=0&&+a.fatigue<=10)))errors.push('La fatiga debe estar entre 0 y 10, o No lo sé.');
 if(a.pain!=null&&!['unknown','none','mild','relevant',''].includes(a.pain))errors.push('Revisa las molestias declaradas.');
 for(const l of a.laps||[])if(!(Number.isFinite(+l.distance)&&+l.distance>=0&&(l.distance>0||l.kind&&l.kind!=='unknown')&&Number.isFinite(+l.seconds)&&+l.seconds>0)||!Number.isFinite(+l.recoverySeconds)||l.recoverySeconds<0||!Number.isFinite(+(l.recoveryDistance??0))||+(l.recoveryDistance??0)<0||l.rpe!=null&&l.rpe!==''&&(!known(l.rpe)||+l.rpe<1||+l.rpe>10))errors.push('Cada vuelta necesita distancia y tiempo positivos, o un bloque identificado por tiempo, y recuperación y esfuerzo válidos.');
 if((a.laps||[]).length){if(a.laps.reduce((x,l)=>x+l.distance+(+l.recoveryDistance||0),0)>+a.distance+.01)errors.push('Las distancias de las vueltas superan la distancia total.');const moving=a.laps.reduce((x,l)=>x+l.seconds+(l.recoveryType==='stop'?0:+l.recoverySeconds||0),0),elapsed=a.laps.reduce((x,l)=>x+l.seconds+(+l.recoverySeconds||0),0);if(moving>a.seconds+.001||a.elapsedSeconds!=null&&elapsed>a.elapsedSeconds+.001)errors.push('El tiempo de vueltas y recuperaciones supera la duración total.');}
 return errors;
}
export function analyze(a,s){return activityAssessment(a,s);}
export function progressEvidence(a,plan,p,history=[],previousProposals=[],referenceDate=activityToday(p?.timezone||timeZone())){
 const denied=reason=>({count:0,eligible:false,activities:[],exclusions:[],limitations:[],reason});
 if(!p||p.pain!=='none'||['beginner','unknown'].includes(p.experience)||+p.weeklyKm<12||!isTrainingActivity(a))return denied('Una sola carrera o una base insuficiente no justifica aumentar carga o ritmo.');
 const context=runnerContext(p,referenceDate);if(context.cautious)return denied('Tu base, pausa, sensaciones o restricciones requieren una propuesta conservadora. No se aumenta carga con estas respuestas.');
 const current=metrics(p,referenceDate);if(!current.ranges[a.type])return denied('El calendario anterior no sustituye una referencia actual válida. Confirma el ritmo cómodo o una marca comparable antes de proponer aumentos por ritmo.');
 const used=new Set(previousProposals.filter(v=>v.status==='accepted'&&v.direction==='increase').flatMap(v=>v.evidenceIds||[]));
 const all=[...history.filter(v=>v.id!==a.id),a].filter(isTrainingActivity),exclusions=[],limitations=new Set();
 const candidates=all.filter(v=>{
  const s=plan?.sessions.find(s=>s.id===v.sessionId),why=[];
  if(v.groupId||used.has(v.id))why.push('registro agrupado o evidencia ya utilizada');
  if(!hasObservedMovingTime(v)){why.push('tiempo en movimiento sin confirmar');limitations.add('Falta tiempo en movimiento confirmado: el cronómetro o tiempo registrado no acredita progreso de ritmo.');}
  if(!validDate(v.date)||v.date>a.date||v.date>referenceDate||daysBetween(v.date,referenceDate)>21)why.push('fecha fuera de los últimos 21 días');
  if(!['easy','recovery','long'].includes(v.type)||v.type!==a.type||s?.type!==v.type||!s.range)why.push('sesión continua del mismo tipo sin asociación comparable');
  if(!(v.distance>0&&s?.distance>0)||Math.abs(v.distance-s.distance)/s.distance>.2||Math.abs(v.distance/a.distance-1)>.2)why.push('distancia no comparable');
  if(!known(v.rpe)||!known(v.fatigue)||v.rpe>s?.rpe||v.fatigue>4||v.pain!=='none'||v.feeling==='mal')why.push('esfuerzo, fatiga o molestias incompatibles o sin confirmar');
  if(!v.terrain||v.terrain==='unknown'||v.terrain==='trail'||v.terrain!==a.terrain||v.terrain!==p.terrain)why.push('terreno no comparable');
  if(v.measurement!=='measured'){why.push('medición sin confirmar');limitations.add('Confirma que distancia y tiempo fueron medidos; una estimación no demuestra progreso.');}
  if(!known(v.temperature)||!known(a.temperature)){why.push('temperatura desconocida');limitations.add('Temperatura desconocida: no sabemos si las condiciones son comparables; se mantiene el plan. Regístrala si la conoces, sin inventarla.');}
  else if(v.temperature>=25||a.temperature>=25||Math.abs(v.temperature-a.temperature)>5)why.push('calor o temperaturas no comparables');
  if(['hot','windy'].includes(v.conditions)||['hot','windy'].includes(a.conditions))why.push('calor o viento relevante declarado');
  if(!known(v.elevation)){why.push('desnivel sin confirmar');limitations.add('Falta confirmar el desnivel; no se presupone un recorrido llano.');}
  else if(+v.elevation/v.distance>15)why.push('desnivel elevado');
  if(!known(v.elapsedSeconds)){why.push('pausas sin confirmar');limitations.add('Falta tiempo total: no se presupone que un ritmo en movimiento sea continuo.');}
  else if(v.elapsedSeconds>v.seconds*1.1)why.push('pausas importantes');
  if(v.conversation&&v.conversation!=='yes')why.push('conversación no cómoda o sin confirmar');
  if(!s?.range||!(v.seconds/v.distance<=((s.range[0]+s.range[1])/2)*.97))why.push('no supera el objetivo comparable de forma consistente');
  if(why.length)exclusions.push({id:v.id,reasons:why});return !why.length;
 }).sort((x,y)=>y.date.localeCompare(x.date)||x.id.localeCompare(y.id));
 const distinct=candidates.filter((v,i)=>candidates.findIndex(x=>x.date===v.date)===i).slice(0,3);
 const span=distinct.length?daysBetween(distinct.at(-1).date,distinct[0].date):0;
 const unsafe=all.some(v=>v.date<=referenceDate&&daysBetween(v.date,referenceDate)<=7&&(v.pain!=='none'||!known(v.rpe)||!known(v.fatigue)||v.fatigue>=7||v.feeling==='mal'));
 const taper=plan?.end&&['race','time'].includes(p.goal.type)&&daysBetween(referenceDate,plan.end)<=14;
 const conflicts=current.capacity.conflicts.length>0,eligible=distinct.length>=3&&span>=7&&!unsafe&&!taper&&!conflicts;
 const reason=unsafe?'Hay señales recientes de molestias o fatiga: no recomendamos aumentar.':taper?'Estás en las dos semanas previas a la carrera: mantén la descarga.':conflicts?'Las marcas de rendimiento se contradicen: revisa su contexto antes de aumentar ritmos.':eligible?'Tres sesiones comparables en al menos siete días, dentro de los últimos 21, han resultado al menos un 3 % más rápidas que su objetivo orientativo, sin mayor esfuerzo declarado.':limitations.size?[...limitations].join(' '):distinct.length<3?'Tenemos '+distinct.length+'/3 sesiones comparables recientes con esfuerzo controlado y poca fatiga; por ahora mantenemos la carga.':'Las sesiones todavía no abarcan una semana: una mejora aislada o concentrada no cambia el plan.';
 return {count:distinct.length,eligible,activities:distinct,spanDays:span,observedPaceSeconds:distinct.length?distinct.map(v=>v.seconds/v.distance).sort((x,y)=>x-y)[Math.floor(distinct.length/2)]:null,exclusions,limitations:[...limitations],reason:reason+(exclusions.length&&!limitations.size&&!eligible?' Exclusiones: '+[...new Set(exclusions.flatMap(v=>v.reasons))].join('; ')+'.':'')};
}
export function comfortablePaceUpdate(before,observedPace,evidenceIds=[]){
 if(!['easy','recovery','long'].includes(before.type)||!before.range||!(observedPace>0))return null;
 const center=(before.range[0]+before.range[1])/2,step=Math.min(5,Math.floor((center-observedPace)/5)*5);
 if(step<=0)return null;
 const range=before.range.map(v=>v-step);
 const blocks=before.blocks.map(b=>{
  if((b.kind||blockKind(b.label))!=='main'||!b.range||b.effort>4||!b.distance)return b;
  const next=b.range.map(v=>v-step),target=targetSeconds((next[0]+next[1])/2);
  return {...b,range:next,targetPace:target,seconds:Math.round(b.distance*target),paceSource:'comparable-runs'};
 });
 return {...before,range,blocks,load:sessionLoad(blocks),seconds:blocks.reduce((n,b)=>n+b.seconds,0),paceSource:'comparable-runs',calibration:{kind:'observation',evidenceIds,observedPaceSeconds:observedPace,stepSeconds:step},progression:'Propuesta gradual: 5 s/km en el bloque cómodo de este tipo de sesión. Distancia, fases, calentamiento y ritmos de calidad se conservan.'};
}

export function proposal(a,plan,p,history=[],previousProposals=[],referenceDate=activityToday(p?.timezone||timeZone())){
 const s=plan?.sessions.find(s=>s.id===a.sessionId),analysis=analyze(a,s),evidence=progressEvidence(a,plan,p,history,previousProposals,referenceDate);
 if(analysis.action==='mantener'){
  if(!evidence.eligible)return null;
  const eligible=plan.sessions.filter(v=>v.date>a.date&&v.date>referenceDate&&daysBetween(a.date,v.date)<=14&&!v.skipped&&v.type===a.type&&(!p.goal.date||!['race','time'].includes(p.goal.type)||daysBetween(v.date,p.goal.date)>14)).slice(0,3);
  const changes=eligible.map(before=>{
   const after=comfortablePaceUpdate(before,evidence.observedPaceSeconds,evidence.activities.map(v=>v.id));if(!after)return null;
   if(after.seconds>runningMinutes(p,day(before.date))*60)return null;
   if(after.hard&&plan.sessions.some(v=>v.id!==before.id&&v.hard&&!v.skipped&&Math.abs(daysBetween(v.date,after.date))<2))return null;
   const changed={...plan,created:referenceDate,sessions:plan.sessions.filter(v=>v.date>referenceDate).map(v=>v.id===before.id?after:v)};
   if(validatePlan(changed,p).length||planDiagnostics(changed).length)return null;
   return {sessionId:before.id,before,after};
  }).filter(Boolean);
  if(!changes.length)return null;
  return {id:uid(),activityId:a.id,created:referenceDate,direction:'increase',updateKind:'pace',evidenceSignature:activityEvidenceSignature(evidence.activities),evidenceIds:evidence.activities.map(v=>v.id),changes,sessionId:changes[0].sessionId,before:changes[0].before,after:changes[0].after,reason:evidence.reason+' Proponemos solo 5 s/km en bloques cómodos del mismo tipo, sin aumentar distancia ni acelerar calidad. Ritmo cómodo observado: '+pace(evidence.observedPaceSeconds)+' min/km. Referencias: '+evidence.activities.map(v=>v.date+' · '+v.distance+' km · '+pace(v.seconds/v.distance)+' min/km · esfuerzo '+v.rpe+'/10').join('; ')+'. Es una inferencia para revisar, no una medición de mejora física.',status:'pending'};
 }
 const next=plan?.sessions.find(v=>v.date>a.date&&v.date>referenceDate&&!v.skipped&&!['strength','rest','race'].includes(v.type));if(!next)return null;
 let after=analysis.action==='revisar'?{...next,type:'rest',distance:null,seconds:0,blocks:[],load:sessionLoad([]),format:null,dose:null,strength:null,repetitions:null,estimated:false,hard:false,rpe:0,purpose:'Pausa por dolor relevante. Revisar con un profesional.',range:null,hr:null}:reduceSession(p,next,.3);

 after.id=next.id;return {id:uid(),activityId:a.id,created:referenceDate,sessionId:next.id,before:next,after,reason:analysis.reason,status:'pending'};
}
export function moveSession(plan,id,date,p,state={},start=today()){
 const s=plan.sessions.find(s=>s.id===id);if(!s)throw Error('No se encuentra la sesión.');
 if(s.type==='race')throw Error('La carrera tiene fecha fija. Para cambiarla, edita el objetivo y regenera el plan.');
 if(s.date<start||s.skipped||(state.activities||[]).some(a=>a.sessionId===id)||(state.sessionCompletions||[]).some(c=>c.sessionId===id))throw Error('Solo puedes reorganizar sesiones pendientes de hoy o futuras.');
 if(!validDate(date))throw Error('Elige una fecha real.');
 if(date<start||date<plan.start||date>plan.end)throw Error('Elige una fecha futura dentro del plan.');
 if(!p.days.includes(day(date)))throw Error('Ese día no figura como disponible en tu perfil.');
 if((state.unavailable||[]).some(b=>date>=b.start&&date<=b.end))throw Error('Ese día está dentro de un periodo sin entrenamiento.');
 if(s.type!=='strength'&&(runnerContext(p,start).blockedDays.includes(day(date))||runningMinutes(p,day(date))<15))throw Error('Ese día está reservado para otro deporte o no queda tiempo para correr.');
 if(s.hard&&nearHardSport(p,day(date)))throw Error('Deja recuperación alrededor de un deporte exigente.');
 if(s.hard&&plan.sessions.some(v=>v.type==='race'&&date<v.date&&daysBetween(date,v.date)<=2))throw Error('Las 48 horas anteriores a la carrera se reservan sin entrenamientos exigentes.');
 if(plan.sessions.some(v=>v.id!==id&&v.date===date))throw Error('Ya hay una sesión ese día. No acumulamos entrenamientos.');
 if(s.seconds>runningMinutes(p,day(date))*60)throw Error('La sesión supera el tiempo disponible de ese día.');
 if(s.hard&&plan.sessions.some(v=>v.id!==id&&!v.skipped&&v.hard&&Math.abs(daysBetween(v.date,date))<2))throw Error('Deja al menos 48 horas entre sesiones exigentes.');
 return {...plan,sessions:plan.sessions.map(v=>v.id===id?{...v,date,week:Math.floor(daysBetween(monday(plan.start),date)/7)}:v).sort((a,b)=>a.date.localeCompare(b.date))};
}
export function coach(question,state,start=today(),options={}){return coachAssessment(question,state,start,options).answer;}

// A record is always shown on its real date. A plan link is separate from that date.
export function findActivitySession(a,plan,activities=[]){return matchActivitySession(a,plan,activities);}
export function analysisForActivity(a,state){
 const s=state.plan?.sessions.find(s=>s.id===a.sessionId)||a.plannedSnapshot;
 const members=a.sessionId?(state.activities||[]).filter(v=>v.sessionId===a.sessionId):[a],actual=members.length>1?aggregateActivities(members):a;
 const base=analyze(actual,s),progress=progressEvidence(actual,state.plan,state.profile,state.activities,state.proposals).reason;
 const next=state.plan?.sessions.find(v=>v.date>activityToday(state.profile?.timezone||timeZone())&&!v.skipped&&!['rest','strength','race'].includes(v.type)&&!state.activities.some(run=>run.sessionId===v.id));
 const pending=state.proposals.find(v=>members.some(m=>m.id===v.activityId)&&v.status==='pending');
 return {...base,progress,planned:s||null,actual,members:members.map(v=>v.id),nextSession:next||null,nextAdvice:base.action==='revisar'?'Pausa la carrera por las molestias relevantes; la propuesta concreta necesita tu aceptación.':base.action==='reducir'?'Revisa la alternativa suave propuesta; si sigue la fatiga o molestia, descansa.':next?`Sigue la siguiente sesión prevista (${next.date}) y comprueba tus sensaciones antes de salir; no acumules lo omitido.`:'No queda una sesión futura modificable. Revisa el objetivo si quieres continuar.',decision:pending?'Hay un ajuste pendiente. Revísalo y acéptalo para modificar las próximas sesiones.':base.action==='mantener'?'Plan mantenido: la actividad se ha guardado; las próximas sesiones conservan su prescripción.':state.proposals.some(v=>v.activityId===a.id&&v.status==='accepted')?'El ajuste de esta carrera ya se aceptó y está en el historial.':'No hay una próxima sesión modificable o un ajuste pendiente. Revisa tu objetivo si el plan ha terminado.'};
}
export function recordActivity(state,activity){
 if(!isTrainingActivity(activity))throw Error('La fuente no está autorizada para el seguimiento. Strava se consulta por separado.');
 activity={...activity,...localActivityDate(activity,state.profile?.timezone||timeZone())};
 const errors=validateActivity(activity,activityToday(activity.timezone));if(errors.length)throw Error(errors.join(' '));
 const duplicate=duplicateActivity(activity,state.activities||[]);if(duplicate&&(duplicate.exact||!activity.duplicateConfirmed))throw Error(duplicate.reason);
 const linked=findActivitySession(activity,state.plan,state.activities);
 if(linked?.date>activityToday(state.profile?.timezone||timeZone()))throw Error('No puedes completar una sesión futura. Reorganízala primero.');
 if(activity.linkMode==='manual'&&activity.sessionId&&!linked)throw Error('La sesión elegida ya no está en el plan. Selecciona otra o usa la vinculación por fecha.');
 if(linked&&state.activities.some(v=>v.id!==activity.id&&v.sessionId===linked.id&&(!activity.groupId||v.groupId!==activity.groupId)))throw Error('Esta sesión ya tiene una carrera vinculada. Edita esa carrera o agrupa los registros desde su análisis.');
 const a={...activity,sessionId:linked?.id||'',linkMode:activity.linkMode||'auto',plannedSnapshot:linked||(activity.linkMode==='manual'?activity.plannedSnapshot:null)||null};
 const prop=proposal(a,state.plan,state.profile,state.activities,state.proposals);
 const next={...state,activities:[...state.activities.filter(v=>v.id!==a.id),a].sort((x,y)=>y.date.localeCompare(x.date)),proposals:[...supersedeActivityProposals(state,[a.id]),...(prop?[prop]:[])]};
 const analysis=analysisForActivity(a,next);return {state:next,activity:{...a,analysis},proposal:prop};
}
const associationKeys=['sessionId','linkMode','groupId','plannedSnapshot','partRole'];
const association=a=>Object.fromEntries(associationKeys.filter(k=>Object.hasOwn(a,k)).map(k=>[k,a[k]]));
const supersedeActivityProposals=(state,ids)=>{
 const sessions=new Set(state.activities.filter(a=>ids.includes(a.id)&&a.sessionId).map(a=>a.sessionId));
 const affected=new Set([...ids,...state.activities.filter(a=>sessions.has(a.sessionId)).map(a=>a.id)]);
 return state.proposals.map(v=>v.status==='pending'&&(affected.has(v.activityId)||(v.evidenceIds||[]).some(id=>affected.has(id)))?{...v,status:'superseded',supersededReason:'Los registros o sus asociaciones han cambiado; revisa el análisis actualizado.'}:v);
};
export function associateActivities(state,ids,sessionId,{roles={},start=activityToday(state.profile?.timezone||timeZone()),unlinkedMode='unlinked'}={}){
 if(!ids.length||new Set(ids).size!==ids.length)throw Error('Selecciona registros distintos para asociarlos.');
 const members=ids.map(id=>state.activities.find(a=>a.id===id));if(members.some(a=>!a||!isTrainingActivity(a)))throw Error('Selecciona solo actividades propias autorizadas.');
 const s=sessionId?state.plan?.sessions.find(v=>v.id===sessionId):null;
 if(sessionId&&(!s||s.date>start||['rest','strength'].includes(s.type)))throw Error('Selecciona una sesión de carrera de hoy o pasada.');
 if(sessionId&&state.activities.some(a=>a.sessionId===sessionId&&!ids.includes(a.id)))throw Error('Incluye todos los registros ya vinculados a esa sesión para agruparlos.');
 if(members.length>1){const dates=new Set(members.map(a=>a.date)),instants=members.map(a=>Date.parse(a.startedAt));if(dates.size>1&&(!instants.every(Number.isFinite)||Math.max(...instants)-Math.min(...instants)>43200000))throw Error('Agrupa registros del mismo día local, o una carrera que cruza medianoche con horas de inicio confirmadas.');}
 for(const value of Object.values(roles))if(!['unknown','full','warmup','main','recovery','cooldown'].includes(value))throw Error('Revisa el papel de cada registro.');
 const before=members.map(a=>({id:a.id,association:association(a)})),groupId=sessionId&&members.length>1?uid():null;
 const activities=state.activities.map(a=>ids.includes(a.id)?{...a,sessionId:sessionId||'',linkMode:sessionId?'manual':unlinkedMode==='none'?'none':'unlinked',groupId,plannedSnapshot:s||null,partRole:roles[a.id]||a.partRole||'unknown'}:a);
 let next={...state,activities,proposals:supersedeActivityProposals(state,ids)};
 const change={id:uid(),date:new Date().toISOString(),type:sessionId?members.length>1?'Actividades agrupadas':'Asociación corregida':'Asociación deshecha',reason:sessionId?'Asociación confirmada por el corredor. Las fechas reales, actividades y notas se conservan por separado.':'Se ha retirado el vínculo; las actividades y sus fechas reales se conservan.',activityAssociations:{before,after:activities.filter(a=>ids.includes(a.id)).map(a=>({id:a.id,association:association(a)}))}};
 next={...next,changes:[change,...state.changes]};
 if(s){const actual={...aggregateActivities(activities.filter(a=>a.sessionId===s.id)),id:ids[0],sessionId:s.id};const v=proposal(actual,state.plan,state.profile,activities,next.proposals);if(v)next.proposals=[...next.proposals,v];}
 return next;
}
export function undoActivityAssociation(state,id){
 const change=state.changes.find(c=>c.id===id),edits=change?.activityAssociations;if(!edits)throw Error('No hay una asociación reversible en este cambio.');
 if(state.changes.some(c=>c.undoOf===id))throw Error('Esta asociación ya se ha deshecho.');
 for(const edit of edits.after){const current=state.activities.find(a=>a.id===edit.id);if(!current||JSON.stringify(association(current))!==JSON.stringify(edit.association))throw Error('Las asociaciones tienen cambios posteriores; revísalas antes de deshacer.');}
 const activities=state.activities.map(a=>{const previous=edits.before.find(e=>e.id===a.id);if(!previous)return a;const restored={...a};for(const k of associationKeys)delete restored[k];return {...restored,...previous.association};});
 const next={...state,activities,proposals:supersedeActivityProposals(state,edits.before.map(e=>e.id)),changes:[{id:uid(),date:new Date().toISOString(),type:'Asociación restaurada',reason:'Se han restaurado los vínculos anteriores sin modificar fechas, medidas ni notas.',undoOf:id},...state.changes]};
 const errors=validateStateShape(next);if(errors.length)throw Error(errors.join(' '));return next;
}
export function deleteActivity(state,id){
 const a=state.activities.find(v=>v.id===id);if(!a)throw Error('No se encuentra la actividad.');
 return {...state,activities:state.activities.filter(v=>v.id!==id),proposals:supersedeActivityProposals(state,[id]),changes:[{id:uid(),date:new Date().toISOString(),type:'Actividad eliminada',reason:'El registro deja de sumar estadísticas. Su copia y notas se conservan en este historial; los ajustes ya aceptados no se alteran.',deletedActivity:a},...state.changes]};
}
export function decideTrainingProposal(state,id,accept,start=activityToday(state.profile?.timezone||timeZone())){
 const v=state.proposals.find(x=>x.id===id&&x.status==='pending');if(!v)throw Error('Esta propuesta ya no está pendiente.');
 if(accept&&['rules','ollama','chatgpt'].includes(v.source))validateCoachProposal(state,v,start);
 const edits=v.changes||[{sessionId:v.sessionId,before:v.before,after:v.after}];
 if(accept){
  for(const e of edits){if(e.before.date<=start||e.after.date<=start||e.before.type==='race'||e.after.type==='race'||state.activities.some(a=>a.sessionId===e.sessionId)||(state.sessionCompletions||[]).some(c=>c.sessionId===e.sessionId))throw Error('Solo se pueden ajustar sesiones futuras pendientes; se conservan carreras y sesiones pasadas.');if(JSON.stringify(state.plan.sessions.find(s=>s.id===e.sessionId))!==JSON.stringify(e.before))throw Error('Una sesión cambió desde la propuesta. Solicita una revisión nueva.');}
  if(v.direction==='increase'){
   const evidence=(v.evidenceIds||[]).map(id=>state.activities.find(a=>a.id===id));
   if(evidence.length<3||evidence.some(a=>!a||!isTrainingActivity(a)||a.date>start||daysBetween(a.date,start)>21)||v.evidenceSignature&&v.evidenceSignature!==activityEvidenceSignature(evidence))throw Error('La evidencia de progresión ha cambiado o ya no es reciente. Revisa otra propuesta.');
   if(state.profile?.pain!=='none'||runnerContext(state.profile,start).cautious||state.activities.some(a=>a.date>=addDays(start,-7)&&a.date<=start&&(a.pain!=='none'||!known(a.fatigue)||+a.fatigue>=7)))throw Error('Las molestias o la recuperación reciente impiden aceptar un aumento.');
   if(v.updateKind==='pace'){
    const latest=[...evidence].sort((a,b)=>b.date.localeCompare(a.date))[0],verified=progressEvidence(latest,state.plan,state.profile,state.activities,state.proposals,start);
    if(!verified.eligible)throw Error('La calibración ya no se sostiene con tus referencias actuales. '+verified.reason);
    for(const edit of edits){const rebuilt=comfortablePaceUpdate(edit.before,verified.observedPaceSeconds,verified.activities.map(a=>a.id));if(JSON.stringify(rebuilt)!==JSON.stringify(edit.after))throw Error('Los ritmos de la propuesta han cambiado. Vuelve a calcular la calibración.');}
   }
  }
  const combined={...state.plan,sessions:state.plan.sessions.map(s=>edits.find(e=>e.sessionId===s.id)?.after||s)};
  const errors=validatePlan({...combined,created:start,sessions:combined.sessions.filter(s=>s.date>=start)},state.profile);if(errors.length)throw Error('La propuesta ya no respeta tus condiciones: '+errors.join(' '));
 }
 const changes=edits.map(e=>({id:uid(),date:new Date().toISOString(),type:accept?v.direction==='increase'?'Progresión aceptada':'Ajuste aceptado':'Plan mantenido',reason:v.reason,before:e.before,after:accept?e.after:e.before,proposalId:v.id}));
 return {...state,plan:accept?{...state.plan,sessions:state.plan.sessions.map(s=>edits.find(e=>e.sessionId===s.id)?.after||s)}:state.plan,proposals:state.proposals.map(x=>x.id===id?{...x,status:accept?'accepted':'declined'}:x),unavailable:accept&&v.unavailable?[...(state.unavailable||[]),v.unavailable]:(state.unavailable||[]),changes:[...changes,...state.changes]};
}
export const activityEvidenceSignature=activities=>JSON.stringify(activities.map(a=>Object.fromEntries(['id','date','distance','seconds','elapsedSeconds','type','rpe','fatigue','pain','feeling','terrain','temperature','elevation','conversation','measurement','conditions','sessionId','groupId','laps'].filter(k=>a[k]!=null).map(k=>[k,a[k]]))).sort((a,b)=>a.id.localeCompare(b.id)));

export function repairActivityLinks(state){
 if(!state.plan)return state;let updated=state,changed=false;
 const activities=[];
 for(const original of state.activities){
  const linked=findActivitySession(original,state.plan,[...activities,...state.activities.filter(v=>v.id!==original.id)]);
  if(!linked||original.sessionId===linked.id){activities.push(original);continue;}
  changed=true;activities.push({...original,sessionId:linked.id,linkMode:original.linkMode||'auto',plannedSnapshot:linked});
 }
 if(!changed)return state;
 updated={...state,activities,changes:[{id:uid(),date:new Date().toISOString(),type:'Carreras vinculadas al calendario',reason:'Se han vinculado los registros existentes con una única sesión de su misma fecha. Los días sin sesión se muestran como carreras adicionales.',before:null,after:null},...state.changes]};
 for(const a of activities){if(state.activities.find(v=>v.id===a.id)?.sessionId===a.sessionId)continue;const prop=proposal(a,updated.plan,updated.profile,activities,updated.proposals);if(prop&&!updated.proposals.some(v=>v.activityId===a.id&&v.status==='pending'))updated.proposals=[...updated.proposals,prop];}
 return updated;
}
export function regeneratePlan(state,start=today()){
 const old=state.plan,continuity=preparationContinuity(state,start),generated=generate(state.profile,start,{continuity,growthAllowed:!old});
 if(!old)return generated;
 const preserved=old.sessions.filter(s=>s.date<start||(state.activities||[]).some(a=>isTrainingActivity(a)&&a.sessionId===s.id)||(state.sessionCompletions||[]).some(c=>c.sessionId===s.id));
 const dates=new Set(preserved.map(s=>s.date));
 return {...generated,start:old.start<generated.start?old.start:generated.start,sessions:[...preserved,...generated.sessions.filter(s=>!dates.has(s.date)).map(s=>{const previous=old.sessions.find(v=>v.date===s.date);return previous?{...s,id:previous.id}:s;})].sort((a,b)=>a.date.localeCompare(b.date))};
}

export function qualitySummary(p,plan){
 const types=['tempo','interval','hills','progressive'],quality=(plan?.sessions||[]).filter(s=>types.includes(s.type)&&!s.skipped),m=metrics(p,plan?.created||today());
 const reasons=runnerContext(p,plan?.created||today()).notes.filter(n=>/pausa|recuperación|Fatiga|Lesión|deportes|prioridad|restricción|Volumen|ritmo llamado|Objetivo sin|Molestias en/.test(n));
 if(p.experience==='beginner'||+p.weeklyKm<8||p.goal.type==='start')reasons.push('Nivel de iniciación: priorizamos un plan sencillo de carrera cómoda o correr/caminar.');
 if(+p.weeklyKm<12)reasons.push('Menos de 12 km semanales actuales: construye primero una base cómoda y estable.');
 if(p.pain!=='none')reasons.push('Has indicado molestias: no se programa trabajo exigente.');
 if(+p.trainingDays<3)reasons.push('Con menos de tres días, se prioriza constancia y recuperación.');
 if(!reasons.length&&!quality.length)reasons.push('No hay huecos adecuados en este periodo con 48 horas de separación y tiempo suficiente; también se omite calidad en descarga y en la puesta a punto previa a la carrera.');
 return {count:quality.length,byType:Object.fromEntries(types.map(t=>[t,quality.filter(s=>s.type===t).length])),firstTempo:quality.find(s=>s.type==='tempo')?.date||null,firstInterval:quality.find(s=>s.type==='interval')?.date||null,reasons,method:m.method,schedule:'Una sesión de calidad por semana normal desde la segunda semana. La distancia objetivo y la fase deciden si se usa tempo, intervalos, cuestas o progresivos; se reduce carga en descarga y puesta a punto.'};
}

// Mirrors the conditions used by generate(), so the explanation matches the calendar.
export function qualityEligibility(p,plan){
 const base=+p.weeklyKm||0,days=Math.min(+p.trainingDays||0,(p.days||[]).length),walkMode=base<5||p.goal?.type==='start',beginner=p.experience==='beginner'||base<8;
 const count=t=>(plan?.sessions||[]).filter(s=>s.type===t&&!s.skipped).length;
 const context=runnerContext(p,plan?.created||today());
 const qualityBlock=p.goal.type==='unknown'?'Mientras defines tu objetivo, construimos base cómoda sin intensidad.':endurancePriority(p)?'Tu prioridad es terminar o correr sin parar: resistencia cómoda, sin intensidad.':context.paused||['no-intensity','time-limit'].includes(p.runningRestriction)?'Tu restricción limita el plan y elimina intensidad.':!comfortableEasy(p)?'Confirma un esfuerzo cómodo y conversación antes de añadir intensidad.':p.weeklySource==='estimated'||['variable','decreasing','increasing'].includes(p.weeklyTrend)?'Primero confirma una base estable: el volumen es estimado o variable.':p.pain==='none'&&(runnerContext(p).returning||runnerContext(p).injury||runnerContext(p).recovery)?'Base o recuperación insuficientes para intensidad; primero confirma constancia y sensaciones.':walkMode?'Primero alternas carrera y caminata hasta correr de forma continua con comodidad.':p.pain!=='none'?'Has indicado molestias: no programamos intensidad hasta que desaparezcan.':beginner?`Nivel de iniciación${base<8?` (${base} km/semana)`:''}: la intensidad llegará cuando sostengas al menos 12 km semanales cómodos.`:base<12?`Tu base es de ${base} km/semana; la intensidad se incorpora a partir de 12 km semanales cómodos.`:days<3?'Con menos de tres días de carrera, cada sesión se dedica a construir base y constancia.':null;
 const when='Revisa el plan cuando registres tres semanas completas con esa base, sin molestias.';
 const purpose={easy:'Base aeróbica con poco esfuerzo; es la mayor parte del plan.',recovery:'Rodaje más corto y esfuerzo 2/10 para dejar margen alrededor de sesiones exigentes.',long:'Resistencia: la sesión más larga de la semana, a ritmo cómodo.',tempo:'Esfuerzo continuo y controlado para sostener ritmos más rápidos.',interval:'Repeticiones más rápidas con recuperación, para trabajar cambios de ritmo.',hills:'Subidas cortas por esfuerzo para técnica y fuerza de carrera.',progressive:'Terminar más rápido de lo que empiezas, con control.',walk:'Alternar carrera y caminata para construir el hábito con seguridad.',strength:'Ejercicios de fuerza que complementan la carrera.'};
 const row=(type,blocked,hint)=>{const n=count(type);return {type,count:n,included:n>0,reason:n?purpose[type]:blocked||hint};};
 return [
  row('walk',null,'Ya puedes correr de forma continua; no necesitas alternar con caminata.'),
  row('easy',walkMode?'Todavía alternas carrera y caminata; la carrera continua llega de forma gradual.':null,'Sin huecos disponibles.'),
  row('recovery',null,'Con esta frecuencia, los días sin carrera aportan recuperación. No añadimos un rodaje extra para variar el plan.'),
  row('long',walkMode?'Antes de una tirada larga necesitas correr de forma continua.':days<3?'Con menos de tres días de carrera no separamos una tirada larga; tus sesiones ya cubren la resistencia.':null,'Sin hueco para tirada larga en este periodo.'),
  ...['tempo','interval','progressive','hills'].map(t=>row(t,qualityBlock?`${qualityBlock} ${when}`:null,t==='hills'?p.terrain==='treadmill'?'Entrenas en cinta: no se prescriben cuestas exteriores.':p.goal.terrain!=='trail'&&!(+p.goal.elevation/+p.goal.distance>=5)?'No has indicado pendientes que justifiquen cuestas; no añadimos intensidad para variar el calendario.':'El terreno justifica cuestas, pero no hay un hueco con tiempo y recuperación suficientes en este plazo.':t==='interval'?'Las repeticiones pueden apoyar también una preparación larga si hay base consolidada y recuperación. En esta propuesta se prioriza otro propósito o no caben trabajo y descansos suficientes.':'Las fases, descargas, minutos y 48 horas de separación no dejan un hueco apropiado para este tipo en la propuesta actual.')),
  row('strength',null,p.strength?(p.otherSports||[]).some(s=>['strength','crossfit'].includes(s.type))?'Ya declaras fuerza o CrossFit: no se duplica el complemento.':'Falta un hueco con tiempo y recuperación suficientes para el complemento.':'No has activado la fuerza complementaria en tu perfil.')
 ];
}
export function validateStateShape(state){
 const errors=[];if(!state||typeof state!=='object')return ['Datos inválidos.'];
 for(const key of ['activities','changes','proposals'])if(!Array.isArray(state[key]))errors.push(`Falta la lista ${key}.`);if(errors.length)return errors;
 const unique=(items,label)=>{const ids=items.map(v=>v?.id);if(ids.some(id=>typeof id!=='string'||!id))errors.push(`Hay ${label} sin identificador.`);else if(new Set(ids).size!==ids.length)errors.push(`Hay ${label} duplicados.`);};
 unique(state.activities,'registros de carrera');
 if(state.activities.some(a=>!/^\d{4}-\d{2}-\d{2}$/.test(a?.date||'')))errors.push('Hay registros de carrera sin una fecha válida.');
 for(const link of new Set(state.activities.map(a=>a.sessionId).filter(Boolean))){const members=state.activities.filter(a=>a.sessionId===link);if(members.length>1&&(!members[0].groupId||members.some(a=>a.groupId!==members[0].groupId||a.linkMode!=='manual')))errors.push('Una sesión tiene más de una carrera vinculada: requiere una agrupación explícita.');}
 for(const group of new Set(state.activities.map(a=>a.groupId).filter(Boolean))){const members=state.activities.filter(a=>a.groupId===group);if(new Set(members.map(a=>a.sessionId)).size!==1||members.some(a=>!a.sessionId))errors.push('La agrupación debe corresponder a una sola sesión.');const instants=members.map(a=>Date.parse(a.startedAt));if(new Set(members.map(a=>a.date)).size>1&&(!instants.every(Number.isFinite)||Math.max(...instants)-Math.min(...instants)>43200000))errors.push('La agrupación contiene días distintos sin una carrera continua confirmada.');}
 if(state.plan!=null){if(!Array.isArray(state.plan.sessions))errors.push('El plan no tiene sesiones.');else{unique(state.plan.sessions,'sesiones del plan');if(state.plan.sessions.some(s=>!/^\d{4}-\d{2}-\d{2}$/.test(s?.date||'')))errors.push('Hay sesiones sin una fecha válida.');}}
 if(state.plan?.structureVersion===6&&Array.isArray(state.plan.sessions)){
  for(const s of state.plan.sessions.filter(s=>s.date>=(state.plan.basis?.generatedOn||state.plan.created))){
   if(!Array.isArray(s.blocks)||!Number.isFinite(s.seconds)||s.seconds<0||s.blocks.some(b=>!Number.isFinite(b.seconds)||b.seconds<0||!Number.isFinite(b.distance)||b.distance<0)||s.seconds!==s.blocks.reduce((n,b)=>n+b.seconds,0)||s.distance!=null&&Math.abs(s.distance-s.blocks.reduce((n,b)=>n+b.distance,0))>.001){errors.push('Hay una sesión nueva cuyos totales no coinciden con sus bloques.');break;}
  }
 }
 if(state.profile)errors.push(...profileContextErrors(state.profile));
 if(state.profile?.timezone!=null&&!validTimeZone(state.profile.timezone))errors.push('Zona horaria no válida.');
 return errors;
}
export function trainingPhase(p,date,week,start,schedule=null){
 return phaseAt(p,date,schedule||phaseSchedule(p,start,runnerContext(p,start)));
}
export function raceCoachAnswer(state,start=today()){
 const p=state.profile,plan=state.plan,goal=acceptedGoal(state),pending=pendingGoalMessage(state);
 const finish=answer=>`${answer}${pending?` ${pending}`:''}`;
 if(!goal.date||!plan)return finish('Guarda una distancia y una fecha objetivo en Perfil para preparar una carrera. Después revisa la propuesta en Mi plan.');
 const remaining=daysBetween(start,goal.date);
 if(remaining<0)return finish('Tu fecha objetivo aceptada ya ha pasado. Registra la carrera y tus sensaciones; después revisa tu base y elige el siguiente objetivo sin acumular el entrenamiento pendiente.');
 const basisDate=plan.basis?.generatedOn||plan.created||plan.start,phase=trainingPhase({...(plan.basis?.profile||p),goal},start,Math.max(0,Math.floor(daysBetween(monday(basisDate),monday(start))/7)),basisDate,plan.schedule);
 const check=(state.checkIns||[]).find(c=>c.date===start);
 if(p?.pain==='relevant'||check?.pain==='relevant')return finish('Has declarado molestias que afectan la zancada. Pausa la carrera y valora la situación antes de retomar; la fecha objetivo no justifica forzar.');
 if(remaining===0)return finish(`Hoy es tu carrera de ${goal.distance??'distancia sin confirmar'} km. Abre Preparar el día de la carrera en Mi plan. Empieza con control y utiliza la estrategia revisada; el tiempo objetivo no es una medición de tu nivel.`);
 const next=plan.sessions.find(s=>s.date>=start&&s.type!=='rest'&&s.type!=='race'&&!s.skipped&&!(state.activities||[]).some(a=>a.source!=='strava'&&a.sessionId===s.id)&&!(state.sessionCompletions||[]).some(c=>c.sessionId===s.id));
 const focus=phase.key==='taper'?'La prioridad es llegar con frescura: respeta la reducción de volumen y no recuperes las sesiones perdidas.':phase.reason;
 return finish(`Faltan ${remaining} días para ${goal.distance??'distancia sin confirmar'} km, el ${goal.date}. Estás en ${phase.label.toLowerCase()}. ${focus}${next?` Próxima sesión: ${TYPES[next.type]}, el ${next.date}, esfuerzo ${next.rpe}/10.`:''}${+check?.fatigue>=7||check?.pain==='mild'?' Tus sensaciones de hoy aconsejan revisar la carga antes de salir.':''} Consulta la sesión clave y el camino de las próximas semanas en Mi plan. Los ritmos parten de tus referencias, no del tiempo que deseas lograr.`);
}
export function qualityType(p,phase,week,previous=[],date){return selectQualitySession(p,phase,{week,previous,date}).type;}

// Automatic adjustments require an explicit preference and can only reduce future load.
export function applyConservativeProposal(state,v,start=today()){
 if(!state.settings?.autoConservative||!v||['rules','ollama','chatgpt'].includes(v.source)||v.direction==='increase'||v.status!=='pending')return state;
 const edits=v.changes||[{sessionId:v.sessionId,before:v.before,after:v.after}];
 if(edits.some(e=>e.before.date<=start||e.before.type==='race'||e.after.hard||e.after.seconds>e.before.seconds||(e.after.distance||0)>(e.before.distance||0)||JSON.stringify(state.plan?.sessions.find(s=>s.id===e.sessionId))!==JSON.stringify(e.before)))return state;
 const changes=edits.map(e=>({id:uid(),date:new Date().toISOString(),type:'Ajuste conservador automático',reason:v.reason,before:e.before,after:e.after,proposalId:v.id}));
 return {...state,plan:{...state.plan,sessions:state.plan.sessions.map(s=>edits.find(e=>e.sessionId===s.id)?.after||s)},proposals:state.proposals.map(p=>p.id===v.id?{...p,status:'accepted',automatic:true}:p),changes:[...changes,...state.changes]};
}
export function undoPlanChange(state,id,start=today()){
 const change=state.changes.find(c=>c.id===id);if(!change?.before?.date||!change.after?.id)throw Error('Este cambio no corresponde a una sesión reversible.');
 const current=state.plan?.sessions.find(s=>s.id===change.after.id);
 if(change.before.date<=start||change.after.date<=start||change.before.type==='race'||state.activities.some(a=>a.sessionId===current?.id))throw Error('Solo puedes deshacer cambios de sesiones futuras pendientes.');
 if(JSON.stringify(current)!==JSON.stringify(change.after))throw Error('La sesión tiene cambios posteriores. Revisa el calendario antes de deshacer.');
 if(change.before.hard&&state.plan.sessions.some(s=>s.id!==current.id&&s.hard&&Math.abs(daysBetween(s.date,change.before.date))<2))throw Error('Deshacer dejaría sesiones exigentes con menos de 48 horas de separación.');
 return {...state,plan:{...state.plan,sessions:state.plan.sessions.map(s=>s.id===current.id?change.before:s)},changes:[{id:uid(),date:new Date().toISOString(),type:'Cambio deshecho',reason:'Has restaurado la sesión anterior desde el historial.',before:change.after,after:change.before,undoOf:id},...state.changes],proposals:state.proposals.map(v=>v.id===change.proposalId?{...v,status:'undone'}:v)};
}
