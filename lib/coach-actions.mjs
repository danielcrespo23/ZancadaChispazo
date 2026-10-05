import {today,uid,moveSession,reduceSession,validatePlan} from './engine.mjs';
import {isFinished,restSession} from './training.mjs';
import {currentCare} from './daily-focus.mjs';
import {coachDataSignature} from './coach-dialog.mjs';
import {stableStringify} from './plan-review.mjs';

// All callers prepare the same reviewable command; none of them applies it.
export function aiProposal(state,input,start=today(),{source='chatgpt'}={}){
 if(!state.profile||!state.plan)throw Error('Guarda tu perfil y genera primero un plan.');
 if(!['chatgpt','rules','ollama'].includes(source))throw Error('Origen de propuesta no permitido.');
 if(!input||typeof input.reason!=='string'||input.reason.trim().length<10||input.reason.length>2000||!Array.isArray(input.changes)||input.changes.length<1||input.changes.length>3)throw Error('Indica un motivo y entre una y tres sesiones.');
 if(Object.keys(input).some(k=>!['reason','changes'].includes(k)))throw Error('Parámetros no permitidos.');
 let working=state.plan;const seen=new Set(),edits=[],care=currentCare(state,start);
 for(const edit of input.changes){
  if(!edit||Object.keys(edit).some(k=>!['sessionId','action','date','reduction'].includes(k)))throw Error('Campos de sesión no permitidos.');
  if(seen.has(edit.sessionId))throw Error('Cada sesión solo puede aparecer una vez.');seen.add(edit.sessionId);
  const before=state.plan.sessions.find(s=>s.id===edit.sessionId);
  if(!before||before.date<=start||before.type==='race'||before.skipped||isFinished(before,state))throw Error('Solo se pueden proponer ajustes de sesiones futuras pendientes; se conserva el día de la carrera.');
  if((care.pain==='relevant'||state.profile.runningRestriction==='no-running')&&edit.action!=='rest')throw Error('Con molestias relevantes o restricción de carrera solo se propone descanso.');
  if(edit.action!=='move'&&edit.date!=null||edit.action!=='reduce'&&edit.reduction!=null)throw Error('La acción contiene parámetros incompatibles.');
  let after;
  if(edit.action==='move'){
   if(typeof edit.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(edit.date)||edit.date<=start)throw Error('Elige una fecha futura válida.');
   working=moveSession(working,before.id,edit.date,state.profile,state,start);after=working.sessions.find(s=>s.id===before.id);
  }else if(edit.action==='reduce'){
   const fraction=edit.reduction??.2;if(!Number.isFinite(fraction)||fraction<.1||fraction>.4)throw Error('La reducción debe estar entre el 10 % y el 40 %.');
   if(['rest','strength'].includes(before.type))throw Error('Elige una sesión de carrera para reducirla.');
   after={...reduceSession(state.profile,before,fraction,start),id:before.id};
   if(after.seconds>before.seconds||(after.distance||0)>(before.distance||0))throw Error('La reducción no puede aumentar la carga.');
   working={...working,sessions:working.sessions.map(s=>s.id===before.id?after:s)};
  }else if(edit.action==='rest'){
   after=restSession(before,'Descanso propuesto. Revisa tus sensaciones antes de retomar la carrera.');working={...working,sessions:working.sessions.map(s=>s.id===before.id?after:s)};
  }else throw Error('Acción no permitida. Usa mover, reducir o descansar.');
  if(stableStringify(before)===stableStringify(after))throw Error('La propuesta no cambia la sesión.');edits.push({sessionId:before.id,before,after});
 }
 const errors=validatePlan({...working,created:start,sessions:working.sessions.filter(s=>s.date>start)},state.profile);if(errors.length)throw Error('La propuesta no respeta las reglas del motor: '+errors.join(' '));
 const origin=source==='rules'?'del chat por reglas':source==='ollama'?'del modelo local':'de ChatGPT';
 const v={id:uid(),activityId:null,created:start,status:'pending',source,changes:edits,sessionId:edits[0].sessionId,before:edits[0].before,after:edits[0].after,reason:`Propuesta ${origin}: ${input.reason.trim()} Revisada por las reglas de Zancada.`,request:{reason:input.reason.trim(),changes:structuredClone(input.changes)},coachContext:{date:start,signature:coachDataSignature(state)}};
 return {state:{...state,proposals:[...state.proposals,v]},proposal:v};
}
export function validateCoachProposal(state,proposal,start=today()){
 if(!proposal.coachContext||proposal.coachContext.date!==start||proposal.coachContext.signature!==coachDataSignature(state))throw Error('Tus datos han cambiado o la propuesta ha caducado. Recalcula el ajuste del entrenador.');
 const rebuilt=aiProposal(state,proposal.request,start,{source:proposal.source}).proposal;
 for(const key of ['changes','sessionId','before','after','reason','coachContext'])if(stableStringify(proposal[key])!==stableStringify(rebuilt[key]))throw Error('La propuesta no coincide con las acciones comprobadas por el motor. Solicita una nueva.');
 return true;
}
export function validateRequestedChanges(changes,assessment){
 if(!Array.isArray(changes)||changes.length>3)throw Error('invalid');
 for(const change of changes){const allowed=assessment.actionPolicy.find(p=>p.sessionId===change.sessionId&&p.actions.includes(change.action));if(!allowed||change.action==='move'&&change.date!==allowed.date)throw Error('invalid');}
 return true;
}
