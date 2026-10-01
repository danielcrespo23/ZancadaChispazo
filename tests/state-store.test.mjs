import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {readState,writeState,eraseState} from '../lib/state-store.mjs';
import {blankProfile,empty,generate,addDays,today} from '../lib/engine.mjs';
import {acceptPlanPreview,buildPlanPreview} from '../lib/training.mjs';
function d1(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_cool_true_believers.sql',import.meta.url),'utf8'));return {prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}};}
const profile=name=>({...blankProfile(),name,experience:'regular',weeklyKm:20,longest:8,days:[1,3,6],minutes:{1:50,3:50,6:90},longDay:6,timezone:'Europe/Madrid',goal:{type:'race',distance:10,date:addDays(today(),70),time:''}});
const onboarded=name=>{const s={...empty(),profile:profile(name)};return acceptPlanPreview(s,buildPlanPreview(s));};

test('each user only reads and writes their own profile, plan and records',async()=>{const db=d1(),ana=onboarded('Ana'),luis=onboarded('Luis');
 assert.deepEqual(await readState(db,'ana'),{state:null,revision:0});
 assert.equal((await writeState(db,'ana',ana,0)).status,200);assert.equal((await writeState(db,'luis',luis,0)).status,200);
 const a=await readState(db,'ana'),l=await readState(db,'luis');assert.equal(a.state.profile.name,'Ana');assert.equal(l.state.profile.name,'Luis');assert.notEqual(a.state.plan.id,l.state.plan.id);assert.equal(a.revision,1);
 // Luis writing with Ana's revision cannot touch Ana's row.
 assert.equal((await writeState(db,'luis',{...luis,profile:{...luis.profile,name:'Luis 2'}},1)).status,200);assert.equal((await readState(db,'ana')).state.profile.name,'Ana');
 await eraseState(db,'luis');assert.equal((await readState(db,'luis')).state,null);assert.equal((await readState(db,'ana')).state.profile.name,'Ana');
 await assert.rejects(readState(db,''),/unauthenticated/);await assert.rejects(writeState(db,null,ana,0),/unauthenticated/);});

test('persistence keeps data across reads, rejects stale tabs and duplicate records',async()=>{const db=d1(),s=onboarded('Ana');await writeState(db,'ana',s,0);
 assert.deepEqual((await readState(db,'ana')).state,s);
 assert.equal((await writeState(db,'ana',s,0)).status,409,'a stale revision cannot overwrite newer data');
 const run={id:'r1',date:today(),distance:5,seconds:1800,rpe:3,sessionId:''};
 const dup=await writeState(db,'ana',{...s,activities:[run,{...run}]},1);assert.equal(dup.status,400);assert.match(dup.error,/duplicados/);
 assert.equal((await writeState(db,'ana',{...s,activities:[run]},1)).status,200);assert.equal((await readState(db,'ana')).state.activities.length,1);
 assert.equal((await writeState(db,'ana',{...s,profile:{...s.profile,timezone:'Bad/Zone'}},2)).status,400);
 assert.equal((await writeState(db,'ana',s,-1)).status,400);});
