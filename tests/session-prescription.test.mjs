import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {blankProfile,session,fitSession,generate,addDays,pace,speed,raceSession} from '../lib/engine.mjs';
import {blockInstruction,conversationText,distanceText,durationText,fatigueAlternative,paceText,prescriptionSummary,prescriptionWarnings,recoveryInstruction,sessionTotals,speedText} from '../lib/session-instructions.mjs';

const start='2026-10-05';
const runner=(over={})=>({...blankProfile(),experience:'regular',weeklyKm:36,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:16,consistency:'continuous',longest:14,longestDate:'2026-09-27',longestSource:'measured',longestResult:'comfortable',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',pain:'none',recovery:'good',runningRestriction:'none',days:[1,2,4,0],trainingDays:4,longDay:0,minutes:{1:60,2:70,4:70,0:180},marks:[{date:'2026-09-20',distance:5,time:'25:00',effort:'race',context:'competition',measurement:'measured',terrain:'asphalt'}],goal:{type:'race',intent:'improve',distance:5,date:addDays(start,70),time:'',flexibility:'any',terrain:'asphalt'},...over});
const workout=(p,type,km=6,minutes=40,week=0)=>session(p,type,start,km,minutes,week,null,start);

test('real distance intervals include exactly n−1 recoveries and all blocks in their total',()=>{
 const p=runner(),s=workout(p,'interval',4),info=recoveryInstruction(s),total=sessionTotals(s);
 assert.equal(s.repetitions.count,4);assert.equal(s.repetitions.workDistance,.4);assert.equal(info.count,3);assert.equal(s.repetitions.recoveryCount,3);assert.equal(info.placement,'between');
 assert.match(info.text,/3 recuperaciones de 200 m/);assert.match(info.text,/tras la última no hay otra recuperación/);
 assert.equal(s.distance,4);assert.equal(total.distance,4);assert.equal(total.seconds,s.seconds);assert(total.matching);assert.equal(total.timing,'estimated');
 assert.equal(s.blocks.filter(b=>b.label.startsWith('Repetición')).reduce((n,b)=>n+b.distance,0),1.6);
 assert.match(prescriptionSummary(s).find(row=>row.kind==='main').text,/4 × 400 m/);assert.deepEqual(prescriptionWarnings(s),[]);
});
test('timed intervals prescribe actual work, n−1 pauses and the remaining soft running',()=>{
 const s=workout(runner({marks:[],easyPace:''}),'interval',0,30),info=recoveryInstruction(s),total=sessionTotals(s);
 assert.equal(s.type,'interval');assert.equal(total.timing,'prescribed');assert.equal(total.seconds,1800);assert.equal(info.count,s.repetitions.count-1);
 assert.match(info.text,/rodaje suave restante/);assert.equal(s.blocks.at(-1).kind,'cooldown');assert(total.matching);assert.deepEqual(prescriptionWarnings(s),[]);
});
test('short quality sessions have real easy labels, focus and effort instead of fake intervals',()=>{
 const p=runner({marks:[],easyPace:''}),s=workout(p,'interval',0,10);
 assert.equal(s.type,'easy');assert.equal(s.rpe,3);assert.equal(s.repetitions,null);assert(s.blocks.every(b=>b.effort<=3));assert.match(s.trainingFocus.reason,/cómoda/);
 for(const type of ['interval','tempo','hills']){const fitted=fitSession({...p,minutes:{1:12}},type,start,0,12,0,null,start);assert.equal(fitted.type,'easy');assert(fitted.seconds<=720);}
});
test('hills and run/walk retain a final recovery and never invent a distance',()=>{
 const p=runner();for(const type of ['hills','walk']){
  const s=workout(p,type,0,30),info=recoveryInstruction(s),total=sessionTotals(s);
  assert.equal(info.count,s.repetitions.count);assert.equal(info.placement,'after-each');assert.match(info.text,/incluida la última/);assert.equal(s.repetitions.recoveryCount,info.count);
  assert.equal(s.distance,null);assert.equal(total.distance,0);assert.equal(total.seconds,1800);assert.equal(total.timing,'prescribed');assert(total.matching);
  assert.deepEqual(prescriptionWarnings(s),[]);
 }
 const hills=workout(p,'hills',0,30);assert.equal(blockInstruction(hills,hills.blocks.find(b=>b.effort===6)).pace,null);
});
test('explicit continuous tempo keeps its purpose and dose without calendar-driven growth',()=>{
 for(const timed of [false,true])for(const distance of [10,21.1]){
  const p=runner({goal:{...runner().goal,distance},...(timed?{marks:[],easyPace:''}:{})});
  const sessions=[0,4,12,20].map(week=>session(p,'tempo',start,8,40,week,null,start,{format:'tempo-continuous'}));
  const work=sessions.map(s=>s.blocks.find(b=>b.label.startsWith('Tempo')).distance||s.blocks.find(b=>b.label.startsWith('Tempo')).seconds);
  assert(work.every(v=>v===work[0]));assert(sessions.every(s=>sessionTotals(s).matching));
  assert(sessions.every(s=>s.blocks.find(b=>b.label==='Aproximación suave').kind==='main'));
  const initial=sessions[0],main=initial.blocks.filter(b=>b.kind==='main').reduce((n,b)=>n+(timed?b.seconds:b.distance),0);
  assert(Math.abs(work[0]/main-.4)<.03,'tempo fraction describes the main block, including its soft approach and exit');
  assert(sessions.every(s=>recoveryInstruction(s).count===0));assert(sessions.every(s=>prescriptionSummary(s).find(row=>row.kind==='main').text.includes('Tempo continuo')));
  if(timed)assert.equal(sessions[0].seconds,2400);
 }
});
test('minutes, seconds, practical distances and pace/speed conversions are legible and correct',()=>{
 assert.equal(distanceText(.4),'400 m');assert.equal(distanceText(.2),'200 m');assert.equal(distanceText(1),'1 km');assert.equal(distanceText(1.2),'1,2 km');assert.equal(distanceText(21.097),'21,097 km');
 assert.equal(durationText(30),'30 s');assert.equal(durationText(90),'1 min 30 s');assert.equal(durationText(3630),'1 h 30 s');
 assert.equal(pace(360),'6:00');assert.equal(speed(360),10);assert.equal(speed(300),12);assert.equal(speed(400),9);assert.equal(pace(359.6),'6:00');
 assert.equal(paceText([360,400]),'6:00–6:40 min/km');assert.equal(speedText([360,400]),'9–10 km/h');assert.equal(speedText(null,360),'10 km/h');
 assert.equal(speedText(null,null),null);assert.equal(paceText(null,null),null);
});
test('time blocks remain prescribed even when a warmup has a numerical pace reference',()=>{
 const p=runner(),s=workout(p,'hills',0,40),warm=s.blocks[0];assert(warm.range);assert.equal(blockInstruction(s,warm).timing,'prescribed');
 const distance=workout(p,'easy',6);assert.equal(blockInstruction(distance,distance.blocks[0]).timing,'estimated');
 const mixed={...distance,blocks:[...distance.blocks,{kind:'recovery',label:'Recuperación parada',distance:0,seconds:90,effort:1}],seconds:distance.seconds+90};
 const total=sessionTotals(mixed);assert(total.matching);assert.equal(total.timing,'mixed');assert.equal(total.prescribedSeconds,90);
});
test('each block has its own effort and conversation; hard work is never described as recovery',()=>{
 const s=workout(runner({marks:[],easyPace:''}),'interval',0,30),work=s.blocks.find(b=>b.effort===7),rec=s.blocks.find(b=>b.kind==='recovery');
 assert.match(blockInstruction(s,work).conversation,/Frases cortas/);assert.match(blockInstruction(s,rec).conversation,/sin esfuerzo/);assert.match(conversationText(5),/sin acabar al máximo/);
});
test('heart-rate ranges require coherent measured data even when legacy session HR is populated',()=>{
 const s=workout(runner(),'interval',6),work=s.blocks.find(b=>b.effort===7),warm=s.blocks[0];
 for(const profile of [{restHR:60,maxHR:190,hrSource:'unknown'},{restHR:60,maxHR:190,hrSource:'estimated'},{restHR:190,maxHR:60,hrSource:'measured'},{restHR:'',maxHR:190,hrSource:'measured'}])assert.equal(blockInstruction({...s,hr:[100,170],profile},work).hr,null);
 const profile={restHR:60,maxHR:190,hrSource:'measured'};assert.deepEqual(blockInstruction({...s,profile},work).hr,[151,171]);assert.deepEqual(blockInstruction({...s,profile},warm).hr,[125,151]);
 assert.equal(blockInstruction({...s,type:'strength',profile},work).hr,null);assert.equal(blockInstruction({...s,type:'race',profile},work).hr,null);
});
test('fatigue alternatives have exact totals, lower duration and effort and preserve run/walk',()=>{
 const p=runner();for(const type of ['interval','tempo','long','hills','walk','easy']){
  const s=workout(p,type,8,40),original=structuredClone(s),alt=fatigueAlternative(p,s,start);
  assert(alt.seconds<=s.seconds*.7);assert(alt.seconds>0);assert.equal(alt.hard,false);assert(alt.blocks.every(b=>b.effort<=3));assert(sessionTotals(alt).matching);assert.deepEqual(s,original);
  assert.match(alt.description,/No acumules/);if(type==='walk'){assert.equal(alt.type,'walk');assert(recoveryInstruction(alt).count>0);}else assert.equal(alt.type,'recovery');
 }
 const strength=fatigueAlternative(p,workout(p,'strength',0,35),start);assert.equal(strength.seconds,600);assert(sessionTotals(strength).matching);
});
test('current restrictions cap alternatives and relevant pain or a race offers concrete rest',()=>{
 const p=runner(),s=workout(p,'interval',8,40);
 const alt=fatigueAlternative({...p,runningRestriction:'time-limit',restrictionMinutes:15},s,start);assert(alt.seconds<=900);
 for(const profile of [{...p,pain:'relevant'},{...p,runningRestriction:'no-running'},{...p,runningRestriction:'time-limit',restrictionMinutes:''}])assert.equal(fatigueAlternative(profile,s,start).type,'rest');
 const race=raceSession(p,{start,created:start});assert.equal(fatigueAlternative(p,race,start).type,'rest');
 assert.equal(sessionTotals(race).distance,5);assert.match(prescriptionSummary(race)[0].text,/fuera de la distancia oficial/);
 const unknown=raceSession({...p,goal:{...p.goal,distance:''}},{start,created:start});assert.equal(sessionTotals(unknown).timing,'unknown');assert.equal(sessionTotals(unknown).duration,'Sin estimación');
});
test('legacy blocks are readable without mutation; inconsistencies are visible instead of hidden',()=>{
 const s=workout(runner(),'interval',4);s.blocks=s.blocks.map(b=>{const legacy={...b};delete legacy.kind;delete legacy.durationType;return legacy;});delete s.repetitions.recoveryCount;delete s.repetitions.recoveryPlacement;
 const before=structuredClone(s);assert.equal(recoveryInstruction(s).count,3);assert(sessionTotals(s).matching);assert.deepEqual(prescriptionWarnings(s),[]);assert.deepEqual(s,before);
 assert(prescriptionWarnings({...s,distance:5}).some(w=>w.includes('total')));assert(prescriptionWarnings({...s,repetitions:{...s.repetitions,count:7}}).some(w=>w.includes('repeticiones')));
 const legacyFake={...workout(runner({marks:[],easyPace:''}),'easy',0,10),type:'interval',rpe:7};assert(prescriptionWarnings(legacyFake).some(w=>w.includes('solo pautan carrera suave')));
});
test('different real engine plans preserve exact sums, metadata and practical distance blocks',()=>{
 const regular=runner(),novice=runner({experience:'beginner',weeklyKm:0,longest:'',marks:[],easyPace:'',recentFrequency:0,consistency:'returning',goal:{...regular.goal,intent:'finish'}});
 for(const p of [regular,novice,runner({goal:{...regular.goal,distance:10}}),runner({goal:{...regular.goal,distance:21.1,date:addDays(start,112)}}),runner({goal:{...regular.goal,distance:10,terrain:'trail',elevation:300}})]){
  const plan=generate(p,start);for(const s of plan.sessions){
   assert(sessionTotals(s).matching,`${s.type} ${s.date}`);assert.deepEqual(prescriptionWarnings(s),[]);
   for(const b of s.blocks||[])if(s.type!=='race'&&b.distance>0)assert(Math.abs(b.distance*10-Math.round(b.distance*10))<1e-8);
   if(s.repetitions)assert.equal(recoveryInstruction(s).count,s.repetitions.recoveryCount);
  }
 }
});

const baseRequire=createRequire(import.meta.url),cache={},root=fileURLToPath(new URL('..',import.meta.url));
function load(file){if(cache[file])return cache[file].exports;const loaded={exports:{}},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;cache[file]=loaded;new Function('require','module','exports',code)(specifier=>{if(!specifier.startsWith('.'))return baseRequire(specifier);const target=path.resolve(path.dirname(file),specifier);return target.endsWith('.mjs')?baseRequire(target):load(target+'.tsx');},loaded,loaded.exports);return loaded.exports;}
const components=load(path.join(root,'app/session-prescription.tsx'));
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
test('calendar and detail render the same count, practical blocks, timing and concrete alternative',()=>{
 const p=runner(),s=workout(p,'interval',4),calendar=render(components.CalendarPrescription,{s}),detail=render(components.default,{s,profile:p,referenceDate:start});
 for(const html of [calendar,detail]){assert.match(html,/4 × 400 m/);assert.match(html,/3 recuperaciones de 200 m/);assert.match(html,/Calentamiento/);assert.match(html,/Vuelta a la calma/);assert.doesNotMatch(html,/NaN|undefined/);}
 assert.match(detail,/Duración estimada por ritmo/);assert.match(detail,/Los bloques suman el total/);assert.match(detail,/Recuperación reducida/);assert.match(detail,/Ver los bloques de la alternativa/);assert.match(detail,/6:00 min\/km equivale a 10 km\/h/);
 assert.doesNotMatch(detail,/FC orientativa: \d/);assert.match(detail,/Sin FC pautada/);
 const measured=render(components.default,{s,profile:{...p,hrSource:'measured',restHR:60,maxHR:190},referenceDate:start});assert.match(measured,/FC orientativa: 151–171 ppm/);
 const timed=render(components.default,{s:workout(runner({marks:[],easyPace:''}),'interval',0,30),profile:p,referenceDate:start});assert.match(timed,/Duración prescrita: 30 min/);assert.match(timed,/no se inventa una distancia/);
});
test('the detail explains a library format and a time-driven substitution',()=>{
 const p=runner({goal:{...runner().goal,distance:21.1}}),s=session(p,'tempo',start,8,40,0,{key:'build'},start),html=render(components.default,{s,profile:p,referenceDate:start});
 assert.match(html,/Tempo fraccionado/);assert.match(html,/2 ×/);assert.match(html,/1 recuperación/);assert.match(html,/Base regular confirmada/);
 const short=fitSession({...p,minutes:{1:12}},'tempo',start,8,12,0,{key:'build'},start),alternative=render(components.default,{s:short,profile:p,referenceDate:start});assert.match(alternative,/Sesión sustituida/);assert.match(alternative,/carrera fácil|calentamiento/i);
});
test('strength instructions show complete rounds, rests and material-specific movements without running repetitions',()=>{
 const p=runner({strengthEquipment:'weights'}),s=workout(p,'strength',0,25),detail=render(components.default,{s,profile:p,referenceDate:start}),calendar=render(components.CalendarPrescription,{s});
 for(const text of ['Fuerza complementaria','2 ronda','10 ejercicios','mancuerna ligera','Descansa','Respira'])assert(detail.includes(text),text);
 assert(!calendar.includes('calendar-repetitions'));assert(!detail.includes('NaN'));
});
