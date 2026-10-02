import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,generate,metrics,feasibility,profileErrors,validatePlan,progressEvidence} from '../lib/engine.mjs';
import {profileReport,profileWarnings} from '../lib/profile-report.mjs';
import {runnerContext} from '../lib/runner-context.mjs';
const start='2026-10-05';
const runner=over=>({...blankProfile(),experience:'regular',weeklyKm:28,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:3,consistentWeeks:12,consistency:'continuous',longest:7,longestDate:'2026-09-28',longestResult:'comfortable',longestSource:'measured',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',days:[2,4,0],longDay:0,minutes:{2:60,4:60,0:100},marks:[{id:'m',date:'2026-09-20',distance:5,time:'25:00',effort:'race',context:'competition',measurement:'measured',terrain:'asphalt'}],goal:{type:'race',intent:'improve',distance:10,date:'2026-12-20',time:'',flexibility:'any',terrain:'asphalt'},...over});
const training=plan=>plan.sessions.filter(s=>!['race','rest','strength'].includes(s.type));
test('priority changes workout decisions without altering measured pace reference',()=>{
 const p=runner(),improve=generate(p,start),finish=generate({...p,goal:{...p.goal,intent:'finish'}},start),nonstop=generate({...p,goal:{...p.goal,intent:'nonstop'}},start);
 assert(improve.qualitySummary.count>0);assert.equal(finish.qualitySummary.count,0);assert.equal(nonstop.qualitySummary.count,0);assert.deepEqual(metrics(p,start).ranges,metrics({...p,goal:{...p.goal,intent:'finish'}},start).ranges);
});
test('estimated or variable volume and pauses reduce initial load and postpone quality',()=>{
 const p=runner(),baseline=generate(p,start);
 for(const over of [{weeklySource:'estimated'},{weeklyTrend:'variable'},{weeklyTrend:'decreasing'},{weeklyTrend:'increasing'},{pauseWeeks:4}]){const plan=generate({...p,...over},start);assert(plan.racePreparation.initialWeeklyKm<baseline.racePreparation.initialWeeklyKm);assert.equal(plan.qualitySummary.count,0);assert.deepEqual(validatePlan(plan,{...p,...over}),[]);}
});
test('long-run date, provenance and result change the starting long-run limit',()=>{
 const p=runner(),firstLong=profile=>generate(profile,start).sessions.find(s=>s.type==='long').distance,baseline=firstLong(p);
 for(const over of [{longestResult:'hard'},{longestResult:'pain'},{longestSource:'estimated'},{longestDate:'2026-06-01'}])assert(firstLong({...p,...over})<baseline,JSON.stringify(over));
 assert.equal(generate({...p,longestResult:'pain'},start).qualitySummary.count,0);
});
test('comfortable pace must agree with effort and conversation; estimates have wider ranges',()=>{
 const p=runner({marks:[]}),numeric=metrics(p,start);
 for(const over of [{easyEffort:6},{easyConversation:'short'},{easyConversation:'no'}]){const changed={...p,...over};assert.equal(metrics(changed,start).source,'effort');assert(training(generate(changed,start)).every(s=>s.distance===null));assert(profileWarnings(changed,start).some(v=>v.includes('no coinciden')));}
 const estimated=metrics({...p,easySource:'estimated'},start);assert(estimated.ranges.easy[1]-estimated.ranges.easy[0]>numeric.ranges.easy[1]-numeric.ranges.easy[0]);
 const marked=runner(),a=metrics(marked,start),b=metrics({...marked,easySource:'estimated'},start);assert(b.ranges.easy[1]-b.ranges.easy[0]>a.ranges.easy[1]-a.ranges.easy[0]);
 const withoutPace=runner({marks:[],easyPace:''});assert(generate(withoutPace,start).qualitySummary.count>0);assert.equal(generate({...withoutPace,easyConversation:'no'},start).qualitySummary.count,0);
});
test('measured competitive or maximal-test marks calibrate pace; incomplete and estimated marks remain stored',()=>{
 const p=runner();assert.equal(metrics(p,start).source,'recent-mark');
 for(const over of [{measurement:'estimated'},{measurement:'unknown'},{context:'training'},{context:'unknown'},{date:''},{time:''},{distance:''}]){const changed={...p,easyPace:'',marks:[{...p.marks[0],...over}]};assert.equal(metrics(changed,start).source,'effort');assert.deepEqual(profileErrors(changed,start),[]);assert.deepEqual(changed.marks[0],{...p.marks[0],...over});}
 assert.equal(metrics({...p,marks:[{...p.marks[0],context:'test'}]},start).source,'recent-mark');
 assert(profileErrors({...p,marks:[{...p.marks[0],date:'2026-02-31'}]},start).length>0);
});
test('flexibility filters proposed alternatives and never silently changes the goal',()=>{
 const p=runner({weeklyKm:6,longest:3,experience:'beginner'});p.goal={...p.goal,distance:42.2,date:'2026-11-01',time:'3:00:00'};
 const original=structuredClone(p),all=feasibility(p,start);assert(all.alternatives.length>=2);
 for(const [flexibility,kinds] of [['date',['date']],['distance',['distance']],['time',['time','finish']],['fixed',[]]]){const changed={...p,goal:{...p.goal,flexibility}},v=feasibility(changed,start);assert(v.alternatives.every(a=>kinds.includes(a.kind)));if(flexibility==='fixed')assert.equal(v.alternatives.length,0);}
 assert.deepEqual(p,original);
});
test('unknown time is provisional, while explicit restrictions and other sports change the calendar',()=>{
 const p=runner(),unknown={...p,minutes:{2:'',4:60,0:100}};assert.deepEqual(profileErrors(unknown,start),[]);assert(generate(unknown,start).sessions.filter(s=>new Date(s.date).getUTCDay()===2&&s.type!=='race').every(s=>s.seconds<=1200));assert.equal(unknown.minutes[2],'');
 const limit={...p,runningRestriction:'time-limit',restrictionMinutes:25},limited=generate(limit,start);assert(training(limited).every(s=>s.seconds<=1500));assert.equal(limited.qualitySummary.count,0);
 for(const over of [{runningRestriction:'no-running'},{runningRestriction:'time-limit',restrictionMinutes:''},{runningRestriction:'time-limit',restrictionMinutes:10}]){const plan=generate({...p,...over},start);assert(plan.sessions.filter(s=>s.type!=='race').every(s=>s.type==='rest'));assert.equal(plan.sessions.find(s=>s.type==='race').range,null);}
 const sport={...p,otherSports:[{id:'s',type:'crossfit',day:2,minutes:'',intensity:'unknown'}]};assert.deepEqual(profileErrors(sport,start),[]);assert(!training(generate(sport,start)).some(s=>new Date(s.date).getUTCDay()===2));
});
test('summary separates measured, estimated and absent data and exposes nonblocking inconsistencies',()=>{
 const p=runner({weeklySource:'estimated',longest:'',recentFrequency:0}),report=profileReport(p,start);assert(report.estimated.some(v=>v.includes('Volumen')));assert(report.reliable.some(v=>v.includes('Ritmo')));assert(report.missing.some(v=>v.includes('Tirada')));assert(report.warnings.some(v=>v.includes('cero días')));assert.deepEqual(profileErrors(p,start),[]);assert.equal(runnerContext(p,start).frequency,0);
 const unknown=profileReport(blankProfile(),start);assert(unknown.rows.find(r=>r.key==='base').text.includes('No lo sé'));assert(!unknown.rows.find(r=>r.key==='base').text.includes('0 km'));
});
test('unknown goal distance or date produces a provisional plan without inventing a race distance',()=>{
 const p=runner({goal:{type:'race',intent:'unknown',distance:'',date:'',time:'',flexibility:'unknown'}});assert.deepEqual(profileErrors(p,start),[]);
 const general=generate(p,start);assert(!general.sessions.some(s=>s.type==='race'));assert.equal(general.racePreparation.distance,null);assert.equal(general.qualitySummary.count,0);
 const dated={...p,goal:{...p.goal,date:'2026-12-20'}},plan=generate(dated,start),event=plan.sessions.find(s=>s.type==='race');assert.equal(event.distance,null);assert.equal(event.range,null);assert(event.durationUnknown);assert(event.blocks[0].label.includes('distancia sin confirmar'));assert.deepEqual(validatePlan(plan,dated),[]);
 const undecided={...runner(),goal:{type:'unknown',intent:'unknown',distance:'',date:'',time:''}};assert.deepEqual(profileErrors(undecided,start),[]);assert.equal(generate(undecided,start).qualitySummary.count,0);assert(profileReport(undecided,start).rows[0].text.includes('Objetivo: No lo sé'));
});
test('all available days consumed by sport yield an explicit pause instead of preventing saving',()=>{
 const p=runner({days:[2],trainingDays:1,longDay:2,minutes:{2:''},otherSports:[{id:'s',type:'crossfit',day:2,minutes:'',intensity:'unknown'}]}),plan=generate(p,start);assert(plan.context.paused);assert(plan.sessions.filter(s=>s.type!=='race').every(s=>s.type==='rest'));assert.equal(plan.sessions.find(s=>s.type==='race').range,null);assert.deepEqual(validatePlan(plan,p),[]);
});
test('new restrictions and uncertain base also prevent a proposed increase against an old calendar',()=>{
 const p=runner(),plan=generate(p,start),a={date:'2026-10-12',performance:'better'};
 for(const over of [{runningRestriction:'no-running'},{runningRestriction:'time-limit',restrictionMinutes:20},{weeklySource:'estimated'},{pauseWeeks:4},{longestResult:'pain'}])assert.equal(progressEvidence(a,plan,{...p,...over}).eligible,false);
});
