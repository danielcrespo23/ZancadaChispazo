import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,blankProfile,today,addDays,session,recordActivity,findActivitySession,analysisForActivity,associateActivities,undoActivityAssociation,validateStateShape,validateActivity,progressEvidence,proposal,decideTrainingProposal,deleteActivity} from '../lib/engine.mjs';
import {activityAssessment,activityLabel,blockComparison,duplicateActivity} from '../lib/activity-evidence.mjs';
import {isTrainingActivity,localActivityDate} from '../lib/activity-source.mjs';
import {normalizePersonalActivity,previewActivityImport,receivePersonalActivities} from '../lib/activity-import.mjs';
import {weekSummary,sessionStatus,undoProposal,missedTraining} from '../lib/training.mjs';
const p={...blankProfile(),experience:'regular',weeklyKm:36,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:12,consistency:'continuous',longest:12,longestDate:addDays(today(),-7),longestResult:'comfortable',longestSource:'measured',easyEffort:3,easyConversation:'yes',pain:'none',runningRestriction:'none',recovery:'good',days:[0,1,2,3,4,5,6],minutes:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,90])),timezone:'Europe/Madrid',marks:[{date:addDays(today(),-20),distance:5,time:'25:00',effort:'race',context:'competition',measurement:'measured',terrain:'asphalt'}],goal:{type:'routine'}};
const easy=session(p,'easy',today(),5,0,0),future=session(p,'easy',addDays(today(),2),6,0,1);
const state=()=>({...empty(),profile:p,plan:{start:addDays(today(),-14),created:addDays(today(),-14),end:addDays(today(),60),sessions:[easy,future]}});
const run=(over={})=>({id:'a',date:today(),distance:5,seconds:easy.seconds,type:'easy',rpe:3,fatigue:2,pain:'none',feeling:'bien',terrain:'asphalt',temperature:18,linkMode:'auto',laps:[],notes:'Conservar esta nota',...over});

test('missing sensations remain unknown, are requested and never imply good recovery',()=>{
 const a=run({rpe:null,fatigue:null,pain:'unknown',feeling:'unknown'}),result=recordActivity(state(),a);
 assert.deepEqual(validateActivity(a),[]);assert.equal(result.activity.rpe,null);assert.equal(result.activity.fatigue,null);assert.equal(result.activity.analysis.action,'mantener');assert.equal(result.proposal,null);
 assert(result.activity.analysis.missing.some(t=>t.includes('Esfuerzo')));assert(result.activity.analysis.missing.some(t=>t.includes('Fatiga')));assert(result.activity.analysis.missing.some(t=>t.includes('Molestias')));assert.match(result.activity.analysis.reason,/no se presume/);
 assert.deepEqual(result.state.plan,state().plan);assert.doesNotThrow(()=>JSON.stringify(result.state));
});
test('automatic correspondence needs a compatible type and shape; manual partial runs are explicit',()=>{
 const intervals=session(p,'interval',today(),8,0,1),base={...state(),plan:{...state().plan,sessions:[intervals,future]}};
 assert.equal(findActivitySession(run({distance:2,type:'easy'}),base.plan,[]),null);assert.equal(findActivitySession(run({type:'unknown',distance:8}),base.plan,[]),null);
 const partial=recordActivity(base,run({distance:2,linkMode:'manual',sessionId:intervals.id}));assert.equal(partial.activity.sessionId,intervals.id);assert.equal(activityLabel(partial.activity,partial.state),'Realizada con cambios');
 assert.equal(intervals.type,'interval');assert.equal(partial.activity.type,'easy');
});
test('all four activity labels have different meanings and do not change dates',()=>{
 const complete=recordActivity(state(),run());assert.equal(activityLabel(complete.activity,complete.state),'Completada');
 const changed=recordActivity(state(),run({distance:2,linkMode:'manual',sessionId:easy.id}));assert.equal(activityLabel(changed.activity,changed.state),'Realizada con cambios');
 const unknown=recordActivity(state(),run({type:'unknown'}));assert.equal(activityLabel(unknown.activity,unknown.state),'Actividad sin vincular');
 const extra=recordActivity(state(),run({linkMode:'none'}));assert.equal(activityLabel(extra.activity,extra.state),'Carrera adicional');assert.equal(extra.activity.date,today());
});
test('tempo and intervals never use the whole-run average as fast-block evidence',()=>{
 for(const type of ['tempo','interval']){
  const s=session(p,type,today(),6,0,1),data=activityAssessment(run({distance:6,seconds:3600,type,rpe:s.rpe}),s);
  assert.match(data.paceMismatch,/No se compara el ritmo medio/);assert(!data.paceMismatch.includes('Más lento'));assert.equal(data.blocks.status,'unknown');assert(data.missing.some(t=>t.includes('vueltas')));
 }
});
test('identified real interval blocks compare work and the exact n−1 recoveries',()=>{
 const s=session({...p,goal:{type:'race',distance:5}},'interval',today(),4,0,0);
 const laps=s.blocks.map(b=>({distance:b.distance,seconds:b.seconds,kind:b.kind==='main'&&b.effort>=5?'work':b.kind,rpe:b.effort,recoverySeconds:0}));
 const a=run({distance:s.distance,seconds:s.seconds,type:'interval',rpe:7,laps});const data=blockComparison(a,s);
 assert.equal(data.status,'compatible');assert.equal(data.rows.find(r=>r.label==='Bloques de trabajo').actual,'4');assert.equal(data.rows.find(r=>r.label==='Recuperaciones').actual,'3');assert.equal(data.missing.length,0);
 const fourth={...laps.find(l=>l.kind==='recovery')};assert.equal(blockComparison({...a,laps:[...laps,fourth]},s).status,'changed');
 const shortWarmup=laps.map(l=>l.kind==='warmup'?{...l,distance:l.distance*.25,seconds:l.seconds*.25}:l);assert.equal(blockComparison({...a,laps:shortWarmup},s).status,'changed');
 assert.equal(activityAssessment(a,s).verdict,'compatible');
});
test('stopped recoveries belong to elapsed time and do not invent moving minutes',()=>{
 const a=run({distance:1.6,seconds:480,elapsedSeconds:750,type:'interval',rpe:7,laps:Array.from({length:4},(_,i)=>({kind:'work',distance:.4,seconds:120,recoverySeconds:i<3?90:0,recoveryType:'stop'}))});
 assert.deepEqual(validateActivity(a),[]);assert(validateActivity({...a,elapsedSeconds:600}).some(t=>t.includes('vueltas')));
});
test('grouping sums separate recordings, retains notes, and can be undone without calendar edits',()=>{
 let base=state();base=recordActivity(base,run({id:'warm',distance:1,seconds:400,type:'easy',linkMode:'unlinked',notes:'Calentamiento original'})).state;
 base=recordActivity(base,run({id:'main',distance:4,seconds:easy.seconds-400,type:'easy',linkMode:'unlinked',notes:'Bloque original'})).state;
 const grouped=associateActivities(base,['warm','main'],easy.id,{roles:{warm:'warmup',main:'main'}});
 assert.equal(grouped.activities[0].groupId,grouped.activities[1].groupId);assert.deepEqual(validateStateShape(grouped),[]);assert.equal(weekSummary(grouped).actualKm,5);assert.equal(sessionStatus(easy,grouped),'completed');
 const report=analysisForActivity(grouped.activities[0],grouped);assert.equal(report.actual.distance,5);assert.equal(report.actual.seconds,easy.seconds);assert.equal(report.members.length,2);
 assert.deepEqual(grouped.plan,base.plan);assert.deepEqual(grouped.activities.map(a=>a.notes),base.activities.map(a=>a.notes));
 const changedNotes={...grouped,activities:grouped.activities.map(a=>a.id==='warm'?{...a,notes:'Nueva nota conservada'}:a)},undone=undoActivityAssociation(changedNotes,grouped.changes[0].id);
 assert(undone.activities.every(a=>!a.sessionId));assert.equal(undone.activities.find(a=>a.id==='warm').notes,'Nueva nota conservada');assert.equal(weekSummary(undone).actualKm,5);
});
test('groups must be explicit and cannot silently take occupied sessions or unrelated days',()=>{
 const base=recordActivity(state(),run()).state,next=recordActivity(base,run({id:'b',distance:3,seconds:1200})).state;
 assert.equal(next.activities.find(a=>a.id==='b').sessionId,'');assert.throws(()=>associateActivities(next,['b'],easy.id),/Incluye todos/);
 const invalid={...next,activities:next.activities.map(a=>({...a,sessionId:easy.id}))};assert(validateStateShape(invalid).some(t=>t.includes('agrupación')));
 const elsewhere={...next,activities:next.activities.map(a=>a.id==='b'?{...a,date:addDays(today(),-2)}:a)};assert.throws(()=>associateActivities(elsewhere,['a','b'],easy.id),/mismo día/);
});
test('several activities in a day stay on their date and add statistics without double completion',()=>{
 const first=recordActivity(state(),run()).state,second=recordActivity(first,run({id:'extra',distance:3,seconds:1200,linkMode:'none'})).state;
 assert.equal(weekSummary(second).actualKm,8);assert.equal(weekSummary(second).completed,1);assert.equal(activityLabel(second.activities.find(a=>a.id==='extra'),second),'Carrera adicional');
});
test('ambiguous duplicates need confirmation, exact provider duplicates are idempotent, separate times are valid',()=>{
 const first=recordActivity(state(),run()).state;assert.throws(()=>recordActivity(first,run({id:'b'})),/misma fecha/);
 assert.equal(recordActivity(first,run({id:'b',duplicateConfirmed:true,linkMode:'none'})).state.activities.length,2);
 assert.equal(duplicateActivity(run({id:'b',startedAt:today()+'T18:00:00Z'}),[{...run(),startedAt:today()+'T06:00:00Z'}]),null);
 const own=normalizePersonalActivity({...run(),id:'device-1'});assert.equal(duplicateActivity({...own,id:'other'},[own]).exact,true);
});
test('local activity date is derived in its zone, including midnight and DST; corrections are explicit',()=>{
 assert.equal(localActivityDate({startedAt:'2026-10-01T22:30:00Z',timezone:'Europe/Madrid'}).date,'2026-10-02');
 assert.equal(localActivityDate({startedAt:'2026-10-02T00:30:00Z',timezone:'America/New_York'}).date,'2026-10-01');
 assert.equal(localActivityDate({startedAt:'2026-03-29T00:30:00Z',timezone:'Europe/Madrid'}).date,'2026-03-29');
 assert.throws(()=>localActivityDate({startedAt:'2026-10-01T22:30:00'}),/offset/);
 const correction=localActivityDate({startedAt:'2026-10-01T22:30:00Z',date:'2026-10-01',dateOverride:true});assert.equal(correction.date,'2026-10-01');assert.equal(correction.reportedDate,'2026-10-02');
});
test('authorized received activity updates statistics immediately and asks for absent effort/fatigue/pain',()=>{
 const input=[{id:'watch',startedAt:addDays(today(),-1)+'T22:30:00Z',timezone:'Europe/Madrid',distance:5,seconds:easy.seconds,type:'easy',notes:'Archivo original'}];
 assert.throws(()=>receivePersonalActivities(state(),input),/Confirma/);
 const result=receivePersonalActivities(state(),input,{consent:true});assert.equal(result.received.length,1);assert.equal(weekSummary(result.state).actualKm,5);
 const a=result.state.activities[0];assert.equal(a.date,today());assert.equal(a.rpe,null);assert.equal(a.fatigue,null);assert.equal(a.pain,'unknown');assert.equal(a.notes,'Archivo original');assert.equal(a.sessionId,easy.id);
 assert(analysisForActivity(a,result.state).missing.some(t=>t.includes('Fatiga')));assert.deepEqual(result.state.plan,state().plan);assert.equal(result.state.proposals.length,0);
 const repeat=receivePersonalActivities(result.state,input,{consent:true});assert.equal(repeat.received.length,0);assert.equal(repeat.duplicates,1);assert.equal(repeat.state.activities.length,1);
});
test('source consent does not relabel Strava data as authorized; malformed records have explicit errors',()=>{
 assert.equal(isTrainingActivity({source:'strava',dataUseConsent:true}),false);assert.equal(isTrainingActivity({source:'personal-file',origin:'personal-device',dataUseConsent:true,stravaId:'x'}),false);assert.equal(isTrainingActivity({source:'unknown',externalId:'x'}),false);
 assert.throws(()=>recordActivity(state(),run({source:'strava'})),/fuente/);assert.throws(()=>normalizePersonalActivity({...run(),source:'strava'}),/Strava/);
 const rows=previewActivityImport(state(),[{distance:0,seconds:30,date:today()},{distance:5,time:'30:00',date:today(),rpe:'inventado'}]);assert(rows.every(r=>r.status==='invalid'));
});
test('a fatigue or pain record never silently changes a calendar even with an old automatic preference',()=>{
 for(const pain of ['none','relevant']){const base={...state(),settings:{autoConservative:true}},result=recordActivity(base,run({fatigue:8,pain}));assert.equal(result.proposal.status,'pending');assert.deepEqual(result.state.plan,base.plan);assert.equal(result.state.changes.length,0);}
});
test('concrete reductions require accept, support reject and joint undo, and preserve previous notes',()=>{
 const base=state(),pending=recordActivity(base,run({fatigue:8})).state,v=pending.proposals[0];assert(v.after.seconds<v.before.seconds);
 const declined=decideTrainingProposal(pending,v.id,false);assert.equal(declined.proposals[0].status,'declined');assert.deepEqual(declined.plan,base.plan);
 const accepted=decideTrainingProposal(pending,v.id,true);assert.equal(accepted.plan.sessions.find(s=>s.id===future.id).type,'recovery');assert.equal(accepted.activities[0].notes,'Conservar esta nota');
 const undone=undoProposal(accepted,v.id);assert.deepEqual(undone.plan,base.plan);assert.equal(undone.proposals[0].status,'undone');
 assert.throws(()=>decideTrainingProposal({...pending,plan:{...pending.plan,sessions:pending.plan.sessions.map(s=>s.id===future.id?{...s,seconds:s.seconds+1}:s)}},v.id,true),/cambió/);
});
const past=[-14,-7,0].map(n=>session(p,'easy',addDays(today(),n),5,0,0));
const history=past.map((s,i)=>run({id:'e'+i,date:s.date,sessionId:s.id,seconds:Math.round(s.seconds*.94),elapsedSeconds:Math.round(s.seconds*.94),elevation:0,measurement:'measured',conversation:'yes',performance:'expected'}));
const progressPlan={...state().plan,sessions:[...past,future]};
test('three comparable sessions can show progress without a better checkbox; one fast run cannot',()=>{
 assert.equal(progressEvidence(history[0],progressPlan,p,[history[0]]).eligible,false);
 const evidence=progressEvidence(history.at(-1),progressPlan,p,history);assert.equal(evidence.eligible,true);assert.equal(evidence.count,3);
 const v=proposal(history.at(-1),progressPlan,p,history);assert(v);assert.equal(v.direction,'increase');assert(v.changes.every(c=>c.after.distance===c.before.distance&&c.after.range[0]===c.before.range[0]-5));assert(v.changes.every(c=>!['tempo','interval','hills'].includes(c.after.type)));
});
test('heat, hills, pauses, unknown sensations and recent relevant pain prevent progress',()=>{
 const a=history.at(-1);
 for(const changed of [{temperature:29},{temperature:null},{elevation:500},{elapsedSeconds:a.seconds*1.5},{rpe:null},{fatigue:null},{pain:'mild'}])assert.equal(progressEvidence({...a,...changed},progressPlan,p,history).eligible,false);
 const unsafe=run({id:'sore',date:addDays(today(),-1),pain:'relevant',linkMode:'none'});assert.equal(progressEvidence(a,progressPlan,p,[...history,unsafe]).eligible,false);
 const duplicateDays=history.map(a=>({...a,date:today()}));assert.equal(progressEvidence(duplicateDays.at(-1),progressPlan,p,duplicateDays).eligible,false);
});
test('changes or deletion of evidence invalidate pending increases and keep a history copy',()=>{
 const v=proposal(history.at(-1),progressPlan,p,history),base={...state(),plan:progressPlan,activities:history,proposals:[v]};
 const deleted=deleteActivity(base,history[0].id);assert.equal(deleted.proposals[0].status,'superseded');assert.equal(deleted.changes[0].deletedActivity.notes,'Conservar esta nota');assert.deepEqual(deleted.plan,base.plan);
 assert.throws(()=>decideTrainingProposal({...base,activities:base.activities.map(a=>a.id===history[0].id?{...a,rpe:9}:a)},v.id,true),/evidencia/);
});
test('importing old fast runs never turns old evidence into a current progression',()=>{
 const old=history.map(a=>({...a,date:addDays(a.date,-40)})),oldPlan={...progressPlan,sessions:progressPlan.sessions.map(s=>s.date<=today()?{...s,date:addDays(s.date,-40)}:s)};
 assert.equal(progressEvidence(old.at(-1),oldPlan,p,old).eligible,false);assert.equal(proposal(old.at(-1),oldPlan,p,old),null);
 const earlier=history.map(a=>({...a,date:addDays(a.date,-1)})),earlierPlan={...progressPlan,sessions:progressPlan.sessions.map(s=>s.date<=today()?{...s,date:addDays(s.date,-1)}:s)};
 const sore=run({id:'recent-sore',pain:'relevant',linkMode:'none'});assert.equal(progressEvidence(earlier.at(-1),earlierPlan,p,[...earlier,sore]).eligible,false,'a backdated record also considers pain reported after that activity');
});
test('grouped recordings cannot be edited into unrelated dates and still complete one session',()=>{
 const records=[run({id:'one',distance:3,seconds:1200,linkMode:'unlinked'}),run({id:'two',distance:2,seconds:800,linkMode:'unlinked'})];
 const grouped=associateActivities({...state(),activities:records},['one','two'],easy.id);
 const inconsistent={...grouped,activities:grouped.activities.map(a=>a.id==='two'?{...a,date:addDays(today(),-5)}:a)};
 assert(validateStateShape(inconsistent).some(t=>t.includes('días distintos')));
});
test('editing any group member invalidates a proposal based on the whole group',()=>{
 const records=[run({id:'warm',distance:1,seconds:400,linkMode:'unlinked'}),run({id:'main',distance:4,seconds:1600,linkMode:'unlinked',pain:'relevant'})];
 const grouped=associateActivities({...state(),activities:records},['warm','main'],easy.id),pending=grouped.proposals.find(v=>v.status==='pending');assert(pending);
 assert.match(analysisForActivity(grouped.activities.find(a=>a.id==='main'),grouped).decision,/ajuste pendiente/);
 const updated=recordActivity(grouped,{...grouped.activities.find(a=>a.id==='main'),pain:'none'}).state;
 assert.equal(updated.proposals.find(v=>v.id===pending.id).status,'superseded');assert.deepEqual(updated.plan,grouped.plan);assert.equal(updated.activities.find(a=>a.id==='main').notes,'Conservar esta nota');
});
test('prescribed total duration compares elapsed time rather than movement alone',()=>{
 const prescribed={...easy,distance:null,seconds:1800,estimated:false},a=run({seconds:1500,elapsedSeconds:1800});
 const result=activityAssessment(a,prescribed);assert.equal(result.deltaMinutes,0);assert.equal(result.status,'completed');assert(result.evidence.some(t=>t.includes('Tiempo total transcurrido: 1800')));
});
test('invalid recorded blocks never gain credibility from negative distances or invalid effort',()=>{
 const a=run({laps:[{kind:'work',distance:-.4,seconds:120,recoverySeconds:0}]});assert(validateActivity(a).length>0);
 assert(validateActivity({...a,laps:[{kind:'work',distance:.4,seconds:120,recoverySeconds:0,recoveryDistance:-.1}]}).length>0);
 assert(validateActivity({...a,laps:[{kind:'work',distance:.4,seconds:120,recoverySeconds:0,rpe:20}]}).length>0);
 assert.throws(()=>normalizePersonalActivity({...a,laps:[{kind:'work',distance:'sin medir',seconds:120}]}),/no es numérico/);
});
test('unregistered and confirmed missed sessions stay distinct and are never compensated',()=>{
 const old=session(p,'easy',addDays(today(),-3),5,0,0),base={...state(),plan:{...state().plan,sessions:[old,easy,future]}};
 const absent=missedTraining(base);assert.equal(absent.unconfirmed.length,1);assert.equal(absent.confirmed,0);
 const result=recordActivity(base,run());assert.deepEqual(result.state.plan,base.plan);assert.equal(result.state.plan.sessions.find(s=>s.id===old.id).date,old.date);assert.equal(result.proposal,null);
});
