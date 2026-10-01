// Real Chrome UI verification with an isolated in-memory API fixture.
// /api/state is intercepted before navigation: this NEVER writes to the user's D1.
// Database persistence is verified separately in tests/state-store.test.mjs.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {today,addDays,validateStateShape} from '../lib/engine.mjs';
const browser='http://127.0.0.1:9223',origin='http://127.0.0.1:5173';
const tab=await (await fetch(browser+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let serial=0,saved=null,revision=0,writes=0;const pending=new Map(),faults=[];
function send(method,params={}){const id=++serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
ws.onmessage=async event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}return;}
 if(m.method==='Runtime.exceptionThrown')faults.push(m.params.exceptionDetails.text);
 if(m.method!=='Fetch.requestPaused')return;const {requestId,request}=m.params;
 try{
  const path=new URL(request.url).pathname;let body,status=200;
  if(path==='/api/state'){
   if(request.method==='GET')body={state:saved,revision};
   else if(request.method==='PUT'){
    const text=request.postData||(await send('Fetch.getRequestPostData',{requestId})).postData,input=JSON.parse(text),invalid=validateStateShape(input.state);
    assert.equal(input.revision,revision);assert.deepEqual(invalid,[]);saved=structuredClone(input.state);revision++;writes++;body={revision};
   }else throw Error('Unexpected state method; destructive operations are blocked.');
  }else if(path==='/api/strava/status')body={configured:false,connected:false,state:'disconnected',activities:[],checklist:[]};
  else {status=503;body={error:'External services disabled during isolated UI verification.'};}
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }catch(error){faults.push(error.message);await send('Fetch.fulfillRequest',{requestId,responseCode:500,body:Buffer.from('{"error":"Isolated test failure"}').toString('base64')});}
};
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function until(expression,label){const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}throw Error('UI timeout: '+label);}
const button=async label=>{await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,'button '+label);return evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Missing or disabled button: '+${JSON.stringify(label)});b.click();return true;})()`);};
const field=(label,value)=>evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent?.startsWith(${JSON.stringify(label)}));const input=label?.querySelector('input,select');if(!input)throw Error('Missing field: '+${JSON.stringify(label)});const setter=Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
try{
 await send('Runtime.enable');await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*',requestStage:'Request'}]});
 await send('Page.navigate',{url:origin});
 await until(`!!document.querySelector('.wizard')||!!document.querySelector('a[href*="signin"]')`,'onboarding or local login');
 if(!await evaluate(`!!document.querySelector('.wizard')`)){await evaluate(`document.querySelector('a[href*="signin"]').click()`);await until(`!!document.querySelector('.wizard')`,'local sign-in');}
 await button('Continuar');await until(`document.body.textContent.includes('Continuar sin Strava')`,'Strava step');await button('Continuar sin Strava');
 await until(`document.body.textContent.includes('¿Qué quieres conseguir?')`,'goal step');await evaluate(`document.querySelector('input[name="wizard-goal"]').closest('.goal-options').querySelectorAll('label')[3].click()`);
 await field('Distancia (km)',10);await field('Fecha de la carrera',addDays(today(),49));await field('Desnivel positivo de la carrera (m)',0);await button('Continuar');
 await until(`document.body.textContent.includes('Tu punto de partida')`,'experience step');await field('Kilómetros semanales actuales',0);await field('Días que has corrido por semana últimamente',0);await field('¿Cómo ha sido tu continuidad?','returning');await button('Continuar');
 await until(`document.body.textContent.includes('¿Cuándo puedes entrenar?')`,'availability step');await button('Añadir deporte habitual');await field('Deporte','crossfit');await field('Intensidad habitual','hard');
 await button('Continuar');await until(`document.body.textContent.includes('Cuidados y preferencias')`,'care step');await field('Fatiga habitual estos días (0–10)',3);await field('Recuperación entre entrenamientos','good');await button('Continuar');
 await until(`document.body.textContent.includes('Tus primeras dos semanas')`,'plan preview');assert(await evaluate(`document.body.textContent.includes('Tu meta necesita revisión')`));
 await button('Crear mi plan');await until(`!!document.querySelector('.sidebar')`,'saved plan');
 assert.equal(saved.plan.racePreparation.totalDays,49);assert.equal(saved.plan.racePreparation.totalWeeks,7);assert.equal(saved.profile.otherSports[0].type,'crossfit');assert.equal(saved.profile.consistency,'returning');assert(saved.plan.sessions.filter(s=>!['race','rest','strength'].includes(s.type)).every(s=>s.distance===null));
 await send('Page.reload');await until(`!!document.querySelector('.sidebar')`,'reload persisted fixture');await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'editable profile');
 assert.equal(await evaluate(`document.querySelector('select').value`),'beginner');await field('Fecha de carrera',addDays(today(),42));await button('Guardar perfil y objetivo');
 await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'review edited date');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'new preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'accepted revision');
 assert.equal(saved.plan.end,addDays(today(),42));assert(saved.changes.length>=2);assert(writes>=3);assert.deepEqual(faults,[]);
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(new URL('../.tools/running-browser-verification.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
 console.log(JSON.stringify({result:'PASS',scope:'Real Chrome; isolated API fixture, no user writes',checks:['seven-step questionnaire','conditional inputs','49-day beginner proposal','other sports','save/reload','edit goal date','review/accept 42-day plan'],writes,runtimeErrors:faults.length}));
}finally{
 await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Target.closeTarget',{targetId:tab.id}).catch(()=>{});ws.close();
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser test closed'));}
}
