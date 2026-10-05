import {blankProfile,empty,generate,session} from '../../lib/engine.mjs';
export const start='2026-10-05';
export function coachFixture(){
 const profile={...blankProfile(),experience:'regular',weeklyKm:36,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:4,consistentWeeks:16,consistency:'continuous',recovery:'good',fatigue:2,pain:'none',runningRestriction:'none',longest:14,longestDate:'2026-09-06',longestSource:'measured',longestResult:'comfortable',easyPace:'6:30',easySource:'measured',easyEffort:3,easyConversation:'yes',days:[1,2,4,5,0],minutes:{1:60,2:60,4:60,5:120,0:120},trainingDays:4,longDay:0,goal:{type:'race',intent:'improve',distance:21.1,date:'2027-01-25',time:'',terrain:'asphalt'}};
 return {...empty(),profile,plan:generate(profile,'2026-09-07')};
}
export function withIntervals(){
 const state=coachFixture(),p={...state.profile,marks:[{id:'measured',date:'2026-09-20',distance:5,time:'25:00',effort:'race',measurement:'measured',context:'competition',terrain:'asphalt'}]},interval=session(p,'interval','2026-10-01',6,0,0,null,start);
 const work=interval.blocks.filter(b=>b.role==='work'),laps=interval.blocks.map(b=>({kind:b.role==='work'?'work':b.kind,distance:b.distance,seconds:b.role==='work'?Math.round(b.distance*(work.indexOf(b)===1?b.range[0]-25:(b.range[0]+b.range[1])/2)):b.seconds,rpe:b.effort}));
 const actual={id:'interval-watch',source:'personal-file',dataUseConsent:true,origin:'personal-device',date:interval.date,sessionId:interval.id,type:'interval',distance:interval.distance,seconds:laps.reduce((n,b)=>n+b.seconds,0),rpe:7,pain:'none',fatigue:3,terrain:'asphalt',temperature:null,laps};
 return {...state,profile:p,plan:{...state.plan,sessions:state.plan.sessions.map(s=>s.date===interval.date?interval:s)},activities:[actual]};
}
