import {blockKind,hrRange,pace,reduceSession,speed,TYPES} from './engine.mjs';

const number=(value,maximumFractionDigits=3)=>value.toLocaleString('es-ES',{maximumFractionDigits});
export function distanceText(km){
 if(!(km>0))return '0 km';
 return km<1?`${Math.round(km*1000)} m`:`${number(km)} km`;
}
export function durationText(seconds){
 const total=Math.max(0,Math.round(seconds||0)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),rest=total%60;
 return [hours&&`${hours} h`,minutes&&`${minutes} min`,(rest||!total)&&`${rest} s`].filter(Boolean).join(' ');
}
export function paceText(range,target=null){
 return range?.length===2&&range.every(n=>n>0)?`${pace(range[0])}–${pace(range[1])} min/km`:target>0?`${pace(target)} min/km`:null;
}
export function speedText(range,target=null){
 const values=range?.length===2&&range.every(n=>n>0)?[speed(range[1]),speed(range[0])]:target>0?[speed(target)]:[];
 return values.length?`${values.map(n=>number(n,1)).join('–')} km/h`:null;
}
export function conversationText(effort,type='easy'){
 if(type==='strength')return 'Respira con control; no contengas la respiración.';
 if(effort<=2)return 'Conversación completa sin esfuerzo; puedes caminar si lo necesitas.';
 if(effort<=4)return 'Puedes hablar en frases completas con comodidad.';
 if(effort===5)return 'Frases más breves, manteniendo control y sin acabar al máximo.';
 return 'Frases cortas; esfuerzo controlado, sin esprintar ni llegar al máximo.';
}
export function blockInstruction(s,b){
 const kind=b.kind||blockKind(b.label),unknown=!!s.durationUnknown&&!b.seconds;
 const timing=unknown?'unknown':b.distance>0?'estimated':'prescribed';
 const hr=['race','rest','strength'].includes(s.type)?null:hrRange(s.profile||{},b.effort>=6?'tempo':'easy');
 return {kind,measure:b.distance>0?distanceText(b.distance):durationText(b.seconds),timing,
  timingText:unknown?'Duración sin estimar':`${timing==='estimated'?'Duración estimada':'Duración prescrita'}: ${durationText(b.seconds)}`,
  pace:paceText(b.range,b.targetPace),speed:speedText(b.range,b.targetPace),
  conversation:conversationText(b.effort,s.type),hr};
}
export function sessionTotals(s){
 const blocks=s.blocks||[],distance=Math.round(blocks.reduce((n,b)=>n+(b.distance||0),0)*1e6)/1e6,seconds=blocks.reduce((n,b)=>n+(b.seconds||0),0);
 const prescribedSeconds=blocks.filter(b=>!b.distance).reduce((n,b)=>n+(b.seconds||0),0),estimatedSeconds=seconds-prescribedSeconds;
 const unknown=!!s.durationUnknown,matching=Math.abs(seconds-(s.seconds||0))<.001&&(s.distance==null||Math.abs(distance-s.distance)<.00001);
 const timing=unknown?'unknown':estimatedSeconds>0?prescribedSeconds>0?'mixed':'estimated':'prescribed';
 return {distance,seconds,prescribedSeconds,estimatedSeconds,matching,timing,
  duration:unknown?'Sin estimación':durationText(seconds),
  label:timing==='unknown'?'Duración sin estimar':timing==='estimated'?'Duración estimada por ritmo':timing==='mixed'?'Duración estimada total; incluye bloques por tiempo':'Duración prescrita'};
}
const measure=b=>b.distance>0?distanceText(b.distance):durationText(b.seconds);
const intensity=b=>`${paceText(b.range,b.targetPace)?` · ${paceText(b.range,b.targetPace)}`:''} · esfuerzo ${b.effort}/10`;
const isWork=b=>b.role==='work'||/^(Repetición|Cuesta|Carrera suave \d)/.test(b.label||'');
const sameMeasure=(a,b)=>a.distance===b.distance&&(!a.distance?a.seconds===b.seconds:true);
function groupMeasure(blocks){
 const km=blocks.reduce((n,b)=>n+(b.distance||0),0),sec=blocks.filter(b=>!b.distance).reduce((n,b)=>n+(b.seconds||0),0);
 return [km>0&&distanceText(Math.round(km*1e6)/1e6),sec>0&&durationText(sec)].filter(Boolean).join(' + ');
}
export function recoveryInstruction(s){
 const blocks=s.blocks||[],recoveries=blocks.filter(b=>(b.kind||blockKind(b.label))==='recovery'),work=blocks.filter(isWork);
 if(!recoveries.length)return {count:0,workCount:work.length,text:'Sin recuperaciones entre repeticiones. Mantén el bloque continuo al esfuerzo indicado.',placement:'none'};
 const lastWork=blocks.findLastIndex(isWork),lastRecovery=blocks.findLastIndex(b=>(b.kind||blockKind(b.label))==='recovery'),afterLast=lastRecovery>lastWork;
 const uniform=recoveries.every(b=>sameMeasure(b,recoveries[0])),amount=uniform?`${recoveries.length} ${recoveries.length===1?'recuperación':'recuperaciones'} de ${measure(recoveries[0])}`:`${recoveries.length} recuperaciones: ${recoveries.map(measure).join(', ')}`;
 const mode=s.repetitions?.recoveryType||'Muy suaves, guiadas por esfuerzo.';
 const remainingEasy=blocks.slice(lastWork+1).some(b=>(b.kind||blockKind(b.label))==='main');
 const position=afterLast?'Después de cada repetición, incluida la última.':`Entre repeticiones; tras la última no hay otra recuperación: ${remainingEasy?'continúa con el rodaje suave restante y la vuelta a la calma':'pasa directamente a la vuelta a la calma'}.`;
 return {count:recoveries.length,workCount:work.length,placement:afterLast?'after-each':'between',text:`${amount}. ${mode}. ${position}`};
}
export function prescriptionSummary(s){
 if(s.type==='race')return [
  {kind:'warmup',title:'Calentamiento',text:s.raceNote&&s.purpose?.includes('requieren revisión')?'Revisa la participación antes de preparar un calentamiento.': '10–15 min de movilidad y trote suave, si lo toleras; fuera de la distancia oficial.'},
  {kind:'main',title:'Bloque principal',text:s.distance!=null?`${distanceText(s.distance)} de distancia oficial. Empieza controlado.`:'Distancia oficial sin confirmar; no se inventa un recorrido.'},
  {kind:'recovery',title:'Recuperaciones',text:'No hay pausas pautadas dentro de la carrera. Adapta la participación a tu preparación.'},
  {kind:'cooldown',title:'Vuelta a la calma',text:'Camina con suavidad tras la meta; fuera de la distancia oficial.'}
 ];
 const blocks=s.blocks||[],groups=['warmup','main','recovery','cooldown'].map(kind=>({kind,blocks:blocks.filter(b=>(b.kind||blockKind(b.label))===kind)}));
 const titles={warmup:'Calentamiento',main:'Bloque principal',recovery:'Recuperaciones',cooldown:'Vuelta a la calma'};
 return groups.map(({kind,blocks:part})=>{
  let text=part.length?`${groupMeasure(part)}${intensity(part.reduce((a,b)=>a.effort>=b.effort?a:b))}. Conversación completa y cómoda.`:'Sin bloque adicional.';
  if(kind==='main'){
   const work=part.filter(isWork),other=part.filter(b=>!isWork(b));
   text=s.repetitions&&work.length&&work.every(b=>sameMeasure(b,work[0]))?`${work.length} × ${measure(work[0])}${s.type==='walk'?' de carrera suave':s.type==='hills'?' en subida controlada':''}${intensity(work[0])}.${other.length?` Además: ${other.map(b=>`${b.label}: ${measure(b)}${intensity(b)}`).join('; ')}.`:''}`:part.map(b=>`${b.label}: ${measure(b)}${intensity(b)}`).join('; ')||'No hay entrenamiento pautado.';
  }
  if(kind==='recovery')text=recoveryInstruction(s).text;
  return {kind,title:titles[kind],text};
 });
}
export function prescriptionWarnings(s){
 const warnings=[];
 if(['interval','tempo','progressive','hills'].includes(s.type)&&!(s.blocks||[]).some(b=>(b.kind||blockKind(b.label))==='main'&&b.effort>=5))warnings.push('Esta sesión antigua está etiquetada como calidad, pero sus bloques solo pautan carrera suave. Sigue el esfuerzo suave de los bloques y revisa una nueva propuesta de plan.');
 if(!sessionTotals(s).matching)warnings.push('Los bloques guardados no coinciden con el total de esta sesión. Revisa el plan antes de seguirlo.');
 if(s.repetitions){const info=recoveryInstruction(s);if(s.repetitions.count!==info.workCount||s.repetitions.recoveryCount!=null&&s.repetitions.recoveryCount!==info.count)warnings.push('Las repeticiones guardadas no coinciden con los bloques. Las instrucciones muestran los bloques reales; revisa esta sesión.');}
 return warnings;
}
export function fatigueAlternative(profile,s,referenceDate=s.date){
 const rest=reason=>({type:'rest',title:'Descanso hoy',description:reason,blocks:[],seconds:0,distance:null,rpe:0});
 if(s.type==='rest')return rest('Mantén el descanso. No añadas entrenamientos para recuperar días perdidos.');
 if(profile.pain==='relevant'||profile.runningRestriction==='no-running')return rest('No hagas esta sesión con dolor que altera la zancada o una restricción de carrera activa. Revisa la situación antes de volver a correr.');
 if(profile.runningRestriction==='time-limit'&&!(+profile.restrictionMinutes>=15))return rest('Confirma el límite de duración antes de correr. Con menos de 15 min permitidos, conserva el descanso previsto por el motor.');
 if(s.type==='race')return rest('Con fatiga importante, no fuerces la salida. Revisa la participación; no se sustituye la carrera por otro entrenamiento exigente.');
 if(s.type==='strength')return {type:'strength',title:'10 min de movilidad suave',description:'Sin la parte de fuerza: 5 min de movilidad cómoda de tobillos y caderas y 5 min de movilidad suave de espalda. Esfuerzo 1–2/10; termina antes si molesta.',distance:null,seconds:600,rpe:2,blocks:[{label:'Movilidad cómoda de tobillos y caderas',kind:'main',distance:0,seconds:300,effort:2,range:null},{label:'Movilidad suave de espalda',kind:'cooldown',distance:0,seconds:300,effort:1,range:null}]};
 const alternative=reduceSession(profile,s,.3,referenceDate);
 if(alternative.seconds<300)return rest('La reducción deja menos de 5 min: descansa hoy y retoma la siguiente sesión prevista.');
 return {...alternative,type:alternative.type,title:`${TYPES[alternative.type]} reducida · ${alternative.distance!=null?distanceText(alternative.distance):durationText(alternative.seconds)}`,
  description:'Estos bloques sustituyen la sesión completa. Mantén conversación cómoda; si la fatiga no mejora, descansa. No acumules después los minutos o kilómetros omitidos.'};
}
