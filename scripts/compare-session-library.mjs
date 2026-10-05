// Fixed-date fictional examples; no personal data store is opened.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {blankProfile,generate,session,fitSession,addDays,day,monday,validatePlan,planDiagnostics} from '../lib/engine.mjs';
import {sessionTotals,recoveryInstruction,prescriptionSummary,paceText} from '../lib/session-instructions.mjs';
import {sessionLoad,progressionAudit} from '../lib/session-library.mjs';
const start='2026-10-05';
const mark=(id,distance,time,date)=>({id,distance,time,elapsedTime:time,date,context:'competition',measurement:'measured',effort:'race',terrain:'asphalt',elevation:0,temperature:16,conditions:'normal'});
const base={...blankProfile(),experience:'regular',weeklyKm:36,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:16,consistency:'continuous',recovery:'good',fatigue:2,runningRestriction:'none',longest:14,longestDate:'2026-10-04',longestSource:'measured',longestResult:'comfortable',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',days:[1,2,4,0],minutes:{1:75,2:60,4:75,0:180},trainingDays:4,longDay:0,marks:[mark('five',5,'25:00','2026-09-14'),mark('ten',10,'52:07','2026-09-21')],goal:{type:'race',intent:'improve',distance:10,date:'2027-01-25',time:'',terrain:'asphalt'}};
const profiles=[
 {name:'Inicio: 5 km, sin carrera continua confirmada',profile:{...base,experience:'beginner',weeklyKm:0,recentFrequency:0,consistentWeeks:0,consistency:'returning',longest:'',marks:[],easyPace:'',days:[1,3,6],minutes:{1:25,3:25,6:30},trainingDays:3,longDay:6,goal:{...base.goal,distance:5,intent:'finish'}}},
 {name:'5 km: base de 24 km, tres días',profile:{...base,weeklyKm:24,recentFrequency:3,consistentWeeks:12,longest:8,days:[1,3,6],minutes:{1:45,3:45,6:75},trainingDays:3,longDay:6,goal:{...base.goal,distance:5}}},
 {name:'10 km: base de 36 km y complemento de fuerza',profile:{...base,strength:true,strengthDay:2,strengthEquipment:'none'}},
 {name:'Media maratón: base de 36 km y tirada reciente de 14 km',profile:{...base,goal:{...base.goal,distance:21.1}}},
 {name:'Maratón: base de 50 km y tirada reciente de 22 km',profile:{...base,weeklyKm:50,longest:22,consistentWeeks:20,minutes:{1:90,2:60,4:90,0:180},goal:{...base.goal,distance:42.2,date:addDays(start,168)}}},
 {name:'Media maratón con CrossFit exigente ya declarado',profile:{...base,strength:true,strengthDay:4,days:[1,2,3,4,6,0],minutes:{1:75,2:60,3:60,4:75,6:75,0:180},otherSports:[{id:'cf',type:'crossfit',day:5,minutes:45,intensity:'hard'}],goal:{...base.goal,distance:21.1}}},
 {name:'10 km con 20 minutos entre semana',profile:{...base,days:[1,3,6],minutes:{1:20,3:20,6:40},trainingDays:3,longDay:6}},
 {name:'10 km con pendientes en la carrera objetivo',profile:{...base,goal:{...base.goal,elevation:100}}}
];
const describe=s=>({date:s.date,type:s.type,format:s.format?.title||null,phase:s.phase?.label||null,distance:s.distance,minutes:Math.round(s.seconds/60*10)/10,pace:paceText(s.range)||'Por esfuerzo',effort:s.rpe,repetitions:s.repetitions,recovery:recoveryInstruction(s).text,load:s.load||null,purpose:s.purpose,reason:s.selectionReason||s.substitution?.reason||s.fit?.reason||s.progression,outline:prescriptionSummary(s),blocks:s.blocks});
const reports=profiles.map(({name,profile})=>{
 const snapshot=JSON.stringify(profile),plan=generate(profile,start),seen=new Map();assert.deepEqual(validatePlan(plan,profile),[]);assert.deepEqual(planDiagnostics(plan),[]);assert.equal(JSON.stringify(profile),snapshot);
 for(const s of plan.sessions){assert(sessionTotals(s).matching);if(s.load)assert.deepEqual(s.load,sessionLoad(s.blocks));if(s.type!=='race')assert(s.seconds<=profile.minutes[day(s.date)]*60);if(['tempo','interval','progressive','hills'].includes(s.type)){for(const key of [s.format.id,s.type]){const old=seen.get(key);if(old)assert(progressionAudit(old,s).allowed);seen.set(key,s);}}}
 const formats=[...new Set(plan.sessions.filter(s=>s.type!=='race').map(s=>s.format?.id).filter(Boolean))];
 const examples=formats.map(id=>describe(plan.sessions.find(s=>s.format?.id===id)));
 const weeks=[...new Set(plan.sessions.map(s=>monday(s.date)))].slice(0,9).map(date=>{const sessions=plan.sessions.filter(s=>monday(s.date)===date&&s.type!=='race');return {date,phase:sessions[0]?.phase?.label||null,km:Math.round(sessions.reduce((n,s)=>n+(s.distance||0),0)*10)/10,minutes:Math.round(sessions.reduce((n,s)=>n+s.seconds/60,0)),runningCount:sessions.filter(s=>!['strength','rest'].includes(s.type)).length,quality:sessions.filter(s=>['tempo','interval','progressive','hills'].includes(s.type)).map(s=>s.format.title),strengthMinutes:sessions.filter(s=>s.type==='strength').reduce((n,s)=>n+s.seconds/60,0)};});
 return {name,base:{weeklyKm:profile.weeklyKm,frequency:profile.recentFrequency,consistentWeeks:profile.consistentWeeks,longest:profile.longest,availableMinutes:profile.minutes,goal:profile.goal,otherSports:profile.otherSports},formats,examples,weeks,notes:plan.context.notes,viability:plan.viability.notes,phaseOrigin:plan.schedule.start,phases:plan.schedule,qualityCount:plan.qualitySummary.count};
});
const shortened=[15,20,25,30,35,40].map(minutes=>({minutes,session:describe(fitSession({...base,minutes:{1:minutes}},'interval',start,8,0,0,{key:'build',label:'Desarrollo'},start))}));
const report={date:start,fictional:true,profiles:reports,shortened,strengthTenMinutes:describe(session(base,'strength',start,0,10,0,null,start))};
writeFileSync(new URL('../docs/biblioteca-sesiones-comparacion.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({profiles:reports.map(r=>({name:r.name,formats:r.formats,firstWeek:r.weeks[0],qualityCount:r.qualityCount})),shortened:shortened.map(r=>({minutes:r.minutes,type:r.session.type,distance:r.session.distance,repetitions:r.session.repetitions?.count,workDistance:r.session.repetitions?.workDistance,actualMinutes:r.session.minutes,reason:r.session.reason})),strengthTenMinutes:{minutes:report.strengthTenMinutes.minutes,format:report.strengthTenMinutes.format}},null,2));
