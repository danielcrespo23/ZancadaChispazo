import test from 'node:test';
import assert from 'node:assert/strict';
import {coach,decideTrainingProposal,applyConservativeProposal,session} from '../lib/engine.mjs';
import {chatReply,coachFacts,validateModelReply} from '../lib/coach-chat.mjs';
import {coachAssessment,understandQuestion,questionDates,coachContextSignature,coachResponseCurrent} from '../lib/coach-dialog.mjs';
import {CoachConversationStore} from '../lib/coach-conversation.mjs';
import {aiProposal} from '../lib/coach-actions.mjs';
import {coachFixture,withIntervals,start} from './helpers/coach-fixture.mjs';
const ask=(state,question,context=null,scopeKey='ana:real',date=start)=>chatReply(state,{question,mode:'rules'},{},fetch,{start:date,context,scopeKey});

test('today explanation identifies the actual dated session, phase and purpose',async()=>{
 const state=coachFixture(),today=state.plan.sessions.find(s=>s.date===start),reply=await ask(state,'¿Por qué hoy tengo este entrenamiento?');
 assert.equal(reply.analysis.sessionId,today.id);assert(reply.answer.includes(start));assert(reply.answer.includes(today.purpose));assert(reply.answer.includes(today.phase.label));assert.match(reply.answer,/Observación:.*\n/s);assert.match(reply.answer,/Inferencia:/);assert.match(reply.answer,/Propuesta:/);assert.equal(reply.proposal,null);assert.equal(coach('¿Por qué hoy tengo este entrenamiento?',state,start),reply.answer);
});
test('pain and fatigue negations do not invent relevant pain or exhaustion',async()=>{
 const state=coachFixture();for(const q of ['No tengo dolor, pero estoy cansado','Sin dolor y con cansancio','No me duele nada pero tengo fatiga']){const r=await ask(state,q);assert(r.analysis.intents.includes('fatigue'));assert(!r.analysis.intents.includes('pain'));assert(!r.answer.includes('Pausa la carrera'));assert.match(r.answer,/por separado/);assert.match(r.answer,/0 a 10/);assert.equal(r.proposal,null);}
 for(const q of ['No estoy cansado','No me siento nada cansado','No tengo fatiga ni dolor']){assert(!understandQuestion(q,start).intents.includes('fatigue'));}
});
test('a denial does not erase relevant pain already saved in the profile or sensations',async()=>{
 for(const state of [{...coachFixture(),checkIns:[{date:start,pain:'relevant',fatigue:3}]},{...coachFixture(),profile:{...coachFixture().profile,pain:'relevant'}}]){const r=await ask(state,'No tengo dolor, pero estoy cansado');assert.match(r.answer,/guardadas.*molestias relevantes|perfil.*molestias relevantes/);assert.match(r.answer,/Confirma y actualiza/);assert.match(r.answer,/Pausa la carrera/);}
});
test('Friday move is a future reviewable proposal and never a Saturday answer',async()=>{
 const state=coachFixture(),snapshot=structuredClone(state),long=state.plan.sessions.find(s=>s.type==='long'&&s.date>start),r=await ask(state,'¿Puedo cambiar la tirada al viernes?');
 assert.match(r.answer,/viernes 2026-10-09/);assert(!r.answer.includes('sábado'));assert.equal(r.proposal.source,'rules');assert.equal(r.proposal.status,'pending');assert.equal(r.proposal.before.id,long.id);assert.equal(r.proposal.after.date,'2026-10-09');assert.deepEqual(state,snapshot);
 const accepted=decideTrainingProposal({...state,proposals:[r.proposal]},r.proposal.id,true,start);assert.equal(accepted.plan.sessions.find(s=>s.id===long.id).date,'2026-10-09');assert.deepEqual(accepted.activities,state.activities);assert.equal(applyConservativeProposal({...state,settings:{autoConservative:true}},r.proposal,start).plan,state.plan);
});
test('day and explicit source references are resolved without hardcoding Saturday',async()=>{
 const state=coachFixture(),fri=await ask(state,'¿Puedo mover la tirada del 11/10 al viernes?');assert.equal(fri.proposal.before.date,'2026-10-11');assert.equal(fri.proposal.after.date,'2026-10-09');
 const next=await ask(state,'¿Y al viernes que viene?',fri.context);assert.equal(next.proposal.after.date,'2026-10-16');
 const tuesday=await ask(state,'¿Puedo mover la tirada al martes?');assert.equal(tuesday.proposal,null);assert.match(tuesday.answer,/martes 2026-10-06/);assert.match(tuesday.answer,/Ya hay una sesión/);
 assert.deepEqual(questionDates('el 09/10/2026 y el 2026-10-11',start),['2026-10-11','2026-10-09']);assert.deepEqual(questionDates('fatiga 8/10',start),[]);
});
test('ambiguous destinations and negated actions ask or explain without drafting changes',async()=>{
 const state=coachFixture();for(const q of ['¿Puedo cambiar la tirada?','¿Puedo cambiar la tirada al viernes o sábado?']){const r=await ask(state,q);assert.equal(r.proposal,null);assert.match(r.answer,/fecha|varias fechas/);}
 for(const q of ['No quiero cambiar la tirada al viernes; solo explica si podría hacerlo','Estoy cansado, fatiga 8/10, pero no quiero reducir el plan']){const r=await ask(state,q);assert.equal(r.proposal,null);const facts=coachFacts(q,state,start);assert.throws(()=>validateModelReply({factIds:['local_answer'],changes:[{sessionId:state.plan.sessions.find(s=>s.date>start).id,action:'reduce'}]},facts,state,q,start));}
});
test('CrossFit requires its own duration and effort instead of assuming a hard workout',async()=>{
 const state=coachFixture(),r=await ask(state,'Ayer hice CrossFit; ¿qué cambia?');assert.match(r.answer,/2026-10-04/);assert.match(r.answer,/minutos/);assert.match(r.answer,/esfuerzo/);assert.equal(r.proposal,null);assert(!r.answer.includes('sábado'));
 const next=await ask(state,'Fueron 45 minutos, esfuerzo 8/10',r.context);assert(next.analysis.intents.includes('sport'));assert.match(next.answer,/45 min, 8\/10/);assert.match(next.answer,/2026-10-05/);assert.match(next.answer,/48 horas/);assert.equal(next.proposal,null,'today remains read-only and tomorrow is 48h later');assert.equal(state.activities.length,0);
});
test('recorded CrossFit and completed strength provide actual minutes and effort',async()=>{
 const state=coachFixture(),cross={...state,activities:[{id:'cf',date:'2026-10-04',type:'crossfit',distance:0,seconds:2400,rpe:7,source:'manual'}]},r=await ask(cross,'Ayer hice CrossFit; ¿qué cambia?');assert.match(r.answer,/40 min, 7\/10/);assert(!r.answer.includes('¿Cuántos minutos'));
 const strength=session(state.profile,'strength','2026-10-04',0,25,0,null,start),own={...state,plan:{...state.plan,sessions:[...state.plan.sessions,strength]},sessionCompletions:[{id:'force',sessionId:strength.id,date:strength.date,minutes:32,rpe:7}]},force=await ask(own,'Ayer hice fuerza; ¿qué cambia?');assert.match(force.answer,/32 min, 7\/10/);assert.match(force.answer,/registrados/);
});
test('high fatigue follow-up prepares only a lower future dose, never a measurement',async()=>{
 const state=coachFixture(),first=await ask(state,'No tengo dolor, pero estoy cansado'),second=await ask(state,'8/10',first.context);assert.match(second.answer,/Fatiga declarada.*8\/10/);assert.match(second.answer,/todavía sin registrar/);assert(second.proposal);assert(second.proposal.after.seconds<second.proposal.before.seconds);assert(second.proposal.before.date>start);assert.equal((state.checkIns||[]).length,0);
});
test('interval analysis identifies the exact too-fast work lap and missing temperature',async()=>{
 const state=withIntervals(),r=await ask(state,'¿Qué parte de los intervalos estoy haciendo demasiado rápido?');assert.match(r.answer,/Trabajo 1:.*sin superar/);assert.match(r.answer,/Trabajo 2:.*más rápido que/);assert.match(r.answer,/Falta temperatura/);assert.match(r.answer,/separada de las recuperaciones/);assert.equal(r.proposal,null);assert(r.answer.includes('2026-10-01'));
});
test('an ordinal follow-up keeps the performed session and compares only that repetition',async()=>{
 const state=withIntervals(),first=await ask(state,'¿Qué parte de los intervalos hice demasiado rápido?'),second=await ask(state,'¿Y la segunda?',first.context);assert.equal(second.analysis.sessionId,first.analysis.sessionId);assert.match(second.answer,/Trabajo 2:.*más rápido/);assert(!second.answer.includes('Trabajo 1:'));assert(!second.answer.includes('Trabajo 3:'));
});
test('an overall average or unlinked activity cannot identify a fast interval',async()=>{
 for(const edit of [a=>({...a,laps:[]}),a=>({...a,sessionId:''})]){const state=withIntervals();state.activities=state.activities.map(edit);const r=await ask(state,'¿Qué parte de los intervalos estoy haciendo demasiado rápido?');assert(!r.answer.includes('Trabajo 2:'));assert.match(r.answer,/Necesito|Faltan bloques/);assert.equal(r.proposal,null);}
});
test('multiple intents retain distinct session subjects and a single validated move',async()=>{
 const state=withIntervals(),r=await ask(state,'¿Qué parte de los intervalos hice demasiado rápido y puedo mover la tirada al viernes?');assert.deepEqual(r.analysis.intents,['move','blocks']);assert.match(r.answer,/Trabajo 2:.*más rápido/);assert.match(r.answer,/viernes 2026-10-09/);assert.equal(r.proposal.before.type,'long');assert.equal(r.proposal.after.date,'2026-10-09');assert.notEqual(r.context.subjects.move,r.context.subjects.blocks);
});
test('unchanged calendar explanation uses pending accepted goal and actual evidence limits',async()=>{
 const state=coachFixture();state.profile.goal={...state.profile.goal,date:'2027-02-01',distance:42.2};const r=await ask(state,'¿Por qué mi plan todavía no ha cambiado?');assert.deepEqual(r.analysis.intents,['unchanged']);assert.match(r.answer,/pendiente/);assert.match(r.answer,/completo.*historial/);assert.match(r.answer,/2027-01-25/);assert.equal(r.proposal,null);assert(!r.answer.includes('sábado'));
});
test('calibration asks for measured references and refuses a maximum test without readiness',async()=>{
 const state=coachFixture();state.profile={...state.profile,experience:'beginner',weeklyKm:'',consistentWeeks:0,recentFrequency:1,easyPace:'',recovery:'unknown'};const r=await ask(state,'¿Qué referencia necesitas para ajustar mis ritmos?');assert.match(r.answer,/distancia y tiempo medidos/);assert.match(r.answer,/temperatura/);assert.match(r.answer,/no se propone una prueba máxima/);assert.match(r.answer,/Capacidad estimada, ritmo cómodo observado y ritmo objetivo/);assert.equal(r.proposal,null);
});
test('activity, health, calendar, scope, expiration and day changes discard old follow-up context',async()=>{
 const state=coachFixture(),first=await ask(state,'Estoy cansado'),mutations=[s=>({...s,activities:[{id:'new',source:'manual',date:start,distance:5,seconds:1800}]}),s=>({...s,checkIns:[{date:start,pain:'none',fatigue:2}]}),s=>({...s,plan:{...s.plan,sessions:s.plan.sessions.filter(v=>v.id!==first.context.sessionId)}})];
 for(const change of mutations){const r=await ask(change(state),'8/10',first.context);assert.equal(r.contextReset,true);assert.equal(r.proposal,null);assert.match(r.answer,/¿A qué sesión/);assert(!r.analysis.intents.includes('fatigue'));}
 for(const [context,scope,date] of [[first.context,'luis:real',start],[{...first.context,updatedAt:Date.now()-1800001},'ana:real',start],[first.context,'ana:real','2026-10-06']]){const r=await ask(state,'8/10',context,scope,date);assert.equal(r.contextReset,true);assert.equal(r.proposal,null);}
});
test('fresh standalone questions are recalculated after a state change',async()=>{
 const state=coachFixture(),old=await ask(state,'¿Por qué hoy tengo este entrenamiento?'),today=state.plan.sessions.find(s=>s.date===start),changed={...state,plan:{...state.plan,sessions:state.plan.sessions.filter(s=>s.id!==today.id)}},fresh=await ask(changed,'¿Por qué hoy tengo este entrenamiento?',old.context);assert.match(fresh.answer,/no tiene entrenamiento/);assert(!fresh.answer.includes(today.purpose));assert.equal(coachResponseCurrent(old,changed,start),false);assert.equal(coachResponseCurrent(fresh,changed,start),true);
});
test('bounded conversation storage has user isolation, expiry and copies',()=>{
 let now=0;const store=new CoachConversationStore({ttl:100,maximum:5,clock:()=>now}),context={intents:['fatigue'],report:{fatigue:8}},id=store.save('ana',null,context);context.report.fatigue=0;assert.equal(store.read('ana',id).report.fatigue,8);assert.equal(store.read('luis',id),null);const foreign=store.save('luis',id,{intents:['move']});assert.notEqual(foreign,id);assert.deepEqual(store.read('ana',id).intents,['fatigue']);for(let i=0;i<8;i++)store.save('ana',null,{i});assert(store.entries.size<=5);assert([...store.entries.values()].filter(v=>v.user==='ana').length<=4);now=101;assert.equal(store.read('luis',foreign),null);assert.throws(()=>store.read('',id));
});
test('model rejects wrong dates, wrong sessions, omitted intents, invented text and stale facts',async()=>{
 const state=coachFixture(),q='No tengo dolor, pero estoy cansado; ¿puedo mover la tirada al viernes?',facts=coachFacts(q,state,start),assessment=coachAssessment(q,state,start),move=assessment.actionRequests.find(a=>a.action==='move');assert(move);
 for(const response of [{factIds:['rules']},{factIds:['next']},{factIds:['local_answer'],text:'Aumenta el ritmo'},{factIds:['local_answer'],changes:[{...move,date:'2026-10-10'}]},{factIds:['local_answer'],changes:[{...move,sessionId:state.plan.sessions.find(s=>s.type==='race').id}]}])assert.throws(()=>validateModelReply(response,facts,state,q,start));
 const valid=validateModelReply({factIds:['local_answer'],changes:[move]},facts,state,q,start);assert.equal(valid.proposal.source,'ollama');assert.equal(valid.proposal.after.date,'2026-10-09');assert.throws(()=>validateModelReply({factIds:['local_answer']},facts,{...state,checkIns:[{date:start,pain:'relevant'}]},q,start));
});
test('coach draft acceptance rejects changed inputs, tampering and next-day expiry',async()=>{
 const state=coachFixture(),r=await ask(state,'¿Puedo mover la tirada al viernes?'),pending={...state,proposals:[r.proposal]},changed=[s=>({...s,profile:{...s.profile,pain:'relevant'}}),s=>({...s,profile:{...s.profile,minutes:{...s.profile.minutes,5:20}}}),s=>({...s,activities:[{id:'fresh',date:start,distance:3,seconds:1100}]}),s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,date:'2027-02-01'}}}),s=>({...s,plan:{...s.plan,end:'2027-02-01'}})];for(const change of changed)assert.throws(()=>decideTrainingProposal(change(pending),r.proposal.id,true,start),/Recalcula/);
 const altered=structuredClone(pending);altered.proposals[0].after.date='2026-10-10';assert.throws(()=>decideTrainingProposal(altered,r.proposal.id,true,start),/no coincide/);assert.throws(()=>decideTrainingProposal(pending,r.proposal.id,true,'2026-10-06'),/caducado/);assert.equal(decideTrainingProposal(changed[0](pending),r.proposal.id,false,start).proposals[0].status,'declined');
});
test('all coach sources share current care restrictions and cannot auto-apply',()=>{
 const state=coachFixture(),future=state.plan.sessions.find(s=>s.date>start);for(const source of ['chatgpt','rules','ollama']){const bad={...state,profile:{...state.profile,pain:'relevant'}};assert.throws(()=>aiProposal(bad,{reason:'Retirar intensidad tras dolor relevante.',changes:[{sessionId:future.id,action:'reduce'}]},start,{source}),/solo se propone descanso/);const valid=aiProposal(bad,{reason:'Descanso ante las molestias relevantes.',changes:[{sessionId:future.id,action:'rest'}]},start,{source});assert.equal(applyConservativeProposal({...valid.state,settings:{autoConservative:true}},valid.proposal,start).plan,state.plan);}
});
test('no pending session and unsupported questions request context without fabricated training',async()=>{
 const state=coachFixture();state.plan.sessions=[];assert.match((await ask(state,'¿Cuál es mi próxima sesión?')).answer,/No encuentro una sesión pendiente/);assert.match((await ask(coachFixture(),'¿Qué significa esta palabra?')).answer,/otras preguntas/);assert.notEqual(coachContextSignature(coachFixture(),start),'');
});
