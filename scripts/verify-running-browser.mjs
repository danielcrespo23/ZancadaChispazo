// Real Chrome UI verification with an isolated in-memory API fixture.
// /api/state is intercepted before navigation: this NEVER writes to the user's D1.
// Database persistence is verified separately in tests/state-store.test.mjs.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {today,addDays,day,DAYS,duration,validateStateShape,monday,daysBetween} from '../lib/engine.mjs';
import {recoveryInstruction,prescriptionSummary,sessionTotals} from '../lib/session-instructions.mjs';
import {weekSummary,sessionStatus} from '../lib/training.mjs';
const browser='http://127.0.0.1:9223',origin=process.argv.slice(2).find(v=>/^https?:\/\//.test(v))||'http://127.0.0.1:5173';
const tab=await (await fetch(browser+'/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let serial=0,saved=null,revision=0,writes=0,failNextWrite=false;const pending=new Map(),faults=[];
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
    assert.equal(input.revision,revision);assert.deepEqual(invalid,[]);
    if(failNextWrite){failNextWrite=false;status=503;body={error:'Fallo de guardado simulado. Tus cambios siguen en pantalla.'};}
    else{saved=structuredClone(input.state);revision++;writes++;body={revision};}
   }else throw Error('Unexpected state method; destructive operations are blocked.');
  }else if(path==='/api/strava/status')body={configured:false,connected:false,state:'disconnected',activities:[],checklist:[]};
  else {status=503;body={error:'External services disabled during isolated UI verification.'};}
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }catch(error){faults.push(error.message);await send('Fetch.fulfillRequest',{requestId,responseCode:500,body:Buffer.from('{"error":"Isolated test failure"}').toString('base64')});}
};
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function until(expression,label){const end=Date.now()+25000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}throw Error('UI timeout: '+label);}
const button=async label=>{await until(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim().replace(/[+]$/,'').trim()===${JSON.stringify(label)}&&!b.disabled)`,'button '+label);return evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/[+]$/,'').trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Missing or disabled button: '+${JSON.stringify(label)});b.click();return true;})()`);};
const field=(label,value)=>evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent?.startsWith(${JSON.stringify(label)}));const input=label?.querySelector('input,select');if(!input)throw Error('Missing field: '+${JSON.stringify(label)});const setter=Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
try{
 await send('Runtime.enable');await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*',requestStage:'Request'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.removeItem('zancada-onboarding');"});
 await send('Page.navigate',{url:origin});
 await until(`!!document.querySelector('.wizard')||!!document.querySelector('a[href*="signin"]')`,'onboarding or local login');
 if(!await evaluate(`!!document.querySelector('.wizard')`)){await evaluate(`document.querySelector('a[href*="signin"]').click()`);await until(`!!document.querySelector('.wizard')`,'local sign-in');}
 await button('Continuar');await until(`document.body.textContent.includes('Continuar sin Strava')`,'Strava step');await button('Continuar sin Strava');
 await until(`document.body.textContent.includes('¿Qué quieres conseguir?')`,'goal step');await evaluate(`document.querySelector('input[name="wizard-goal"]').closest('.goal-options').querySelectorAll('label')[3].click()`);
 await field('Distancia (km)',10);await field('Fecha de la carrera',addDays(today(),49));await field('Desnivel positivo de la carrera (m)',0);await button('Continuar');
 await until(`document.body.textContent.includes('Tu punto de partida')`,'experience step');await field('Kilómetros semanales actuales',0);await field('Origen de los kilómetros semanales','estimated');await field('Variación entre las últimas semanas','variable');await field('Días que has corrido por semana últimamente',0);await field('¿Cómo ha sido tu continuidad?','returning');await field('Pausa más larga en las últimas ocho semanas',4);
 await button('Añadir una marca de referencia');await field('Distancia (km)',5);await button('Añadir una marca de referencia');
 await evaluate(`(()=>{const input=[...document.querySelectorAll('.wizard-body details')].filter(d=>d.querySelector('summary')?.textContent.startsWith('Referencia')).at(-1).querySelector('input[placeholder="No lo sé · 26:30"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'20:00');input.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);await button('Continuar');
 await until(`document.body.textContent.includes('¿Cuándo puedes entrenar?')`,'availability step');await button('Añadir deporte habitual');await field('Deporte','crossfit');await field('Intensidad habitual','hard');
 await button('Continuar');await until(`document.body.textContent.includes('Cuidados y preferencias')`,'care step');await field('Fatiga habitual estos días (0–10)',3);await field('Recuperación entre entrenamientos','good');await button('Continuar');
 await until(`document.body.textContent.includes('Tus primeras dos semanas')`,'plan preview');assert(await evaluate(`document.body.textContent.includes('Tu meta necesita revisión')`));
 assert(await evaluate(`!!document.querySelector('[aria-label="Resumen editable del corredor"]')&&document.body.textContent.includes('Información ausente y precisión')&&document.body.textContent.includes('marcas incompletas')`));
 await button('Editar objetivo');await field('Flexibilidad para una meta alternativa','date');await button('Volver al resumen');await until(`document.body.textContent.includes('Tus primeras dos semanas')`,'edited summary');
 assert(await evaluate(`[...document.querySelectorAll('.alternatives button')].every(b=>b.textContent.includes('fecha'))`));
 await button('Crear mi plan');await until(`!!document.querySelector('.sidebar')`,'saved plan');
 assert.equal(saved.plan.racePreparation.totalDays,49);assert.equal(saved.plan.racePreparation.totalWeeks,7);assert.equal(saved.profile.otherSports[0].type,'crossfit');assert.equal(saved.profile.consistency,'returning');assert(saved.plan.sessions.filter(s=>!['race','rest','strength'].includes(s.type)).every(s=>s.distance===null));
 assert.equal(saved.profile.pauseWeeks,'4');assert.equal(saved.profile.weeklySource,'estimated');assert.equal(saved.profile.goal.flexibility,'date');assert.equal(saved.profile.marks[0].distance,'5');assert.equal(saved.profile.marks[0].time,'');
 assert.equal(saved.profile.marks.length,2);assert.equal(saved.profile.marks[1].time,'20:00');assert.equal(saved.profile.marks[1].date,'');
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'profile immediately after onboarding');
 assert.equal(await evaluate(`[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent?.startsWith('Fecha de carrera')).querySelector('input').value`),saved.profile.goal.date);
 assert.equal(await evaluate(`document.querySelector('input').value`),saved.profile.name);
 await send('Page.reload');await until(`!!document.querySelector('.sidebar')`,'reload persisted fixture');await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'editable profile');
 assert.equal(await evaluate(`document.querySelector('select').value`),'beginner');await field('Fecha de carrera',addDays(today(),42));await button('Guardar perfil y objetivo');
 await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'review edited date');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'new preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'accepted revision');
 assert.equal(saved.plan.end,addDays(today(),42));assert(saved.changes.length>=2);assert(writes>=3);assert.deepEqual(faults,[]);
 // Saving a new date does not accept its calendar. Reopening must keep the old one.
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'profile after revision');
 await field('Fecha de carrera',addDays(today(),35));await button('Guardar perfil y objetivo');
 await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'unaccepted goal');
 const acceptedPlan=JSON.stringify(saved.plan);await send('Page.reload');await until(`!!document.querySelector('.sidebar')`,'reopen edited goal');
 assert.equal(JSON.stringify(saved.plan),acceptedPlan);assert.equal(saved.plan.sessions.filter(s=>s.type==='race').length,1);
 // Set three separated weekdays, including today, so the activity can complete a real session.
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'availability profile');
 const available=[0,2,4].map(offset=>(day(today())+offset)%7);
 for(const d of [0,1,2,3,4,5,6]){
  const label=DAYS[d],want=available.includes(d);
  await evaluate(`(()=>{const label=[...document.querySelectorAll('.availability .check-label')].find(l=>l.textContent.trim()===${JSON.stringify(label)});const input=label.querySelector('input');if(input.checked!==${want})input.click();return true;})()`);
 }
 await field('Día preferido para tirada larga',day(today()));
 await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'profile available today');
 await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'availability preview');await button('Aceptar nuevo plan');
 await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'availability accepted');
 const planned=saved.plan.sessions.find(s=>s.date===today());assert.ok(planned);assert.equal(planned.type,'walk');
 await evaluate(`[...document.querySelectorAll('.session-card')].find(b=>b.getAttribute('aria-label')?.startsWith('Correr / caminar del')).click()`);
 await until(`!!document.querySelector('[role=dialog]')`,'session instructions');
 assert(await evaluate(`document.querySelector('[role=dialog]').textContent.includes('Camina cómodo para calentar')&&document.querySelector('[role=dialog]').textContent.includes('Camina para terminar')`));
 assert(await evaluate(`document.querySelector('.session-prescription').textContent.includes('Duración prescrita')&&document.querySelector('.session-prescription').textContent.includes('Sin FC pautada')`));
 await evaluate(`document.querySelector('.fatigue-option summary').click()`);
 assert(await evaluate(`document.querySelector('.fatigue-option details[open]').textContent.includes('Los bloques suman el total')&&document.querySelector('.fatigue-option').textContent.includes('Correr / caminar reducida')`));
 assert(await evaluate(`document.querySelector('.calendar-prescription').textContent.includes('Calentamiento')`));
 await button('Seguir sesión por bloques');await button('Empezar / continuar');
 await until(`document.querySelector('.guide-console')?.textContent.includes('00:01')`,'guide active clock');
 await button('Saltar bloque');await until(`document.querySelector('.guide-console')?.textContent.includes('Bloque 2 de')`,'next guide block');
 await button('Pausar');await evaluate(`document.querySelector('[role=dialog] button[aria-label="Cerrar detalle"]').click()`);
 // Read the real race event in its own calendar week, including its instructions.
 for(let i=0;i<5;i++)await evaluate(`document.querySelector('button[aria-label="Periodo siguiente"]').click()`);
 await until(`!![...document.querySelectorAll('.session-card')].find(b=>b.getAttribute('aria-label')?.startsWith('Día de la carrera del'))`,'race calendar label');
 await evaluate(`[...document.querySelectorAll('.session-card')].find(b=>b.getAttribute('aria-label')?.startsWith('Día de la carrera del')).click()`);
 await until(`document.querySelector('[role=dialog]')?.textContent.includes('distancia oficial')`,'race instructions');
 await evaluate(`document.querySelector('[role=dialog] button[aria-label="Cerrar detalle"]').click()`);
 await button('Hoy');
 await button('Añadir carrera');await until(`!!document.querySelector('.record-layout')`,'activity form');
 await field('Distancia (km)',2);await field('Tiempo en movimiento',duration(planned.seconds));await field('Tipo de sesión realizada','walk');await field('Esfuerzo percibido',3);await field('Fatiga después de la carrera',3);await field('Molestias','none');await field('Sensaciones','bien');await field('Terreno (opcional)','asphalt');
 await button('Guardar y analizar carrera');await until(`document.body.textContent.includes('Historial y estadísticas')`,'recorded activity');
 assert.equal(saved.activities.length,1);assert.equal(saved.activities[0].sessionId,planned.id);assert.equal(sessionStatus(planned,saved),'completed');assert.equal(weekSummary(saved).actualKm,2);
 await button('Mi plan');await until(`!!document.querySelector('.calendar')`,'completed calendar');
 assert(await evaluate(`!![...document.querySelectorAll('.calendar-day')].find(d=>d.querySelector('.recorded-run')&&d.textContent.includes('Completada'))`));
 await button('Historial');await until(`!!document.querySelector('.activity-row')`,'activity history');
 await button('Editar');await until(`document.querySelector('h1')?.textContent==='Editar carrera'`,'edit activity');
 await field('Fecha',addDays(today(),-1));await button('Guardar y analizar carrera');await until(`document.body.textContent.includes('Historial y estadísticas')`,'edited activity');
 assert.equal(saved.activities[0].sessionId,'');assert.equal(saved.activities[0].plannedSnapshot,null);assert.equal(sessionStatus(planned,saved),'pending');
 await button('Editar');await until(`document.querySelector('h1')?.textContent==='Editar carrera'`,'relink edited activity');await field('Fecha',today());await button('Guardar y analizar carrera');
 await until(`document.body.textContent.includes('Historial y estadísticas')`,'relinked activity');assert.equal(saved.activities[0].sessionId,planned.id);
 // A network failure must remain visible after navigation, retain changes, and allow retry.
 await button('Ajustes');await until(`document.body.textContent.includes('Ajustes del entrenador')`,'settings');assert(await evaluate(`document.body.textContent.includes('sin modificar automáticamente las siguientes sesiones')`));
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'failed profile write');failNextWrite=true;await field('Fatiga habitual estos días',4);await button('Guardar perfil y objetivo');
 await until(`document.body.textContent.includes('los cambios pendientes siguen en pantalla')`,'failed persistence');
 await button('Inicio');assert(await evaluate(`document.body.textContent.includes('Hay cambios sin guardar')&&document.body.textContent.includes('Reintentar guardado')`));
 await button('Reintentar guardado');await until(`document.querySelector('.save-state')?.textContent==='Datos guardados'`,'retry persistence');assert.equal(saved.profile.fatigue,'4');
 // Editing demo data and leaving it cannot populate a real activity form.
 const realData=JSON.stringify(saved);await button('Explorar demostración');await button('Historial');await until(`!!document.querySelector('.activity-row')`,'demo history');await button('Editar');
 await until(`document.querySelector('h1')?.textContent==='Editar carrera'`,'demo edit');await button('Salir de demostración');await button('Añadir carrera');
 await until(`!!document.querySelector('.record-layout')`,'real form after demo');
 assert.equal(await evaluate(`document.querySelector('input[type=number]').value`),'');assert.equal(JSON.stringify(saved),realData);
 await send('Page.reload');await until(`!!document.querySelector('.sidebar')`,'final reopening');
 assert.equal(saved.activities.length,1);assert.equal(saved.activities[0].sessionId,planned.id);assert.equal(weekSummary(saved).actualKm,2);assert.deepEqual(faults,[]);
 // Change the runner's evidence through the actual profile form, then accept its plan.
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'personalization profile');
 await field('Experiencia corriendo','regular');await field('Kilómetros semanales actuales',28);await field('Origen de los kilómetros semanales','measured');await field('Variación entre las últimas semanas','stable');await field('Días que has corrido por semana últimamente',3);await field('¿Cómo ha sido tu continuidad?','continuous');await field('Semanas consecutivas con esta rutina',12);await field('Pausa más larga en las últimas ocho semanas',0);
 await field('Tirada más larga reciente (km)',7);await field('Fecha de la tirada reciente',addDays(today(),-7));await field('Origen de la distancia de la tirada','measured');await field('¿Cómo resultó esa tirada?','comfortable');await field('Ritmo habitual suave (min/km)','6:30');await field('Origen del ritmo cómodo','measured');await field('Esfuerzo en tus rodajes suaves (0–10)',3);await field('¿Puedes conversar en un rodaje suave?','yes');
 await field('Fecha de la marca',addDays(today(),-14));await field('Tiempo (mm:ss o hh:mm:ss)','25:00');await field('Contexto de la marca','competition');await field('Origen de distancia y tiempo de la marca','measured');await field('Esfuerzo de esta marca','race');await field('Terreno de la marca','asphalt');await button('Quitar deporte');
 for(const d of [0,1,2,3,4,5,6])await evaluate(`(()=>{const l=[...document.querySelectorAll('.availability .check-label')].find(l=>l.textContent.trim()===${JSON.stringify(DAYS[d])});const i=l.querySelector('input');if(i.checked!==${[2,4,0].includes(d)})i.click();return true;})()`);
 // Edit each daily time separately because the form has repeated labels.
 for(const d of [2,4,0])await evaluate(`(()=>{const box=[...document.querySelectorAll('.availability>div')].find(b=>b.querySelector('.check-label').textContent.trim()===${JSON.stringify(DAYS[d])});const input=box.querySelector('input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'100');input.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await field('Días de carrera por semana',3);await field('Día preferido para tirada larga',0);await field('Prioridad en la carrera','improve');await field('Fecha de carrera',addDays(today(),84));await field('Flexibilidad para una meta alternativa','any');await field('Restricción para correr','none');
 await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'evidence saved');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'evidence plan preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'evidence accepted');
 assert(saved.plan.qualitySummary.count>0);assert.equal(saved.plan.basis.profile.weeklySource,'measured');assert.equal(saved.plan.basis.profile.marks[0].context,'competition');assert.equal(saved.plan.racePreparation.paceSource,'recent-mark');const goodQuality=saved.plan.qualitySummary.count;
 // Read a real generated quality workout in the calendar and detail, at desktop and mobile widths.
 const quality=saved.plan.sessions.find(s=>s.type==='interval'&&s.date>=today())||saved.plan.sessions.find(s=>s.type==='tempo'&&s.date>=today());assert(quality);
 await button('Mi plan');await button('Hoy');
 const qualityWeeks=daysBetween(monday(today()),monday(quality.date))/7;for(let i=0;i<qualityWeeks;i++)await evaluate(`document.querySelector('button[aria-label="Periodo siguiente"]').click()`);
 await until(`!!document.querySelector('.session-card.${quality.type}')`,'quality calendar');
 const mainInstruction=prescriptionSummary(quality).find(row=>row.kind==='main').text;
 assert(await evaluate(`document.querySelector('.session-card.${quality.type} .calendar-blocks').textContent.includes(${JSON.stringify(mainInstruction)})`));
 await evaluate(`document.querySelector('.session-card.${quality.type}').click()`);await until(`!!document.querySelector('.session-prescription')`,'quality instructions');
 const recovery=recoveryInstruction(quality);assert(await evaluate(`document.querySelector('.prescription-outline').textContent.includes(${JSON.stringify(recovery.text)})`));
 assert(await evaluate(`document.querySelector('.session-prescription').textContent.includes(${JSON.stringify(sessionTotals(quality).duration)})&&document.querySelector('.session-prescription').textContent.includes('Ritmo orientativo')&&document.querySelector('.session-prescription').textContent.includes('Cinta:')`));
 await evaluate(`document.querySelector('.fatigue-option summary').click()`);assert(await evaluate(`document.querySelector('.fatigue-option').textContent.includes('Recuperación reducida')&&document.querySelector('.fatigue-option details').textContent.includes('Los bloques suman el total')`));
 if(process.argv.includes('--screenshot')){const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../.tools/session-detail-desktop.png',import.meta.url),Buffer.from(capture.data,'base64'));}
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth&&document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth+1`));
 if(process.argv.includes('--screenshot')){const capture=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('../.tools/session-detail-mobile.png',import.meta.url),Buffer.from(capture.data,'base64'));}
 await evaluate(`document.querySelector('[aria-label="Cerrar detalle"]').click()`);await send('Emulation.clearDeviceMetricsOverride');await button('Hoy');
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'priority edit');await field('Prioridad en la carrera','nonstop');await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'priority saved');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'priority preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'priority accepted');
 assert.equal(saved.plan.qualitySummary.count,0);assert(goodQuality>saved.plan.qualitySummary.count);assert.equal(saved.activities.length,1);assert.equal(saved.activities[0].sessionId,planned.id);
 await send('Page.reload');await until(`!!document.querySelector('.sidebar')`,'reopen evidence');await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'reopened evidence profile');assert.equal(await evaluate(`[...document.querySelectorAll('label')].find(l=>l.firstChild?.textContent?.startsWith('Prioridad en la carrera')).querySelector('select').value`),'nonstop');assert.equal(saved.profile.easyConversation,'yes');assert.equal(saved.profile.longestResult,'comfortable');assert.deepEqual(faults,[]);
 await field('Distancia objetivo (km)','');await field('Fecha de carrera','');await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'unknown goal saved');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'unknown goal preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'unknown goal accepted');
 assert.equal(saved.profile.goal.distance,'');assert.equal(saved.profile.goal.date,'');assert.equal(saved.plan.racePreparation.distance,null);assert(!saved.plan.sessions.some(s=>s.type==='race'));assert.equal(saved.activities.length,1);assert.equal(saved.profile.marks[1].time,'20:00');assert.deepEqual(faults,[]);
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'undecided objective');await evaluate(`document.querySelector('input[name="goal"][value="unknown"]').click()`);assert(await evaluate(`document.querySelector('.runner-summary').textContent.includes('Objetivo: No lo sé')`));await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'undecided objective saved');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'undecided preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'undecided accepted');assert.equal(saved.profile.goal.type,'unknown');assert.equal(saved.plan.qualitySummary.count,0);assert.equal(saved.activities.length,1);assert.deepEqual(faults,[]);
 // New engine controls must be usable with AI and integrations unavailable.
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'engine reference profile');
 while(await evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Eliminar marca')`))await button('Eliminar marca');
 await field('Ritmo habitual suave (min/km)','');await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'engine reference saved');await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'engine reference preview');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'engine reference accepted');
 assert.equal(saved.plan.planningVersion,3);assert(saved.plan.referenceSession?.sessionId);assert(saved.plan.sources.length>=4);
 await evaluate(`document.querySelector('.methodology summary').click()`);await button('Abrir sesión de referencia');await until(`!!document.querySelector('[aria-label="Detalle de entrenamiento"]')`,'reference session detail');assert(await evaluate(`document.querySelector('.modal').textContent.includes('Por qué esta sesión')`));await evaluate(`document.querySelector('[aria-label="Cerrar detalle"]').click()`);
 await button('Perfil y objetivo');await until(`!!document.querySelector('.profile-form')`,'alternative profile');await evaluate(`document.querySelector('input[name="goal"][value="race"]').click()`);await field('Distancia objetivo (km)',42.2);await field('Fecha de carrera',addDays(today(),42));await field('Prioridad en la carrera','finish');await field('Flexibilidad para una meta alternativa','distance');await button('Guardar perfil y objetivo');await until(`document.body.textContent.includes('Calcular propuesta de plan')`,'alternative saved');await button('Calcular propuesta de plan');await until(`!!document.querySelector('.plan-preview .alternatives button')`,'engine alternative controls');
 const beforeAlternative=JSON.stringify(saved.plan);await evaluate(`document.querySelector('.plan-preview .alternatives button').click()`);await until(`!document.querySelector('.plan-preview')`,'alternative saved in profile');assert.equal(saved.profile.goal.distance,10);assert.equal(JSON.stringify(saved.plan),beforeAlternative);await button('Calcular propuesta de plan');await until(`document.body.textContent.includes('Aceptar nuevo plan')`,'alternative recalculated');await button('Aceptar nuevo plan');await until(`!document.body.textContent.includes('Aceptar nuevo plan')`,'alternative accepted');assert.equal(saved.plan.sessions.find(s=>s.type==='race').distance,10);assert.equal(saved.activities.length,1);
 await send('Page.reload');await until(`!!document.querySelector('.sidebar')`,'engine final reopen');assert.equal(saved.plan.planningVersion,3);assert.deepEqual(faults,[]);
 if(process.argv.includes('--screenshot')){const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL('../.tools/running-browser-verification.png',import.meta.url),Buffer.from(screenshot.data,'base64'));}
 console.log(JSON.stringify({result:'PASS',scope:'Real Chrome; isolated API fixture, no user writes',checks:['conditional questionnaire and multiple partial marks','editable evidence summary','flexibility filters alternatives','goal and availability','beginner plan and race day','other sports','save/reload','unaccepted goal stays unchanged on reopen','record/edit activity','completed calendar and statistics','settings save failure/retry','demo isolation','profile evidence changes accepted plan','priority changes quality','evidence persists on reopening','unknown date/distance save a provisional plan','local engine without AI','sources and reference session open','alternative saves goal before calendar acceptance','new engine persists on reopening','actual quality blocks in calendar and detail','explicit recoveries and duration types','concrete fatigue alternatives','desktop and mobile session detail'],writes,runtimeErrors:faults.length}));
}finally{
 await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Target.closeTarget',{targetId:tab.id}).catch(()=>{});ws.close();
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser test closed'));}
}
