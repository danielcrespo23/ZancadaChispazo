import {today,uid,monday,addDays,daysBetween,day,round,planKm,pace,duration,seconds,generate,session,TYPES} from './engine.mjs';

export const isOwnActivity=a=>a.source!=='strava'&&!a.stravaId&&!a.externalId;
const running=a=>isOwnActivity(a)&&a.distance>0&&a.seconds>0;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+'T12:00:00Z').getTime())&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const median=values=>{const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
export function recentTraining(state,start=today()){
 const activities=(state.activities||[]).filter(a=>running(a)&&a.date<start&&a.date>=addDays(start,-35));
 const first=monday(start),weeks=Array.from({length:4},(_,i)=>{const date=addDays(first,-7*(4-i)),runs=activities.filter(a=>a.date>=date&&a.date<addDays(date,7));return {date,km:round(runs.reduce((n,a)=>n+a.distance,0)),runs:runs.length,minutes:Math.round(runs.reduce((n,a)=>n+a.seconds,0)/60)};});
 const easy=activities.filter(a=>['easy','recovery','long'].includes(a.type)&&a.rpe>=2&&a.rpe<=4&&a.fatigue<=4&&a.pain==='none'&&a.terrain===state.profile?.terrain&&(a.temperature==null||a.temperature<25));
 const comparable=easy.filter(a=>Math.abs(a.distance/(easy[0]?.distance||1)-1)<=.25);
 const recent=activities.filter(a=>daysBetween(a.date,start)<=7);
 return {weeks,count:activities.length,activeWeeks:weeks.filter(w=>w.runs>0).length,medianWeeklyKm:median(weeks.map(w=>w.km)),longest:activities.length?Math.max(...activities.map(a=>a.distance)):null,easyPace:comparable.length>=3?median(comparable.map(a=>a.seconds/a.distance)):null,easyCount:comparable.length,temperatureKnown:comparable.every(a=>a.temperature!=null),caution:recent.some(a=>a.pain&&a.pain!=='none'||a.fatigue>=7||a.feeling==='mal'),source:'Registros propios de Zancada. Strava no interviene en este análisis.'};
}
export function sessionStatus(s,state){
 if((state.sessionCompletions||[]).some(c=>c.sessionId===s.id))return 'completed';
 const runs=(state.activities||[]).filter(a=>a.sessionId===s.id&&isOwnActivity(a));
 if(runs.length){const km=runs.reduce((n,a)=>n+a.distance,0),sec=runs.reduce((n,a)=>n+a.seconds,0);return runs.every(a=>a.type===s.type&&!(a.rpe>s.rpe+2))&&(!s.distance||Math.abs(km-s.distance)/s.distance<=.25)&&(!s.seconds||Math.abs(sec-s.seconds)/s.seconds<=.3)?'completed':'changed';}
 return s.skipped?'skipped':s.type==='rest'?'rest':s.date<today()?'missed':'pending';
}
export const statusLabels={completed:'Completada',changed:'Realizada con cambios',skipped:'Omitida',rest:'Descanso',missed:'Sin registrar',pending:'Pendiente'};
export const isFinished=(s,state)=>['completed','changed'].includes(sessionStatus(s,state));
export function weekSummary(state,date=today()){
 const start=monday(date),end=addDays(start,7),sessions=(state.plan?.sessions||[]).filter(s=>s.date>=start&&s.date<end),scheduled=sessions.filter(s=>s.type!=='rest'&&!s.skipped),runs=(state.activities||[]).filter(a=>running(a)&&a.date>=start&&a.date<end);
 return {start,sessions,scheduled:scheduled.length,completed:scheduled.filter(s=>isFinished(s,state)).length,actualKm:round(runs.reduce((n,a)=>n+a.distance,0)),plannedKm:round(scheduled.reduce((n,s)=>n+(s.distance||0),0)),minutes:Math.round(runs.reduce((n,a)=>n+a.seconds,0)/60),effortCount:runs.filter(a=>a.rpe>0).length,load:Math.round(runs.reduce((n,a)=>n+(a.rpe>0?a.seconds/60*a.rpe:0),0)),quality:scheduled.filter(s=>['interval','tempo','hills','progressive'].includes(s.type)).length,phase:sessions.find(s=>s.phase)?.phase||null};
}
// Planned versus done since the plan began. Today counts only once it is registered.
export function goalProgress(state,start=today()){
 const plan=state.plan;if(!plan)return null;
 const active=plan.sessions.filter(s=>!['rest','race'].includes(s.type)),due=active.filter(s=>s.date<start||(s.date===start&&isFinished(s,state)));
 const statuses=due.map(s=>sessionStatus(s,state)),count=k=>statuses.filter(v=>v===k).length;
 const runs=(state.activities||[]).filter(a=>running(a)&&a.date>=plan.start&&a.date<=start);
 const race=plan.sessions.find(s=>s.type==='race')||null,first=monday(plan.start);
 return {due:due.length,completed:count('completed'),changed:count('changed'),skipped:count('skipped'),missed:count('missed'),extra:runs.filter(a=>!a.sessionId).length,remaining:active.filter(s=>s.date>start&&!s.skipped).length,plannedKm:round(due.reduce((n,s)=>n+(s.distance||0),0)),actualKm:round(runs.reduce((n,a)=>n+a.distance,0)),week:Math.max(1,Math.min(Math.floor(daysBetween(first,start)/7)+1,Math.floor(daysBetween(first,plan.end)/7)+1)),totalWeeks:Math.floor(daysBetween(first,plan.end)/7)+1,daysLeft:Math.max(0,daysBetween(start,plan.end)),race};
}
export function buildPlanPreview(state,{useHistory=false,completeHistory=false,conservative=false}={},start=today()){
 if(!state.profile)throw Error('Guarda primero tu perfil y objetivo.');
 const evidence=recentTraining(state,start),profile={...state.profile},reasons=[];
 if(useHistory){
  if(!completeHistory)throw Error('Confirma que has registrado todas tus carreras de las últimas cuatro semanas. Un historial incompleto no permite medir tu volumen real.');
  if(evidence.count<6||evidence.activeWeeks<3)throw Error('Necesitamos al menos seis carreras propias repartidas en tres de las últimas cuatro semanas completas. Usa por ahora tu volumen declarado.');
  const declared=+profile.weeklyKm||0,observed=evidence.medianWeeklyKm;
  profile.weeklyKm=planKm(declared>0?Math.min(declared,observed):observed);
  if(evidence.longest)profile.longest=profile.longest?Math.min(+profile.longest,evidence.longest):evidence.longest;
  reasons.push(`Base semanal usada: ${profile.weeklyKm} km. Mediana de cuatro semanas completas: ${observed} km; volumen declarado: ${declared||'sin dato'} km. No se aumenta el volumen por una carrera aislada.`);
  const declaredPace=seconds(profile.easyPace);
  if(evidence.easyPace&&(!declaredPace||evidence.easyPace>declaredPace)){profile.easyPace=pace(Math.ceil(evidence.easyPace/5)*5);reasons.push(`Referencia suave provisional: ${profile.easyPace} min/km, desde ${evidence.easyCount} sesiones de esfuerzo y terreno comparables. No mide tu umbral.${evidence.temperatureKnown?'':' Temperatura incompleta: precisión limitada.'}`);}
  if(evidence.caution){profile.pain=profile.pain==='relevant'?'relevant':'mild';reasons.push('Hay molestias o fatiga declaradas recientemente. Se suprime la calidad y se reduce la carga inicial. No es una medición de recuperación.');}
 }else reasons.push('Base semanal, tirada reciente y referencias del perfil guardado. El historial incompleto no sustituye los datos declarados.');
 const check=(state.checkIns||[]).find(c=>c.date===start);
 if(check?.pain==='relevant'){profile.pain='relevant';reasons.push('Hoy has declarado molestias que afectan la zancada. Se prescribe pausa; revisa la situación antes de retomar.');}
 else if(check?.pain==='mild'){profile.pain='mild';reasons.push('Hoy has declarado molestias leves. La propuesta suprime intensidad hasta que revises tus sensaciones.');}
 if(conservative){profile.weeklyKm=planKm((+profile.weeklyKm||0)*.85);reasons.push('Has elegido una carga inicial más suave: se reduce un 15 % antes de aplicar límites de tiempo y tirada reciente.');}
 let generated=generate(profile,start),old=state.plan;
 const preserved=(old?.sessions||[]).filter(s=>s.date<start||isFinished(s,state)),dates=new Set(preserved.map(s=>s.date));
 generated={...generated,start:old?.start<generated.start?old.start:generated.start,sessions:[...preserved,...generated.sessions.filter(s=>!dates.has(s.date)).map(s=>{const previous=old?.sessions.find(v=>v.date===s.date);return previous?{...s,id:previous.id}:s;})].sort((a,b)=>a.date.localeCompare(b.date)),basis:{source:useHistory?'own-history':'profile',profile,reasons,generatedOn:start}};
 const blocked=(state.unavailable||[]).filter(b=>b.end>=start);
 generated={...generated,sessions:generated.sessions.map(s=>s.date>=start&&s.type!=='race'&&!isFinished(s,state)&&blocked.some(b=>s.date>=b.start&&s.date<=b.end)?restSession(s,'Periodo sin entrenamiento. No se trasladan sesiones para compensar.'):s)};
 return {plan:generated,evidence,reasons,changedCount:generated.sessions.filter(s=>s.date>=start&&!isFinished(s,state)).length,retained:preserved.length,raceConflict:blocked.some(b=>profile.goal.date>=b.start&&profile.goal.date<=b.end)};
}
export function acceptPlanPreview(state,preview,start=today()){
 if(!preview?.plan||preview.plan.basis.generatedOn!==start)throw Error('La revisión ya no es de hoy. Genera otra antes de aplicarla.');
 return {...state,plan:preview.plan,planProposals:(state.planProposals||[]).map(v=>v.status==='pending'?{...v,status:'superseded'}:v),proposals:state.proposals.map(v=>v.status==='pending'?{...v,status:'superseded'}:v),changes:[{id:uid(),date:new Date().toISOString(),type:state.plan?'Plan revisado':'Plan creado',reason:preview.reasons.join(' '),before:state.plan,after:preview.plan},...state.changes]};
}
export function restSession(before,reason){return {...before,type:'rest',distance:null,seconds:0,blocks:[],repetitions:null,range:null,hr:null,rpe:0,hard:false,purpose:reason,alternative:'Descansa. No acumules la carga omitida.',progression:'Pausa sin compensación posterior.',durationUnknown:false,estimated:false};}
export function wellnessProposal(state,check,start=today()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(check.date)||check.date!==start||![0,1,2,3,4,5,6,7,8,9,10].includes(+check.fatigue)||!['none','mild','relevant'].includes(check.pain))throw Error('Revisa fecha, fatiga y molestias.');
 if(check.sleep!==''&&check.sleep!=null&&(!Number.isFinite(+check.sleep)||+check.sleep<0||+check.sleep>16))throw Error('Las horas de sueño deben estar entre 0 y 16, o quedar vacías.');
 const pain=check.pain!=='none',tired=+check.fatigue>=7;
 const reason=check.pain==='relevant'?'Has declarado molestias relevantes: pausa la carrera y valora la situación con un profesional antes de retomarla.':pain||tired?'Tus sensaciones sugieren reducir la próxima carga; no confirman por sí solas tu estado de recuperación.':'Tus sensaciones no justifican cambiar la carga ahora. Dormir poco de forma aislada no se convierte en un diagnóstico.';
 const next=state.plan?.sessions.filter(s=>s.date>start&&!s.skipped&&!isFinished(s,state)&&!['race','rest'].includes(s.type)&&s.date<=addDays(start,3)).slice(0,check.pain==='relevant'?2:1)||[];
 const changes=next.map(before=>{
  const after=check.pain==='relevant'||before.type==='strength'||before.distance==null?restSession(before,reason):{...session(state.profile,'recovery',before.date,planKm(before.distance*.7),0,before.week,before.phase),id:before.id};
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
export function preparationSignature(state){const {name,email,...profile}=state.profile||{};return JSON.stringify({profile,plan:state.plan,activities:(state.activities||[]).filter(isOwnActivity),unavailable:state.unavailable||[],sessionCompletions:state.sessionCompletions||[],checkIns:state.checkIns||[]});}
export function acceptAIPlan(state,id,start=today()){
 const v=(state.planProposals||[]).find(v=>v.id===id&&v.status==='pending');
 if(!v||v.signature!==preparationSignature(state)||v.created!==start)throw Error('La propuesta ya no refleja tus datos actuales. Pide una revisión nueva en ChatGPT.');
 const next=acceptPlanPreview(state,v.preview,start);return {...next,planProposals:state.planProposals.map(x=>x.id===id?{...x,status:'accepted'}:x.status==='pending'?{...x,status:'superseded'}:x)};
}
export function restorePreviousPlan(state,id,start=today()){
 const c=state.changes.find(v=>v.id===id);if(!c?.before?.sessions||!c?.after?.sessions||JSON.stringify(state.plan)!==JSON.stringify(c.after))throw Error('El plan tiene cambios posteriores o no hay un plan anterior que restaurar.');
 if((state.activities||[]).some(a=>a.sessionId&&!c.before.sessions.some(s=>s.id===a.sessionId))||(state.sessionCompletions||[]).some(a=>!c.before.sessions.some(s=>s.id===a.sessionId)))throw Error('Hay registros vinculados a sesiones nuevas. Revisa el calendario antes de restaurarlo.');
 const passed=state.plan.sessions.filter(s=>s.date<start||isFinished(s,state)),dates=new Set(passed.map(s=>s.date));
 const restored={...c.before,sessions:[...passed,...c.before.sessions.filter(s=>!dates.has(s.date))].sort((a,b)=>a.date.localeCompare(b.date))};
 if(state.profile?.goal?.date&&['race','time'].includes(state.profile.goal.type)&&!restored.sessions.some(s=>s.type==='race'&&s.date===state.profile.goal.date&&s.distance===+state.profile.goal.distance))throw Error('El objetivo actual tiene otra carrera. Revisa el perfil antes de restaurar.');
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
