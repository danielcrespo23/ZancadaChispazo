import {today,daysBetween,addDays,monday,trainingPhase} from './engine.mjs';
import {isOwnActivity,isFinished,weekSummary} from './training.mjs';

export function raceCoaching(state,date=today()){
 const p=state.profile,plan=state.plan;
 if(!p?.goal?.date||!plan)return null;
 const days=daysBetween(date,p.goal.date),week=Math.max(0,Math.floor(daysBetween(monday(plan.start),monday(date))/7));
 const phase=trainingPhase(p,date,week,plan.start),summary=weekSummary(state,date);
 const pending=plan.sessions.filter(s=>s.date>=date&&!s.skipped&&!isFinished(s,state)&&!['rest','race'].includes(s.type));
 const next=pending[0]||null,key=pending.find(s=>['long','tempo','interval','hills','progressive'].includes(s.type)&&s.date<addDays(monday(date),7));
 const runs=(state.activities||[]).filter(a=>isOwnActivity(a)&&a.date<=date&&a.date>=addDays(date,-7));
 const check=(state.checkIns||[]).find(c=>c.date===date);
 const pain=p.pain==='relevant'||check?.pain==='relevant'||runs.some(a=>a.pain==='relevant');
 const caution=p.pain==='mild'||check?.pain==='mild'||+check?.fatigue>=7||runs.some(a=>a.pain==='mild'||a.fatigue>=7);
 const alerts=[];
 if(plan.end!==p.goal.date)alerts.push('La fecha del perfil y la del calendario no coinciden. Revisa el plan antes de seguirlo.');
 if(pain)alerts.push('Has declarado dolor que afecta la zancada. Pausa la carrera y revisa la situación antes de retomar.');
 else if(caution)alerts.push('Hay molestias o fatiga alta recientes. Prioriza descanso o carrera cómoda y revisa tus sensaciones.');
 const missed=plan.sessions.filter(s=>s.date<date&&s.date>=addDays(date,-7)&&!['rest','race'].includes(s.type)&&!isFinished(s,state));
 if(missed.length)alerts.push(`${missed.length} sesiones recientes sin completar. No acumules su carga: registra lo realizado y continúa desde tu situación actual.`);
 const lastRun=[...(state.activities||[])].filter(a=>isOwnActivity(a)&&a.distance>0&&a.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
 if(lastRun&&daysBetween(lastRun.date,date)>=14)alerts.push('Llevas al menos dos semanas sin carreras registradas. Si has parado realmente, revisa tu base antes de retomar el calendario.');
 const focus=days<0?'La carrera ya ha pasado. Registra tus sensaciones y fija el siguiente objetivo.':days===0?'Hoy es tu carrera. Sigue tu estrategia y empieza con control.':pain?'Hoy la prioridad es recuperar, no completar kilómetros.':caution?'Mantén el esfuerzo cómodo; no fuerces la sesión clave.':phase.key==='taper'?'Llegar con frescura: reduce volumen y evita recuperar entrenamientos perdidos.':phase.key==='deload'?'Asimilar el trabajo: respeta la descarga aunque te encuentres bien.':phase.key==='specific'?`Practicar el esfuerzo de ${p.goal.distance} km con control, respetando las recuperaciones.`:phase.key==='base'?'Construir constancia con esfuerzo cómodo antes de añadir exigencia.':'Desarrollar resistencia sin aumentar ritmo y volumen a la vez.';
 const roadmap=[];
 for(let offset=0;offset<Math.min(8,Math.ceil(Math.max(0,days)/7)+1);offset++){
  const start=addDays(monday(date),offset*7),end=addDays(start,7);
  const sessions=plan.sessions.filter(s=>s.date>=start&&s.date<end&&!s.skipped);
  if(!sessions.length)continue;
  const training=sessions.filter(s=>!['race','rest'].includes(s.type));
  roadmap.push({start,phase:sessions.find(s=>s.phase)?.phase||trainingPhase(p,start,week+offset,plan.start),km:Math.round(training.reduce((n,s)=>n+(s.distance||0),0)*10)/10,minutes:Math.round(training.reduce((n,s)=>n+(s.seconds||0),0)/60),runs:training.filter(s=>s.type!=='strength').length,race:sessions.some(s=>s.type==='race')});
 }
 return {days,phase,focus,alerts,next,key,summary,roadmap,completed:days<0};
}
