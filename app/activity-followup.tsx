'use client';
import React,{useState} from 'react';
import {analysisForActivity,associateActivities,today,TYPES,undoActivityAssociation} from '../lib/engine.mjs';
import {activityLabel} from '../lib/activity-evidence.mjs';
import {activitySourceLabel,isTrainingActivity} from '../lib/activity-source.mjs';
import {distanceText,durationText} from '../lib/session-instructions.mjs';

export type FollowupActivity={id:string,date:string,type:string,distance:number,seconds:number,sessionId?:string,groupId?:string,partRole?:string,notes?:string,rpe?:number|null,fatigue?:number|null,pain?:string,feeling?:string,name?:string,startedAt?:string,source?:string};
export type FollowupState={activities:FollowupActivity[],profile?:{timezone?:string}|null,plan?:{sessions:{id:string,date:string,type:string}[]}|null,changes:{id:string,undoOf?:string,activityAssociations?:{after:{id:string}[]}}[]};
const labelType=(type:string)=>TYPES[type as keyof typeof TYPES]||'Tipo sin confirmar';
const feeling=(value:string)=>({bien:'Bien',normal:'Normal',pesado:'Piernas pesadas',mal:'Mal'}[value]||'Sin confirmar');
export default function ActivityFollowup({state,activityId,onSave,onEdit,busy}:{state:FollowupState,activityId:string,onSave:(next:unknown)=>Promise<boolean>,onEdit:(activity:FollowupActivity)=>void,busy:boolean}){
 const activity=state.activities.find(a=>a.id===activityId),members=activity?.sessionId?state.activities.filter(a=>a.sessionId===activity.sessionId):activity?[activity]:[];
 const [selected,setSelected]=useState(members.map(a=>a.id)),[target,setTarget]=useState(activity?.sessionId||''),[roles,setRoles]=useState<Record<string,string>>(Object.fromEntries(members.map(a=>[a.id,a.partRole||'unknown']))),[error,setError]=useState('');
 if(!activity)return <p>El registro ya no está activo. Su eliminación, si la hubo, permanece en el historial.</p>;
 const data=analysisForActivity(activity,state),before=data.planned,actual=data.actual;
 const nearby=state.activities.filter(a=>isTrainingActivity(a)&&(a.date===activity.date||a.sessionId===activity.sessionId&&!!activity.sessionId||Math.abs(Date.parse(a.date)-Date.parse(activity.date))<=86400000));
 const undo=state.changes.filter(c=>c.activityAssociations?.after.some(a=>a.id===activityId)&&!state.changes.some(v=>v.undoOf===c.id)).slice(0,3);
 async function link(sessionId:string,unlinkedMode='unlinked'){setError('');try{await onSave(associateActivities(state,selected,sessionId,{roles,unlinkedMode}));}catch(e){setError(e instanceof Error?e.message:String(e));}}
 return <div className="activity-followup">
  <p><b>{activityLabel(activity,state)}</b> · {activity.date} · {activitySourceLabel(activity)}{members.length>1?` · ${members.length} registros agrupados`:''}</p>
  <p>{data.purpose}</p>{data.context&&<p>{data.context}</p>}
  <section className="followup-decision" aria-label="Qué cambia después de esta carrera"><h3>Qué cambia en tu plan</h3><p>{data.decision}</p><p>{data.nextAdvice}</p></section>
  <div className="table-scroll"><table className="followup-comparison"><thead><tr><th>Dato</th><th>Previsto</th><th>Realizado</th></tr></thead><tbody>
   <tr><th>Tipo</th><td>{before?labelType(before.type):'Sin sesión vinculada'}</td><td>{labelType(actual.type)}</td></tr>
   <tr><th>Distancia</th><td>{before?.distance!=null?distanceText(before.distance):before?'Por tiempo':'—'}</td><td>{distanceText(actual.distance)}</td></tr>
   <tr><th>Duración</th><td>{before&&!before.durationUnknown?`${durationText(before.seconds)} (${before.estimated?'estimada':'prescrita'})`:'Sin referencia'}</td><td>{durationText(actual.seconds)} en movimiento{actual.elapsedSeconds!=null?`; ${durationText(actual.elapsedSeconds)} con pausas`:''}</td></tr>
   <tr><th>Esfuerzo</th><td>{before?`${before.rpe}/10`:'Sin referencia'}</td><td>{actual.rpe!=null?`${actual.rpe}/10`:'Falta esfuerzo'}</td></tr>
   <tr><th>Sensaciones</th><td>Control y recuperación suficiente</td><td>{feeling(actual.feeling)} · fatiga {actual.fatigue!=null?`${actual.fatigue}/10`:'sin confirmar'} · molestias {actual.pain==='none'?'no':actual.pain==='mild'?'leves':actual.pain==='relevant'?'relevantes':'sin confirmar'}</td></tr>
  </tbody></table></div>
  <p>{data.paceMismatch}</p>
  {data.blocks.rows.length>0&&<><h3>Bloques previstos y realizados</h3><div className="table-scroll"><table className="followup-comparison"><thead><tr><th>Bloque</th><th>Previsto</th><th>Realizado</th><th>Lectura</th></tr></thead><tbody>{data.blocks.rows.map((row:{label:string,planned:string,actual:string,matches:boolean},i:number)=><tr key={i}><th>{row.label}</th><td>{row.planned}</td><td>{row.actual}</td><td>{row.matches?'Compatible':'Con cambios'}</td></tr>)}</tbody></table></div></>}
  <h3>Datos que apoyan esta lectura</h3>{data.evidence.length?<ul>{data.evidence.map((text:string)=><li key={text}>{text}</li>)}</ul>:<p>Solo conocemos el registro; no hay una sesión prevista para comparar.</p>}
  {data.missing.length>0&&<><h3>Información que falta</h3><ul>{data.missing.map((text:string)=><li key={text}>{text}</li>)}</ul><button onClick={()=>onEdit(activity)}>Completar sensaciones y bloques</button></>}
  <h3>La siguiente sesión</h3><p>{data.reason}</p><p>{data.progress}</p>
  <details className="association-editor spaced"><summary>Corregir, agrupar o desvincular actividades</summary>
   <p>Selecciona los registros que forman esta sesión y el papel de cada uno. Se suman para comparar; sus fechas, medidas y notas se mantienen por separado.</p>
   <label>Sesión prevista<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecciona una sesión</option>{state.plan?.sessions.filter(s=>s.date<=today()&&!['rest','strength'].includes(s.type)).map(s=><option key={s.id} value={s.id}>{s.date} · {labelType(s.type)}</option>)}</select></label>
   {nearby.map(a=><div className="association-row" key={a.id}><label className="check-label"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>setSelected(e.target.checked?[...selected,a.id]:selected.filter(id=>id!==a.id))}/>{a.date} · {distanceText(a.distance)} · {durationText(a.seconds)}{a.id===activityId?' · Este registro':''}</label>{selected.includes(a.id)&&<label>Papel del registro<select value={roles[a.id]||'unknown'} onChange={e=>setRoles({...roles,[a.id]:e.target.value})}>{[['unknown','No lo sé'],['full','Sesión completa'],['warmup','Calentamiento'],['main','Bloque principal'],['recovery','Recuperaciones'],['cooldown','Vuelta a la calma']].map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>}</div>)}
   <div className="actions spaced"><button disabled={busy||!target||!selected.length} onClick={()=>link(target)}>Confirmar asociación o grupo</button><button disabled={busy||!selected.length} onClick={()=>link('')}>Dejar sin vincular</button><button disabled={busy||!selected.length} onClick={()=>link('','none')}>Marcar como carrera adicional</button></div>
   {undo.map(c=><button key={c.id} className="text-button" disabled={busy} onClick={async()=>{try{await onSave(undoActivityAssociation(state,c.id));}catch(e){setError(e instanceof Error?e.message:String(e));}}}>Deshacer asociación</button>)}
  </details>{error&&<p className="error" role="alert">{error}</p>}
 </div>;
}
