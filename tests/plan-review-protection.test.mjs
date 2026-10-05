import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {blankProfile,empty,today,addDays,generate,raceCoachAnswer} from '../lib/engine.mjs';
import {acceptedGoal,goalAwaitingReview} from '../lib/daily-focus.mjs';
import {raceCoaching} from '../lib/race-coach.mjs';
import {buildPlanPreview,acceptPlanPreview,acceptAIPlan,goalProgress,preparationSignature,restorePreviousPlan} from '../lib/training.mjs';
import {manualContext,CoachService} from '../lib/ai-coach.mjs';
import {withAIConsent} from '../lib/coach-consent.mjs';
import {readState,writeState} from '../lib/state-store.mjs';
import {stateResponse} from '../lib/ui-errors.mjs';

const date=today();
const profile=()=>({...blankProfile(),name:'Prueba aislada',experience:'regular',weeklyKm:25,longest:8,easyPace:'6:00',timezone:'Europe/Madrid',goal:{type:'race',distance:10,date:addDays(date,70),time:''}});
function initial(activities=[]){const state={...empty(),profile:profile(),activities};return acceptPlanPreview(state,buildPlanPreview(state,{},date),date);}
const run={id:'own',date:addDays(date,-1),distance:5,seconds:1800,type:'easy',rpe:3,fatigue:2,pain:'none',terrain:'asphalt',notes:'Conservar este registro'};
const cases=[
 ['molestias del perfil',s=>({...s,profile:{...s.profile,pain:'relevant'}})],
 ['molestias de hoy',s=>({...s,checkIns:[{date,pain:'relevant',fatigue:3}]})],
 ['fatiga de hoy',s=>({...s,checkIns:[{date,pain:'none',fatigue:8}]})],
 ['días disponibles',s=>({...s,profile:{...s.profile,days:[1],longDay:1}})],
 ['minutos disponibles',s=>({...s,profile:{...s.profile,minutes:{...s.profile.minutes,1:10}}})],
 ['periodo sin entrenamiento',s=>({...s,unavailable:[{start:addDays(date,1),end:addDays(date,4)}]})],
 ['actividad añadida',s=>({...s,activities:[...s.activities,{...run,id:'new',date}]})],
 ['actividad corregida',s=>({...s,activities:s.activities.map(a=>({...a,seconds:1900}))})],
 ['actividad eliminada',s=>({...s,activities:[]})],
 ['asociación de actividad',s=>({...s,activities:s.activities.map(a=>({...a,sessionId:s.plan.sessions[0].id}))})],
 ['sesión completada',s=>({...s,sessionCompletions:[{id:'strength',sessionId:s.plan.sessions[0].id,date,minutes:20,rpe:3}]})],
 ['calendario revisado',s=>({...s,plan:{...s.plan,sessions:s.plan.sessions.map((v,i)=>i? v:{...v,skipped:true})}})],
 ['fecha objetivo',s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,date:addDays(date,7)}}})],
 ['distancia objetivo',s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,distance:21.1}}})],
 ['tipo de objetivo',s=>({...s,profile:{...s.profile,goal:{type:'routine'}}})],
 ['tiempo objetivo',s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,time:'50:00'}}})],
 ['terreno objetivo',s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,terrain:'trail',elevation:500}}})]
];
function d1(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_cool_true_believers.sql',import.meta.url),'utf8'));return {prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}};}};}

test('edited goal is pending while race summary, coach, statistics and AI context describe the accepted calendar',()=>{
 const base=initial(),edited={...base,profile:{...base.profile,goal:{...base.profile.goal,distance:21.1,date:addDays(date,7)}}},before=JSON.stringify(edited);
 const coaching=raceCoaching(edited,date),progress=goalProgress(edited,date),context=manualContext(edited,date);
 assert.equal(coaching.days,70);assert.deepEqual(coaching.goal,acceptedGoal(base));assert.deepEqual(coaching.phase,raceCoaching(base,date).phase);assert.equal(coaching.goalPending,true);
 assert.deepEqual(coaching.pendingGoal,edited.profile.goal);assert.match(coaching.alerts.join(' '),/Nuevo objetivo pendiente: 21.1 km/);
 assert.match(raceCoachAnswer(edited,date),/Faltan 70 días para 10 km/);assert.match(raceCoachAnswer(edited,date),/Nuevo objetivo pendiente/);
 assert.equal(progress.daysLeft,70);assert.equal(progress.goal.distance,10);assert.equal(progress.goalPending,true);
 assert.equal(context.profile.goal.distance,10);assert.equal(context.goal.date,base.profile.goal.date);assert.equal(context.pendingGoal.distance,21.1);
 assert.equal(JSON.stringify(edited),before);
 // Moving the draft date into the past must not make the accepted race disappear.
 edited.profile.goal.date=addDays(date,-1);assert.equal(raceCoaching(edited,date).completed,false);
 edited.profile.goal={type:'routine'};assert.equal(raceCoaching(edited,date).days,70);assert.equal(goalAwaitingReview(edited),true);
});
test('legacy calendars, general goals and a retained past race use the same accepted goal',()=>{
 const base=initial(),legacy={...base,profile:{...base.profile,goal:{type:'race',date:addDays(date,7),distance:21.1,time:'1:45:00'}},plan:{...base.plan,basis:undefined}};
 assert.equal(acceptedGoal(legacy).distance,10);assert.equal(acceptedGoal(legacy).time,undefined);assert.equal(raceCoaching(legacy,date).days,70);
 const oldRace={...base.plan.sessions.find(s=>s.type==='race'),id:'past-race',date:addDays(date,-10),distance:5};
 assert.equal(acceptedGoal({...base,plan:{...base.plan,sessions:[oldRace,...base.plan.sessions]}}).distance,10);
 const p={...profile(),goal:{type:'routine'}},general={...empty(),profile:p,plan:generate(p,date)};
 general.profile={...p,goal:{type:'race',date:addDays(date,7),distance:21.1}};
 assert.equal(acceptedGoal(general).type,'routine');assert.equal(raceCoaching(general,date),null);assert.equal(goalAwaitingReview(general),true);
 general.plan.sessions.unshift(oldRace);assert.equal(acceptedGoal(general).type,'routine','past races cannot replace the accepted general goal');
});

for(const [name,change] of cases)test(`engine rejects a same-day preview after ${name} and preserves data`,()=>{
 const base={...initial(),activities:[run]},preview=buildPlanPreview(base,{},date,{revision:3}),changed=change(structuredClone(base)),before=JSON.stringify(changed);
 assert.throws(()=>acceptPlanPreview(changed,preview,date,3),/Vuelve a calcular/);assert.equal(JSON.stringify(changed),before);
 const ai={...changed,planProposals:[{id:'ai',status:'pending',created:date,signature:preparationSignature(base),preview}]};
 assert.throws(()=>acceptAIPlan(ai,'ai',date,3),/Vuelve a calcular/);
});
test('valid and recalculated previews accept after JSON roundtrip, retain records and preserve the originating revision',()=>{
 const base={...initial(),activities:[run]},preview=JSON.parse(JSON.stringify(buildPlanPreview(base,{conservative:true},date,{revision:4})));
 assert.equal(preview.source.revision,4);assert.equal(preview.source.planId,base.plan.id);
 const reordered=JSON.parse(JSON.stringify(base));reordered.profile.goal={date:base.profile.goal.date,time:'',distance:10,type:'race'};
 assert.equal(acceptPlanPreview(reordered,preview,date,4).plan.id,preview.plan.id);
 assert.throws(()=>acceptPlanPreview(base,preview,date,5),/revisión/);assert.throws(()=>acceptPlanPreview(base,preview,addDays(date,1),4),/desactualizada/);
 const changed=cases[0][1](base),fresh=buildPlanPreview(changed,{},date,{revision:5}),accepted=acceptPlanPreview(changed,fresh,date,5);
 assert.deepEqual(accepted.activities,base.activities);assert(accepted.plan.sessions.filter(s=>s.date>=date&&s.type!=='race').every(s=>s.type==='rest'));
 const incomplete=structuredClone(preview);delete incomplete.source;assert.throws(()=>acceptPlanPreview(base,incomplete,date),/origen/);
});

for(const [name,change] of cases.filter(([name])=>!['calendario revisado','asociación de actividad'].includes(name)))test(`server rejects direct stale replacement after ${name}, even at its current revision`,async()=>{
 const db=d1(),base=initial([run]);assert.equal((await writeState(db,'runner',base,0)).status,200);
 const preview=buildPlanPreview(base,{},date,{revision:1}),accepted=acceptPlanPreview(base,preview,date,1),changed=change(structuredClone(base));
 assert.equal((await writeState(db,'runner',changed,1)).status,200);
 const before=await readState(db,'runner'),payload={...changed,plan:accepted.plan,changes:accepted.changes};
 const result=await writeState(db,'runner',payload,2);assert.equal(result.status,409);assert.equal(result.code,'stale_plan_preview');assert.equal(result.recalculate,true);assert.deepEqual(await readState(db,'runner'),before);
});
test('server rejects forged source, missing source and reverting the new pain while replaying an old preview',async()=>{
 const db=d1(),base=initial();await writeState(db,'runner',base,0);
 const preview=buildPlanPreview(base,{},date,{revision:1}),accepted=acceptPlanPreview(base,preview,date,1),changed={...base,profile:{...base.profile,pain:'relevant'}};
 await writeState(db,'runner',changed,1);const before=await readState(db,'runner');
 const forged=structuredClone(accepted);forged.profile=changed.profile;forged.plan.basis.review={...forged.plan.basis.review,revision:2,signature:preparationSignature(changed)};
 assert.equal((await writeState(db,'runner',forged,2)).status,409,'server rebuilds the calendar instead of trusting client source metadata');
 const missing=structuredClone(forged);delete missing.plan.basis.review;assert.equal((await writeState(db,'runner',missing,2)).status,409);
 assert.equal((await writeState(db,'runner',accepted,2)).status,409,'old profile cannot silently overwrite current pain during acceptance');
 assert.deepEqual(await readState(db,'runner'),before);
 const fresh=buildPlanPreview(changed,{},date,{revision:2}),valid=acceptPlanPreview(changed,fresh,date,2);
 assert.equal((await writeState(db,'runner',valid,2)).status,200);assert.deepEqual((await readState(db,'runner')).state,valid);
 const restored=restorePreviousPlan(valid,valid.changes[0].id,date);assert.equal((await writeState(db,'runner',restored,3)).status,200,'restoring a verified previous calendar remains available');
});
test('AI proposal binds the complete state but calculates with manual data, and server acceptance remains valid',async()=>{
 const db=d1(),base=withAIConsent(initial([run,{...run,id:'file',source:'personal-file',externalId:'watch'}]),true);
 await writeState(db,'runner',base,0);
 const proposed=await new CoachService(db).call('runner','proponer_preparacion_running',{reason:'Revisar la preparación con una carga inicial suave.',conservative:true});
 const row=await readState(db,'runner'),v=row.state.planProposals.find(p=>p.id===proposed.id);
 assert.equal(v.preview.source.originRevision,1);assert.equal(v.preview.source.revision,2);assert.equal(v.preview.source.activityScope,'manual');assert.equal(v.preview.evidence.count,1);
 const accepted=acceptAIPlan(row.state,v.id,date,row.revision);assert.equal((await writeState(db,'runner',accepted,row.revision)).status,200);assert.deepEqual(accepted.activities,base.activities);
});
test('stale server previews expose a recalculation message instead of a generic tab conflict',async()=>{
 await assert.rejects(stateResponse(Response.json({code:'stale_plan_preview',error:'Tus datos han cambiado. Vuelve a calcular la propuesta.',recalculate:true},{status:409})),e=>e.code==='stale_plan_preview'&&/Vuelve a calcular/.test(e.message));
});
test('server rejects changing pain and accepting the old preview in a single request',async()=>{
 const db=d1(),base=initial();await writeState(db,'runner',base,0);
 const preview=buildPlanPreview(base,{},date,{revision:1}),accepted=acceptPlanPreview(base,preview,date,1),payload={...accepted,profile:{...base.profile,pain:'relevant'}};
 const before=await readState(db,'runner');assert.equal((await writeState(db,'runner',payload,1)).code,'stale_plan_preview');assert.deepEqual(await readState(db,'runner'),before);
});
