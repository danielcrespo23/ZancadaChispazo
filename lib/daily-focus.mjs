import {today} from './engine.mjs';
import {isFinished} from './training.mjs';
import {isTrainingActivity} from './activity-source.mjs';

export function currentCare(state,start=today()){
 const profile=state.profile||{},check=(state.checkIns||[]).find(c=>c.date===start),levels=['unknown','none','mild','relevant'];
 const pain=levels[Math.max(levels.indexOf(profile.pain),levels.indexOf(check?.pain),0)];
 const fatigue=[profile.fatigue,check?.fatigue].filter(v=>v!==''&&v!=null&&Number.isFinite(+v));
 return {...profile,pain,fatigue:fatigue.length?Math.max(...fatigue.map(Number)):null};
}
export function dailyFocus(state,start=today()){
 const sessions=state.plan?.sessions||[],session=sessions.find(s=>s.date===start)||null;
 const next=sessions.find(s=>s.date>start&&s.type!=='rest'&&!s.skipped&&!isFinished(s,state))||null;
 const runs=(state.activities||[]).filter(a=>isTrainingActivity(a)&&a.date===start),care=currentCare(state,start);
 const kind=!state.plan?'no_plan':session&&isFinished(session,state)?'completed':session?.skipped?'skipped':session&&session.type!=='rest'?'workout':sessions.length&&start>state.plan.end?'finished':runs.length?'recorded':'rest';
 const caution=care.pain==='relevant'?'pain':care.pain==='mild'?'mild':care.fatigue>=7?'fatigue':null;
 return {kind,session,next,runs,care,caution,unlinkedToday:runs.filter(a=>!a.sessionId),date:start};
}
export function acceptedGoal(state){
 const race=state.plan?.sessions.find(s=>s.type==='race'),goal=state.plan?.basis?.profile?.goal;
 return race?{...(goal||state.profile?.goal),type:'race',date:race.date,distance:race.distance}:goal||state.profile?.goal||{type:'unknown'};
}
export function goalAwaitingReview(state){
 if(!state.plan)return false;
 if(!state.plan.basis?.profile){
  const race=state.plan.sessions.find(s=>s.type==='race'),current=state.profile?.goal||{};
  return race?current.type!=='race'||String(race.date)!==String(current.date)||Number(race.distance)!==Number(current.distance):current.type==='race';
 }
 const old=state.plan.basis.profile.goal||{},current=state.profile?.goal||{};
 return ['type','intent','distance','date','time','flexibility'].some(k=>String(old[k]??'')!==String(current[k]??''));
}
