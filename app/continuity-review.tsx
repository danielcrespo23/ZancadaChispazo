'use client';
import React,{useState} from 'react';
import {missedTraining,confirmMissedSessions} from '../lib/training.mjs';
import {TYPES,duration} from '../lib/engine.mjs';
export default function ContinuityReview({state,save,busy,onReview}:{state:any,save:any,busy:boolean,onReview:()=>void}){
 const report=missedTraining(state),[ids,setIds]=useState<string[]>([]),[error,setError]=useState('');
 if(!report.unconfirmed.length&&!report.confirmed)return null;
 return <section className="panel spaced"><h2>Continuidad: revisar lo que ocurrió</h2><p>{report.note} Hay {report.confirmed} sesiones confirmadas como omitidas en los últimos 14 días. Con dos o más, la nueva propuesta reduce la base y retoma dos semanas cómodas.</p>{report.unconfirmed.length>0&&<details><summary>{report.unconfirmed.length} sesiones pasadas sin registrar</summary><p>Si las realizaste, añade la carrera y confirma su vinculación. Marca aquí únicamente las que no hiciste.</p>{report.unconfirmed.map((s:any)=><label className="check-label spaced" key={s.id}><input type="checkbox" checked={ids.includes(s.id)} onChange={e=>setIds(e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/>{s.date} · {TYPES[s.type as keyof typeof TYPES]} · {s.distance!=null?`${s.distance} km`:duration(s.seconds)}</label>)}<button className="spaced" disabled={busy||!ids.length} onClick={async()=>{try{setError('');if(await save(confirmMissedSessions(state,ids))){setIds([]);onReview();}}catch(e:any){setError(e.message);}}}>Confirmar omisiones y revisar la propuesta</button></details>}{report.confirmed>=2&&<button className="spaced" disabled={busy} onClick={onReview}>Revisar preparación sin compensar lo pendiente</button>}{error&&<p className="error" role="alert">{error}</p>}</section>;
}
