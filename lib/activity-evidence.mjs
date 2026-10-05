import {known} from './profile-evidence.mjs';
import {isTrainingActivity,hasObservedMovingTime,activityTimeLabel} from './activity-source.mjs';
const quality=new Set(['interval','tempo','hills','progressive']);
const pct=(actual,planned)=>planned>0?Math.abs(actual-planned)/planned:null;
const round=n=>Math.round(n*100)/100;
const pace=n=>`${Math.floor(Math.round(n)/60)}:${String(Math.round(n)%60).padStart(2,'0')}`;
const distanceText=n=>n<1?`${Math.round(n*1000)} m`:`${round(n).toLocaleString('es-ES')} km`;
const kind=b=>b.kind||(/^Recuperación|^Baja /.test(b.label||'')?'recovery':/^Calent|^Movilidad$|^Camina cómodo para calentar|^Rodaje de aproximación/.test(b.label||'')?'warmup':/^Vuelta|^Camina para terminar|^Movilidad suave/.test(b.label||'')?'cooldown':'main');

export function aggregateActivities(activities){
 const runs=activities.filter(isTrainingActivity),latest=[...runs].sort((a,b)=>b.date.localeCompare(a.date)).at(0)||{};
 const numeric=(key,method)=>{const values=runs.map(a=>a[key]);return values.length&&values.every(known)?method(values.map(Number)):null;};
 const types=[...new Set(runs.map(a=>a.type).filter(t=>t&&t!=='unknown'))];
 const parts=runs.filter(a=>a.partRole&&a.partRole!=='full'&&a.partRole!=='unknown');
 const main=parts.filter(a=>a.partRole==='main');
 return {...latest,id:runs.map(a=>a.id).join('+'),activityIds:runs.map(a=>a.id),grouped:runs.length>1,timeBasis:runs.every(hasObservedMovingTime)?'moving':'recorded',
  distance:runs.reduce((n,a)=>n+a.distance,0),seconds:runs.reduce((n,a)=>n+a.seconds,0),
  elapsedSeconds:runs.every(a=>known(a.elapsedSeconds))?runs.reduce((n,a)=>n+Number(a.elapsedSeconds),0):null,
  type:main.length&&main.every(a=>a.type===main[0].type)?main[0].type:types.length===1?types[0]:'unknown',
  rpe:numeric('rpe',v=>Math.max(...v)),fatigue:numeric('fatigue',v=>Math.max(...v)),
  pain:runs.some(a=>a.pain==='relevant')?'relevant':runs.some(a=>a.pain==='mild')?'mild':runs.every(a=>a.pain==='none')?'none':'unknown',
  feeling:runs.some(a=>a.feeling==='mal')?'mal':runs.some(a=>a.feeling==='pesado')?'pesado':runs.every(a=>a.feeling&&a.feeling!=='unknown')?latest.feeling:'unknown',
  terrain:runs.every(a=>a.terrain&&a.terrain===latest.terrain)?latest.terrain:'unknown',
  temperature:numeric('temperature',v=>Math.max(...v)),elevation:numeric('elevation',v=>v.reduce((n,x)=>n+x,0)),
  laps:runs.flatMap(a=>a.laps||[]),parts:parts.map(a=>({kind:a.partRole,distance:a.distance,seconds:a.seconds,effort:a.rpe})),
  missingMembers:runs.filter(a=>!known(a.rpe)||!known(a.fatigue)||!['none','mild','relevant'].includes(a.pain)).map(a=>a.id)};
}
export function sessionActivity(state,s){return aggregateActivities((state.activities||[]).filter(a=>a.sessionId===s.id));}

export function blockComparison(a,s){
 if(!s)return {status:'unavailable',rows:[],missing:['No hay sesión prevista vinculada.']};
 const planned=s.blocks||[],laps=a.laps||[],parts=a.parts||[],rows=[],missing=[];
 const expected=planned.filter(b=>kind(b)==='main'&&(b.role==='work'||/^(Repetición|Cuesta|Tempo|Carrera suave \d)/.test(b.label||'')||b.effort>=5||!quality.has(s.type)&&!s.repetitions));
 const work=laps.filter(l=>l.kind==='work'||l.kind==='main'&&(!quality.has(s.type)||known(l.rpe)&&l.rpe>=5)),recoveries=laps.filter(l=>l.kind==='recovery');
 if(!quality.has(s.type)&&!s.repetitions&&!work.length)return {status:parts.length||laps.length?'reported':'not-required',rows:[],missing:[]};
 if(!work.length){missing.push('Faltan bloques o vueltas identificados como trabajo. El ritmo medio no confirma intervalos, tempo ni cuestas.');return {status:'unknown',rows,missing};}
 const countExpected=s.repetitions?.count||expected.length;
 rows.push({label:'Bloques de trabajo',planned:`${countExpected}`,actual:`${work.length}`,matches:work.length===countExpected});
 for(let i=0;i<Math.min(work.length,expected.length);i++){
  const before=expected[i],after=work[i],byDistance=before.distance>0,delta=pct(byDistance?after.distance:after.seconds,byDistance?before.distance:before.seconds);
  rows.push({label:`Trabajo ${i+1}`,planned:byDistance?distanceText(before.distance):`${before.seconds} s`,actual:byDistance?distanceText(after.distance):`${after.seconds} s`,matches:delta!=null&&delta<=.15});
  if(before.range&&after.distance>0&&hasObservedMovingTime(after)){const actual=after.seconds/after.distance;rows.push({label:`Ritmo trabajo ${i+1}`,planned:`${pace(before.range[0])}–${pace(before.range[1])} min/km`,actual:`${pace(actual)} min/km`,matches:actual>=before.range[0]*.95&&actual<=before.range[1]*1.05});}else if(!hasObservedMovingTime(after))missing.push(`Trabajo ${i+1}: falta tiempo en movimiento comparable; el tiempo de cronómetro o registrado no se convierte en ritmo medido.`);
  if(known(after.rpe))rows.push({label:`Esfuerzo trabajo ${i+1}`,planned:`${before.effort}/10`,actual:`${after.rpe}/10`,matches:Math.abs(Number(after.rpe)-before.effort)<=1});
 }
 const recoveryExpected=planned.filter(b=>kind(b)==='recovery');
 const attached=work.filter(l=>l.recoverySeconds>0),reported=recoveries.length+attached.length;
 if(recoveryExpected.length){
  if(!reported)missing.push('Faltan las recuperaciones entre los bloques y, cuando corresponde, la última recuperación.');
  else{
   rows.push({label:'Recuperaciones',planned:String(recoveryExpected.length),actual:String(reported),matches:reported===recoveryExpected.length});
   const actualSeconds=recoveries.reduce((n,l)=>n+l.seconds,0)+attached.reduce((n,l)=>n+l.recoverySeconds,0),expectedSeconds=recoveryExpected.reduce((n,b)=>n+b.seconds,0);
   const byTime=recoveryExpected.every(b=>!b.distance),actualKm=recoveries.reduce((n,l)=>n+l.distance,0)+attached.reduce((n,l)=>n+(Number(l.recoveryDistance)||0),0),expectedKm=recoveryExpected.reduce((n,b)=>n+b.distance,0);
   if(byTime)rows.push({label:'Tiempo de recuperación',planned:`${expectedSeconds} s`,actual:`${actualSeconds} s`,matches:pct(actualSeconds,expectedSeconds)<=.25});
   else if(actualKm>0&&recoveries.every(l=>l.distance>0)&&attached.every(l=>l.recoveryDistance>0))rows.push({label:'Distancia de recuperación',planned:`${round(expectedKm)} km`,actual:`${round(actualKm)} km`,matches:pct(actualKm,expectedKm)<=.2});
   else missing.push('Se ha indicado recuperación por tiempo, pero falta su distancia; no podemos comprobar los metros de recuperación previstos.');
  }
  if(reported){const lastWork=laps.findLastIndex(l=>work.includes(l)),lastRecovery=laps.findLastIndex(l=>l.kind==='recovery'),afterLast=lastRecovery>lastWork||work.at(-1)?.recoverySeconds>0,expectedAfterLast=s.repetitions?.recoveryPlacement==='after-each'||['hills','walk'].includes(s.type);rows.push({label:'Recuperación tras la última repetición',planned:expectedAfterLast?'Sí':'No',actual:afterLast?'Sí':'No',matches:afterLast===expectedAfterLast});}
 }
 for(const k of ['warmup','cooldown']){
  const expectedParts=planned.filter(b=>kind(b)===k),reportedLaps=laps.filter(l=>l.kind===k),actualParts=reportedLaps.length?reportedLaps:parts.filter(b=>b.kind===k);
  if(!expectedParts.length)continue;
  if(!actualParts.length){missing.push(`No se ha identificado ${k==='warmup'?'el calentamiento':'la vuelta a la calma'} en los datos realizados.`);continue;}
  const expectedKm=expectedParts.reduce((n,b)=>n+b.distance,0),byDistance=expectedKm>0,expectedValue=byDistance?expectedKm:expectedParts.reduce((n,b)=>n+b.seconds,0),actualValue=actualParts.reduce((n,b)=>n+(byDistance?b.distance:b.seconds),0);
  rows.push({label:k==='warmup'?'Calentamiento':'Vuelta a la calma',planned:byDistance?distanceText(expectedValue):`${expectedValue} s`,actual:byDistance?distanceText(actualValue):`${actualValue} s`,matches:pct(actualValue,expectedValue)<=.2});
 }
 return {status:rows.some(r=>!r.matches)?'changed':missing.length?'partial':'compatible',rows,missing};
}
export function activityAssessment(a,s){
 const missing=[],evidence=[],blocks=blockComparison(a,s);
 if(!known(a.rpe))missing.push('Esfuerzo percibido (1–10).');
 if(!known(a.fatigue))missing.push('Fatiga después de la actividad (0–10).');
 if(!['none','mild','relevant'].includes(a.pain))missing.push('Molestias: sin molestias, leves o relevantes.');
 if(!a.type||a.type==='unknown')missing.push('Tipo de entrenamiento realizado.');
 if(!a.feeling||a.feeling==='unknown')missing.push('Sensaciones al terminar.');
 if(!a.terrain||a.terrain==='unknown')missing.push('Terreno; limita la comparación entre sesiones.');
 if(!known(a.temperature))missing.push('Temperatura; no se asumen condiciones frescas.');
 if(!hasObservedMovingTime(a))missing.push('Tiempo en movimiento no confirmado: se conserva el tiempo original, sin convertirlo en una referencia de ritmo.');
 const constrained=known(a.temperature)&&+a.temperature>=25||a.terrain==='trail'||known(a.elevation)&&a.elevation/a.distance>15||known(a.elapsedSeconds)&&a.elapsedSeconds>a.seconds*1.1;
 const expectedEffort=s?.rpe??({interval:7,tempo:6,hills:6,progressive:5}[a.type]||3);
 const high=known(a.rpe)&&Number(a.rpe)>=expectedEffort+2||known(a.fatigue)&&+a.fatigue>=7||a.feeling==='mal';
 const pain=a.pain==='relevant',mild=a.pain==='mild',sameType=!!s&&a.type===s.type;
 const actualTotal=known(a.elapsedSeconds)?+a.elapsedSeconds:a.seconds;
 const deltaKm=s?.distance>0?round(a.distance-s.distance):null,deltaMinutes=s&&!s.durationUnknown?Math.round((actualTotal-s.seconds)/60):null;
 if(s?.blocks?.some(b=>b.recoveryType==='stop')&&!known(a.elapsedSeconds))missing.push('Falta tiempo total transcurrido, incluidas las recuperaciones parado; el tiempo registrado no confirma las pausas.');
 const volumeMatches=!!s&&(s.distance>0?pct(a.distance,s.distance)<=.1:!s.seconds||pct(actualTotal,s.seconds)<=.15);
 if(s){evidence.push(`Distancia: ${a.distance} km${s.distance>0?` frente a ${s.distance} km previstos`: '; la sesión se prescribió por tiempo'}.`);
  if(!s.durationUnknown)evidence.push(`${known(a.elapsedSeconds)?'Tiempo total transcurrido':'Tiempo '+activityTimeLabel(a)}: ${actualTotal} s frente a ${s.seconds} s totales ${s.estimated?'estimados, no prescritos':'prescritos'}.`);
  if(known(a.rpe))evidence.push(`Esfuerzo declarado ${a.rpe}/10; previsto ${s.rpe}/10.`);
  if(sameType)evidence.push('El tipo realizado declarado coincide con el previsto.');
 }
 if(known(a.fatigue))evidence.push(`Fatiga declarada: ${a.fatigue}/10.`);
 if(['none','mild','relevant'].includes(a.pain))evidence.push(`Molestias declaradas: ${a.pain==='none'?'sin molestias':a.pain==='mild'?'leves':'relevantes'}.`);
 const paceMismatch=!hasObservedMovingTime(a)?'Sin comparación de ritmo: falta tiempo en movimiento confirmado; el tiempo registrado se conserva con su significado.':quality.has(s?.type)?'No se compara el ritmo medio total con el del bloque rápido. Se revisan los bloques identificados.':s?.range&&!constrained?(a.seconds/a.distance<s.range[0]?'Más rápido que el rango orientativo de carrera continua.':a.seconds/a.distance>s.range[1]?'Más lento que el rango orientativo de carrera continua.':'Dentro del rango orientativo de carrera continua.'):'Sin comparación precisa de ritmo: faltan referencias o las condiciones la limitan.';
 let verdict=!s?'unlinked':pain||high||!sameType||!volumeMatches||blocks.status==='changed'?'changed':!known(a.rpe)||!['none','mild','relevant'].includes(a.pain)||quality.has(s.type)&&blocks.missing.length?'uncertain':'compatible';
 const purpose=verdict==='unlinked'?'Carrera sin sesión vinculada: no podemos comprobar el propósito previsto.':verdict==='changed'?'La actividad presenta cambios o señales de mayor exigencia; revisa si cumplió el propósito previsto.':verdict==='uncertain'?'El registro puede ser compatible con la sesión, pero falta información para confirmar su propósito.':'El esfuerzo y el trabajo registrado parecen compatibles con el propósito previsto; es una interpretación, no una medición de adaptación.';
 const action=pain?'revisar':high||mild?'reducir':'mantener';
 const reason=pain?'Has indicado dolor relevante. Pausa la siguiente carrera y valora la situación antes de retomar.':high||mild?'La fatiga, el esfuerzo o las molestias declaradas aconsejan revisar la próxima sesión y retirar intensidad; se presenta una reducción para tu decisión.':missing.some(t=>/Esfuerzo|Fatiga|Molestias/.test(t))?'Faltan sensaciones importantes. Conservamos el calendario y solicitamos esos datos; no se presume una buena recuperación.':'Mantén el plan mientras revisamos varias sesiones comparables; una carrera rápida aislada no justifica subir la carga.';
 return {purpose,verdict,confidence:verdict==='compatible'?'moderate':'limited',evidence,missing:[...missing,...blocks.missing],blocks,deltaKm,deltaMinutes,paceMismatch,action,reason,
  context:constrained?'El terreno, calor, desnivel o pausas declarados limitan la comparación del ritmo. No se corrige el ritmo con una fórmula inventada.':'',
  status:s?(sameType&&volumeMatches&&!high&&!pain&&!mild&&blocks.status!=='changed'?'completed':'changed'):'unlinked'};
}
export function matchActivitySession(a,plan,activities=[]){
 const sessions=plan?.sessions||[];
 if(a.linkMode==='none'||a.linkMode==='unlinked')return null;
 if(a.sessionId){const linked=sessions.find(s=>s.id===a.sessionId&&!['rest','strength'].includes(s.type));if(linked&&(a.linkMode!=='auto'||linked.date===a.date))return linked;}
 if(a.linkMode==='manual')return null;
 const candidates=sessions.filter(s=>s.date===a.date&&!s.skipped&&!['rest','strength'].includes(s.type)&&!activities.some(v=>v.id!==a.id&&v.sessionId===s.id));
 if(candidates.length!==1)return null;
 const s=candidates[0],compatibleShape=s.distance>0?pct(a.distance,s.distance)<=.25:known(a.seconds)&&s.seconds>0&&pct(a.seconds,s.seconds)<=.3;
 if(!compatibleShape)return null;
 if(quality.has(s.type))return a.type===s.type||blockComparison(a,s).status==='compatible'?s:null;
 return a.type===s.type||['easy','recovery','long'].includes(a.type)&&['easy','recovery','long'].includes(s.type)||s.type==='walk'&&a.type==='walk'?s:null;
}
export function activityLabel(a,state){
 if(a.sessionId){const s=state.plan?.sessions.find(s=>s.id===a.sessionId)||a.plannedSnapshot;const group=s?(state.activities||[]).filter(v=>v.sessionId===a.sessionId):[a];return activityAssessment(aggregateActivities(group),s).status==='completed'?'Completada':'Realizada con cambios';}
 return a.linkMode==='none'?'Carrera adicional':'Actividad sin vincular';
}
export function duplicateActivity(a,activities){
 for(const v of activities){
  if(v.id===a.id)continue;
  if(!isTrainingActivity(v))continue;
  if(a.importSources?.some(source=>(v.importSources||[]).some(old=>old.key===source.key)))return {id:v.id,exact:true,reason:'Este archivo ya está vinculado a esa carrera. Se conserva un solo registro y sus notas.'};
  if(a.source==='personal-file'&&a.externalId&&v.source===a.source&&v.externalId===a.externalId)return {id:v.id,exact:true,reason:'La fuente ya entregó esta actividad. Se conserva el registro existente y sus notas.'};
  const times=[v.startedAt,a.startedAt].map(Date.parse);
  const timed=times.every(Number.isFinite),distanceNear=Math.abs(v.distance-a.distance)<=Math.max(.05,a.distance*.03);
  if(timed&&Math.abs(times[0]-times[1])<=120000&&distanceNear&&(v.date!==a.date||Math.abs(v.seconds-a.seconds)>10))return {id:v.id,exact:false,reason:'La hora de inicio y distancia coinciden, pero los tiempos o fechas locales difieren. Revisa movimiento, cronómetro y zona antes de vincular; se conservan ambas medidas originales.'};
  if(v.date!==a.date||Math.abs(v.distance-a.distance)>.05||Math.abs(v.seconds-a.seconds)>10)continue;
  if(times.every(Number.isFinite)&&Math.abs(times[0]-times[1])>120000)continue;
  return {id:v.id,exact:times.every(Number.isFinite),reason:'Ya tienes una carrera con la misma fecha, distancia y duración. Edita ese registro o confirma que son dos carreras distintas.'};
 }
 return null;
}
