import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,empty,generate,session,fitSession,qualityType as engineQualityType,addDays,day,monday,daysBetween,validatePlan,validateStateShape,planDiagnostics} from '../lib/engine.mjs';
import {SESSION_LIBRARY,sessionDefinition,sessionFormat as librarySessionFormat,formatEligibility,buildRunningBlocks,buildStrengthBlocks,sessionLoad,progressionAudit,strengthContext,selectQualitySession as librarySelectQualitySession} from '../lib/session-library.mjs';
import {timedSession} from '../lib/timed-session.mjs';
import {recoveryInstruction,sessionTotals,prescriptionWarnings} from '../lib/session-instructions.mjs';
import {buildPlanPreview,acceptPlanPreview,completeStrength} from '../lib/training.mjs';
const start='2026-10-05';
const qualityType=(p,phase,week,previous=[])=>engineQualityType(p,phase,week,previous,start);
const sessionFormat=(p,type,phase,options={})=>librarySessionFormat(p,type,phase,{referenceDate:start,...options});
const selectQualitySession=(p,phase,options={})=>librarySelectQualitySession(p,phase,{date:start,...options});
const runner=(over={})=>({...blankProfile(),experience:'regular',weeklyKm:36,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:16,consistency:'continuous',recovery:'good',fatigue:2,runningRestriction:'none',longest:14,longestDate:'2026-10-04',longestSource:'measured',longestResult:'comfortable',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',days:[1,2,4,0],minutes:{1:75,2:60,4:75,0:180},trainingDays:4,longDay:0,marks:[{id:'five',date:'2026-09-14',distance:5,time:'25:00',elapsedTime:'25:00',context:'competition',measurement:'measured',effort:'race',terrain:'asphalt',elevation:0,temperature:16,conditions:'normal'},{id:'ten',date:'2026-09-21',distance:10,time:'52:07',elapsedTime:'52:07',context:'competition',measurement:'measured',effort:'race',terrain:'asphalt',elevation:0,temperature:16,conditions:'normal'}],goal:{type:'race',intent:'improve',distance:10,date:addDays(start,168),time:'',terrain:'asphalt'},...over});
const build={key:'build',label:'Desarrollo',loadFactor:1},specific={key:'specific',label:'Específico',loadFactor:1};
const workout=(p,type,km=8,minutes=40,phase=build,options={})=>session(p,type,start,km,minutes,0,phase,start,options);
const running=s=>!['strength','rest','race'].includes(s.type);
function verify(s){assert(sessionTotals(s).matching);assert.deepEqual(prescriptionWarnings(s),[]);if(s.load)assert.deepEqual(s.load,sessionLoad(s.blocks));if(s.repetitions){const recovery=recoveryInstruction(s);assert.equal(recovery.workCount,s.repetitions.count);assert.equal(recovery.count,s.repetitions.recoveryCount);}for(const b of s.blocks){assert(b.seconds>=0);assert(b.effort<=7);if(s.type!=='race')assert(Math.abs(b.distance*10-Math.round(b.distance*10))<1e-8);}}

test('the executable catalogue describes purpose, level, prerequisites, blocks, recovery, load, duration and progression',()=>{
 assert.equal(new Set(SESSION_LIBRARY.map(s=>s.id)).size,SESSION_LIBRARY.length);
 for(const s of SESSION_LIBRARY){assert(s.purpose&&s.level&&s.requirements.length&&s.blocks.length&&s.recovery);assert(s.duration&&s.load&&s.prescription.kind&&s.progression.example);assert.equal(s.progression.maximumSimultaneousIncreases,1);assert(s.reduceWhen.length&&s.substitute);assert.equal(sessionDefinition(s.id),s);}
 assert(SESSION_LIBRARY.some(s=>s.id==='tempo-broken'));assert(SESSION_LIBRARY.some(s=>s.id==='interval-endurance'));
});
test('selection depends on goal and phase, not week parity, and explains its purpose',()=>{
 for(const distance of [5,10,21.1,42.2]){const p=runner({goal:{...runner().goal,distance}});assert.equal(qualityType(p,build,1),qualityType(p,build,2));assert.equal(qualityType(p,build,1),qualityType(p,build,42));assert.match(selectQualitySession(p,build).reason,/objetivo, base, fase/);}
 assert.equal(qualityType(runner({goal:{...runner().goal,distance:5}}),specific,0),'interval');assert.equal(qualityType(runner(),specific,0),'tempo');
 assert.equal(sessionFormat(runner({goal:{...runner().goal,distance:21.1}}),'tempo',build).id,'tempo-broken');
 assert.equal(qualityType(runner(),{key:'taper'},5),'easy');
});
test('an underrepresented useful purpose can be selected without an arbitrary modulo rotation',()=>{
 const p=runner(),previous=[0,1].map(i=>({type:'tempo',phase:build,date:addDays(start,i*7)}));
 assert.equal(qualityType(p,build,1,previous),'interval');assert.equal(qualityType(p,build,100,previous),'interval');
 const hilly={...p,goal:{...p.goal,elevation:100}};assert.equal(qualityType(hilly,build,2),'hills');
});
test('half marathon and marathon can use controlled repetitions when the runner is prepared',()=>{
 for(const distance of [21.1,42.2]){const p=runner({goal:{...runner().goal,distance}}),s=workout(p,'interval');assert.equal(s.type,'interval');assert.equal(s.format.id,'interval-endurance');assert.equal(s.rpe,6);assert(s.range);verify(s);}
 const unready=runner({weeklyKm:18,consistentWeeks:4,longest:6,goal:{...runner().goal,distance:21.1}}),s=workout(unready,'interval');assert.equal(s.type,'easy');assert.match(s.substitution.reason,/base consolidada/);assert.equal(formatEligibility(unready,sessionDefinition('interval-endurance'),start).eligible,false);
});
test('advanced formats require a recent measured and comfortable long run, not an old estimate',()=>{
 for(const over of [{longestDate:'2026-06-01'},{longestSource:'estimated'},{longestResult:'hard'},{longestDate:'2026-10-06'}]){const p=runner({...over,goal:{...runner().goal,distance:21.1}}),s=workout(p,'interval');assert.equal(s.type,'easy');assert(s.substitution.reason);assert.equal(sessionFormat(p,'tempo',build).id,'tempo-continuous');verify(s);}
});
test('the time constructor enforces prerequisites and useful duration without depending on its caller',()=>{
 const args={id:'time',p:runner({marks:[],easyPace:''}),type:'interval',date:start,minutes:18,week:0,phase:build,source:'effort'},short=timedSession(args);assert.equal(short.type,'easy');assert(short.substitution.reason);assert.equal(short.distance,null);assert.equal(short.seconds,1080);verify(short);
 const valid=timedSession({...args,minutes:30});assert.equal(valid.type,'interval');assert.equal(valid.repetitions.count,4);assert.equal(valid.repetitions.recoveryCount,3);assert.equal(valid.seconds,1800);verify(valid);
 const novice=timedSession({...args,minutes:30,p:runner({weeklyKm:6,consistentWeeks:2})});assert.equal(novice.type,'easy');assert.match(novice.substitution.reason,/base/);verify(novice);
});
test('the same quality family has different useful work for five and ten kilometres',()=>{
 const five=workout(runner({goal:{...runner().goal,distance:5}}),'interval',8,40,specific),ten=workout(runner(),'interval',8,40,specific);
 assert.equal(five.repetitions.workDistance,.4);assert.equal(ten.repetitions.workDistance,1);assert(five.range[0]<ten.range[0]);verify(five);verify(ten);
});
test('easy, recovery and long main blocks preserve their own range rather than sharing one pace',()=>{
 const sessions=['easy','recovery','long'].map(type=>workout(runner(),type));for(const s of sessions){const main=s.blocks.find(b=>b.kind==='main');assert.deepEqual(main.range,s.range);verify(s);}
 assert(sessions[1].blocks.find(b=>b.kind==='main').targetPace>sessions[0].blocks.find(b=>b.kind==='main').targetPace);assert(sessions[2].blocks.find(b=>b.kind==='main').targetPace>sessions[0].blocks.find(b=>b.kind==='main').targetPace);
});
test('fractional tempo has two equal useful blocks and exactly one intervening recovery for time and distance',()=>{
 for(const timed of [false,true]){const p=runner({goal:{...runner().goal,distance:21.1},...(timed?{marks:[],easyPace:''}:{})}),s=workout(p,'tempo');assert.equal(s.format.id,'tempo-broken');assert.equal(s.repetitions.count,2);assert.equal(s.repetitions.recoveryCount,1);assert.equal(recoveryInstruction(s).placement,'between');const work=s.blocks.filter(b=>b.role==='work');assert.equal(work.length,2);assert.equal(work[0].distance,work[1].distance);assert.equal(work[0].seconds,work[1].seconds);assert(work.every(b=>b.seconds>=180));verify(s);if(timed){assert.equal(s.distance,null);assert.equal(s.seconds,2400);}}
});
test('insufficient fractional tempo is substituted rather than made into meaningless fragments',()=>{
 const p=runner({marks:[],easyPace:'',goal:{...runner().goal,distance:21.1}}),s=fitSession({...p,minutes:{1:20}},'tempo',start,0,20,0,build,start);
 assert.equal(s.type,'easy');assert(s.substitution.reason);assert(s.blocks.every(b=>b.effort<=3));assert(s.seconds<=1200);verify(s);
});
test('fitting intervals removes complete repetitions, keeps their recovery and respects the available duration',()=>{
 for(const minutes of [12,15,20,25,30,35,40]){const p=runner({minutes:{1:minutes}}),s=fitSession(p,'interval',start,8,0,0,build,start);assert(s.seconds<=minutes*60);verify(s);
  if(s.type==='interval'){assert.equal(s.repetitions.workDistance,.6);assert(s.repetitions.count>=2&&s.repetitions.count<=4);assert(s.blocks.filter(b=>b.kind==='warmup').reduce((n,b)=>n+b.seconds,0)>=300);assert(s.blocks.filter(b=>b.kind==='cooldown').reduce((n,b)=>n+b.seconds,0)>=180);}
  else {assert.equal(s.type,'easy');assert(s.substitution.reason);}
 }
});
test('a fitted tempo preserves the minimum sustained purpose or provides a clear easy alternative',()=>{
 for(const minutes of [12,20,25,35,45]){const p=runner({minutes:{1:minutes}}),s=fitSession(p,'tempo',start,8,0,0,build,start);verify(s);assert(s.seconds<=minutes*60);if(s.type==='tempo')assert(s.load.workSeconds>=360);else assert(s.substitution.reason);}
});
test('hills have a full final descent, a fixed useful dose, and safe substitution when too short',()=>{
 const p=runner({goal:{...runner().goal,elevation:100}}),s=workout(p,'hills',0,30);assert.equal(s.repetitions.count,4);assert.equal(s.repetitions.workSeconds,30);assert.equal(s.repetitions.recoveryCount,4);assert.equal(s.seconds,1800);verify(s);
 const short=fitSession({...p,minutes:{1:12}},'hills',start,0,12,0,build,start);assert.equal(short.type,'easy');assert(short.substitution.reason);verify(short);
 const treadmill=workout({...p,terrain:'treadmill'},'hills',0,30);assert.equal(treadmill.type,'easy');assert.match(treadmill.substitution.reason,/cinta/);
});
test('changing only the calendar week does not increase pace, work, repetitions or running/walking difficulty',()=>{
 const p=runner();for(const type of ['tempo','interval','hills','progressive','walk']){const early=session(p,type,start,type==='walk'||type==='hills'?0:8,40,0,build,start),late=session(p,type,start,type==='walk'||type==='hills'?0:8,40,20,build,start);assert.deepEqual(late.blocks,early.blocks);assert.deepEqual(late.repetitions,early.repetitions);}
});
test('progression audit detects simultaneous increases and allows a single gradual change',()=>{
 const s=workout(runner(),'interval'),one={...s,repetitions:{...s.repetitions,count:s.repetitions.count+1}};assert(progressionAudit(s,one).allowed);
 const multiple={...one,distance:s.distance+1,rpe:s.rpe+1,dose:{...s.dose,work:s.dose.work+.1},blocks:s.blocks.map(b=>b.role==='work'?{...b,targetPace:b.targetPace-5}:b)},audit=progressionAudit(s,multiple);assert.equal(audit.allowed,false);assert.deepEqual(audit.increasedAxes,['pace','volume','repetitions','difficulty']);
 const built=buildRunningBlocks({p:runner(),type:'interval',phase:build,minutes:40,dose:{count:6,work:120}});assert.match(built.failed,/a la vez/);
});
test('generated plans keep each format stable while weekly budgets and long runs remain bounded',()=>{
 for(const distance of [5,10,21.1,42.2]){const p=runner({goal:{...runner().goal,distance}}),plan=generate(p,start),seen=new Map();assert.deepEqual(validatePlan(plan,p),[]);assert.deepEqual(planDiagnostics(plan),[]);
  for(const s of plan.sessions){verify(s);if(running(s))assert(s.seconds<=p.minutes[day(s.date)]*60);if(['tempo','interval','progressive','hills'].includes(s.type)){for(const key of [s.format.id,s.type]){const old=seen.get(key);if(old)assert(progressionAudit(old,s).allowed,JSON.stringify({distance,format:s.format.id,audit:progressionAudit(old,s)}));seen.set(key,s);}assert(s.selectionReason);}}
  for(const date of new Set(plan.sessions.map(s=>monday(s.date))))assert(plan.sessions.filter(s=>monday(s.date)===date&&['tempo','interval','progressive','hills'].includes(s.type)).length<=1);
  const hard=plan.sessions.filter(s=>s.hard);for(let i=1;i<hard.length;i++)assert(daysBetween(hard[i-1].date,hard[i].date)>=2);
 }
});
test('changing tempo format with the phase preserves total work instead of advancing its dose by calendar',()=>{
 for(const timed of [false,true]){const p=runner({goal:{...runner().goal,distance:21.1},...(timed?{marks:[],easyPace:''}:{})}),plan=generate(p,start),tempo=plan.sessions.filter(s=>s.type==='tempo');assert(tempo.some(s=>s.format.id==='tempo-broken'));assert(tempo.some(s=>s.format.id==='tempo-continuous'));let before=null;
  for(const s of tempo){const work=s.dose.work*s.dose.count;if(before)assert(work<=before.work+.001,JSON.stringify({timed,previous:before,work,format:s.format.id}));before={work,format:s.format.id};verify(s);}
 }
});
test('strength counts all rests and offers complete rounds or mobility within the requested duration',()=>{
 for(const minutes of [0,5,10,15,20,25]){const s=workout(runner(),'strength',0,minutes||.001);assert(s.seconds<=minutes*60+.1);verify(s);assert.equal(s.strength.exerciseCount%5,0);if(minutes>=15)assert(s.strength.rounds>=1);else{assert.equal(s.format.id,'strength-mobility');assert.match(recoveryInstruction(s).text,/Movilidad suave/);assert.equal(recoveryInstruction(s).count,0);}}
 const full=buildStrengthBlocks(25);assert.equal(full.strength.rounds,2);assert.equal(full.strength.exerciseCount,10);assert.equal(full.blocks.filter(b=>b.kind==='recovery').length,10);assert.equal(full.seconds,1500);verify({...full,type:'strength'});
});
test('strength material alternatives change instructions while preserving time, effort and exercise balance',()=>{
 const versions=['none','band','weights'].map(equipment=>buildStrengthBlocks(25,equipment));
 for(const s of versions){assert.equal(s.seconds,1500);assert.equal(s.rpe,4);assert.equal(s.strength.exerciseCount,10);for(const b of s.blocks.filter(b=>b.exercise))assert(b.exercise.options.none&&b.exercise.options.band&&b.exercise.options.weights);}
 assert(versions[0].blocks.some(b=>/silla/.test(b.label)));assert(versions[1].blocks.some(b=>/banda ligera/.test(b.label)));assert(versions[2].blocks.some(b=>/mancuerna ligera/.test(b.label)));
});
test('existing strength and CrossFit prevent duplicate supplements even on a different weekday',()=>{
 for(const type of ['strength','crossfit']){const p=runner({strength:true,strengthDay:2,otherSports:[{id:'existing',type,day:5,minutes:45,intensity:'hard'}]}),plan=generate(p,start);assert.equal(strengthContext(p,2).allowed,false);assert(!plan.sessions.some(s=>s.type==='strength'));assert(plan.context.notes.some(n=>/no se añade fuerza duplicada/.test(n)));verify(plan.sessions[0]);}
});
test('a new strength supplement has its own day, avoids demanding runs, and eases during taper',()=>{
 const p=runner({strength:true,strengthDay:2}),plan=generate(p,start),strength=plan.sessions.filter(s=>s.type==='strength');assert(strength.length);
 for(const s of strength){assert(!plan.sessions.some(v=>v.id!==s.id&&v.date===s.date&&running(v)));assert(!plan.sessions.some(v=>v.hard&&Math.abs(daysBetween(v.date,s.date))<2));assert(s.seconds<=1500);assert(s.seconds<=p.minutes[day(s.date)]*60);verify(s);if(s.phase.key==='taper')assert.equal(s.format.id,'strength-mobility');}
});
test('strength uses its own minutes and effort records without inventing running activity',()=>{
 const p=runner(),s=workout(p,'strength',0,25),state={...empty(),profile:p,plan:{start,created:start,end:p.goal.date,sessions:[s]}};
 const saved=completeStrength(state,s,18,4,start);assert.deepEqual(saved.activities,[]);assert.equal(saved.sessionCompletions[0].minutes,18);assert.equal(saved.sessionCompletions[0].rpe,4);assert.equal(saved.plan,state.plan);assert.deepEqual(validateStateShape(saved),[]);
 const again=completeStrength(saved,s,20,3,start);assert.equal(again.sessionCompletions.length,1);assert.equal(again.sessionCompletions[0].minutes,20);
});
test('a high effort strength record suppresses adjacent quality on review',()=>{
 const p=runner(),review=addDays(start,1),plan=generate(p,addDays(start,-28)),strength=workout(p,'strength',0,25),state={...empty(),profile:p,plan:{...plan,sessions:[...plan.sessions.filter(s=>s.date!==start),strength]}};
 const control=buildPlanPreview(state,{},review).plan.sessions.find(s=>s.date===review);assert(['tempo','interval','progressive','hills'].includes(control.type));assert(control.hard);
 const completed=completeStrength(state,strength,25,8,start),preview=buildPlanPreview(completed,{},review);
 const reduced=preview.plan.sessions.find(s=>s.date===review);assert(!reduced.hard);assert(reduced.seconds<=control.seconds*.7);assert.deepEqual(preview.plan.sessions.find(s=>s.id===strength.id),strength);
});
test('plan revisions preserve formats, phase origins, completed sessions, links and source data',()=>{
 const p=runner(),old=generate(p,start),review=addDays(start,35),done=old.sessions.find(s=>s.date<review&&s.type==='easy'),activity={id:'own',date:done.date,type:done.type,sessionId:done.id,distance:done.distance,seconds:done.seconds,rpe:3,fatigue:2,pain:'none'},state={...empty(),profile:p,plan:old,activities:[activity]},snapshot=JSON.stringify(state);
 const preview=buildPlanPreview(state,{},review),accepted=acceptPlanPreview(state,preview,review),again=buildPlanPreview(accepted,{},review);assert.deepEqual(accepted.activities,state.activities);assert.deepEqual(preview.plan.schedule,old.schedule);assert.deepEqual(preview.plan.sessions.find(s=>s.id===done.id),done);assert.equal(JSON.stringify(state),snapshot);
 assert(preview.plan.basis.profile.sessionSelectionHistory.length);for(const s of preview.plan.sessions.filter(s=>s.date>=review&&['tempo','interval','progressive','hills'].includes(s.type))){const repeat=again.plan.sessions.find(v=>v.id===s.id);assert.equal(repeat.type,s.type);assert.deepEqual(repeat.dose,s.dose);}
});
