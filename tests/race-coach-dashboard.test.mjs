import test from 'node:test';import assert from 'node:assert/strict';
import {blankProfile,empty,generate,addDays,raceCoachAnswer} from '../lib/engine.mjs';
import {raceCoaching} from '../lib/race-coach.mjs';
import {buildPlanPreview} from '../lib/training.mjs';
const date='2026-10-01';
function state(){const profile={...blankProfile(),experience:'regular',weeklyKm:25,longest:8,easyPace:'6:00',goal:{type:'race',distance:10,date:addDays(date,70),time:''}};return {...empty(),profile,plan:generate(profile,date)};}
test('race roadmap uses actual calendar, counts down, and excludes the race from training volume',()=>{
 const s=state(),coach=raceCoaching(s,date);assert.equal(coach.days,70);assert.equal(coach.roadmap.length,8);
 const raceDate=s.profile.goal.date,c=raceCoaching(s,addDays(raceDate,-3));assert.equal(c.phase.key,'taper');assert(c.roadmap.some(w=>w.race));
 const w=c.roadmap.find(w=>w.race),sessions=s.plan.sessions.filter(x=>x.date>=w.start&&x.date<addDays(w.start,7)&&!['race','rest'].includes(x.type));assert.equal(w.km,Math.round(sessions.reduce((n,x)=>n+(x.distance||0),0)*10)/10);
 assert(raceCoaching(s,addDays(raceDate,1)).completed);
});
test('own pain changes priority; Strava data cannot affect coaching; stale calendar warns',()=>{
 const s=state(),original=raceCoaching(s,date);
 s.activities=[{source:'strava',date,distance:100,pain:'relevant',fatigue:10}];assert.equal(raceCoaching(s,date).focus,original.focus);
 s.checkIns=[{date,pain:'relevant',fatigue:3}];assert.match(raceCoaching(s,date).focus,/recuperar/);
 s.profile.goal.date=addDays(s.profile.goal.date,1);assert(raceCoaching(s,date).alerts.some(a=>a.includes('no coinciden')));
});
test('return after a break reduces the base, preserves the race and prevents quality for fourteen days',()=>{
 const s=state();s.profile.weeklyKm=40;s.profile.longest=12;s.profile.goal.intent='improve';
 const preview=buildPlanPreview(s,{returnAfterBreak:true},date);
 assert.equal(preview.plan.basis.profile.weeklyKm,24);assert.equal(preview.plan.basis.profile.longest,8.4);
 const first=preview.plan.sessions.filter(s=>s.date>=date&&s.date<addDays(date,14));
 assert(first.every(s=>!['tempo','interval','hills','progressive'].includes(s.type)));
 assert.equal(preview.plan.sessions.find(s=>s.type==='race').date,s.profile.goal.date);
 assert(preview.plan.sessions.some(s=>s.date>=addDays(date,14)&&['tempo','interval','hills','progressive'].includes(s.type)));
 assert.equal(s.profile.weeklyKm,40);
});
test('local coach explains the date and taper without treating desired pace as measured performance',()=>{
 const s=state();assert.match(raceCoachAnswer(s,date),/70 días/);
 assert.match(raceCoachAnswer(s,addDays(s.profile.goal.date,-3)),/llegar con frescura/);
 assert.match(raceCoachAnswer(s,s.profile.goal.date),/Hoy es tu carrera/);
 s.checkIns=[{date,pain:'relevant'}];assert.match(raceCoachAnswer(s,date),/Pausa/);
});
