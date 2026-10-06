'use client';
import React from 'react';
import {Play,Route,Timer,Gauge,Flame,ArrowRight} from 'lucide-react';
import {dailyFocus} from '../lib/daily-focus.mjs';
import {TYPES,pace,dateObj} from '../lib/engine.mjs';
import {sessionTotals,distanceText} from '../lib/session-instructions.mjs';
type State=Parameters<typeof dailyFocus>[0];
type Session=ReturnType<typeof dailyFocus>['session'];
const date=(d:string)=>dateObj(d).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'});
const type=(s:Session)=>TYPES[s.type as keyof typeof TYPES];
// RPE 1-10 shown as five bars so the effort reads at a glance.
const difficulty=(rpe:number)=>({bars:Math.max(1,Math.min(5,Math.ceil((+rpe||1)/2))),label:rpe<=3?'Suave':rpe<=5?'Moderado':rpe<=7?'Exigente':'Muy exigente'});
export default function DailyFocus({state,onOpen,onWeek,onHistory,onGoal}:{state:State,onOpen:(s:Session)=>void,onWeek:()=>void,onHistory:()=>void,onGoal:()=>void}){
 const focus=dailyFocus(state),s=focus.session;
 const title=focus.caution==='pain'?'Hoy: pausa y revisa las molestias':focus.kind==='workout'?`Hoy: ${type(s)}`:focus.kind==='completed'?'Entrenamiento de hoy registrado':focus.kind==='skipped'?'Hoy has omitido la sesión':focus.kind==='recorded'?'Carrera registrada hoy':focus.kind==='finished'?'Has terminado este bloque':'Hoy: descanso';
 const effort=s?difficulty(s.rpe):null;
 return <section className={`next-card daily-focus kind-${focus.kind}`} aria-label="Qué entreno hoy"><div className="next-header"><span className="eyebrow">ENTRENAMIENTO DE HOY</span><span className="next-date">{date(focus.date)}</span></div><h2>{title}</h2>
 {focus.caution&&<p className="daily-caution" role="status">{focus.caution==='pain'?'Has indicado molestias que afectan la zancada. Evita correr y valora la situación con un profesional antes de retomar.':focus.caution==='mild'?'Has indicado molestias leves. Evita intensidad y revisa la alternativa antes de salir.':'Has indicado fatiga alta. Revisa la alternativa suave o descansa si no mejora.'} El calendario conserva la sesión aceptada hasta que revises un cambio.</p>}
 {focus.kind==='workout'&&s?<><div className="today-type"><span className={`pill on-dark type-badge ${s.type}`}>{s.type==='race'?'Día de la carrera':type(s)}</span>{effort&&<span className="effort-meter" aria-label={`Dificultad: ${effort.label}, esfuerzo ${s.rpe} de 10`}>{Array.from({length:5},(_,i)=><i key={i} className={i<effort.bars?'on':''}/>)}<b>{effort.label}</b></span>}</div>
 <div className="next-metrics today-metrics"><div><Route size={18}/><strong>{s.distance!=null?distanceText(s.distance):'Por tiempo'}</strong><small>Distancia</small></div><div><Timer size={18}/><strong>{sessionTotals(s).duration}</strong><small>{sessionTotals(s).label}</small></div><div><Gauge size={18}/><strong>{s.range?`${pace(s.range[0])}–${pace(s.range[1])}`:'Por sensaciones'}</strong><small>{s.range?'Ritmo objetivo · min/km':s.conversation||'Sigue el esfuerzo de cada bloque'}</small></div><div><Flame size={18}/><strong>{s.rpe}/10</strong><small>Esfuerzo percibido</small></div></div>
 <p className="today-purpose">{s.purpose}</p>
 <details className="daily-reason"><summary>Por qué me toca</summary><p>{s.trainingFocus?.reason||s.phase?.reason||'Forma parte de la preparación aceptada, según tu base y disponibilidad.'}</p></details>
 {focus.unlinkedToday.length>0&&<p className="daily-caution">Ya hay una carrera guardada hoy que no completa esta sesión. Revisa su asociación antes de entrenar otra vez. <button className="lime" onClick={onHistory}>Revisar actividad de hoy</button></p>}
 <button className="lime cta-start" onClick={()=>onOpen(s)}><Play size={20} fill="currentColor"/>Comenzar entrenamiento</button></>:<><p className="today-purpose">{focus.kind==='completed'?'El registro actualiza calendario y estadísticas. Comprueba qué indica para tu siguiente sesión.':focus.kind==='skipped'?'No se traslada ni se acumula la carga omitida. Retoma la siguiente sesión según tus sensaciones.':focus.kind==='recorded'?'El registro suma estadísticas. Su asociación y propósito se revisan con los datos disponibles; no implica hacer otra carrera hoy.':focus.kind==='finished'?'Revisa tu objetivo para preparar el siguiente bloque. Tus actividades e historial se conservan.':s?.purpose||'No hay una sesión pautada para hoy. Recupera sin adelantar ni compensar entrenamientos.'}</p><button className="lime cta-start" onClick={focus.kind==='finished'?onGoal:focus.runs.length?onHistory:onWeek}>{focus.kind==='finished'?'Revisar siguiente objetivo':focus.runs.length?'Ver qué cambia tras mi carrera':'Ver mi semana'}<ArrowRight size={18}/></button></>}
 {focus.next&&<div className="daily-next"><div><small>A continuación</small><b>Después: {type(focus.next)}</b><p>{date(focus.next.date)} · {focus.next.distance!=null?distanceText(focus.next.distance):sessionTotals(focus.next).duration}</p></div><button className="text-button" onClick={()=>onOpen(focus.next)}>Consultar próxima sesión<ArrowRight size={16}/></button></div>}
 </section>;
}
