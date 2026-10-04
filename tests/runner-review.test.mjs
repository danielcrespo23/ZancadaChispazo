import test from 'node:test';import assert from 'node:assert/strict';
import {blankProfile,empty,generate,session,today,addDays,validatePlan,metrics,recordActivity,progressEvidence,decideTrainingProposal} from '../lib/engine.mjs';
import {currentCare,dailyFocus,acceptedGoal,goalAwaitingReview} from '../lib/daily-focus.mjs';
import {weekSummary,confirmMissedSessions,undoProposal} from '../lib/training.mjs';
import {sessionTotals,fatigueAlternative} from '../lib/session-instructions.mjs';
import {aiProposal} from '../lib/ai-coach.mjs';import {stateResponse,friendlyError} from '../lib/ui-errors.mjs';
const runner=(changes={})=>({...blankProfile(),experience:'regular',weeklyKm:30,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:12,consistency:'continuous',longest:10,longestDate:addDays(today(),-7),longestSource:'measured',longestResult:'comfortable',easyEffort:3,easyConversation:'yes',pain:'none',runningRestriction:'none',recovery:'good',days:[0,1,2,3,4,5,6],minutes:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,90])),timezone:'Europe/Madrid',marks:[{date:addDays(today(),-21),distance:5,time:'25:00',effort:'race',measurement:'measured',context:'competition',terrain:'asphalt'}],goal:{type:'race',distance:10,date:addDays(today(),49),intent:'improve',flexibility:'distance',terrain:'asphalt'},...changes});
const state=p=>({...empty(),profile:p,plan:generate(p)});
const run=(s,changes={})=>({id:'review-run',date:s.date,type:s.type,distance:s.distance,seconds:s.seconds,rpe:s.rpe,fatigue:2,pain:'none',feeling:'bien',terrain:'asphalt',temperature:18,linkMode:'manual',sessionId:s.id,...changes});
test('daily decisions distinguish rest, today, completed, changed and skipped without bringing a future workout forward',()=>{
 const p=runner(),planned=session(p,'easy',today(),5,0,0),future=session(p,'easy',addDays(today(),2),5,0,0),rest=session(p,'rest',today(),0,0,0),base={...state(p),plan:{...generate(p),sessions:[rest,future]}};
 assert.equal(dailyFocus(base).kind,'rest');assert.equal(dailyFocus(base).session.id,rest.id);assert.equal(dailyFocus(base).next.id,future.id);
 const scheduled={...base,plan:{...base.plan,sessions:[planned,future]}};assert.equal(dailyFocus(scheduled).kind,'workout');
 for(const distance of [5,3]){const recorded=recordActivity(scheduled,run(planned,{distance,seconds:distance*360})).state;assert.equal(dailyFocus(recorded).kind,'completed');assert.equal(weekSummary(recorded).actualKm,distance);assert.equal(JSON.stringify(recorded.plan),JSON.stringify(scheduled.plan));}
 assert.equal(dailyFocus({...scheduled,plan:{...scheduled.plan,sessions:[{...planned,skipped:true},future]}}).kind,'skipped');
 assert.equal(dailyFocus({...empty()}).kind,'no_plan');assert.equal(dailyFocus({...base,plan:{...base.plan,end:addDays(today(),-1),sessions:[{...rest,date:addDays(today(),-1)}]}}).kind,'finished');
});
test('an unlinked run does not complete a scheduled workout or become evidence for another same-day run',()=>{
 const p=runner(),s=session(p,'easy',today(),5,0,0),base={...state(p),plan:{...generate(p),sessions:[s]}},recorded=recordActivity(base,run(s,{sessionId:'',linkMode:'unlinked'})).state,focus=dailyFocus(recorded);
 assert.equal(focus.kind,'workout');assert.equal(focus.unlinkedToday.length,1);assert.equal(weekSummary(recorded).completed,0);assert.equal(weekSummary(recorded).actualKm,5);
});
test('today pain and fatigue affect visible guidance while preserving the accepted prescription',()=>{
 const p=runner(),base=state(p),s=base.plan.sessions.find(s=>s.type==='easy'),before=JSON.stringify(base.plan),careState={...base,checkIns:[{date:today(),pain:'relevant',fatigue:8}]};
 assert.equal(dailyFocus(careState).caution,'pain');assert.equal(currentCare(careState).pain,'relevant');assert.equal(fatigueAlternative(currentCare(careState),s).type,'rest');assert.equal(JSON.stringify(careState.plan),before);
 assert.equal(dailyFocus({...base,checkIns:[{date:today(),pain:'none',fatigue:8}]}).caution,'fatigue');assert.equal(currentCare({...base,profile:{...p,pain:'relevant'},checkIns:[{date:today(),pain:'none'}]}).pain,'relevant');
});
test('a saved new goal stays distinct from the race and date of the accepted calendar',()=>{
 const p=runner(),base=state(p),edited={...base,profile:{...p,goal:{...p.goal,date:addDays(today(),70),distance:21.1}}};
 assert.equal(goalAwaitingReview(base),false);assert.equal(goalAwaitingReview(edited),true);assert.equal(acceptedGoal(edited).date,p.goal.date);assert.equal(acceptedGoal(edited).distance,10);assert.equal(edited.plan.sessions.filter(s=>s.type==='race').length,1);
 const legacy={...edited,plan:{...edited.plan,basis:undefined}};assert.equal(acceptedGoal(legacy).date,p.goal.date);
});
test('beginner, recent-reference runner, seven-week race and too-close goal have explainably different valid plans',()=>{
 const regular=runner(),beginner=runner({experience:'beginner',weeklyKm:'',longest:'',easyPace:'',marks:[],consistentWeeks:'',recentFrequency:'',consistency:'unknown',goal:{type:'start'}}),near=runner({goal:{...regular.goal,distance:42.2,date:addDays(today(),10)}});
 const a=generate(beginner),b=generate(regular),c=generate(near);
 assert.equal(metrics(beginner).source,'effort');assert(a.sessions.some(s=>s.type==='walk'));assert.equal(a.qualitySummary.count,0);assert.equal(metrics(regular).source,'recent-mark');assert(b.qualitySummary.count>0);assert.equal(b.racePreparation.totalDays,49);assert.equal(c.viability.cautious,true);assert.equal(c.qualitySummary.count,0);assert(c.viability.alternatives.length>0);
 for(const [p,plan] of [[beginner,a],[regular,b],[near,c]]){assert.deepEqual(validatePlan(plan,p),[]);for(const s of plan.sessions)assert.equal(sessionTotals(s).matching,true);const races=plan.sessions.filter(s=>s.type==='race');if(p.goal.date){assert.equal(races.length,1);assert.equal(races[0].date,p.goal.date);}}
});
test('little available time keeps the actual blocks within the available minutes',()=>{
 const p=runner({days:[1,3,6],minutes:{1:15,3:20,6:30},longDay:6,trainingDays:3}),plan=generate(p);
 assert.deepEqual(validatePlan(plan,p),[]);for(const s of plan.sessions.filter(s=>!['rest','race'].includes(s.type))){assert(p.days.includes(new Date(s.date+'T12:00:00Z').getUTCDay()));assert(s.seconds<=p.minutes[new Date(s.date+'T12:00:00Z').getUTCDay()]*60);assert.equal(sessionTotals(s).matching,true);}
 assert(plan.viability.notes.some(n=>/minutos|tiempo|disponib/i.test(n)));
});
test('with and without HR, the record immediately changes stats while one harder or different-terrain run cannot trigger progression',()=>{
 const p=runner(),s=session(p,'easy',today(),5,0,0),base={...state(p),plan:{...generate(p),sessions:[s,...generate(p).sessions.filter(v=>v.date>today())]}};
 for(const HR of [{},{avgHR:145,maxHR:170}]){const result=recordActivity(base,run(s,HR));assert.equal(weekSummary(result.state).actualKm,5);assert.equal(dailyFocus(result.state).kind,'completed');assert.equal(result.proposal,null);}
 const history=[-14,-7,0].map((offset,i)=>({...run(s),id:'history-'+i,date:addDays(today(),offset),seconds:1800}));
 for(const change of [{rpe:8},{terrain:'trail'},{temperature:32}]){const fast={...history.at(-1),seconds:1500,...change};assert.equal(progressEvidence(fast,base.plan,p,[...history.slice(0,-1),fast]).eligible,false);}
});
test('missed sessions are not relocated, and explicit changes can be accepted, declined and restored with past records intact',()=>{
 const p=runner(),base=state(p),future=base.plan.sessions.find(s=>s.date>today()&&s.distance>0&&s.type!=='race'),past=session(p,'easy',addDays(today(),-2),5,0,0),history={...base,plan:{...base.plan,sessions:[past,...base.plan.sessions]},activities:[{...run(past),id:'past',notes:'Preserve my note'}]};
 const original=JSON.stringify(history.plan),change=aiProposal(history,{reason:'Fatiga actual: propongo reducir y revisar la sesión.',changes:[{sessionId:future.id,action:'reduce',reduction:.2}]}),declined=decideTrainingProposal(change.state,change.proposal.id,false);
 assert.equal(JSON.stringify(declined.plan),original);const accepted=decideTrainingProposal(change.state,change.proposal.id,true);assert.notEqual(JSON.stringify(accepted.plan),original);const undone=undoProposal(accepted,change.proposal.id);assert.equal(JSON.stringify(undone.plan),original);assert.deepEqual(undone.activities,history.activities);
 const missed={...base,plan:{...base.plan,sessions:[past,...base.plan.sessions]}};const confirmed=confirmMissedSessions(missed,[past.id]);assert.equal(confirmed.plan.sessions[0].skipped,true);assert.deepEqual(confirmed.plan.sessions.slice(1),base.plan.sessions);
});
test('network, invalid server output and stale versions are recoverable without exposing server internals or claiming a save',async()=>{
 assert.match(friendlyError(new TypeError('Failed to fetch')),/contactar con el servidor/);await assert.rejects(stateResponse(new Response('not json',{status:200})),/respuesta incompleta/);await assert.rejects(stateResponse(Response.json({error:'secret database path'},{status:503})),/servidor no pudo/);await assert.rejects(stateResponse(Response.json({error:'internal'},{status:409})),/Exporta/);await assert.rejects(stateResponse(Response.json({state:null})),/no confirmó/);assert.deepEqual(await stateResponse(Response.json({revision:4})),{revision:4});
});
