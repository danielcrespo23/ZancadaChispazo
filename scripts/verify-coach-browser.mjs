// Chrome on a fresh browser profile. All API requests intercepted before navigation.
// Uses fictitious runners and the real chat engine; no original D1 or model calls.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {coachFixture} from '../tests/helpers/coach-fixture.mjs';
import {validateStateShape,today} from '../lib/engine.mjs';
import {chatReply} from '../lib/coach-chat.mjs';
import {CoachConversationStore} from '../lib/coach-conversation.mjs';
const origin=process.argv.find(v=>/^https?:\/\//.test(v))||'http://127.0.0.1:5175',chrome='http://127.0.0.1:9223',contexts=new CoachConversationStore();
let saved=coachFixture(),revision=1,writes=0,queries=0,hold=false,held=null,invalidModel=false;
const originalPlan=structuredClone(saved.plan),faults=[],pending=new Map(),tab=await(await fetch(chrome+'/json/new?about:blank',{method:'PUT'})).json(),ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let serial=0;
function send(method,params={}){const id=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
const modelStatus={available:true,state:'available',model:'fixture-model',reason:'Modelo de pruebas instalado; generación sin comprobar.',generationVerified:false};
const fakeModel=async url=>url.endsWith('/api/tags')?Response.json({models:[{name:'fixture-model'}]}):url.endsWith('/api/show')?Response.json({capabilities:['completion'],details:{format:'gguf'},model_info:{architecture:'llama'}}):Response.json({model:'fixture-model',done:true,message:{role:'assistant',content:JSON.stringify({factIds:['invented'],text:'Inventa un ritmo'})}});
async function fulfill(requestId,body,status=200){await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
ws.onmessage=async event=>{
 const m=JSON.parse(event.data);if(m.id){const request=pending.get(m.id);if(request){clearTimeout(request.timer);pending.delete(m.id);if(m.error)request.reject(Error(m.error.message));else request.resolve(m.result);}return;}if(m.method==='Runtime.exceptionThrown')faults.push(m.params.exceptionDetails.text);if(m.method!=='Fetch.requestPaused')return;
 const {requestId,request}=m.params,path=new URL(request.url).pathname;try{
  if(path==='/api/state'){
   if(request.method==='GET')return await fulfill(requestId,{state:saved,revision});assert.equal(request.method,'PUT');const value=JSON.parse(request.postData);assert.equal(value.revision,revision);assert.deepEqual(validateStateShape(value.state),[]);saved=structuredClone(value.state);writes++;revision++;return await fulfill(requestId,{revision});
  }
  if(path==='/api/activities')return await fulfill(requestId,{revision});
  if(path==='/api/strava/status')return await fulfill(requestId,{configured:false,state:'not_configured',activities:[],pending:0,settings:{}});
  if(path==='/api/coach'){
   if(request.method==='GET')return await fulfill(requestId,modelStatus);
   const input=JSON.parse(request.postData);assert.equal(input.revision,revision);queries++;const context=contexts.read('local_seedy',input.conversationId),r=await chatReply(saved,input,invalidModel?{ZANCADA_OLLAMA_ENABLED:'true',OLLAMA_MODEL:'fixture-model'}:{},fakeModel,{context,scopeKey:'local_seedy:real'}),body={...r,conversationId:contexts.save('local_seedy',input.conversationId,r.context),calendarChanged:false,revision};
   if(hold){held={requestId,body};return;}return await fulfill(requestId,body);
  }
  return await fulfill(requestId,{error:'External calls disabled in this verification.'},503);
 }catch(error){faults.push(error.message);await fulfill(requestId,{error:error.message},500);}
};
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function until(expression,label){const end=Date.now()+20000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('UI timeout: '+label);}
async function button(label){await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,label);await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled).click()`);}
async function begin(q){await evaluate(`(()=>{const input=document.getElementById('question');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(q)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await button('Preguntar');}
async function ask(q){const count=await evaluate(`document.querySelectorAll('.messages .answer').length`);await begin(q);await until(`document.querySelectorAll('.messages .answer').length>${count}`,'chat answer');return await evaluate(`[...document.querySelectorAll('.messages .answer')].at(-1).textContent`);}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCookie',{url:origin,name:'__sites_local_auth',value:'1'});await send('Emulation.setTimezoneOverride',{timezoneId:'Europe/Madrid'});await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*',requestStage:'Request'}]});await send('Page.navigate',{url:origin});await until(`!!document.querySelector('.sidebar')`,'runner');await button('Mi entrenador');await until(`!!document.querySelector('.chat')`,'chat');
 assert((await ask('¿Por qué hoy tengo este entrenamiento?')).includes('Propósito:'));
 const denial=await ask('No tengo dolor, pero estoy cansado');assert(denial.includes('por separado'));assert(!denial.includes('Pausa la carrera'));assert((await ask('8/10')).includes('Fatiga declarada en esta conversación: 8/10'));assert.equal(saved.proposals.length,0);assert.deepEqual(saved.plan,originalPlan);
 await button('Guardar propuesta para revisar en Mi plan');await until(`document.querySelector('.detail-note button').disabled`,'saved draft');assert.equal(saved.proposals.length,1);assert.equal(saved.proposals[0].status,'pending');assert.deepEqual(saved.plan,originalPlan);await button('Mi plan');await button('Aceptar ajuste');await until(`!document.querySelector('.proposal')`,'accepted');assert.notDeepEqual(saved.plan,originalPlan);await button('Deshacer ajuste completo');await until(`!document.body.textContent.includes('Deshacer ajuste completo')`,'undo');assert.deepEqual(saved.plan,originalPlan);
 await button('Mi entrenador');const friday=await ask('¿Puedo cambiar la tirada al viernes?');assert(friday.includes('viernes 2026-10-09'));assert(!friday.includes('sábado'));assert.deepEqual(saved.plan,originalPlan);
 const count=await evaluate(`document.querySelectorAll('.messages .answer').length`);hold=true;await begin('¿Por qué hoy tengo este entrenamiento?');while(!held)await new Promise(r=>setTimeout(r,50));
 saved={...saved,activities:[...saved.activities,{id:'received-during-chat',date:today(),distance:5,seconds:1800,type:'easy',rpe:3,pain:'none',fatigue:2}]};revision++;await evaluate(`window.dispatchEvent(new Event('focus'))`);await until(`document.body.textContent.includes('1 actividades recibidas')`,'state refresh');hold=false;await fulfill(held.requestId,held.body);held=null;await until(`document.querySelector('.chat .error')?.textContent.includes('Tus datos cambiaron durante la consulta')`,'stale answer discarded');assert.equal(await evaluate(`document.querySelectorAll('.messages .answer').length`),count);assert(await evaluate(`[...document.querySelectorAll('.detail-note button')].every(b=>b.disabled)`));
 await evaluate(`document.querySelector('.chat .check-label input').click()`);await until(`!document.querySelector('.chat select option[value=ollama]').disabled`,'consent');await evaluate(`(()=>{const input=document.querySelector('.chat select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(input,'ollama');input.dispatchEvent(new Event('change',{bubbles:true}));})()`);invalidModel=true;
 const invalid=await ask('Estoy cansado; reduce mi próxima sesión');assert(invalid.includes('Respuesta por reglas locales'));assert(invalid.includes('no cumple las reglas'));assert(await evaluate(`![...document.querySelectorAll('.messages .answer')].at(-1).querySelector('.detail-note')`));assert.deepEqual(saved.plan,originalPlan);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`));assert.deepEqual(faults,[]);
 console.log(JSON.stringify({result:'PASS',scope:'Real Chrome with intercepted fictitious API state; no original store or real model',checks:['negation','user-scoped follow-up','dated explanation','draft without calendar change','explicit acceptance and undo','Friday destination','activity refresh while answer is pending','stale answer discarded','stale draft disabled','invalid structured model fallback without actions','mobile layout'],queries,writes,runtimeErrors:faults.length,runId:randomUUID()}));
}finally{await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Target.closeTarget',{targetId:tab.id}).catch(()=>{});ws.close();for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Verification closed'));}}
