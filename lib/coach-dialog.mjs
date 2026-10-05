import {DAYS,TYPES,addDays,day,monday,daysBetween,calibrationAssessment,progressEvidence,raceCoachAnswer,moveSession,pace,blockKind} from './engine.mjs';
import {isFinished} from './training.mjs';
import {currentCare} from './daily-focus.mjs';
import {isTrainingActivity} from './activity-source.mjs';
import {aggregateActivities,blockComparison} from './activity-evidence.mjs';
import {acceptedGoal,pendingGoalMessage} from './plan-goal.mjs';
import {fingerprint} from './plan-review.mjs';
import {known} from './profile-evidence.mjs';

export const normalizeQuestion=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function coachDataSignature(state){
 const profile={...state.profile};delete profile.name;delete profile.email;
 return fingerprint({profile,plan:state.plan,activities:(state.activities||[]).filter(isTrainingActivity),checkIns:state.checkIns||[],sessionCompletions:state.sessionCompletions||[],unavailable:state.unavailable||[]});
}
export const coachContextSignature=(state,start)=>fingerprint({data:coachDataSignature(state),start,proposals:state.proposals||[],planProposals:state.planProposals||[]});
export const coachResponseCurrent=(response,state,start)=>response?.date===start&&response?.stateSignature===coachContextSignature(state,start);
const realDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
const quantity=s=>s.distance!=null?`${s.distance.toLocaleString('es-ES')} km`:`${Math.round(s.seconds/60)} min`;
const label=s=>`${TYPES[s.type]||s.type}, ${DAYS[day(s.date)].toLowerCase()} ${s.date}, ${quantity(s)}, esfuerzo ${s.rpe}/10`;
const typeNames={long:/\btirada\b|carrera larga|rodaje largo/,interval:/interval|repeticion|series/,tempo:/\btempo\b/,hills:/cuesta/,progressive:/progresiv/,strength:/fuerza/,easy:/carrera facil|rodaje facil/,recovery:/\brecuperacion\b/};

export function questionDates(text,start){
 const q=normalizeQuestion(text),dates=[];
 for(const date of q.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[])if(realDate(date))dates.push(date);
 for(const match of q.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)){if(!match[3]&&(q.trim()===match[0]||/(?:fatiga|cansancio|esfuerzo|rpe|intensidad)\s*(?:de |es |del |: )?$/.test(q.slice(0,match.index))))continue;const date=`${match[3]||start.slice(0,4)}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;if(realDate(date))dates.push(date);}
 if(/pasado manana/.test(q))dates.push(addDays(start,2));else if(/\bmanana\b/.test(q))dates.push(addDays(start,1));
 if(/\banteayer\b/.test(q))dates.push(addDays(start,-2));else if(/\bayer\b/.test(q))dates.push(addDays(start,-1));
 if(/\bhoy\b/.test(q))dates.push(start);
 for(let d=0;d<7;d++)if(new RegExp('\\b'+normalizeQuestion(DAYS[d])+'\\b').test(q)){
  let date=addDays(monday(start),(d+6)%7);
  if(/semana que viene|proxim[oa] (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)|(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo) que viene/.test(q))date=addDays(date,7);
  dates.push(date);
 }
 return [...new Set(dates)];
}
export function understandQuestion(question,start,previous=null){
 const q=normalizeQuestion(question),intents=[],add=intent=>{if(!intents.includes(intent))intents.push(intent);};
 const noPain=/\bno (?:tengo|siento|presento) (?:ningun |nada de )?(?:dolor|molestias)|\bsin (?:dolor|molestias)|\bno me duele/.test(q);
 const painMention=/dolor|molest|lesion|me duele/.test(q),painPositive=/\b(?:tengo|siento|presento) (?:un |una |mucho )?(?:dolor|molestias)|\bme duele|\bcon dolor/.test(q);
 const noFatigue=/\bno (?:estoy|me siento) (?:muy |nada )?cansad|\bsin (?:fatiga|cansancio)|\bno (?:tengo|siento) (?:fatiga|cansancio)/.test(q);
 const tired=/cans|fatiga/.test(q)&&!noFatigue;
 const noChange=/\bno (?:quiero|deseo|puedo|vamos a|voy a) (?:cambiar|mover|reducir|descansar|ajustar)|\bno cambies|\bsolo (?:explica|quiero saber|pregunto)/.test(q);
 const unchanged=/\bplan\b/.test(q)&&/todavia|aun|sigue igual|no (?:ha |se ha |se )?cambi|no se actualiza|no cambia/.test(q);
 const move=/\b(?:cambiar|cambio|mover|movemos|pasar|trasladar|reorganizar)\b/.test(q)&&!unchanged||/\by (?:al|el|para el) (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)/.test(q)&&previous?.intents?.includes('move');
 const crossfit=/\b(?:crossfit|fuerza)\b/.test(q)&&/hice|he hecho|entrene|ayer|antes de ayer/.test(q)&&!/\bno (?:hice|he hecho|entrene)/.test(q);
 if(/chatgpt|conectad[oa]|\bmodelo\b|\bia\b/.test(q))add('status');
 if(painMention&&!noPain)add('pain');if(tired)add('fatigue');if(crossfit)add('sport');if(move)add('move');
 if(/demasiado rapid|muy rapid|mas rapid|que parte|que repeticion|que bloque/.test(q)&&/interval|repeticion|serie|bloque/.test(q))add('blocks');
 if(previous?.intents?.includes('blocks')&&/\b(?:primera|segunda|tercera|cuarta|ultima)\b/.test(q))add('blocks');
 if(unchanged)add('unchanged');
 if(/referencia|calibra|ajustar? (?:mis |los )?ritmos|revisar? (?:mis |los )?ritmos/.test(q))add('calibration');
 if(/por que|porque|motivo|explica/.test(q)&&!unchanged&&!intents.includes('calibration')&&!intents.includes('blocks'))add('explain');
 if(/objetivo|competicion|puesta a punto|taper|cuanto.*(?:falta|queda)|prepar.*carrera|dia.*carrera/.test(q)&&!intents.includes('move'))add('race');
 if(/mejor|progres/.test(q)&&!intents.includes('blocks'))add('progress');
 if(/perd|salt|no pude/.test(q))add('missed');
 if(!intents.length&&/hoy|proxim|sesion|entrenamiento|\bplan\b|ritmo/.test(q))add('next');
 const dates=questionDates(q,start),types=Object.entries(typeNames).filter(([,pattern])=>pattern.test(q)).map(([type])=>type);
 const followUp=!intents.length&&(/^(?:y\b|entonces\b|esa\b|ese\b|la del\b|el del\b|si\b)|\bminutos\b|\b\d+\s*\/\s*10\b/.test(q)||types.length||dates.length);
 if(followUp&&previous)for(const intent of previous.intents||[])add(intent);
 const numbers={fatigue:q.match(/(?:fatiga|cansancio)\s*(?:de |es |del |: )?(\d{1,2})(?:\s*\/\s*10)?/),rpe:q.match(/(?:esfuerzo|rpe|intensidad)\s*(?:de |es |del |: )?(\d{1,2})(?:\s*\/\s*10)?/),minutes:q.match(/\b(\d{1,3})\s*(?:minutos|min)\b/)};
 const number=(match,max)=>match&&+match[1]<=max?+match[1]:null;
 const bareScore=q.match(/^\s*(\d{1,2})\s*\/\s*10\s*[.!?]?\s*$/),single=previous?.intents?.length===1?previous.intents[0]:null;
 const report={pain:noPain?'none':painPositive?(/relevante|fuerte|zancada|impide/.test(q)?'relevant':/leve/.test(q)?'mild':'unspecified'):null,fatigue:number(numbers.fatigue,10)??(single==='fatigue'?number(bareScore,10):null),tired,rpe:number(numbers.rpe,10)??(single==='sport'?number(bareScore,10):null),minutes:number(numbers.minutes,240),sport:crossfit?(/crossfit/.test(q)?'crossfit':'strength'):null};
 const targetMatch=q.match(/(?:\bal |\bpara el |\ba el )(.+)$/),targetText=targetMatch?.[1]?.split(/;|[?¿]|\by (?:por que|que parte|ayer|hoy|no tengo)/)[0]||q;
 const targetDays=move?questionDates(targetText,start):[],bareWeekday=/lunes|martes|miercoles|jueves|viernes|sabado|domingo/.test(targetText)&&!/\beste\b|pasado|\d{4}-\d{2}-\d{2}|\d+\/\d+/.test(targetText);
 const targets=targetDays.map(date=>date<start&&bareWeekday?addDays(date,7):date);
 const sourceDates=move&&targetMatch?questionDates(q.slice(0,targetMatch.index).match(/(?:tirada|sesion|intervalos|tempo|series)\s+(?:del?|el)\s+(.+)$/)?.[1]||'',start):[];
 const ordinal=q.match(/\b(primera|segunda|tercera|cuarta|quinta|sexta|ultima)\b/),lapIndex=ordinal?['primera','segunda','tercera','cuarta','quinta','sexta'].indexOf(ordinal[1]):null;
 return {intents,types,dates,targets,sourceDates,noChange,report,followUp,noFatigue,lapIndex,explicitToday:/\bhoy\b/.test(q),explicitNext:/proxim|siguiente/.test(q),painQuestion:painMention&&!noPain&&!painPositive};
}

function chooseSession(state,parsed,start,context){
 if(!parsed.intents.some(i=>['next','explain','fatigue','sport','move','blocks','missed'].includes(i)))return null;
 const sessions=(state.plan?.sessions||[]).filter(s=>!s.skipped).sort((a,b)=>a.date.localeCompare(b.date)),pending=s=>!isFinished(s,state)&&s.type!=='rest';
 const types=parsed.types,typed=types.length?sessions.filter(s=>types.includes(s.type)):sessions;
 if(context?.sessionId&&!types.length&&!parsed.dates.length&&parsed.intents.includes('blocks'))return typed.find(s=>s.id===context.sessionId)||null;
 if(parsed.intents.includes('blocks')){
  const performed=typed.filter(s=>s.date<=start&&(state.activities||[]).some(a=>isTrainingActivity(a)&&a.sessionId===s.id));
  if(parsed.dates.length&&!parsed.intents.includes('move'))return performed.find(s=>parsed.dates.includes(s.date))||typed.find(s=>parsed.dates.includes(s.date))||null;
  if(performed.length)return performed.at(-1);
 }
 if(parsed.intents.includes('move')&&parsed.sourceDates?.length)return typed.find(s=>parsed.sourceDates.includes(s.date))||null;
 if(parsed.explicitToday&&!parsed.intents.includes('move'))return typed.find(s=>s.date===start)||null;
 if(parsed.dates.length&&!parsed.intents.some(i=>['move','sport'].includes(i)))return typed.find(s=>parsed.dates.includes(s.date))||null;
 if(context?.sessionId&&!parsed.explicitNext&&!types.length){const old=sessions.find(s=>s.id===context.sessionId);if(old)return old;}
 if(parsed.intents.includes('move'))return typed.find(s=>s.date>start&&pending(s)&&s.type!=='race')||null;
 return typed.find(s=>s.date>=start&&pending(s))||null;
}
export function renderCoachAssessment(value){
 return [['Observación',value.observations],['Inferencia',value.inferences],['Propuesta',value.suggestions],['Dato que falta',value.questions]].filter(([,rows])=>rows.length).map(([title,rows])=>`${title}:\n${rows.join('\n')}`).join('\n\n');
}

export function coachAssessment(question,state,start,{context=null,scopeKey='isolated',dataSignature=coachDataSignature(state)}={}){
 const observations=[],inferences=[],suggestions=[],questions=[],actionRequests=[],actionPolicy=[],intents=[];
 const stale=!!context&&(context.scopeKey!==scopeKey||context.signature!==dataSignature||context.date!==start||Date.now()-context.updatedAt>1800000);
 const previous=stale?null:context,parsed=understandQuestion(question,start,previous);
 intents.push(...parsed.intents);
 const report={...(previous?.report||{}),...Object.fromEntries(Object.entries(parsed.report).filter(([,value])=>value!==null&&value!==false))};
 if(parsed.report.pain==='none')report.pain='none';
 if(parsed.noFatigue){report.tired=false;report.fatigue=null;}
 const p=state.profile,plan=state.plan,own=(state.activities||[]).filter(isTrainingActivity),session=chooseSession(state,parsed,start,previous),care=currentCare(state,start);
 const moving=parsed.intents.includes('move')?chooseSession(state,{...parsed,intents:['move'],types:parsed.types.includes('long')?['long']:parsed.types},start,{...previous,sessionId:previous?.subjects?.move||(!previous?.intents?.includes('blocks')?previous?.sessionId:null)}):null;
 const performing=parsed.intents.includes('blocks')?chooseSession(state,{...parsed,types:parsed.types.includes('interval')?['interval']:parsed.types},start,{...previous,sessionId:previous?.subjects?.blocks||previous?.sessionId}):null;
 const add=(rows,text)=>{if(text&&!rows.includes(text))rows.push(text);};
 if(stale)add(observations,'El contexto anterior ha caducado o tus actividades, perfil o calendario han cambiado. Esta respuesta se recalcula con los datos actuales.');
 if(parsed.followUp&&!previous&&!parsed.intents.length)add(questions,'¿A qué sesión o pregunta anterior te refieres? Indica su fecha y qué quieres revisar.');
 if(intents.includes('status'))add(observations,'El chat de la página funciona con reglas locales y no está conectado directamente a ChatGPT. No puedo comprobar desde esta página si el plugin está conectado. No se ha enviado esta pregunta a ninguna IA. Puedes consultar datos y preparar propuestas sin una API de pago.');
 if(!p||!plan){add(questions,'Crea tu perfil y genera un plan para responder con sesiones y datos concretos.');}
 else{
  if(session)add(observations,`Sesión consultada: ${label(session)}.${isFinished(session,state)?' Ya figura realizada.':''}`);
  if(parsed.explicitToday&&!session)add(observations,`El calendario no tiene entrenamiento de ese tipo hoy, ${start}.`);
  if(parsed.dates.length&&!session&&!intents.some(i=>['sport','move'].includes(i)))add(questions,`No encuentro esa sesión en ${parsed.dates.join(', ')}. ¿Qué fecha y tipo quieres consultar?`);
  if(intents.some(i=>['next','explain'].includes(i))&&session){
   add(observations,`Propósito: ${session.purpose||'Sin propósito documentado en este calendario antiguo.'}`);
   if(session.range)add(observations,`Rango orientativo de esta sesión: ${pace(session.range[0])}–${pace(session.range[1])} min/km. Prioriza el esfuerzo pautado.`);
   if(session.phase)add(observations,`Fase: ${session.phase.label}. ${session.phase.reason||''}`);
   if(session.selectionReason)add(inferences,session.selectionReason);
   if(session.trainingFocus?.reason)add(inferences,session.trainingFocus.reason);
   if(session.fit?.reason)add(observations,`Recorte por disponibilidad: ${session.fit.reason}`);
   if(session.substitution?.reason)add(observations,`Sustitución: ${session.substitution.reason}`);
   const nearby=plan.sessions.filter(s=>s.id!==session.id&&s.hard&&!s.skipped&&Math.abs(daysBetween(s.date,session.date))<2);
   if(nearby.length)add(inferences,`La sesión cómoda deja margen alrededor de ${nearby.map(label).join('; ')}. La posición en el calendario no demuestra recuperación.`);
   add(suggestions,session.conversation||'Respeta el esfuerzo pautado y revisa tus sensaciones antes de salir.');
  }
  if(intents.some(i=>['next','explain'].includes(i))&&!session&&!parsed.dates.length)add(questions,'No encuentro una sesión pendiente para esa consulta. ¿Quieres revisar una sesión realizada por fecha o calcular una preparación nueva en Mi plan?');
  const safety=care.pain==='relevant'||report.pain==='relevant'||p.runningRestriction==='no-running';
  if(safety){add(observations,care.pain==='relevant'?'El perfil o las sensaciones guardadas indican molestias relevantes.':report.pain==='relevant'?'En esta conversación declaras dolor relevante; no se ha guardado como medición.':'Hay una restricción activa de no correr.');if(report.pain==='none')add(questions,'Ahora dices que no tienes dolor, pero el perfil o las sensaciones guardadas siguen indicando molestias relevantes. Confirma y actualiza ese dato antes de retomar.');add(suggestions,'Pausa la carrera y valora la situación con un profesional antes de retomar. El chat no diagnostica ni autoriza volver a correr.');}
  if(intents.includes('pain')&&!safety){if(report.pain)add(observations,`Declaración en esta consulta: molestias ${report.pain==='mild'?'leves':'sin gravedad confirmada'}.`);add(questions,'¿Son molestias leves o afectan la zancada? Indica zona, cuándo aparecen y si te obligan a parar.');add(suggestions,'Con dolor relevante, pausa; sin confirmar su gravedad no se propone intensidad nueva.');}
  if(intents.includes('fatigue')){
   if(report.pain==='none')add(observations,'Dices que no tienes dolor; el cansancio se trata por separado y no se interpreta como dolor relevante.');
   add(observations,`Si estás cansado: ${session?.alternative||'Reduce esfuerzo o descansa, sin compensar después.'}`);
   if(known(report.fatigue))add(observations,`Fatiga declarada en esta conversación: ${report.fatigue}/10, todavía sin registrar.`);else if(known(care.fatigue))add(observations,`Fatiga guardada: ${care.fatigue}/10; no confirma por sí sola tus sensaciones de hoy.`);
   add(inferences,'El cansancio puede justificar retirar intensidad o acortar; no demuestra lesión ni permite medir tu recuperación.');
   if(!known(report.fatigue))add(questions,'¿Cuánta fatiga tienes hoy, de 0 a 10, y cómo has dormido? Regístrala en Sensaciones para que también la tenga en cuenta el plan.');
   const next=plan.sessions.find(s=>s.date>start&&s.date<=addDays(start,3)&&!s.skipped&&!isFinished(s,state)&&!['rest','race','strength'].includes(s.type));
   if(next&&!parsed.noChange){actionPolicy.push({sessionId:next.id,actions:safety?['rest']:['reduce','rest']});if(known(report.fatigue)&&report.fatigue>=7||known(care.fatigue)&&care.fatigue>=7||/reduc|acorta|ajust/.test(normalizeQuestion(question)))actionRequests.push({sessionId:next.id,action:safety?'rest':'reduce',...(safety?{}:{reduction:.3})});}
   if(session?.date===start)add(suggestions,'Para hoy utiliza la alternativa de la sesión o descanso según tus sensaciones; las propuestas guardadas solo cambian sesiones futuras pendientes.');
  }
  if(intents.includes('sport')){
   const date=parsed.dates.find(d=>d<start)||previous?.sportDate||null,sport=report.sport||previous?.report?.sport;
   const registered=[...own.filter(a=>a.type===sport&&(!date||a.date===date)),...(sport==='strength'?(state.sessionCompletions||[]).filter(a=>plan.sessions.some(s=>s.id===a.sessionId&&s.type==='strength')&&(!date||a.date===date)):[])];
   add(observations,`Declaras ${sport==='strength'?'fuerza':'CrossFit'}${date?' el '+date:''} en la conversación.${registered.length?' Hay un registro propio de ese día.':' No consta un registro propio de esa sesión.'}`);
   const actual=registered.at(-1),effort=report.rpe??actual?.rpe,minutes=report.minutes??(known(actual?.minutes)?actual.minutes:known(actual?.seconds)?actual.seconds/60:null);
   if(!date)add(questions,'¿Qué día hiciste esa sesión?');if(!known(minutes))add(questions,'¿Cuántos minutos duró el CrossFit o la fuerza?');if(!known(effort))add(questions,'¿Qué esfuerzo tuvo de 1 a 10, y cómo notas las piernas hoy?');
   if(known(effort)&&known(minutes)){add(observations,`Duración y esfuerzo ${known(report.rpe)||known(report.minutes)?'declarados en esta consulta':'registrados'}: ${Math.round(minutes)} min, ${effort}/10. No suman kilómetros de running.`);if(effort>=6&&date){const affected=plan.sessions.filter(s=>s.date>=start&&s.hard&&!isFinished(s,state)&&Math.abs(daysBetween(date,s.date))<2);add(inferences,affected.length?`Ese esfuerzo exige revisar ${affected.map(label).join('; ')} dentro del margen de 48 horas.`:'No hay sesión exigente pendiente dentro de las 48 horas de esa fecha; no se desplaza automáticamente la tirada.');for(const s of affected.filter(s=>s.date>start&&!['race','strength'].includes(s.type)).slice(0,3)){actionPolicy.push({sessionId:s.id,actions:['reduce','rest']});if(!parsed.noChange)actionRequests.push({sessionId:s.id,action:'reduce',reduction:.3});}if(affected.some(s=>s.date===start))add(suggestions,'Hoy retira la intensidad o descansa si sigues cansado; registra el trabajo realizado y las sensaciones para revisar el futuro.');}}
   else add(inferences,'Sin duración y esfuerzo no se considera esa sesión automáticamente exigente ni se supone que estés recuperado.');
  }
  if(intents.includes('move')){
   const session=moving;if(session&&session.id!==chooseSession(state,parsed,start,previous)?.id)add(observations,`Sesión para reorganizar: ${label(session)}.`);
   const candidates=parsed.targets.map(date=>date===start&&!/\beste\b|\bhoy\b/.test(normalizeQuestion(question))?addDays(date,7):date),targets=[...new Set(candidates)];
   if(!session)add(questions,'¿Qué sesión futura pendiente quieres mover? Indica tipo y fecha.');
   if(targets.length!==1)add(questions,targets.length?'Has indicado varias fechas: elige una para preparar la propuesta.':'¿A qué fecha concreta quieres moverla? Puedes indicar el día y la semana.');
   if(session&&targets.length===1){const date=targets[0];add(observations,`Destino consultado: ${DAYS[day(date)].toLowerCase()} ${date}; ${p.days.includes(day(date))?'día disponible en el perfil':'día no disponible en el perfil'}.`);
    try{if(safety)throw Error('Las molestias relevantes o la restricción activa requieren revisar la carrera antes de reorganizarla.');if(session.date<=start)throw Error('Solo se reorganizan sesiones futuras pendientes.');moveSession(plan,session.id,date,p,state,start);add(inferences,'El cambio respeta disponibilidad, minutos, ocupación y separación entre sesiones exigentes según el motor.');if(!parsed.noChange){actionPolicy.push({sessionId:session.id,actions:['move'],date});actionRequests.push({sessionId:session.id,action:'move',date});}}
    catch(error){add(suggestions,`Ese cambio no se puede proponer: ${error.message}`);add(questions,'Elige otra fecha disponible con tiempo suficiente y recuperación, o revisa primero la disponibilidad en Perfil.');}
   }
  }
  if(intents.includes('blocks')){
   const session=performing;if(session&&session.id!==chooseSession(state,parsed,start,previous)?.id)add(observations,`Sesión para analizar vueltas: ${label(session)}.`);
   const members=session?own.filter(a=>a.sessionId===session.id):[],actual=members.length?aggregateActivities(members):null;
   if(!session||!actual)add(questions,'Necesito la fecha de los intervalos y un registro vinculado con sus vueltas de trabajo y recuperación; la media total no identifica qué repetición fue rápida.');
   else{
    const comparison=blockComparison(actual,session),work=actual.laps.filter(l=>l.kind==='work'||l.kind==='main'&&known(l.rpe)&&l.rpe>=5),expected=session.blocks.filter(b=>b.role==='work'||blockKind(b.label)==='main'&&b.effort>=5);
    add(observations,`Registro vinculado: ${members.map(a=>a.id).join(', ')}, ${actual.date}. ${work.length} vuelta(s) identificada(s) como trabajo.`);
    const selectedLap=parsed.lapIndex===-1?work.length-1:parsed.lapIndex;
    if(selectedLap!=null&&selectedLap>=Math.min(work.length,expected.length))add(questions,'Esa repetición no tiene una vuelta de trabajo y un bloque previsto comparables. Confirma el número o completa las vueltas.');
    for(let i=0;i<Math.min(work.length,expected.length);i++){if(selectedLap!=null&&i!==selectedLap)continue;const lap=work[i],block=expected[i];if(lap.distance>0&&block.range){const observed=lap.seconds/lap.distance,tooFast=observed<block.range[0];add(observations,`Trabajo ${i+1}: ${pace(observed)} min/km frente a ${pace(block.range[0])}–${pace(block.range[1])} previstos${tooFast?'; más rápido que el límite orientativo':'; sin superar el límite rápido'}.`);}else add(questions,`Trabajo ${i+1}: faltan distancia medida o rango numérico comparable; revisa esfuerzo y tiempo.`);}
    add(questions,comparison.missing.join(' '));if(!known(actual.temperature))add(questions,'Falta temperatura: no atribuyo esa diferencia automáticamente a progreso ni corrijo el ritmo.');
    add(inferences,'Se compara cada vuelta de trabajo, separada de las recuperaciones. Estar fuera del rango es una observación; no demuestra una mejora de capacidad.');add(suggestions,'Mantén el esfuerzo y la recuperación pautados. Una carrera aislada no acelera los ritmos del plan.');
   }
  }
  if(intents.includes('unchanged')){
   const goal=acceptedGoal(state);add(observations,goal.type==='race'?`Objetivo del calendario aceptado: ${goal.distance} km el ${goal.date}.`:'El calendario conserva el objetivo aceptado en su última preparación.');
   const pending=[...(state.proposals||[]),...(state.planProposals||[])].filter(v=>v.status==='pending');add(observations,`El calendario vigente se calculó el ${plan.basis?.generatedOn||plan.created||plan.start}. ${pending.length} propuesta(s) esperan revisión.`);
   add(observations,pendingGoalMessage(state));add(inferences,'Registrar actividades o preguntar al chat no acepta una revisión. El calendario se mantiene hasta que revisas y aceptas una propuesta vigente.');
   const latest=own.filter(a=>a.date<=start).sort((a,b)=>b.date.localeCompare(a.date))[0];if(latest)add(inferences,progressEvidence(latest,plan,p,own,state.proposals||[],start).reason);
   if(!own.length)add(questions,'¿Está completo tu historial propio reciente? La ausencia de registros no se interpreta como inactividad.');
   add(suggestions,pending.length?'Abre Mi plan y revisa la propuesta pendiente; si han cambiado los datos, recalcula.':'En Mi plan puedes calcular una revisión con el historial confirmado. Se conservan el pasado y las asociaciones.');
  }
  if(intents.includes('calibration')){
   const calibration=calibrationAssessment(state,start);add(observations,`Referencias de capacidad: ${calibration.capacity.references.length}; rodajes cómodos comparables: ${calibration.comfortable.count}. Capacidad estimada, ritmo cómodo observado y ritmo objetivo se mantienen separados.`);
   add(questions,calibration.missing.slice(0,5).join(' '));add(suggestions,typeof calibration.nextReference==='string'?calibration.nextReference:calibration.nextReference?.description||calibration.nextReference?.purpose||'Registra tres rodajes cómodos comparables en al menos una semana, con distancia y tiempo medidos, esfuerzo, pausas, terreno, desnivel y temperatura.');
   add(suggestions,'En esa referencia anota distancia y tiempo medidos, tiempo total y en movimiento, esfuerzo, conversación, molestias, fatiga, terreno, desnivel y temperatura conocida; no inventes las condiciones ausentes.');if(!calibration.performanceTestAllowed)add(suggestions,'Todavía no se propone una prueba máxima. Primero confirma continuidad, recuperación y rodajes cómodos.');add(suggestions,'Después de registrar la referencia, calcula una propuesta de calibración en Mi plan. Varias sesiones comparables pueden apoyar un ajuste gradual; una carrera aislada no cambia todos los ritmos.');
  }
  if(intents.includes('race'))add(observations,raceCoachAnswer(state,start));
  if(intents.includes('progress')){const last=own.filter(a=>a.date<=start).sort((a,b)=>b.date.localeCompare(a.date))[0];add(inferences,last?progressEvidence(last,plan,p,own,state.proposals||[],start).reason:'Registra carreras y sensaciones para valorar progreso; una carrera rápida no acredita adaptación.');}
  if(intents.includes('missed'))add(suggestions,'Marca la sesión como omitida desde Mi plan. No compenses acumulando intensidad; continúa con la siguiente o prepara una reorganización respetando recuperación.');
 }
 if(!intents.length&&!questions.length)add(questions,'Para otras preguntas necesito concretar el tema. Puedo explicar una sesión por fecha, fatiga, CrossFit, cambios de día, vueltas rápidas, continuidad y referencias de ritmo.');
 if(actionRequests.length)add(suggestions,'Puede prepararse una propuesta comprobada por el motor. Guardarla no modifica el calendario; se revisa y acepta en Mi plan.');
 const nextContext={version:1,scopeKey,signature:dataSignature,date:start,updatedAt:Date.now(),intents:intents.slice(0,8),sessionId:session?.id||null,subjects:{move:moving?.id||null,blocks:performing?.id||null},report,sportDate:intents.includes('sport')?(parsed.dates.find(d=>d<start)||previous?.sportDate||null):previous?.sportDate||null};
 const result={observations,inferences,suggestions,questions,actionRequests:parsed.noChange?[]:actionRequests,actionPolicy:parsed.noChange?[]:actionPolicy,intents,sessionId:session?.id||null,context:nextContext,contextReset:stale};
 return {...result,answer:renderCoachAssessment(result)};
}
