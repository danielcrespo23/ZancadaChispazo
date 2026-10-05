'use client';
import React,{useEffect,useRef,useState} from 'react';
import {chatReply} from '../lib/coach-chat.mjs';
import {coachContextSignature,coachResponseCurrent} from '../lib/coach-dialog.mjs';
import {activityToday} from '../lib/activity-source.mjs';
import {hasAIConsent,withAIConsent} from '../lib/coach-consent.mjs';
import {manualContext} from '../lib/ai-coach.mjs';
import {durationText,distanceText} from '../lib/session-instructions.mjs';

type State=Parameters<typeof manualContext>[0];
type Reply=Awaited<ReturnType<typeof chatReply>>;
export type CoachMessage={q:string,answer:string,scopeKey?:string,conversationId?:string,date?:string,stateSignature?:string,context?:Reply['context'],mode?:string,model?:string,notice?:string,proposal?:Reply['proposal']};
type ModelStatus={available:boolean,state:string,model?:string,reason:string,generationVerified?:boolean};
type Props={state:State,revision:number,demo:boolean,busy:boolean,dirty:boolean,scopeKey?:string,onSave:(value:State)=>Promise<boolean>,messages:CoachMessage[],onMessages:(messages:CoachMessage[])=>void,question:string,onQuestion:(value:string)=>void};
const amount=(s:{distance:number|null,seconds:number})=>s.distance!=null?distanceText(s.distance):durationText(s.seconds);
export default function CoachChat({state,revision,demo,busy,dirty,scopeKey='local',onSave,messages,onMessages,question,onQuestion}:Props){
 const [status,setStatus]=useState<ModelStatus|null>(null),[mode,setMode]=useState('rules'),[waiting,setWaiting]=useState(false),[error,setError]=useState('');
 const latest=useRef({state,revision,scopeKey,messages}),allowed=hasAIConsent(state),locked=busy||waiting;
 const visible=messages.filter(m=>m.scopeKey===scopeKey),date=activityToday(state.profile?.timezone);
 useEffect(()=>{latest.current={state,revision,scopeKey,messages};},[state,revision,scopeKey,messages]);
 async function check(){if(demo)return;try{const response=await fetch('/api/coach');if(!response.ok)throw Error();setStatus(await response.json() as ModelStatus);}catch{setStatus({available:false,state:'unavailable',reason:'No se pudo comprobar el modelo; puedes usar las reglas locales.'});}}
 useEffect(()=>{let cancelled=false;if(!demo)fetch('/api/coach').then(async response=>{if(response.ok&&!cancelled)setStatus(await response.json() as ModelStatus);}).catch(()=>{if(!cancelled)setStatus({available:false,state:'unavailable',reason:'Estado del modelo no disponible.'});});return()=>{cancelled=true;};},[demo,scopeKey]);
 async function ask(q:string){
  if(!q.trim()||locked)return;setError('');setWaiting(true);
  const signature=coachContextSignature(state,date),previous=visible.at(-1),origin={scopeKey,revision},options={context:previous?.context,scopeKey};
  const current=()=>latest.current.scopeKey===origin.scopeKey&&coachContextSignature(latest.current.state,activityToday(latest.current.state.profile?.timezone))===signature;
  try{
   let result:Reply&{conversationId?:string};
   if(demo||dirty)result=await chatReply(state,{question:q,mode:'rules'},{},fetch,options);
   else{
    const response=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,mode,revision,conversationId:previous?.conversationId})});
    const body=await response.json() as Reply&{error?:string,conversationId?:string};
    if(!response.ok){if(response.status===409||response.status===401){setError(body.error||'Tus datos han cambiado. Recarga y consulta de nuevo.');return;}throw Error(body.error||'No se pudo consultar el entrenador.');}result=body;
   }
   if(!current()||!demo&&!dirty&&latest.current.revision!==origin.revision){setError('Tus datos cambiaron durante la consulta. Vuelve a preguntar con el calendario y las actividades actuales.');return;}
   onMessages([...latest.current.messages,{q,scopeKey,conversationId:result.conversationId,answer:result.answer,mode:result.mode,model:result.model||undefined,notice:result.notice||undefined,proposal:result.proposal,date:result.date,stateSignature:result.stateSignature,context:result.context}].slice(-20));onQuestion('');
  }catch(e){
   if(!current()){setError('Tus datos cambiaron durante la consulta. Vuelve a preguntar.');return;}
   const result=await chatReply(latest.current.state,{question:q,mode:'rules'},{},fetch,options);
   if(!current())return;
   onMessages([...latest.current.messages,{q,scopeKey,answer:result.answer,mode:'rules',notice:(e instanceof Error?e.message:'Error de consulta.')+' Respuesta por reglas locales.',proposal:result.proposal,date:result.date,stateSignature:result.stateSignature,context:result.context}].slice(-20));onQuestion('');
  }finally{setWaiting(false);}
 }
 return <section className="panel chat" aria-label="Chat de entrenamiento"><div className="section-heading"><h2>Chat de entrenamiento</h2><span className="pill">{demo?'Demostración · reglas locales':mode==='rules'?'Reglas locales · sin API':status?.available&&allowed?'Ollama disponible · se verifica al responder':'Modelo sin comprobar'}</span></div><p>Pregunta por sesiones, fechas, cansancio, CrossFit, vueltas o ritmos. Las respuestas separan lo observado, la interpretación y las propuestas; si falta un dato, te lo piden.</p>
 <label>Modo del chat<select value={mode} disabled={locked||demo} onChange={e=>setMode(e.target.value)}><option value="rules">Reglas locales, sin modelo</option><option value="ollama" disabled={!status?.available||!allowed}>Modelo local Ollama</option></select></label>
 <p className="helper">{status?.reason||'Comprobando si hay un modelo local disponible…'} {status?.model&&`Modelo configurado: ${status.model}.`} <button className="text-button" disabled={locked||demo} onClick={check}>Comprobar modelo</button></p>
 <label className="check-label spaced"><input type="checkbox" checked={allowed} disabled={locked||demo} onChange={async e=>{const enable=e.target.checked;if(await onSave(withAIConsent(state,enable))&&!enable)setMode('rules');}}/>Autorizo usar mi perfil deportivo, plan, sensaciones y registros manuales con el modelo local o las herramientas de Zancada para ChatGPT. Excluye Strava y archivos externos. Puedo retirarlo aquí.</label>
 <p className="helper">Ollama utiliza datos manuales autorizados; no recibe nombre, correo, tokens ni notas libres. Las reglas locales también pueden consultar tus archivos propios autorizados. Las propuestas se revisan en Mi plan.</p>
 <p className="helper">Puedes hacer una pregunta de seguimiento. Se conserva brevemente la sesión y el tema de esta cuenta; si cambian tus datos o pasa el día, se recalcula o se pide concretar.</p>
 {dirty&&<p className="notice">Hay cambios sin guardar: se responde con tus datos locales. Guárdalos antes de conservar una propuesta.</p>}
 <div className="suggestions">{['¿Por qué hoy tengo este entrenamiento?','Ayer hice CrossFit; ¿qué cambia?','No tengo dolor, pero estoy cansado','¿Puedo cambiar la tirada al viernes?','¿Qué parte de los intervalos estoy haciendo demasiado rápido?','¿Por qué mi plan todavía no ha cambiado?','¿Qué referencia necesitas para ajustar mis ritmos?'].map(q=><button key={q} disabled={locked} onClick={()=>ask(q)}>{q}</button>)}</div>
 <div className="messages" aria-live="polite">{visible.map((m,i)=>{const fresh=coachResponseCurrent(m,state,date);return <div key={i}><div className="question">{m.q}</div><div className="answer"><div><small>{m.mode==='ollama'?`Modelo local ${m.model} · respuesta comprobada`:'Respuesta por reglas locales'}</small><p style={{whiteSpace:'pre-wrap'}}>{m.answer}</p>{!fresh&&<p className="notice">Respuesta anterior: tus datos han cambiado. Vuelve a preguntar antes de usarla para decidir.</p>}{m.notice&&<p className="helper">{m.notice}</p>}{m.proposal&&<div className="detail-note"><b>Propuesta concreta, sin aplicar</b><p>{m.proposal.reason}</p>{m.proposal.changes.map((c,n)=><p key={n}>{c.before.date}: {c.before.type} · {amount(c.before)} → {c.after.date}: {c.after.type} · {amount(c.after)}.</p>)}<button disabled={locked||dirty||!fresh||state.proposals.some((v:{id:string})=>v.id===m.proposal?.id)} onClick={async()=>{if(!coachResponseCurrent(m,latest.current.state,activityToday(latest.current.state.profile?.timezone))){setError('Recalcula la propuesta con tus datos actuales.');return;}if(await onSave({...latest.current.state,proposals:[...latest.current.state.proposals,m.proposal]}))setError('');}}>Guardar propuesta para revisar en Mi plan</button><p className="helper">Guardar la propuesta conserva las sesiones. Allí puedes aceptar, rechazar y deshacer; al aceptar se vuelven a comprobar los datos.</p></div>}</div></div></div>;})}</div>
 <form className="chat-input" onSubmit={e=>{e.preventDefault();ask(question.trim());}}><label className="sr-only" htmlFor="question">Tu pregunta</label><input id="question" placeholder="Pregunta por una sesión o continúa la conversación…" maxLength={2000} value={question} onChange={e=>onQuestion(e.target.value)} required/><button disabled={locked} type="submit" className="primary">{waiting?'Consultando…':'Preguntar'}</button></form>{error&&<p role="alert" className="error">{error}</p>}
 <details className="spaced"><summary>Instalar un modelo local opcional</summary><p>Solo en la versión PC. Instala <a href="https://ollama.com/download/windows" target="_blank" rel="noreferrer">Ollama para Windows</a> (Windows 10 22H2 o posterior; al menos 4 GB para la aplicación, más el modelo). Desactiva la nube en Ollama con la variable de usuario <code>OLLAMA_NO_CLOUD=1</code> y reinicia Ollama. Descarga el modelo con <code>ollama pull llama3.2:3b</code> y comprueba <code>ollama list</code>. Se ejecuta en CPU si no hay GPU compatible; el rendimiento depende del equipo.</p><p>Activa <code>ZANCADA_OLLAMA_ENABLED=true</code> y <code>OLLAMA_MODEL=llama3.2:3b</code> en <code>.dev.vars</code> y reinicia Zancada. «Comprobar modelo» verifica el servicio y la instalación; una respuesta válida verifica la generación. No se descarga ni instala nada automáticamente. Consulta <a href="https://docs.ollama.com/windows" target="_blank" rel="noreferrer">requisitos oficiales</a>.</p><p>Ollama usa recursos de tu PC y no exige facturación de API. Una suscripción de ChatGPT no concede acceso gratuito a la API. En despliegue remoto esta opción local permanece desactivada.</p></details></section>;
}
