import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,empty,metrics,raceEstimate,workoutRange,generate,session,progressEvidence,proposal,decideTrainingProposal,calibrationAssessment,addDays,validatePlan,profileErrors,validateActivity} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview} from '../lib/training.mjs';
import {comfortableObservation,performanceReferences,readableRange} from '../lib/reference-evidence.mjs';
const date='2026-10-05';
const mark=(over={})=>({id:'five',date:'2026-09-14',distance:5,time:'25:00',elapsedTime:'25:00',context:'competition',measurement:'measured',effort:'race',terrain:'asphalt',elevation:0,temperature:16,conditions:'normal',...over});
const runner=(over={})=>({...blankProfile(),experience:'regular',weeklyKm:30,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:3,consistentWeeks:12,consistency:'continuous',recovery:'good',fatigue:2,runningRestriction:'none',longest:12,longestDate:'2026-10-04',longestSource:'measured',longestResult:'comfortable',easyEffort:3,easyConversation:'yes',days:[1,3,6],minutes:{1:90,3:90,6:120},marks:[mark()],goal:{type:'race',date:'2027-01-25',distance:10,time:'',intent:'improve',terrain:'asphalt'},...over});
const coherent=()=>[mark(),mark({id:'ten',date:'2026-09-21',distance:10,time:'52:07',elapsedTime:'52:07'})];
function progressFixture(){
 const p=runner({goal:{type:'routine'}}),past=[-14,-7,0].map(n=>session(p,'easy',addDays(date,n),5,0,0,null,date));
 const future=[2,7].map(n=>session(p,'easy',addDays(date,n),5,0,2,null,date));
 future.push(session(p,'tempo',addDays(date,9),6,0,2,null,date));
 const activities=past.map((s,i)=>({id:'own-'+i,date:s.date,type:'easy',sessionId:s.id,distance:s.distance,seconds:Math.round(s.seconds*.94),elapsedSeconds:Math.round(s.seconds*.94),measurement:'measured',rpe:3,fatigue:2,pain:'none',feeling:'bien',terrain:'asphalt',temperature:16,elevation:0,conversation:'yes'}));
 return {p,plan:{start:addDays(date,-14),created:addDays(date,-14),end:addDays(date,56),sessions:[...past,...future]},activities};
}
test('equivalent references agree across distances and are combined independently of input order',()=>{
 const p=runner({marks:coherent()}),a=metrics(p,date),b=metrics({...p,marks:[...p.marks].reverse()},date);
 assert.equal(a.capacity.references.length,2);assert.equal(a.confidence,'reference');assert(Math.abs(a.basePace-300)<.1);
 assert.equal(a.basePace,b.basePace);assert.deepEqual(a.ranges,b.ranges);assert.equal(a.capacity.kind,'estimate');
 const race=raceEstimate(p,date);assert.equal(race.references.length,2);assert(Math.abs(race.seconds-3127)<1);assert(race.secondsRange[0]<race.seconds&&race.secondsRange[1]>race.seconds);
});
test('contradictory comparable marks lower confidence, expose both results and withhold race and hard paces',()=>{
 const p=runner({marks:[mark(),mark({id:'fast',date:'2026-09-21',time:'20:00',elapsedTime:'20:00'})]}),m=metrics(p,date);
 assert.equal(m.confidence,'low');assert.equal(m.capacity.conflicts.length,1);assert(m.missing.some(v=>/contradicen/.test(v)));
 assert(m.basePace>=300);assert.equal(raceEstimate(p,date).seconds,null);assert.equal(workoutRange(p,'interval',null,m,date),null);
 assert(m.ranges.easy);assert.equal(m.ranges.tempo,undefined);
});
test('a newer faster test in heat and with elevation does not replace an older comparable competition',()=>{
 const p=runner({marks:[mark({id:'clean',distance:10,time:'52:07',elapsedTime:'52:07'}),mark({id:'newer',date:'2026-10-03',time:'20:00',elapsedTime:'20:00',context:'test',temperature:28,elevation:60})]}),m=metrics(p,date);
 assert.equal(m.mark.id,'clean');assert.equal(m.confidence,'low');assert(m.capacity.references.find(v=>v.id==='newer').limitations.some(v=>/Calor/.test(v)));
 assert(m.basePace>=299.9);assert.equal(raceEstimate(p,date).seconds,null);
});
test('old references are provisional, expired references remain stored and cannot fix current fast paces',()=>{
 const old=runner({marks:[mark({date:'2026-06-01'})]}),snapshot=JSON.stringify(old),m=metrics(old,date);
 assert.equal(m.confidence,'provisional');assert(m.mark);assert.equal(raceEstimate(old,date).seconds,null);assert.equal(workoutRange(old,'interval',null,m,date),null);
 const expired=metrics({...old,marks:[mark({date:'2026-01-01'})]},date);assert.equal(expired.mark,undefined);assert.equal(expired.capacity.assessments.length,1);
 assert.equal(JSON.stringify(old),snapshot);
});
test('estimated, controlled, training, provider and incomplete marks cannot masquerade as measured maximum performances',()=>{
 for(const over of [{measurement:'estimated'},{effort:'controlled'},{context:'training'},{source:'strava'},{date:''},{terrain:'unknown'},{elapsedTime:'28:00'}]){
  const p=runner({marks:[mark(over)]}),m=metrics(p,date);assert.equal(m.mark,undefined);assert.equal(raceEstimate(p,date).seconds,null);assert(m.capacity.assessments[0].reasons.length);
 }
 const none=metrics(runner({marks:[],easyPace:''}),date);assert.deepEqual(none.ranges,{});assert.equal(none.capacity.confidence,'none');
});
test('a small known pause uses elapsed time; missing conditions stay unknown and reduce confidence',()=>{
 const p=runner({marks:[mark({elapsedTime:'25:30'})]}),m=metrics(p,date);assert.equal(m.basePace,306);
 const unknown=runner({marks:[mark({temperature:undefined,elapsedTime:undefined,elevation:undefined,conditions:undefined})]}),snapshot=JSON.stringify(unknown),v=metrics(unknown,date);
 assert.equal(v.confidence,'provisional');assert(v.missing.some(s=>/Temperatura desconocida/.test(s)));assert.equal(JSON.stringify(unknown),snapshot);assert.equal(unknown.marks[0].temperature,undefined);
});
test('duplicate results do not create independent support or stronger confidence',()=>{
 const p=runner({marks:[mark(),mark({id:'copy'})]}),m=metrics(p,date);
 assert.equal(m.capacity.references.length,1);assert.equal(m.confidence,'provisional');assert(m.capacity.assessments.some(v=>/duplicada/.test(v.targetReason||'')));
});
test('a newer incomplete result and a weaker duplicate cannot displace a complete comparable reference',()=>{
 const clean=mark({id:'clean'}),incomplete=mark({id:'new',date:'2026-10-03',elapsedTime:undefined,elevation:undefined,temperature:undefined,conditions:undefined}),p=runner({marks:[incomplete,clean]});
 assert.equal(metrics(p,date).mark.id,'clean');
 const duplicate={...clean,id:'partial-copy',elapsedTime:undefined,elevation:undefined,temperature:undefined,conditions:undefined};
 assert.equal(metrics(runner({marks:[duplicate,clean]}),date).mark.id,'clean');assert.equal(metrics(runner({marks:[clean,duplicate]}),date).mark.id,'clean');
});
test('wind and reported heat lower comparability without manufacturing weather-adjusted performances',()=>{
 for(const conditions of ['windy','hot']){
  const p=runner({marks:[mark({conditions})]}),m=metrics(p,date);
  assert.equal(m.basePace,300);assert.equal(m.confidence,'provisional');assert(m.capacity.limitations.some(s=>/declarado/.test(s)));
 }
});
test('three measured comfortable training references support observation without estimating maximum capacity',()=>{
 const marks=[-21,-14,-7].map((n,i)=>mark({id:'training-'+i,date:addDays(date,n),context:'training',effort:'easy',time:'30:00',elapsedTime:'30:00',rpe:3,fatigue:2,pain:'none',conversation:'yes'})),p=runner({marks,easyPace:''}),m=metrics(p,date);
 assert.equal(m.capacity.seconds,null);assert.equal(m.observedComfortable.kind,'observation');assert.equal(m.observedComfortable.paceSeconds,360);assert.equal(m.observedComfortable.eligible,true);
 assert.equal(m.ranges.interval,undefined);assert.equal(m.ranges.easy,undefined,'observations are reviewed before changing the prescription');
});
test('comfortable observations reject higher effort, heat, pauses and estimated measurements',()=>{
 const {p,activities}=progressFixture();assert(comfortableObservation(p,date,activities).eligible);
 for(const changes of [{rpe:5},{rpe:4},{temperature:30},{elapsedSeconds:3000},{measurement:'estimated'},{conversation:'short'},{conditions:'hot'},{conditions:'windy'}]){
  assert.equal(comfortableObservation(p,date,activities.map(a=>({...a,...changes}))).eligible,false);
 }
 assert.equal(comfortableObservation(p,date,activities.map(a=>({...a,temperature:null}))).eligible,false);
});
test('capacity, comfortable observations and desired race pace remain separate',()=>{
 const {p,activities}=progressFixture(),a=metrics({...p,goal:{type:'race',distance:10,time:'40:00'}},date,activities),b=metrics({...p,goal:{type:'race',distance:10,time:'60:00'}},date,activities);
 assert.equal(a.desiredRacePace.kind,'goal');assert.equal(a.desiredRacePace.paceSeconds,240);
 assert.equal(a.capacity.paceSeconds,b.capacity.paceSeconds);assert.equal(a.observedComfortable.paceSeconds,b.observedComfortable.paceSeconds);assert.deepEqual(a.ranges,b.ranges);
});
test('missing temperature and measurement explain maintaining the plan and never acquire invented defaults',()=>{
 const {p,plan,activities}=progressFixture(),a=activities.at(-1),missing=activities.map(v=>({...v,temperature:null})),v=progressEvidence({...a,temperature:null},plan,p,missing,[],date);
 assert.equal(v.eligible,false);assert.match(v.reason,/Temperatura desconocida/);assert.match(v.reason,/mantiene el plan/);assert(v.exclusions.every(x=>x.reasons.includes('temperatura desconocida')));
 const unmeasured=progressEvidence({...a,measurement:'unknown'},plan,p,activities,[],date);assert.equal(unmeasured.eligible,false);assert.match(unmeasured.reason,/medidos/);
 assert.equal(proposal({...a,temperature:null},plan,p,missing,[],date),null);
});
test('multiple comparable runs offer five seconds per kilometre only for their own type, preserving volume and quality',()=>{
 const {p,plan,activities}=progressFixture(),snapshot=JSON.stringify(plan),v=proposal(activities.at(-1),plan,p,activities,[],date);
 assert(v);assert.equal(v.updateKind,'pace');assert.equal(v.evidenceIds.length,3);assert.match(v.reason,/5 s\/km/);
 for(const c of v.changes){assert.equal(c.after.type,'easy');assert.equal(c.after.distance,c.before.distance);assert.equal(c.after.range[0],c.before.range[0]-5);assert.equal(c.after.range[1],c.before.range[1]-5);assert(c.after.seconds<c.before.seconds);assert.deepEqual(c.after.blocks.filter(b=>b.kind!=='main'),c.before.blocks.filter(b=>b.kind!=='main'));}
 assert.equal(JSON.stringify(plan),snapshot);assert.equal(proposal(activities[0],plan,p,[activities[0]],[],date),null);
 const state={...empty(),profile:p,plan,activities,proposals:[v]},accepted=decideTrainingProposal(state,v.id,true,date);
 assert.deepEqual(accepted.activities,activities);assert.deepEqual(accepted.plan.sessions.filter(s=>s.type==='tempo'),plan.sessions.filter(s=>s.type==='tempo'));
 assert.deepEqual(validatePlan({...accepted.plan,created:date,sessions:accepted.plan.sessions.filter(s=>s.date>=date)},p),[]);
 assert.equal(progressEvidence(activities.at(-1),accepted.plan,p,activities,accepted.proposals,date).eligible,false);
});
test('pace updates revalidate evidence, contradictions and proposed prescriptions before acceptance',()=>{
 const {p,plan,activities}=progressFixture(),v=proposal(activities.at(-1),plan,p,activities,[],date),state={...empty(),profile:p,plan,activities,proposals:[v]};
 assert.throws(()=>decideTrainingProposal({...state,activities:activities.map(a=>a.id===activities[0].id?{...a,temperature:null}:a)},v.id,true,date),/evidencia/);
 const contradictory={...p,marks:[mark(),mark({id:'conflict',date:'2026-09-21',time:'20:00',elapsedTime:'20:00'})]};
 assert.throws(()=>decideTrainingProposal({...state,profile:contradictory},v.id,true,date),/calibración|contradicen/);
 const forged={...v,changes:v.changes.map(c=>({...c,after:{...c.after,range:c.after.range.map(n=>n-10)}}))};
 assert.throws(()=>decideTrainingProposal({...state,proposals:[forged]},v.id,true,date),/ritmos/);
});
test('calibration proposes comfortable reference for beginners and defers it under pain or restrictions',()=>{
 const beginner=runner({experience:'beginner',weeklyKm:4,recentFrequency:1,consistentWeeks:1,marks:[]}),state={...empty(),profile:beginner,plan:generate(beginner,date)},a=calibrationAssessment(state,date);
 assert.equal(a.performanceTestAllowed,false);assert.match(a.performanceStep,/no se propone una prueba máxima/);assert(a.nextReference);
 assert.equal(calibrationAssessment({...state,profile:{...beginner,pain:'relevant'}},date).nextReference.kind,'deferred');
 assert.equal(calibrationAssessment({...state,profile:{...beginner,runningRestriction:'no-running'}},date).nextReference.kind,'deferred');
 assert.equal(calibrationAssessment(empty(),date),null);
});
test('plan calibration is reviewable, gradual, preserves phases and cannot compound the same evidence',()=>{
 const {p,activities}=progressFixture(),old=generate(p,addDays(date,-14)),state={...empty(),profile:p,plan:old,activities},first=buildPlanPreview(state,{calibratePaces:true},date),before=old.sessions.find(s=>s.date>=date&&s.type==='easy'),after=first.plan.sessions.find(s=>s.date===before.date);
 assert(first.reasons.some(r=>/Calibración desde 3/.test(r)));assert((before.range[0]+before.range[1]-after.range[0]-after.range[1])/2<=5);
 assert.deepEqual(first.plan.schedule,old.schedule);const accepted=acceptPlanPreview(state,first,date),again=buildPlanPreview(accepted,{calibratePaces:true},date);
 assert(again.reasons.some(r=>/no se acumulan/.test(r)));assert.deepEqual(again.plan.sessions.find(s=>s.date===before.date).range,after.range);
 assert.deepEqual(accepted.activities,state.activities);assert.deepEqual(state.profile,p);
 const unknown={...state,activities:activities.map(a=>({...a,temperature:null}))},limited=buildPlanPreview(unknown,{calibratePaces:true},date);
 assert(limited.reasons.some(r=>/Temperatura desconocida/.test(r)));assert.deepEqual(limited.plan.sessions.find(s=>s.date===before.date).range,before.range);
});
test('one newly entered performance cannot accelerate an accepted plan and an estimated recorded race stays unmeasured',()=>{
 const p=runner({marks:[],easyPace:'6:30'}),plan=generate(p,addDays(date,-14)),changed={...empty(),profile:{...p,marks:[mark({time:'20:00',elapsedTime:'20:00'})]},plan},preview=buildPlanPreview(changed,{},date);
 for(const s of preview.plan.sessions.filter(s=>s.date>=date&&['easy','tempo','interval','progressive'].includes(s.type))){const old=plan.sessions.find(v=>v.date===s.date);if(old?.type===s.type&&old.range&&s.range)assert(s.range[0]>=old.range[0]);}
 const actual={id:'race',type:'race',date:addDays(date,-7),distance:5,seconds:1500,elapsedSeconds:1500,rpe:8,raceEffort:'race',measurement:'estimated',pain:'none',terrain:'asphalt'};
 assert.equal(performanceReferences([actual],date).length,0);assert.equal(performanceReferences([{...actual,measurement:'measured'}],date).length,1);
 const cal=buildPlanPreview({...empty(),profile:p,activities:[actual]},{calibratePaces:true},date);assert.equal(cal.plan.basis.profile.marks.length,0);
});
test('marathon and trail guards remain while distance-specific ranges use appropriate references',()=>{
 const p=runner({marks:coherent()}),marathon={...p,goal:{...p.goal,distance:42.195}};
 assert.equal(raceEstimate(marathon,date).seconds,null);assert.equal(workoutRange(marathon,'tempo',{key:'specific'},metrics(marathon,date),date),null);
 const trail={...p,terrain:'trail',goal:{...p.goal,terrain:'trail'}};assert.deepEqual(metrics(trail,date).ranges,{});assert.equal(raceEstimate(trail,date).seconds,null);
 const range=workoutRange(p,'interval',{key:'build'},metrics(p,date),date);assert(range[0]>=300&&range[1]>range[0]);
 assert.equal(readableRange(range),'5:05–5:25 min/km');
});
test('ranges and block distances remain legible and practical, and invalid optional conditions are rejected',()=>{
 const p=runner({marks:coherent()}),m=metrics(p,date),plan=generate(p,date);
 assert(Object.values(m.ranges).every(r=>r[0]%5===0&&r[1]%5===0));
 assert(Object.values(m.rangeLabels).every(v=>/^\d+:\d\d–\d+:\d\d min\/km$/.test(v)));
 for(const s of plan.sessions.filter(s=>s.type!=='race'))for(const b of s.blocks)assert(Math.abs(b.distance*10-Math.round(b.distance*10))<1e-8);
 assert.deepEqual(validatePlan(plan,p),[]);assert(profileErrors({...p,marks:[mark({temperature:'inventada'})]},date).length);
 assert(validateActivity({date,distance:5,seconds:1800,measurement:'inventada',laps:[]},date).length);
 assert(validateActivity({date,distance:5,seconds:1800,temperature:'inventada',laps:[]},date).length);
 assert(validateActivity({date,distance:5,seconds:1800,conditions:'inventadas',laps:[]},date).length);
});
test('incomplete references persist with explicit null evidence rather than non-JSON numeric values',()=>{
 const p=runner({marks:[{id:'partial',date:'',distance:'',time:'',effort:'unknown',context:'unknown',measurement:'unknown',terrain:'unknown'}]}),plan=generate(p,date);
 assert.deepEqual(JSON.parse(JSON.stringify(plan)),plan);
 assert.equal(plan.referenceEvaluation.capacity.assessments[0].totalSeconds,null);
 assert.equal(plan.referenceEvaluation.capacity.assessments[0].distance,null);
});
test('repeated recalculation cannot keep accelerating quality from unchanged coherent references',()=>{
 const p=runner(),plan=generate(p,addDays(date,-14)),changed={...empty(),profile:{...p,marks:[mark({time:'20:00',elapsedTime:'20:00'}),mark({id:'ten',date:'2026-09-21',distance:10,time:'41:41',elapsedTime:'41:41'})]},plan};
 const first=buildPlanPreview(changed,{calibratePaces:true},date),accepted=acceptPlanPreview(changed,first,date),again=buildPlanPreview(accepted,{calibratePaces:true},date);
 const quality=first.plan.sessions.filter(s=>s.date>=date&&['tempo','interval','progressive'].includes(s.type));assert(quality.length);
 for(const s of quality)assert.deepEqual(again.plan.sessions.find(v=>v.id===s.id).range,s.range);
 assert(again.reasons.some(r=>/no han cambiado/.test(r)));
});
test('a current check-in or recent adverse sensations prevent offering a maximum performance reference',()=>{
 const {p,activities}=progressFixture(),state={...empty(),profile:p,activities,plan:generate(p,date)};
 assert.equal(calibrationAssessment(state,date).performanceTestAllowed,true);
 const painful=calibrationAssessment({...state,checkIns:[{date,pain:'relevant',fatigue:2}]},date);
 assert.equal(painful.performanceTestAllowed,false);assert.equal(painful.nextReference.kind,'deferred');
 assert.equal(calibrationAssessment({...state,checkIns:[{date,pain:'none',fatigue:7}]},date).performanceTestAllowed,false);
 assert.equal(calibrationAssessment({...state,activities:[...activities,{...activities.at(-1),id:'adverse',pain:'mild'}]},date).performanceTestAllowed,false);
});
