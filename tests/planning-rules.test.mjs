import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,generate,addDays,monday,daysBetween,validatePlan,trainingPhase,planDiagnostics,metrics,raceEstimate,session,qualityEligibility,progressEvidence} from '../lib/engine.mjs';
import {buildPlanPreview,recentTraining} from '../lib/training.mjs';
const start='2026-10-05';
const runner=(over={})=>({...blankProfile(),experience:'regular',weeklyKm:36,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:16,consistency:'continuous',longest:14,longestDate:'2026-09-27',longestSource:'measured',longestResult:'comfortable',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',pain:'none',recovery:'good',runningRestriction:'none',days:[1,2,4,0],trainingDays:4,longDay:0,minutes:{1:60,2:70,4:70,0:180},marks:[{date:'2026-09-20',distance:5,time:'25:00',effort:'race',context:'competition',measurement:'measured',terrain:'asphalt'}],goal:{type:'race',intent:'improve',distance:21.1,date:addDays(start,112),time:'',flexibility:'any',terrain:'asphalt'},...over});
const runs=plan=>plan.sessions.filter(s=>!['rest','race','strength'].includes(s.type));
const week=(plan,date)=>runs(plan).filter(s=>monday(s.date)===monday(date));
const km=sessions=>sessions.reduce((n,s)=>n+(s.distance||0),0);

test('actual first week never exceeds recent volume or the recent long run, even with excessive availability',()=>{
 for(const volume of [6,18,36,70]){const p=runner({weeklyKm:volume}),plan=generate(p,start);assert(km(week(plan,start))<=volume+.01);assert(week(plan,start).find(s=>s.type==='long').distance<=14);assert.deepEqual(validatePlan(plan,p),[]);}
 const p=runner({minutes:{1:15,2:15,4:15,0:30}}),plan=generate(p,start),values=Array.from({length:6},(_,i)=>km(week(plan,addDays(start,i*7))));
 assert(values[0]<15);assert(values.slice(1).every(v=>v<=values[0]+2));assert.equal(plan.viability.cautious,true);assert(plan.viability.notes.some(n=>n.includes('minutos')));
});
test('phases change with deadline; a ten-day race gets no compressed development or intensity',()=>{
 const p=runner(),long=generate(p,start),short=generate({...p,goal:{...p.goal,date:addDays(start,10)}},start);
 assert(long.schedule.developmentDays>0);assert(long.schedule.specificDays>0);assert.equal(short.schedule.specificDays,0);assert.equal(short.qualitySummary.count,0);
 for(const plan of [long,short])for(const s of runs(plan))assert.equal(s.phase.key,trainingPhase(plan===long?p:{...p,goal:{...p.goal,date:short.end}},s.date,s.week,start).key);
});
test('distance changes endurance development and the taper without requiring the complete race in training',()=>{
 const p=runner({weeklyKm:44,longest:18}),plans=[5,10,21.1,42.2].map(distance=>generate({...p,goal:{...p.goal,distance,date:addDays(start,168)}},start));
 assert.deepEqual(plans.map(p=>p.schedule.taperDays),[7,7,10,14]);assert(plans[3].racePreparation.projectedLongKm>plans[1].racePreparation.projectedLongKm);
 assert(plans[3].racePreparation.projectedLongKm<=32);assert(plans[3].racePreparation.projectedLongKm<42.2);
 for(const plan of plans)assert.equal(plan.sessions.filter(s=>s.type==='race').length,1);
});
test('recovery is short and low effort around demanding sessions; no consecutive demanding workouts',()=>{
 const p=runner(),plan=generate(p,start),recovery=plan.sessions.filter(s=>s.type==='recovery');assert(recovery.length>0);assert(recovery.every(s=>s.rpe===2&&!s.hard));
 const hard=plan.sessions.filter(s=>s.hard);for(let i=1;i<hard.length;i++)assert(daysBetween(hard[i-1].date,hard[i].date)>=2);
 assert.deepEqual(planDiagnostics(plan),[]);
 assert(plan.racePreparation.projectedLongKm>14,'adding recovery must not repeatedly reduce the baseline until endurance development disappears');
});
test('deloads and progressive taper reduce load; recovery is not repaid as a weekly spike',()=>{
 const p=runner(),plan=generate(p,start),normal=runs(plan).filter(s=>s.phase.loadFactor===1),deload=runs(plan).filter(s=>s.phase.key==='deload'),taper=runs(plan).filter(s=>s.phase.key==='taper');
 assert(deload.length>0);assert(taper.some(s=>s.phase.loadFactor===.7));assert(taper.some(s=>s.phase.loadFactor===.45));assert(taper.every(s=>!s.hard));
 assert(Math.max(...taper.map(s=>s.distance))<Math.max(...normal.map(s=>s.distance)));
 const weeks=Array.from({length:14},(_,i)=>week(plan,addDays(start,i*7)));for(let i=1;i<weeks.length;i++)if(weeks[i-1].some(s=>s.phase.key==='deload')&&i>1)assert(km(weeks[i])<=km(weeks[i-2])+2.1);
});
test('only authorized complete history changes the base; the latest drop and a zero are preserved',()=>{
 const p=runner({weeklyKm:50}),activities=[];for(let w=0;w<4;w++)for(const offset of [0,2,5])activities.push({id:`${w}-${offset}`,date:addDays(start,-28+w*7+offset),type:'easy',distance:w===3?3:10,seconds:w===3?1170:3900,rpe:3,pain:'none',fatigue:2,terrain:'asphalt'});
 activities.push({...activities[0],id:'external',source:'strava',distance:100});const state={profile:p,activities,changes:[],proposals:[]};
 assert.equal(recentTraining(state,start).load.km,9);assert.throws(()=>buildPlanPreview(state,{useHistory:true},start),/Confirma/);
 assert.equal(buildPlanPreview(state,{},start).plan.basis.profile.weeklyKm,50);
 const preview=buildPlanPreview(state,{useHistory:true,completeHistory:true},start);assert.equal(preview.plan.basis.profile.weeklyKm,9);assert(km(week(preview.plan,start))<=9);
 const declaredZero=buildPlanPreview({...state,profile:{...p,weeklyKm:0}},{useHistory:true,completeHistory:true},start);assert.equal(declaredZero.plan.basis.profile.weeklyKm,0);
 const noLast={...state,activities:activities.filter(a=>a.date<addDays(start,-7))},paused=buildPlanPreview(noLast,{useHistory:true,completeHistory:true},start);assert.equal(paused.plan.basis.profile.weeklyKm,0);assert(runs(paused.plan).every(s=>s.type==='walk'));
});
test('without a pace, recorded minutes cap the initial week and a concrete comfortable reference is proposed',()=>{
 const p=runner({easyPace:'',marks:[]}),plan=generate(p,start,{recentMinutes:60,longestMinutes:25}),first=week(plan,start);assert(first.reduce((n,s)=>n+s.seconds,0)<=3600);assert(runs(plan).every(s=>s.distance===null));
 assert(plan.referenceSession.sessionId);assert(plan.sessions.some(s=>s.id===plan.referenceSession.sessionId));assert.equal(plan.referenceSession.blocks.reduce((n,b)=>n+b.seconds,0),plan.referenceSession.seconds);assert(plan.reference.includes('No es una contrarreloj'));
 const hr=metrics({...p,restHR:60,maxHR:190,hrSource:'measured'},start);assert.equal(hr.source,'effort');assert.deepEqual(hr.ranges,{});
});
test('unconfirmed historical performances are preserved but never become exact performance paces',()=>{
 const p=runner({easyPace:''}),legacy={date:'2026-09-20',distance:5,time:'25:00'};
 for(const mark of [legacy,{...p.marks[0],context:'unknown'},{...p.marks[0],measurement:'estimated'},{...p.marks[0],terrain:'unknown'},{...p.marks[0],date:'2026-09-31'}]){const changed={...p,marks:[mark]},before=JSON.stringify(changed),m=metrics(changed,start);assert.equal(m.source,'effort');assert.deepEqual(m.ranges,{});generate(changed,start);assert.equal(JSON.stringify(changed),before);}
});
test('short races may be compared; a 5 km performance never fixes an exact marathon race pace',()=>{
 const p=runner(),ten={...p,goal:{...p.goal,distance:10}},marathon={...p,goal:{...p.goal,distance:42.2,date:addDays(start,168),time:'3:30:00'}};
 assert(raceEstimate(ten,start).seconds>3000);assert.equal(raceEstimate(marathon,start).seconds,null);const plan=generate(marathon,start);assert.equal(plan.sessions.find(s=>s.type==='race').range,null);assert(plan.viability.notes.some(n=>n.includes('maratón desde una marca corta')));
 const equivalent={...marathon,marks:[{...p.marks[0],distance:42.2,time:'4:00:00'}]};assert.equal(raceEstimate(equivalent,start).seconds,14400,'the same distance is an observed reference, even outside the extrapolation duration');assert.equal(metrics({...equivalent,easyPace:''},start).source,'effort','that reference is not extrapolated to 5 km outside model limits');
 const comparable={...marathon,marks:[{...p.marks[0],distance:42.2,time:'3:40:00'}]};assert.equal(raceEstimate(comparable,start).seconds,13200);
});
test('interval and specific endurance work change with distance; hills require a terrain reason',()=>{
 const p=runner(),five={...p,goal:{...p.goal,distance:5}},ten={...p,goal:{...p.goal,distance:10}},specific={key:'specific'};
 const short=session(five,'interval',start,8,0,6,specific,start),longer=session(ten,'interval',start,8,0,6,specific,start);assert(short.repetitions.workDistance<longer.repetitions.workDistance);assert(short.range[0]<longer.range[0]);
 const half=generate(p,start);assert(!half.sessions.some(s=>s.type==='interval'));assert(qualityEligibility(p,half).find(r=>r.type==='interval').reason.includes('resistencia sostenida'));
 const flat=generate(ten,start),hilly=generate({...ten,goal:{...ten.goal,elevation:100}},start);assert(!flat.sessions.some(s=>s.type==='hills'));assert(hilly.sessions.some(s=>s.type==='hills'));assert(qualityEligibility(ten,flat).find(r=>r.type==='hills').reason.includes('pendientes'));
});
test('the local planner requires no AI or network and does not depend on a desired time for training paces',()=>{
 const previous=globalThis.fetch;try{globalThis.fetch=()=>{throw Error('Network prohibited');};const p=runner(),plan=generate(p,start),changed=generate({...p,goal:{...p.goal,time:'1:00:00'}},start);assert(plan.sessions.length);assert.deepEqual(runs(plan).map(s=>[s.date,s.type,s.distance,s.range]),runs(changed).map(s=>[s.date,s.type,s.distance,s.range]));}finally{globalThis.fetch=previous;}
});
test('blocked periods do not receive reference workouts and an old calendar cannot validate missing pace evidence',()=>{
 const p=runner({marks:[],easyPace:''}),state={profile:p,activities:[],changes:[],proposals:[],unavailable:[{start,end:addDays(start,30)}]},preview=buildPlanPreview(state,{},start);
 assert(preview.plan.referenceSession.date>state.unavailable[0].end);assert(preview.plan.sessions.find(s=>s.id===preview.plan.referenceSession.sessionId).type!=='rest');
 const old=generate(runner(),start),a={date:addDays(start,7),type:'easy',performance:'better'};assert.equal(progressEvidence(a,old,p).eligible,false);assert(progressEvidence(a,old,p).reason.includes('referencia actual válida'));
});
