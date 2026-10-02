// Explicit questionnaire heuristics. Unknown answers stay unknown in stored profiles.
export const known=v=>v!==''&&v!=null&&Number.isFinite(+v);
export function realDate(v){const d=new Date(`${v}T12:00:00Z`);return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(+d)&&d.toISOString().slice(0,10)===v;}
export function comfortableEasy(p){return !['short','no'].includes(p.easyConversation)&&!(known(p.easyEffort)&&+p.easyEffort>4);}
export function recentLong(p,start){
 const age=realDate(p.longestDate)&&realDate(start)?Math.round((new Date(start)-new Date(p.longestDate))/86400000):null;
 const factor=Math.min(p.longestResult==='pain'?.5:p.longestResult==='hard'?.75:1,p.longestSource==='estimated'?.85:1,age>42?.7:1);
 return {value:known(p.longest)?+p.longest*factor:null,age,factor};
}
export function goalPriority(p){return p.goal.type==='nonstop'?'nonstop':p.goal.intent==='time'?'improve':p.goal.intent==='unknown'?'finish':p.goal.intent||(p.goal.type==='time'||p.goal.time?'improve':'finish');}
export function endurancePriority(p){return ['race','time','nonstop'].includes(p.goal.type)&&['finish','nonstop'].includes(goalPriority(p));}
export function updateAvailability(p,d,on){const days=(on?[...new Set([...p.days,d])]:p.days.filter(v=>+v!==d)).sort((a,b)=>((a+6)%7)-((b+6)%7));return {...p,days,minutes:{...p.minutes,[d]:p.minutes[d]??''},trainingDays:Math.max(1,Math.min(on&&+p.trainingDays===p.days.length?days.length:+p.trainingDays,days.length||1)),longDay:days.includes(+p.longDay)?+p.longDay:days.at(-1)??p.longDay,strengthDay:days.includes(+p.strengthDay)?+p.strengthDay:days[0]??p.strengthDay};}
