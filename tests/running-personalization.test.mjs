import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,empty,generate,session,metrics,feasibility,validatePlan,validateActivity,profileErrors,day,addDays,daysBetween,monday,seconds,today,reduceSession,moveSession,recordActivity} from '../lib/engine.mjs';
import {runningMinutes,nearHardSport} from '../lib/runner-context.mjs';
import {recentTraining,buildPlanPreview,acceptPlanPreview,missedTraining,confirmMissedSessions,sessionStatus,weekSummary,wellnessProposal} from '../lib/training.mjs';
import {manualContext,aiProposal} from '../lib/ai-coach.mjs';
import {raceCoaching} from '../lib/race-coach.mjs';
const start='2026-10-01',race=addDays(start,49);
const runner=(over={})=>({...blankProfile(),experience:'regular',weeklyKm:24,longest:8,recentFrequency:3,consistentWeeks:12,consistency:'continuous',fatigue:3,recovery:'good',days:[2,4,0],trainingDays:3,longDay:0,minutes:{2:55,4:45,0:90},marks:[{id:'mark',date:'2026-09-20',distance:5,time:'25:00',effort:'race',terrain:'asphalt',elevation:0}],goal:{type:'race',intent:'improve',distance:10,date:race,time:'',terrain:'asphalt',elevation:0},...over});
const training=s=>!['rest','strength','race'].includes(s.type);
function totals(plan,p){
 assert.deepEqual(validatePlan(plan,p),[]);
 for(const s of plan.sessions){assert.equal(s.seconds,s.blocks.reduce((n,b)=>n+b.seconds,0));if(s.distance!=null)assert(Math.abs(s.distance-s.blocks.reduce((n,b)=>n+b.distance,0))<.001);if(s.type!=='race'){assert(s.seconds<=runningMinutes(p,day(s.date))*60);assert(p.days.includes(day(s.date)));}}
}
test('beginner with race in exactly seven weeks uses the available 49 days, not a compressed long-distance preparation',()=>{
 const p=runner({experience:'beginner',weeklyKm:0,longest:'',recentFrequency:0,consistentWeeks:0,marks:[],days:[1,3,6],longDay:6,minutes:{1:25,3:25,6:30},goal:{type:'race',distance:10,date:race,intent:'finish',terrain:'asphalt',elevation:''}}),plan=generate(p,start);
 assert.equal(plan.end,race);assert.equal(plan.racePreparation.totalDays,49);assert.equal(plan.racePreparation.totalWeeks,7);
 assert.equal(plan.sessions.filter(s=>s.type==='race').length,1);assert(plan.viability.cautious);assert(plan.viability.alternatives.some(a=>a.kind==='distance'));
 assert(plan.sessions.filter(training).every(s=>s.type==='walk'&&s.distance===null&&s.rpe===3));assert(plan.sessions.filter(s=>s.date<addDays(start,14)).every(s=>s.type==='walk'&&s.seconds<=25*60));
 const runs=plan.sessions.filter(training);assert(runs.every((s,i)=>!i||daysBetween(runs[i-1].date,s.date)>=2));assert.equal(plan.context.count,3);
 assert(plan.sessions.some(s=>s.phase?.key==='deload'));assert(plan.sessions.some(s=>s.phase?.key==='taper'));totals(plan,p);
});
test('experienced runner improving a mark has a different seven-week structure and bounded progression',()=>{
 const p=runner(),plan=generate(p,start);assert.equal(plan.viability.cautious,false);assert(plan.sessions.some(s=>s.type==='tempo'));assert(plan.sessions.some(s=>s.type==='interval'));
 assert(plan.sessions.some(s=>s.phase?.key==='specific'));assert(plan.sessions.filter(s=>s.date>=addDays(race,-7)&&s.type!=='race').every(s=>!s.hard));
 const weeks=[...new Set(plan.sessions.map(s=>monday(s.date)))].map(d=>weekSummary({plan,activities:[]},d));assert(weeks.every(w=>w.quality<=1));
 const peak=Math.max(...weeks.map(w=>w.plannedKm));assert(peak<=p.weeklyKm+8);assert(Math.max(...plan.sessions.filter(s=>s.type==='long').map(s=>s.distance))<=p.longest+3.5);
 const hard=plan.sessions.filter(s=>s.hard);assert(hard.every((s,i)=>!i||daysBetween(hard[i-1].date,s.date)>=2));totals(plan,p);
});
test('incomplete history never invents 7 min/km, distances or threshold paces',()=>{
 const p=runner({marks:[],easyPace:'',weeklyKm:18,longest:'',consistentWeeks:'',recentFrequency:''}),plan=generate(p,start);
 assert(plan.sessions.filter(training).every(s=>s.distance===null&&s.seconds>0&&s.blocks.every(b=>b.targetPace===null)));
 const easyOnly=metrics({...p,easyPace:'6:30'},start);assert(easyOnly.ranges.easy);assert.equal(easyOnly.ranges.interval,undefined);assert.equal(easyOnly.ranges.tempo,undefined);
 const preview=buildPlanPreview({...empty(),profile:p,activities:[]},{},start);assert.equal(preview.plan.basis.source,'profile');assert(preview.reasons.some(r=>/provisional/.test(r)));totals(plan,p);
});
test('explicit controlled/easy/unknown marks, old marks, hills and pauses cannot become a maximum performance',()=>{
 const base=runner();for(const mark of [{...base.marks[0],effort:'controlled'},{...base.marks[0],effort:'easy'},{...base.marks[0],effort:'unknown'},{...base.marks[0],date:'2025-09-20'},{...base.marks[0],terrain:'trail'},{...base.marks[0],elevation:300},{...base.marks[0],elapsedTime:'30:00'}])assert.equal(metrics({...base,marks:[mark]},start).mark,undefined);
 assert.equal(metrics(base,start).source,'recent-mark');assert.equal(seconds('1:30:00'),5400);
 const trail=generate({...base,terrain:'trail',goal:{...base.goal,terrain:'trail',elevation:600,time:'50:00'}},start);assert(trail.viability.cautious);assert(trail.sessions.every(s=>s.range===null));assert.equal(trail.sessions.find(s=>s.type==='race').durationUnknown,true);
 assert(profileErrors({...base,marks:[{...base.marks[0],elapsedTime:'20:00'}]},start).length);
});
test('strength and CrossFit reserve recovery, other sports consume time but never running kilometres',()=>{
 const p=runner({days:[1,2,3,4,5,6,0],minutes:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,60])),trainingDays:4,recentFrequency:4,longDay:0,strength:true,strengthDay:3,otherSports:[{id:'cf',type:'crossfit',day:5,minutes:45,intensity:'hard'},{id:'bike',type:'cycling',day:1,minutes:40,intensity:'easy'}]}),plan=generate(p,start);
 assert(plan.sessions.some(s=>s.type==='strength'));assert(plan.sessions.filter(training).every(s=>![3,5].includes(day(s.date))));assert(plan.sessions.filter(s=>s.hard&&s.type!=='race').every(s=>!nearHardSport(p,day(s.date))));
 assert(plan.sessions.filter(s=>day(s.date)===1).every(s=>s.seconds<=20*60));totals(plan,p);
 const own=recentTraining({profile:p,activities:[{date:'2026-09-25',distance:80,seconds:7200,type:'cycling'},{date:'2026-09-26',distance:5,seconds:1800,type:'easy'}]},start);assert.equal(own.count,1);assert.equal(own.longest,5);
});
test('current frequency constrains availability and a stale 30 km baseline with zero runs starts again',()=>{
 const p=runner({recentFrequency:1,consistentWeeks:2,trainingDays:3}),plan=generate(p,start);assert.equal(plan.context.count,1);assert.equal(plan.qualitySummary.count,0);
 const stopped=generate({...p,recentFrequency:0,weeklyKm:30},start);assert.equal(stopped.racePreparation.initialWeeklyKm,0);assert(stopped.sessions.filter(training).every(s=>s.type==='walk'));
});
test('unrealistic marathon and target time give concrete alternatives without driving training paces',()=>{
 const p=runner({experience:'beginner',weeklyKm:6,longest:3,marks:[],goal:{type:'race',distance:42.2,date:race,time:'3:00:00',intent:'time'}}),plan=generate(p,start);
 assert(plan.viability.cautious);assert(plan.viability.alternatives.some(a=>a.kind==='date'));assert(plan.viability.alternatives.some(a=>a.kind==='distance'));assert(plan.sessions.filter(training).every(s=>!s.hard));
 const a=runner(),b={...a,goal:{...a.goal,time:'35:00',intent:'time'}};assert(feasibility(b,start).cautious);assert.deepEqual(metrics(a,start).ranges,metrics(b,start).ranges);assert(feasibility(b,start).alternatives.some(v=>v.kind==='finish'));
});
test('own history uses complete weeks, robust comparison, elevation, pauses and valid HR as context',()=>{
 const p=runner(),activities=[];for(let w=0;w<4;w++)for(const offset of [1,3,5])activities.push({id:`${w}-${offset}`,date:addDays(monday(start),-28+w*7+offset),type:'easy',distance:5,seconds:2000,rpe:3,fatigue:2,pain:'none',terrain:'asphalt',temperature:18,avgHR:140});
 activities.unshift({id:'tiny',date:'2026-09-28',type:'easy',distance:.2,seconds:90,rpe:3,fatigue:2,pain:'none',terrain:'asphalt'});
 activities.push({id:'hill',date:'2026-09-27',type:'easy',distance:5,seconds:2500,elevation:400,rpe:3,fatigue:2,pain:'none',terrain:'asphalt'},{id:'paused',date:'2026-09-26',type:'easy',distance:5,seconds:2000,elapsedSeconds:2800,rpe:3,fatigue:2,pain:'none',terrain:'asphalt'},{id:'provider',source:'strava',date:'2026-09-26',distance:100,seconds:10000,type:'race'});
 const state={...empty(),profile:p,activities},evidence=recentTraining(state,start);assert.equal(evidence.easyCount,12);assert.equal(evidence.easyPace,400);assert.equal(evidence.quality.observedEasyHR,140);assert(evidence.quality.excludedEasy>=3);assert.equal(evidence.longest,5);
 assert.throws(()=>buildPlanPreview(state,{useHistory:true},start),/Confirma/);const preview=buildPlanPreview(state,{useHistory:true,completeHistory:true},start);assert(preview.plan.basis.profile.weeklyKm<=p.weeklyKm);assert.equal(preview.plan.basis.profile.longest,5);assert.equal(preview.plan.basis.profile.easyPace,'6:40');
 const context=JSON.stringify(manualContext({...state,strava:{accessToken:'SECRET'}} ,start));assert(!context.includes('SECRET'));assert(!context.includes('provider'));assert(!context.includes('threshold'));
});
test('missing records require confirmation; omitted sessions soften the future without stacking or losing the past',()=>{
 const p=runner(),old=generate(p,addDays(start,-14)),state={...empty(),profile:p,plan:old},report=missedTraining(state,start);
 assert.equal(report.confirmed,0);assert(report.unconfirmed.length>=2);const original=buildPlanPreview(state,{},start);
 const confirmed=confirmMissedSessions(state,report.unconfirmed.slice(0,2).map(s=>s.id),start),preview=buildPlanPreview(confirmed,{},start);
 assert.equal(missedTraining(confirmed,start).confirmed,2);assert(preview.plan.racePreparation.initialWeeklyKm<original.plan.racePreparation.initialWeeklyKm);
 assert(preview.plan.sessions.filter(s=>s.date>=start&&s.date<addDays(start,14)).every(s=>!['interval','tempo','hills','progressive'].includes(s.type)));
 for(const past of confirmed.plan.sessions.filter(s=>s.date<start))assert.deepEqual(preview.plan.sessions.find(s=>s.id===past.id),past);
 assert.equal(new Set(preview.plan.sessions.map(s=>s.date)).size,preview.plan.sessions.length);assert.throws(()=>confirmMissedSessions(state,['missing'],start));
});
test('fatigue, injury and recovery change the plan and duration reductions cannot accidentally last longer',()=>{
 for(const change of [{fatigue:8},{recovery:'poor'},{recentInjury:true},{consistency:'returning'}]){const p=runner(change),plan=generate(p,start);assert.equal(plan.qualitySummary.count,0);assert(plan.racePreparation.initialWeeklyKm<24);}
 const p=runner({easyPace:'8:00'}),before=session(p,'interval',addDays(today(),(7-day(today()))%7||7),4,0,2),after=reduceSession(p,before,.3);assert(after.seconds<=Math.floor(before.seconds*.7));assert.equal(after.hard,false);assert.equal(after.seconds,after.blocks.reduce((n,b)=>n+b.seconds,0));
 const unknown=runner({marks:[],easyPace:''}),timed=session(unknown,'tempo',addDays(today(),(7-day(today()))%7||7),0,25,2),reduced=reduceSession(unknown,timed,.3);assert.equal(reduced.distance,null);assert.equal(reduced.seconds,1050);
 const walking=session(unknown,'walk',timed.date,0,25,2),shortWalk=reduceSession(unknown,walking,.3);assert.equal(shortWalk.type,'walk');assert(shortWalk.seconds<=walking.seconds*.7);assert(shortWalk.blocks.some(b=>b.kind==='recovery'));assert(shortWalk.blocks.filter(b=>b.effort===3).every(b=>b.seconds===shortWalk.repetitions.workSeconds));
 const now=runner({goal:{...p.goal,date:addDays(today(),49)}}),state={...empty(),profile:now,plan:generate(now)},check={date:today(),fatigue:8,pain:'none',sleep:''};const proposal=wellnessProposal(state,check);assert(proposal.proposal.changes.every(c=>c.after.seconds<=c.before.seconds*.7&&!c.after.hard));
});
test('AI explanations receive only useful structured context and never nested credentials or free personal notes',()=>{
 const p=runner({name:'Private name',email:'private@test',injuries:'PRIVATE_NOTE',otherSports:[{id:'secret-id',type:'crossfit',day:1,minutes:30,intensity:'hard',token:'NESTED_SECRET'}]}),state={...empty(),profile:{...p,goal:{...p.goal,token:'GOAL_SECRET'},marks:[{...p.marks[0],email:'mark@test',token:'MARK_SECRET'}]},checkIns:[{date:start,fatigue:3,pain:'none',notes:'PERSONAL_NOTE'}]};
 const text=JSON.stringify(manualContext(state,start));for(const value of ['Private name','private@test','PRIVATE_NOTE','NESTED_SECRET','GOAL_SECRET','MARK_SECRET','mark@test','PERSONAL_NOTE'])assert(!text.includes(value),value);
 assert(text.includes('crossfit'));assert(text.includes('continuous'));
});
test('date and availability revisions preserve actual records, completed sessions and the original plan history',()=>{
 const p=runner({marks:[{id:'older-mark',date:'2026-09-10',distance:5,time:'25:00',effort:'race'}]}),plan=generate(p,addDays(start,-14)),s=plan.sessions.find(s=>s.date<start&&s.distance),a={id:'done',date:s.date,sessionId:s.id,type:s.type,distance:s.distance,seconds:s.seconds,rpe:3,fatigue:2,pain:'none'};
 const state={...empty(),profile:{...p,goal:{...p.goal,date:addDays(race,-7)},minutes:{2:20,4:20,0:35}},plan,activities:[a]},preview=buildPlanPreview(state,{},start),accepted=acceptPlanPreview(state,preview,start);
 assert.deepEqual(accepted.activities,[a]);assert.deepEqual(accepted.plan.sessions.find(v=>v.id===s.id),s);assert.equal(accepted.plan.end,addDays(race,-7));assert.equal(accepted.plan.sessions.filter(v=>v.date>=start&&v.type==='race').length,1);assert.equal(accepted.changes[0].before,plan);
 assert.equal(raceCoaching(accepted,start).phase.key,'base','the current phase starts at the revision, although historical sessions remain');
 assert(accepted.plan.sessions.filter(v=>v.date>=start&&v.type!=='race').every(v=>v.seconds<=state.profile.minutes[day(v.date)]*60));
});
test('a provisional old reference or excessive goal never assigns a competitive race pace',()=>{
 const p=runner({marks:[{date:'2026-06-01',distance:5,time:'25:00',effort:'race'}],goal:{type:'race',intent:'time',distance:10,date:race,time:'50:00'}}),plan=generate(p,start);assert(plan.viability.cautious);assert(metrics(p,start).markAgeDays>90);assert.equal(plan.sessions.find(s=>s.type==='race').range,null);
 const ambitious=runner({goal:{type:'race',intent:'time',distance:10,date:race,time:'35:00'}});assert.equal(generate(ambitious,start).sessions.find(s=>s.type==='race').durationUnknown,true);
});
test('faster effort, high fatigue or pain cannot be labelled completed as prescribed',()=>{
 const p=runner(),s=session(p,'easy',start,5,0,0),a={sessionId:s.id,type:'easy',date:start,distance:s.distance,seconds:Math.round(s.seconds*.9),rpe:6,fatigue:2,pain:'none'};
 assert.equal(sessionStatus(s,{activities:[a]}),'changed');assert.equal(sessionStatus(s,{activities:[{...a,rpe:3,fatigue:8}]}),'changed');assert.equal(sessionStatus(s,{activities:[{...a,rpe:3,pain:'mild'}]}),'changed');
});
test('math validation detects mismatched totals; time units, elapsed duration, DST and estimated HR stay explicit',()=>{
 const p=runner({restHR:55,maxHR:185,hrSource:'estimated'}),plan=generate(p,start);assert(plan.sessions.every(s=>s.hr===null));
 const broken=structuredClone(plan);broken.sessions[0].seconds++;assert(validatePlan(broken,p).some(e=>/Duración/.test(e)));
 assert.equal(daysBetween('2026-10-24','2026-10-26'),2);assert.equal(addDays('2026-10-24',7),'2026-10-31');
 assert(validateActivity({date:today(),distance:5,seconds:1800,elapsedSeconds:1700,rpe:3}).length);assert.throws(()=>feasibility({...p,goal:{...p.goal,date:'2027-02-31'}},start),/real/);
});
test('Strava data cannot be saved as a manual performance and moves honour external sport constraints',()=>{
 const p=runner({goal:{type:'race',distance:10,date:addDays(today(),49)},otherSports:[{id:'cf',type:'crossfit',day:5,minutes:30,intensity:'hard'}]}),plan=generate(p);
 assert.throws(()=>recordActivity({...empty(),profile:p,plan},{source:'strava',id:'provider',date:today(),distance:5,seconds:1500,rpe:8}),/Strava/);
 const s=plan.sessions.find(s=>s.date>today()&&training(s));let friday=addDays(today(),1);while(day(friday)!==5)friday=addDays(friday,1);assert.throws(()=>moveSession(plan,s.id,friday,{...p,days:[...new Set([...p.days,5])],minutes:{...p.minutes,5:60}}),/reservado/);
});
