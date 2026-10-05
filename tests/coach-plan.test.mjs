import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,generate,metrics,planDiagnostics,monday,addDays,day,daysBetween} from '../lib/engine.mjs';
import {buildPlanPreview} from '../lib/training.mjs';
const start='2026-10-01';
const profile=()=>({...blankProfile(),experience:'regular',weeklyKm:30,longest:7,easyPace:'6:30',days:[2,4,0],longDay:0,minutes:{2:120,4:120,0:120},goal:{type:'race',distance:10,date:'2026-11-22',time:''}});

test('regression: easy 7.8 km cannot exceed the 7 km long run',()=>{
 const p=profile(),plan=generate(p,start),first=plan.sessions.filter(s=>monday(s.date)===monday(start)),long=first.find(s=>s.type==='long');
 assert.equal(long.distance,7);
 assert.ok(first.filter(s=>s.type==='easy').every(s=>s.distance<=6.3));
 assert.deepEqual(planDiagnostics(plan),[]);
});
test('weekly distance and duration hierarchy survive availability and taper boundaries',()=>{
 for(const days of [[2,4,0],[1,3,6],[1,2,3],[1,2,3,4,5,6,0]])for(const mins of [15,30,60,120])for(const longest of [2,7,12]){
  const p={...profile(),days,trainingDays:days.length,longDay:days.at(-1),longest,minutes:Object.fromEntries(days.map(d=>[d,d===days.at(-1)?mins:120]))};
  const plan=generate(p,start);
  assert.deepEqual(planDiagnostics(plan),[],JSON.stringify({days,mins,longest}));
  const hard=plan.sessions.filter(s=>s.hard);
  for(let i=1;i<hard.length;i++)assert.ok(daysBetween(hard[i-1].date,hard[i].date)>=2);
  for(const s of plan.sessions.filter(s=>s.type!=='race'))assert.ok(s.seconds<=p.minutes[day(s.date)]*60);
 }
});
test('equivalent 5 km and half-marathon performances yield equivalent training ranges',()=>{
 const p=profile(),date='2026-09-20',five={...p,marks:[{distance:5,time:1500,date,effort:'race',context:'competition',measurement:'measured',terrain:'asphalt'}]},half={...p,marks:[{distance:21.1,time:1500*Math.pow(21.1/5,1.06),date,effort:'race',context:'competition',measurement:'measured',terrain:'asphalt'}]};
 assert.ok(Math.abs(metrics(five,start).basePace-metrics(half,start).basePace)<.001);
 assert.deepEqual(metrics(five,start).ranges,metrics(half,start).ranges);
 const slow={...five,easyPace:'8:00'};assert.ok(metrics(slow,start).ranges.easy[0]>=465);
});
test('saved broken plans are diagnosed; revision preserves completed and historical sessions',()=>{
 const p=profile(),old=generate(p,addDays(start,-14));
 const long=old.sessions.find(s=>s.type==='long'&&s.date>=start),easy=old.sessions.find(s=>s.type==='easy'&&monday(s.date)===monday(long.date));easy.distance=long.distance+1;
 assert.ok(planDiagnostics(old).length);
 const state={profile:p,plan:old,activities:[],changes:[],proposals:[]},snapshot=JSON.stringify(state),preview=buildPlanPreview(state,{},start);
 assert.equal(JSON.stringify(state),snapshot);
 assert.ok(preview.plan.sessions.filter(s=>s.date>=start).every(s=>!s.skipped));
 assert.deepEqual(preview.plan.sessions.filter(s=>s.date<start),old.sessions.filter(s=>s.date<start));
 assert.deepEqual(planDiagnostics({...preview.plan,sessions:preview.plan.sessions.filter(s=>s.date>=start)}),[]);
});
test('history review uses own race performances but does not promote easy runs or provider records',()=>{
 const p=profile(),activities=[];
 for(let w=0;w<4;w++)for(const offset of [1,3,5])activities.push({id:`${w}-${offset}`,date:addDays(monday(start),-28+w*7+offset),type:'easy',distance:6,seconds:2340,rpe:3,fatigue:2,pain:'none',terrain:'asphalt'});
 activities.push({id:'race',measurement:'measured',raceEffort:'race',date:'2026-09-20',type:'race',distance:5,seconds:1500,rpe:8,fatigue:3,pain:'none',terrain:'asphalt'});
 activities.push({id:'provider',source:'strava',date:'2026-09-28',type:'race',distance:5,seconds:1200,rpe:9,pain:'none',terrain:'asphalt'});
 const state={profile:p,activities,changes:[],proposals:[],plan:null};
 const preview=buildPlanPreview(state,{useHistory:true,completeHistory:true},start);
 assert.equal(preview.plan.basis.profile.marks.length,1);
 assert.equal(preview.plan.basis.profile.marks[0].id,'race-race');
 assert.equal(preview.plan.racePreparation.paceSource,'recent-mark');
 assert.equal(p.marks.length,0);
});
