// The calendar owns its accepted goal. Editing the profile only proposes a new one.
export function acceptedGoal(state){
 const plan=state.plan,stored=plan?.basis?.profile?.goal;
 if(!plan)return state.profile?.goal||{type:'unknown'};
 const races=(plan.sessions||[]).filter(s=>s.type==='race');
 const race=stored?races.find(s=>s.date===stored.date):races.find(s=>s.date===plan.end)||races.at(-1);
 if(race)return {...(stored||{}),type:stored?.type||'race',date:race.date,distance:race.distance};
 return stored||{type:'unknown'};
}
export function goalAwaitingReview(state){
 if(!state.plan)return false;
 const accepted=acceptedGoal(state),current=state.profile?.goal||{};
 const keys=state.plan.basis?.profile?['type','intent','distance','date','time','flexibility','terrain','elevation']:['type','distance','date'];
 return keys.some(k=>String(accepted[k]??'')!==String(current[k]??''));
}
export function pendingGoalMessage(state){
 if(!goalAwaitingReview(state))return '';
 const goal=state.profile?.goal||{},details=[goal.distance!==''&&goal.distance!=null?`${goal.distance} km`:'',goal.date?`el ${goal.date}`:''].filter(Boolean).join(', ');
 return `Nuevo objetivo pendiente${details?`: ${details}`:''}. El calendario conserva la meta aceptada hasta revisar y aceptar otro plan.`;
}
