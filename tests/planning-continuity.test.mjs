import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,empty,generate,addDays,monday,round,validatePlan,planDiagnostics,raceCoachAnswer,regeneratePlan,session} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview} from '../lib/training.mjs';
import {phaseAt,preparationContinuity} from '../lib/planning-rules.mjs';
import {raceCoaching} from '../lib/race-coach.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readState,writeState} from '../lib/state-store.mjs';
import {readFileSync} from 'node:fs';

const origin='2026-10-05',review='2026-11-09',race='2027-01-25';
const profile=()=>({...blankProfile(),experience:'regular',weeklyKm:30,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:3,consistentWeeks:12,consistency:'continuous',longest:12,longestSource:'measured',longestDate:'2026-10-04',longestResult:'comfortable',easyPace:'6:00',easySource:'measured',easyEffort:3,easyConversation:'yes',recovery:'good',runningRestriction:'none',days:[1,3,6],minutes:{1:70,3:70,6:100},longDay:6,timezone:'Europe/Madrid',goal:{type:'race',distance:21.1,date:race,time:'',intent:'improve',terrain:'asphalt'}});
const running=s=>!['rest','race','strength'].includes(s.type);
const own=s=>({id:'own-'+s.id,date:s.date,type:s.type,distance:s.distance??round(s.seconds/360),seconds:s.seconds,rpe:s.rpe,fatigue:2,pain:'none',feeling:'bien',terrain:'asphalt',temperature:16,sessionId:s.id,notes:'Conservar nota y asociación',laps:[]});
function fixture(until=null){const p=profile(),plan=generate(p,origin);return {...empty(),profile:p,plan,activities:until?plan.sessions.filter(s=>running(s)&&s.date<until).map(own):[]};}
const weekKm=(plan,date)=>round(plan.sessions.filter(s=>running(s)&&monday(s.date)===monday(date)).reduce((n,s)=>n+(s.distance||0),0));
const phaseDates=plan=>[plan.schedule.start,plan.schedule.baseEnd,plan.schedule.specificStart,plan.schedule.taperStart,plan.schedule.end];

test('05/10 half marathon reviewed on 09/11 keeps development, specific block, race, and original deloads',()=>{
 const state=fixture(),snapshot=JSON.stringify(state),preview=buildPlanPreview(state,{},review);
 assert.equal(state.plan.sessions.find(s=>s.date===review).phase.key,'build');assert.equal(preview.plan.sessions.find(s=>s.date===review).phase.key,'build');
 assert.deepEqual(phaseDates(preview.plan),phaseDates(state.plan));assert.equal(preview.plan.schedule.specificStart,'2026-12-11');assert.equal(preview.plan.schedule.taperStart,'2027-01-15');
 assert.equal(preview.continuity.mode,'adjust');assert.equal(preview.plan.sessions.find(s=>s.date===review).week,5);
 assert.equal(preview.plan.sessions.find(s=>s.date>=review&&s.phase?.key==='deload').date,'2026-11-23');
 assert.equal(JSON.stringify(state),snapshot);assert.deepEqual(preview.plan.sessions.filter(s=>s.date<review),state.plan.sessions.filter(s=>s.date<review));
 assert.equal(preview.comparison[0].before.km,weekKm(state.plan,review));assert.equal(preview.comparison[0].after.km,30);
 assert.deepEqual(preview.comparison[0].after.phases,['Desarrollo']);assert.equal(preview.comparison[0].after.keySessions[0].type,state.plan.sessions.find(s=>s.date===review).type);
 assert(preview.comparison.every(w=>w.reasons.length>=2));assert(preview.historyQuestion);assert.equal(preview.continuity.load.growthAllowed,false);
});
test('elapsed weeks do not become load evidence; complete actual history permits only a measured incremental proposal',()=>{
 const missing=fixture(),completed=fixture(review),a=buildPlanPreview(missing,{},review),b=buildPlanPreview(completed,{completeHistory:true},review);
 assert.deepEqual(phaseDates(a.plan),phaseDates(b.plan));assert.equal(a.continuity.load.source,'incomplete-history');assert.equal(b.continuity.load.source,'complete-history');
 assert.equal(a.continuity.load.referenceWeeklyKm,30);assert.equal(b.continuity.load.referenceWeeklyKm,30.9);
 assert.equal(b.comparison[0].after.km,31.8);assert.equal(b.continuity.load.growthAllowed,true);assert(!b.historyQuestion);
 assert(b.comparison[0].after.km<=b.continuity.load.referenceWeeklyKm+1.01);
 assert(b.plan.basis.profile.longest>completed.profile.longest,'recorded long runs, not elapsed weeks, justify the current long reference');
});
test('eleven successive weekly reviews preserve phases and deload dates while actual completed work updates load',()=>{
 let state=fixture(review);const dates=phaseDates(state.plan),volumes=[],deloads=[],quality=[];
 for(let i=0;i<11;i++){
  const date=addDays(review,i*7),activities=structuredClone(state.activities),past=state.plan.sessions.filter(s=>s.date<date),preview=buildPlanPreview(state,{completeHistory:true},date);
  assert.deepEqual(phaseDates(preview.plan),dates);assert.equal(preview.continuity.mode,'adjust');
  for(const old of past)assert.deepEqual(preview.plan.sessions.find(s=>s.id===old.id),old);
  const expected=phaseAt(state.profile,date,state.plan.schedule);assert.equal(preview.plan.sessions.find(s=>s.date>=date&&running(s))?.phase.key,expected.key);
  assert.deepEqual(planDiagnostics({...preview.plan,sessions:preview.plan.sessions.filter(s=>s.date>=date)}),[]);
  const future=preview.plan.sessions.filter(s=>s.date>=date&&!state.activities.some(a=>a.sessionId===s.id));assert.deepEqual(validatePlan({...preview.plan,created:date,sessions:future},preview.plan.basis.profile),[]);
  assert.equal(preview.plan.sessions.find(s=>s.type==='race').date,race);
  const km=weekKm(preview.plan,date);volumes.push(km);if(expected.key==='deload')deloads.push(date);
  quality.push(preview.plan.sessions.find(s=>monday(s.date)===date&&['tempo','progressive'].includes(s.type))?.type||null);
  state=acceptPlanPreview(state,preview,date);assert.deepEqual(state.activities,activities);
  state.activities.push(...state.plan.sessions.filter(s=>running(s)&&s.date>=date&&s.date<addDays(date,7)).map(own));
 }
 assert.deepEqual(deloads,['2026-11-23','2026-12-21']);assert(volumes[1]>volumes[0]);assert(volumes[4]>volumes[0]);
 assert(quality.slice(0,2).every(t=>['tempo','progressive'].includes(t)));assert.equal(quality[2],null);
 assert(volumes[2]<volumes[1]);assert(volumes[3]<=volumes[1]+1.1,'no repayment spike after a deload');
 assert(volumes[9]<volumes[8]);assert(volumes[10]<volumes[9]);
});
test('successive reviews with unconfirmed or incomplete history ask about coverage without inventing inactivity',()=>{
 for(const activities of [[],fixture(addDays(origin,8)).activities]){
  let state={...fixture(),activities};
  for(let i=0;i<6;i++){
   const date=addDays(review,i*7),preview=buildPlanPreview(state,{},date);
   assert.equal(preview.continuity.mode,'adjust');assert.equal(preview.continuity.confirmedBreak,false);assert.match(preview.historyQuestion,/registrado todas/);
   assert.equal(preview.plan.schedule.start,origin);assert.equal(preview.plan.schedule.specificStart,'2026-12-11');assert.equal(preview.continuity.load.growthAllowed,false);
   state=acceptPlanPreview(state,preview,date);
  }
 }
});
test('a declared real pause starts a bounded reentry; repeated acceptance does not repeat the reduction or delay deloads',()=>{
 let state=fixture(addDays(origin,20)),preview=buildPlanPreview(state,{returnAfterBreak:true},review);
 assert.equal(preview.continuity.mode,'resume');assert.equal(preview.continuity.startedOn,origin);assert.equal(preview.continuity.phaseOrigin,review);
 assert.equal(preview.continuity.reentryUntil,'2026-11-23');assert.equal(preview.plan.basis.profile.weeklyKm,18);
 assert(preview.plan.sessions.filter(s=>s.date>=review&&s.date<'2026-11-23').every(s=>!['tempo','interval','hills','progressive'].includes(s.type)));
 state=acceptPlanPreview(state,preview,review);
 const next=buildPlanPreview(state,{returnAfterBreak:true},'2026-11-16');assert.equal(next.continuity.mode,'adjust');assert.equal(next.continuity.reentryUntil,'2026-11-23');assert.equal(next.plan.basis.profile.weeklyKm,18);
 assert.equal(next.plan.schedule.start,review);assert.equal(next.plan.sessions.find(s=>s.date>='2026-11-16'&&s.phase?.key==='deload').date,'2026-11-30');
 assert.equal(next.plan.sessions.find(s=>s.type==='race').date,race);
 const withRuns={...state,activities:[...state.activities,...state.plan.sessions.filter(s=>running(s)&&s.date>=review&&s.date<'2026-11-16').map(own)]};
 const active=buildPlanPreview(withRuns,{returnAfterBreak:true},'2026-11-16');assert.equal(active.continuity.mode,'adjust');assert.equal(active.continuity.reentryUntil,'2026-11-23');assert.equal(active.plan.basis.profile.weeklyKm,18);
 const secondBreak=buildPlanPreview(withRuns,{completeHistory:true,returnAfterBreak:true},'2026-12-07');assert.equal(secondBreak.continuity.mode,'resume');assert.equal(secondBreak.continuity.phaseOrigin,'2026-12-07');
 const explicitBase=fixture(),explicitFirst=buildPlanPreview(explicitBase,{mode:'resume'},review),explicitState=acceptPlanPreview(explicitBase,explicitFirst,review);
 const explicitNext=buildPlanPreview(explicitState,{mode:'resume'},'2026-11-16');assert.equal(explicitNext.continuity.mode,'adjust');assert.equal(explicitNext.plan.basis.profile.weeklyKm,18);assert.equal(explicitNext.continuity.phaseOrigin,review);
});
test('only confirmed complete history turns a real fourteen-day gap into a pause, including zero runs',()=>{
 for(const state of [fixture(addDays(review,-18)),fixture()]){
  const unknown=buildPlanPreview(state,{},review),complete=buildPlanPreview(state,{completeHistory:true},review);
  assert.equal(unknown.continuity.mode,'adjust');assert.equal(complete.continuity.mode,'resume');assert.equal(complete.continuity.confirmedBreak,true);
  assert.equal(complete.plan.basis.profile.weeklyKm,0);assert(complete.plan.sessions.filter(s=>s.date>=review&&s.date<addDays(review,14)&&running(s)).every(s=>s.type==='walk'));
  assert.equal(complete.plan.end,race);assert.deepEqual(complete.plan.sessions.filter(s=>s.date<review),state.plan.sessions.filter(s=>s.date<review));
 }
});
test('a changed race and an explicit new preparation are different decisions with new phase origins',()=>{
 const state=fixture(review),changed={...state,profile:{...state.profile,goal:{...state.profile.goal,distance:10,date:'2027-02-15'}}};
 const goal=buildPlanPreview(changed,{completeHistory:true},review),fresh=buildPlanPreview(state,{mode:'new',completeHistory:true},review);
 assert.equal(goal.continuity.mode,'goal_change');assert.equal(goal.plan.schedule.start,review);assert.equal(goal.plan.end,'2027-02-15');
 assert.equal(goal.plan.sessions.find(s=>s.type==='race').distance,10);assert.equal(fresh.continuity.mode,'new');assert.equal(fresh.plan.schedule.start,review);
 assert.equal(fresh.plan.schedule.specificStart,'2026-12-25');assert.equal(fresh.plan.end,race);
 assert.deepEqual(goal.plan.sessions.filter(s=>s.date<review),state.plan.sessions.filter(s=>s.date<review));
 assert.throws(()=>buildPlanPreview(changed,{mode:'adjust'},review),/objetivo ha cambiado/);
 assert.equal(buildPlanPreview(state,{},review).continuity.mode,'adjust');
 const withPause=buildPlanPreview(changed,{returnAfterBreak:true},review);assert.equal(withPause.continuity.mode,'goal_change');assert.equal(withPause.continuity.loadRestart,true);assert.equal(withPause.plan.basis.profile.weeklyKm,18);
 assert(withPause.plan.sessions.filter(s=>s.date>=review&&s.date<'2026-11-23').every(s=>!['tempo','interval','hills','progressive'].includes(s.type)));
 assert.throws(()=>buildPlanPreview(state,{mode:'goal_change'},review),/nuevo objetivo/);
});
test('review during taper keeps its dates, phase guidance and progressive reductions, including a pause near the race',()=>{
 const date='2027-01-18',state=fixture(date),preview=buildPlanPreview(state,{completeHistory:true},date);
 assert.deepEqual(phaseDates(preview.plan),phaseDates(state.plan));assert.equal(preview.continuity.mode,'adjust');
 const sessions=preview.plan.sessions.filter(s=>s.date>=date&&running(s));assert(sessions.every(s=>s.phase.key==='taper'&&!s.hard));
 assert(sessions.some(s=>s.phase.loadFactor===.7));assert(sessions.some(s=>s.phase.loadFactor===.45));
 const accepted=acceptPlanPreview(state,preview,date);assert.equal(raceCoaching(accepted,date).phase.key,'taper');assert.match(raceCoachAnswer(accepted,date),/llegar con frescura/);
 const paused=buildPlanPreview(fixture(addDays(date,-18)),{completeHistory:true},date);
 assert.equal(paused.continuity.mode,'resume');assert.equal(paused.plan.end,race);assert(paused.plan.sessions.filter(s=>s.date>=date&&running(s)).every(s=>s.phase.key==='taper'));
});
test('completed sessions, strength, groups, notes and an already recorded race remain immutable',()=>{
 const state=fixture(review),future=state.plan.sessions.find(s=>s.date>review&&running(s));state.activities.push(own(future));
 const strength=session(state.profile,'strength',addDays(review,2),0,25,5);state.plan.sessions.push(strength);state.sessionCompletions=[{id:'strength-done',sessionId:strength.id,date:strength.date,minutes:22,rpe:4}];
 const event=state.plan.sessions.find(s=>s.type==='race');state.activities.push({...own(event),id:'race-done'});
 const part=state.activities[0];state.activities[0]={...part,groupId:'group',linkMode:'manual',distance:part.distance*.8,seconds:Math.round(part.seconds*.8)};state.activities.push({...part,id:'cooldown',groupId:'group',linkMode:'manual',distance:part.distance*.2,seconds:part.seconds-Math.round(part.seconds*.8)});
 const records=structuredClone(state.activities),completions=structuredClone(state.sessionCompletions),preview=buildPlanPreview(state,{completeHistory:true},review),accepted=acceptPlanPreview(state,preview,review);
 for(const old of [future,strength,event])assert.deepEqual(accepted.plan.sessions.find(s=>s.id===old.id),old);
 assert.deepEqual(accepted.activities,records);assert.deepEqual(accepted.sessionCompletions,completions);
});
test('legacy calendars and the engine regeneration entry retain their saved phase clock and completed associations',()=>{
 const state=fixture(review);delete state.plan.continuity;
 const preview=buildPlanPreview(state,{},review),regenerated=regeneratePlan(state,review);
 assert.equal(preview.plan.schedule.start,origin);assert.equal(regenerated.schedule.start,origin);
 assert.deepEqual(phaseDates(regenerated),phaseDates(state.plan));assert.equal(regenerated.sessions.find(s=>s.date===review).phase.key,'build');
 for(const s of state.plan.sessions.filter(s=>s.date<review))assert.deepEqual(regenerated.sessions.find(v=>v.id===s.id),s);
 const noSchedule={...state,plan:{...state.plan,schedule:undefined,created:review}};assert.equal(buildPlanPreview(noSchedule,{},review).plan.schedule.start,origin);
 assert.equal(preparationContinuity(state,review).mode,'adjust');
});
test('current fatigue or relevant pain can lower load without resetting the event clock or claiming readiness',()=>{
 const state=fixture(review),tired=buildPlanPreview({...state,checkIns:[{date:review,fatigue:8,pain:'none'}]},{completeHistory:true},review),pain=buildPlanPreview({...state,profile:{...state.profile,pain:'relevant'}},{completeHistory:true},review);
 assert.deepEqual(phaseDates(tired.plan),phaseDates(state.plan));assert.deepEqual(phaseDates(pain.plan),phaseDates(state.plan));
 assert(tired.plan.sessions.filter(s=>s.date>=review&&s.type!=='race').every(s=>!['tempo','interval','hills','progressive'].includes(s.type)));
 assert(pain.plan.sessions.filter(s=>s.date>=review&&s.type!=='race').every(s=>s.type==='rest'));
 assert(tired.comparison[0].after.km<weekKm(state.plan,review));
 const noSensations={...state,activities:state.activities.map(a=>({...a,fatigue:null,pain:'unknown'}))};
 assert.equal(buildPlanPreview(noSensations,{completeHistory:true},review).continuity.load.growthAllowed,false);
 const lastId=state.activities.at(-1).id,withSymptoms={...state,activities:state.activities.map(a=>a.id===lastId?{...a,pain:'mild',fatigue:8}:a)};
 const symptoms=buildPlanPreview(withSymptoms,{completeHistory:true},review);
 assert.deepEqual(phaseDates(symptoms.plan),phaseDates(state.plan));assert.equal(symptoms.continuity.load.growthAllowed,false);
 assert(symptoms.plan.sessions.filter(s=>s.date>=review&&s.type!=='race').every(s=>!['tempo','interval','hills','progressive'].includes(s.type)));
 assert(symptoms.comparison[0].reasons.some(r=>r.includes('molestias o fatiga')));
});
test('revision inside a deload preserves its remaining days; repeating it on the same day does not change the next week',()=>{
 const date='2026-11-25',state=fixture(date),preview=buildPlanPreview(state,{completeHistory:true},date),accepted=acceptPlanPreview(state,preview,date),again=buildPlanPreview(accepted,{completeHistory:true},date);
 const restOfWeek=p=>p.sessions.filter(s=>s.date>=date&&s.date<'2026-11-30'&&running(s));
 assert(restOfWeek(preview.plan).every(s=>s.phase.key==='deload'));assert(restOfWeek(again.plan).every(s=>s.phase.key==='deload'));
 assert.equal(weekKm(preview.plan,'2026-11-30'),weekKm(again.plan,'2026-11-30'));
 assert.equal(again.plan.schedule.specificStart,'2026-12-11');assert.equal(again.plan.schedule.deloadOrigin,origin);
});
test('same-day revisions do not compound load, and an uncompleted deload still limits the measured baseline',()=>{
 const state=fixture(review),first=buildPlanPreview(state,{completeHistory:true},review),accepted=acceptPlanPreview(state,first,review),again=buildPlanPreview(accepted,{completeHistory:true},review);
 assert.equal(weekKm(first.plan,review),weekKm(again.plan,review));assert.equal(weekKm(first.plan,'2026-11-23'),weekKm(again.plan,'2026-11-23'));
 assert.deepEqual(first.comparison.map(w=>w.after),again.comparison.map(w=>w.after));
 const date='2026-11-30',completed=fixture(date),missing={...completed,activities:completed.activities.filter(a=>a.date<'2026-11-23')};
 const recorded=buildPlanPreview(completed,{completeHistory:true},date),omitted=buildPlanPreview(missing,{completeHistory:true},date);
 assert(recorded.continuity.load.recoveryWeeks.includes('2026-11-23'));
 assert(!omitted.continuity.load.recoveryWeeks.includes('2026-11-23'));assert.equal(omitted.continuity.load.referenceWeeklyKm,0);assert.equal(omitted.continuity.load.growthAllowed,false);
 assert.deepEqual(phaseDates(omitted.plan),phaseDates(completed.plan));
});
test('a time preference alone preserves the current race clock; a completed block starts a new preparation',()=>{
 const state=fixture(review),time={...state,profile:{...state.profile,goal:{...state.profile.goal,time:'1:45:00'}}};
 assert.deepEqual(phaseDates(buildPlanPreview(time,{},review).plan),phaseDates(state.plan));
 const afterRace={...state,profile:{...state.profile,goal:{...state.profile.goal,date:'2027-05-03'}}};
 assert.equal(buildPlanPreview(afterRace,{},'2027-02-01').continuity.mode,'new');
});
test('cycling, strength and provider records do not hide a confirmed running pause',()=>{
 const state=fixture(addDays(review,-18));
 state.activities.push(...['cycling','strength','crossfit','other'].map((type,i)=>({id:'other-'+i,type,date:addDays(review,-1),distance:20,seconds:3600,pain:'none',rpe:3,fatigue:2})));
 state.activities.push({id:'provider',type:'easy',source:'strava',date:addDays(review,-1),distance:5,seconds:1800});
 const unknown=buildPlanPreview(state,{},review),confirmed=buildPlanPreview(state,{completeHistory:true},review);
 assert.equal(unknown.continuity.mode,'adjust');assert(unknown.historyQuestion);
 assert.equal(confirmed.continuity.mode,'resume');assert.equal(confirmed.continuity.lastRun,'2026-10-21');
 assert.deepEqual(confirmed.plan.sessions.filter(s=>s.date<review),state.plan.sessions.filter(s=>s.date<review));
});
test('server revalidation persists a continuous revision and rejects a stale coverage choice without touching records',async()=>{
 const RealDate=globalThis.Date;
 class ReviewDate extends RealDate {constructor(...args){super(...(args.length?args:['2026-11-09T12:00:00Z']));}static now(){return new RealDate('2026-11-09T12:00:00Z').getTime();}}
 globalThis.Date=ReviewDate;
 try{
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0000_cool_true_believers.sql',import.meta.url),'utf8'));
  const state=fixture(review);sqlite.prepare('INSERT INTO runner_state (user_id,data,revision,updated_at) VALUES (?,?,1,?)').run('isolated',JSON.stringify(state),'');
  const db={prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}};}};
  const preview=buildPlanPreview(state,{completeHistory:true},review,{revision:1}),accepted=acceptPlanPreview(state,preview,review,1);
  assert.equal((await writeState(db,'isolated',accepted,1)).status,200);const stored=await readState(db,'isolated');
  assert.equal(stored.state.plan.schedule.start,origin);assert.equal(stored.state.plan.schedule.specificStart,'2026-12-11');assert.deepEqual(stored.state.activities,state.activities);
  const pending=buildPlanPreview(stored.state,{completeHistory:false},review,{revision:2}),oldAcceptance=acceptPlanPreview(stored.state,pending,review,2);
  const changed={...stored.state,activities:stored.state.activities.slice(1)};await writeState(db,'isolated',changed,2);const before=await readState(db,'isolated');
  assert.equal((await writeState(db,'isolated',{...changed,plan:oldAcceptance.plan,changes:oldAcceptance.changes},3)).code,'stale_plan_preview');assert.deepEqual(await readState(db,'isolated'),before);
 }finally{globalThis.Date=RealDate;}
});
