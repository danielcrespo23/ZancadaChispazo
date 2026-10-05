// Fictional fixed-date fixtures; no personal database is read or written.
import {writeFileSync} from 'node:fs';
import {blankProfile,empty,metrics,raceEstimate,session,proposal,progressEvidence,generate,addDays,pace,TYPES} from '../lib/engine.mjs';
import {buildPlanPreview} from '../lib/training.mjs';
import {readableRange} from '../lib/reference-evidence.mjs';
const date='2026-10-05';
const mark=(over={})=>({id:'5k',date:'2026-09-14',distance:5,time:'25:00',elapsedTime:'25:00',context:'competition',measurement:'measured',effort:'race',terrain:'asphalt',temperature:16,elevation:0,conditions:'normal',...over});
const p={...blankProfile(),experience:'regular',weeklyKm:30,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:3,consistentWeeks:12,consistency:'continuous',fatigue:2,recovery:'good',runningRestriction:'none',longest:12,longestDate:'2026-10-04',longestSource:'measured',longestResult:'comfortable',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',days:[1,3,6],minutes:{1:90,3:90,6:120},marks:[mark(),mark({id:'10k',date:'2026-09-21',distance:10,time:'52:07',elapsedTime:'52:07'})],goal:{type:'race',date:'2027-01-25',distance:10,time:'50:00',intent:'improve',terrain:'asphalt'}};
const cases=[
 ['Equivalentes',p],
 ['Contradictorias',{...p,marks:[mark(),mark({id:'fast',date:'2026-09-21',time:'20:00',elapsedTime:'20:00'})]}],
 ['Nueva menos comparable',{...p,marks:[mark({id:'clean',distance:10,time:'52:07',elapsedTime:'52:07'}),mark({id:'new',date:'2026-10-03',time:'20:00',elapsedTime:'20:00',context:'test',temperature:28,elevation:60})]}],
 ['Antigua (126 días)',{...p,marks:[mark({date:'2026-06-01'})]}],
 ['Ausentes; cómodo declarado',{...p,marks:[]}],
 ['Sin referencias ni ritmo declarado',{...p,marks:[],easyPace:''}]
].map(([name,profile])=>{
 const m=metrics(profile,date),race=raceEstimate(profile,date);
 return {name,anchor:m.mark?.id||null,capacity:readableRange(m.capacity.paceRange),confidence:m.confidence,easy:readableRange(m.ranges.easy),tempo:readableRange(m.ranges.tempo),raceEstimate:race.seconds?{secondsRange:race.secondsRange,pointSeconds:race.seconds}:null,goalPace:pace(m.desiredRacePace?.paceSeconds),limitations:m.missing,assessments:m.capacity.assessments,conflicts:m.capacity.conflicts};
});
const past=[-14,-7,0].map(n=>session(p,'easy',addDays(date,n),5,0,1,null,date));
const activities=past.map((s,i)=>({id:'comfortable-'+i,date:s.date,sessionId:s.id,type:'easy',distance:5,seconds:1875,elapsedSeconds:1875,measurement:'measured',rpe:3,fatigue:2,pain:'none',feeling:'bien',conversation:'yes',terrain:'asphalt',temperature:16,elevation:0}));
const future=[2,7].map(n=>session(p,'easy',addDays(date,n),5,0,4,null,date));
future.push(session(p,'tempo',addDays(date,9),6,0,4,null,date));
const plan={start:addDays(date,-14),created:addDays(date,-14),end:p.goal.date,sessions:[...past,...future]},update=proposal(activities.at(-1),plan,p,activities,[],date);
const missing=activities.map(a=>({...a,temperature:null})),held=progressEvidence(missing.at(-1),plan,p,missing,[],date);
const preview=buildPlanPreview({...empty(),profile:p,plan:generate(p,'2026-09-21'),activities},{calibratePaces:true},date);
const report={date,fictional:true,cases,progress:{observedComfortablePace:pace(375),goalPace:pace(300),evidence:activities.map(({id,date,distance,seconds,rpe,fatigue,temperature})=>({id,date,distance,seconds,rpe,fatigue,temperature})),changes:update?.changes.map(c=>({date:c.before.date,type:TYPES[c.before.type],distance:c.before.distance,beforeRange:readableRange(c.before.range),afterRange:readableRange(c.after.range)})),reason:update?.reason,missingTemperatureReason:held.reason},calibrationPreview:{reasons:preview.reasons,phaseOrigin:preview.plan.schedule.start,paceEvidenceCount:preview.plan.basis.profile.paceEvidence.length}};
writeFileSync(new URL('../docs/calibracion-comparacion.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({cases:cases.map(({name,anchor,capacity,confidence,easy,tempo,raceEstimate})=>({name,anchor,capacity,confidence,easy,tempo,raceEstimate})),progress:report.progress},null,2));
