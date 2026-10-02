import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,blankProfile,generate,upgradeRaceDay,session,findActivitySession,recordActivity,today,addDays,day,validatePlan,moveSession,proposal,progressEvidence} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview,weekSummary} from '../lib/training.mjs';

const profile=()=>({...blankProfile(),experience:'regular',weeklyKm:24,longest:8,easyPace:'6:00',days:[1,3,6],minutes:{1:60,3:60,6:90},longDay:6});
const run=(date=today())=>({id:'run',date,distance:5,seconds:1800,type:'easy',rpe:3,fatigue:3,pain:'none',feeling:'bien',linkMode:'auto',sessionId:''});

test('reopening after editing the race goal keeps the accepted calendar intact',()=>{
 const p={...profile(),goal:{type:'race',distance:10,date:addDays(today(),70),time:''}};
 const initial={...empty(),profile:p};const saved=acceptPlanPreview(initial,buildPlanPreview(initial));
 const edited={...saved,profile:{...p,goal:{...p.goal,date:addDays(today(),63)}}};
 assert.ok(upgradeRaceDay(edited)===edited);
 const legacy={...edited,plan:{...saved.plan,basis:undefined}};
 assert.ok(upgradeRaceDay(legacy)===legacy);
});

test('automatic links follow the actual date after an activity is edited',()=>{
 const p=profile(),first=session(p,'easy',addDays(today(),-2),5,0,1),second=session(p,'easy',today(),5,0,1);
 const state={...empty(),profile:p,plan:{start:first.date,end:addDays(today(),30),sessions:[first,second]}};
 const recorded=recordActivity(state,run(first.date)).state;
 const changed={...recorded.activities[0],date:second.date};
 assert.equal(findActivitySession(changed,state.plan,recorded.activities).id,second.id);
 const edited=recordActivity(recorded,changed).state;
 assert.equal(edited.activities[0].sessionId,second.id);
 assert.equal(weekSummary(edited).actualKm,5);
 const additional=recordActivity(edited,{...edited.activities[0],date:addDays(today(),-1)}).activity;
 assert.equal(additional.sessionId,'');assert.equal(additional.plannedSnapshot,null);
});

test('plan validation rejects a session outside the available weekdays',()=>{
 const p=profile(),plan=generate(p);let date=addDays(today(),1);while(p.days.includes(day(date)))date=addDays(date,1);
 const bad={...plan,sessions:[{...plan.sessions[0],date}]};
 // Keep a minute value on this unchecked weekday, as a previous profile can do.
 assert.match(validatePlan(bad,{...p,minutes:{...p.minutes,[day(date)]:120}}).join(' '),/disponible/);
});

test('moving rejects invalid calendar dates without changing the session',()=>{
 const p=profile(),plan=generate(p);
 assert.throws(()=>moveSession(plan,plan.sessions[0].id,'2026-02-31',p),/fecha real/);
});

test('reorganization preserves completed sessions and holidays',()=>{
 const p=profile(),plan=generate(p),s=plan.sessions.find(s=>s.date>today());
 const target=addDays(s.date,7);
 const sparse={...plan,sessions:[s]};
 assert.throws(()=>moveSession(sparse,s.id,target,p,{activities:[{sessionId:s.id}]}),/pendientes/);
 assert.throws(()=>moveSession(sparse,s.id,target,p,{sessionCompletions:[{sessionId:s.id}]}),/pendientes/);
 assert.throws(()=>moveSession(sparse,s.id,target,p,{unavailable:[{start:target,end:target}]}),/sin entrenamiento/);
});

test('revising a plan leaves recovery after a completed long session',()=>{
 const p={...profile(),days:[day(today()),day(addDays(today(),2)),day(addDays(today(),4))],minutes:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,90])),longDay:day(today())};
 const before=session(p,'long',addDays(today(),-1),8,0,1);
 const state={...empty(),profile:p,plan:{start:before.date,end:addDays(today(),83),sessions:[before]},activities:[{...run(before.date),distance:before.distance,seconds:before.seconds,sessionId:before.id,type:'long'}]};
 const preview=buildPlanPreview(state);
 assert.ok(preview.plan.sessions.filter(s=>s.date>=today()&&s.date<addDays(today(),1)).every(s=>!s.hard));
 assert.ok(preview.plan.sessions.some(s=>s.id===before.id&&s.hard));
});

test('progression respects time reserved for other sports and excludes provider evidence',()=>{
 let date=addDays(today(),1);while(day(date)!==1)date=addDays(date,1);
 const p={...profile(),otherSports:[{type:'cycling',day:1,minutes:35,intensity:'easy'}]};
 const before=session(p,'easy',date,4,0,1);
 const past=[-14,-7,0].map(offset=>session(p,'easy',addDays(today(),offset),3,0,0));
 const history=past.map((s,i)=>({...run(s.date),id:`evidence-${i}`,sessionId:s.id,seconds:Math.round(s.seconds*.93),distance:s.distance,type:s.type,terrain:'asphalt',temperature:18,performance:'better'}));
 const plan={start:addDays(today(),-14),created:addDays(today(),-14),end:addDays(today(),30),sessions:[...past,before]};
 assert.equal(progressEvidence(history.at(-1),plan,p,history).eligible,true);
 assert.equal(proposal(history.at(-1),plan,p,history),null,'extra running time cannot consume the cycling reservation');
 const external=history.map(a=>({...a,source:'strava'}));
 assert.equal(progressEvidence(external.at(-1),plan,p,external).eligible,false);
});
