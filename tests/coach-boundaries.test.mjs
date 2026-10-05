import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {CoachService,coachTools} from '../lib/ai-coach.mjs';
import {withAIConsent} from '../lib/coach-consent.mjs';
import {readState,writeState} from '../lib/state-store.mjs';
import {decideTrainingProposal,today,addDays,empty,blankProfile} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview} from '../lib/training.mjs';
import {chatReply} from '../lib/coach-chat.mjs';
import {coachFixture,withIntervals,start} from './helpers/coach-fixture.mjs';
function d1(states){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_cool_true_believers.sql',import.meta.url),'utf8'));for(const [user,state] of Object.entries(states))sql.prepare('INSERT INTO runner_state VALUES (?,?,?,?)').run(user,JSON.stringify(state),1,'');return {prepare(text){return {bind(...args){return {async first(){return sql.prepare(text).get(...args)||null;},async run(){return {meta:{changes:Number(sql.prepare(text).run(...args).changes)}};}};}};}};}
function currentFixture(){const p={...blankProfile(),experience:'regular',weeklyKm:24,longest:10,easyPace:'6:30',pain:'none',fatigue:2,days:[0,1,2,3,4,5,6],minutes:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,120])),goal:{type:'race',distance:10,date:addDays(today(),70),time:''}},initial={...empty(),profile:p};return acceptPlanPreview(initial,buildPlanPreview(initial));}
async function draft(state){const result=await chatReply(state,{question:'Estoy cansado; reduce mi próxima sesión. Fatiga 8/10',mode:'rules'});assert(result.proposal);return result.proposal;}

test('authenticated MCP conversation isolates users, asks for missing info and writes nothing',async()=>{
 const db=d1({ana:withAIConsent(currentFixture(),true),luis:withAIConsent(currentFixture(),true)}),service=new CoachService(db),oldAna=await readState(db,'ana'),oldLuis=await readState(db,'luis');
 const first=await service.call('ana','consultar_entrenador_running',{question:'No tengo dolor, pero estoy cansado'});assert.match(first.answer,/por separado/);assert.equal(first.calendarChanged,false);assert(first.conversationId);
 const follow=await service.call('ana','consultar_entrenador_running',{question:'8/10',conversationId:first.conversationId});assert(follow.proposal);assert.equal(follow.proposal.status,'pending');assert.equal(follow.proposal.source,'rules');assert.match(follow.answer,/8\/10/);
 const foreign=await service.call('luis','consultar_entrenador_running',{question:'8/10',conversationId:first.conversationId});assert.notEqual(foreign.conversationId,first.conversationId);assert.equal(foreign.proposal,null);assert(!foreign.answer.includes('Fatiga declarada'));
 assert.deepEqual(await readState(db,'ana'),oldAna);assert.deepEqual(await readState(db,'luis'),oldLuis);assert(coachTools.find(t=>t.name==='consultar_entrenador_running').annotations.readOnlyHint);
 await assert.rejects(service.call('ana','consultar_entrenador_running',{question:'hoy',userId:'luis'}),/pregunta e identificador/);
});
test('MCP follow-up rechecks activities and refuses to reuse old fatigue declarations',async()=>{
 const state=withAIConsent(currentFixture(),true),db=d1({ana:state}),service=new CoachService(db),r=await service.call('ana','consultar_entrenador_running',{question:'Estoy cansado'});assert.equal((await writeState(db,'ana',{...state,activities:[{id:'new',date:today(),distance:3,seconds:1200,type:'easy',rpe:3,pain:'none',fatigue:2}]},1)).status,200);
 const follow=await service.call('ana','consultar_entrenador_running',{question:'8/10',conversationId:r.conversationId});assert.equal(follow.contextReset,true);assert.equal(follow.proposal,null);assert.match(follow.answer,/¿A qué sesión/);
});
test('MCP consult and model paths exclude external files while local rules can compare authorized laps',async()=>{
 const state=withAIConsent(withIntervals(),true),local=await chatReply(state,{question:'¿Qué parte de los intervalos hice demasiado rápido?',mode:'rules'},{},fetch,{start});assert.match(local.answer,/Trabajo 2:.*más rápido/);
 const db=d1({ana:state}),service=new CoachService(db),remote=await service.call('ana','consultar_entrenador_running',{question:'¿Qué parte de los intervalos hice demasiado rápido?'});assert(!remote.answer.includes('interval-watch'));assert.match(remote.answer,/Necesito/);assert.deepEqual((await readState(db,'ana')).state,state);
});
test('MCP can save a reviewed command through the shared validator, without changing the calendar',async()=>{
 const state=withAIConsent(currentFixture(),true),db=d1({ana:state}),service=new CoachService(db),r=await service.call('ana','consultar_entrenador_running',{question:'Estoy cansado, fatiga 8/10; reduce mi próxima sesión'});const saved=await service.call('ana','proponer_ajuste_running',r.proposal.request);assert.equal(saved.proposal.source,'chatgpt');assert.deepEqual(saved.proposal.changes,r.proposal.changes);assert.equal(saved.calendarChanged,false);const row=await readState(db,'ana');assert.equal(row.revision,2);assert.deepEqual(row.state.plan,state.plan);assert.equal(row.state.proposals[0].status,'pending');
 const accepted=decideTrainingProposal(row.state,saved.proposal.id,true);assert.equal((await writeState(db,'ana',accepted,row.revision)).status,200);assert.deepEqual((await readState(db,'ana')).state.plan,accepted.plan);
});
test('MCP cannot return an answer computed before a concurrent calendar update',async()=>{
 const db=d1({ana:withAIConsent(currentFixture(),true)}),service=new CoachService(db),read=service.read.bind(service);let count=0;service.read=async user=>{const row=await read(user);return ++count>1?{...row,revision:row.revision+1}:row;};await assert.rejects(service.call('ana','consultar_entrenador_running',{question:'Estoy cansado'}),/durante la respuesta/);
});
test('server keeps valid rules drafts pending and accepts them only after explicit review',async()=>{
 const state=currentFixture(),db=d1({ana:state}),proposal=await draft(state),pending={...state,proposals:[proposal]};assert.equal((await writeState(db,'ana',pending,1)).status,200);assert.deepEqual((await readState(db,'ana')).state.plan,state.plan);
 const accepted=decideTrainingProposal(pending,proposal.id,true);assert.equal((await writeState(db,'ana',accepted,2)).status,200);assert.equal((await readState(db,'ana')).state.proposals[0].status,'accepted');assert.deepEqual((await readState(db,'ana')).state.activities,state.activities);
});
test('server revalidates a coach acceptance even with the newest database revision',async()=>{
 const mutations=[s=>({...s,profile:{...s.profile,pain:'relevant'}}),s=>({...s,profile:{...s.profile,minutes:{...s.profile.minutes,2:20}}}),s=>({...s,activities:[{id:'new',date:today(),distance:3,seconds:1200,type:'easy'}]}),s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,distance:21.1}}})];
 for(const change of mutations){const state=currentFixture(),proposal=await draft(state),pending={...state,proposals:[proposal]},db=d1({ana:pending}),oldAccepted=decideTrainingProposal(pending,proposal.id,true),changed=change(pending);assert.equal((await writeState(db,'ana',changed,1)).status,200);const before=await readState(db,'ana'),payload={...changed,plan:oldAccepted.plan,proposals:oldAccepted.proposals,changes:oldAccepted.changes},result=await writeState(db,'ana',payload,before.revision);assert.equal(result.status,409);assert.equal(result.code,'stale_coach_proposal');assert.equal(result.recalculate,true);assert.deepEqual(await readState(db,'ana'),before);}
});
test('server rejects tampered draft, combined creation and application, deleted pending review and modified acceptance',async()=>{
 const state=currentFixture(),proposal=await draft(state),pending={...state,proposals:[proposal]},accepted=decideTrainingProposal(pending,proposal.id,true);
 for(const payload of [accepted,{...accepted,proposals:[proposal]}]){const db=d1({ana:state});assert.equal((await writeState(db,'ana',payload,1)).code,'stale_coach_proposal');assert.deepEqual((await readState(db,'ana')).state,state);}
 const altered=structuredClone(pending);altered.proposals[0].reason+=' Inventado';const fresh=d1({ana:state});assert.equal((await writeState(fresh,'ana',altered,1)).code,'stale_coach_proposal');
 const db=d1({ana:pending});assert.equal((await writeState(db,'ana',{...accepted,proposals:[]},1)).code,'stale_coach_proposal');const mismatched=structuredClone(accepted);mismatched.plan=pending.plan;assert.equal((await writeState(db,'ana',mismatched,1)).code,'stale_coach_proposal');assert.deepEqual((await readState(db,'ana')).state,pending);
});
test('an obsolete legacy draft stays readable and can be declined without deleting records',async()=>{
 const state=currentFixture(),proposal=await draft(state);delete proposal.coachContext;delete proposal.request;const pending={...state,proposals:[proposal]},db=d1({ana:pending});assert.equal((await writeState(db,'ana',pending,1)).status,200);assert.throws(()=>decideTrainingProposal(pending,proposal.id,true),/Recalcula/);const declined=decideTrainingProposal(pending,proposal.id,false);assert.equal((await writeState(db,'ana',declined,2)).status,200);assert.deepEqual((await readState(db,'ana')).state.plan,state.plan);
});
test('coach replies do not disclose other account data in bounded contexts',async()=>{
 const state=coachFixture();state.profile.name='PRIVATE NAME';state.profile.email='PRIVATE MAIL';state.strava={accessToken:'SECRET'};const r=await chatReply(state,{question:'Ayer hice CrossFit; ¿qué cambia?',mode:'rules'},{},fetch,{start,scopeKey:'ana:real'});assert(!JSON.stringify(r).includes('PRIVATE'));assert(!JSON.stringify(r).includes('SECRET'));assert(!r.context.question);assert(!r.context.transcript);assert(r.context.intents.length<=8);
});
