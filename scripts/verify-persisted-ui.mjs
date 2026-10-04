// Called only against the disposable server/store owned by verify-state-http.
import assert from 'node:assert/strict';
import {isTrainingActivity} from '../lib/activity-source.mjs';

export async function verifyPersistedUI(origin,expected){
 const chrome='http://127.0.0.1:9223',faults=[];
 for(let reopening=0;reopening<2;reopening++){
  const tab=await(await fetch(chrome+'/json/new?about:blank',{method:'PUT'})).json(),ws=new WebSocket(tab.webSocketDebuggerUrl),pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('Persistence browser timeout: '+method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
  ws.onmessage=event=>{const result=JSON.parse(event.data);if(result.method==='Runtime.exceptionThrown')faults.push(result.params.exceptionDetails.text);const request=pending.get(result.id);if(!request)return;clearTimeout(request.timer);pending.delete(result.id);if(result.error)request.reject(Error(result.error.message));else request.resolve(result.result);};
  async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
  async function until(expression){const end=Date.now()+20000;while(Date.now()<end){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Persisted UI did not restore expected state.');}
  try{
   await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCookie',{url:origin,name:'__sites_local_auth',value:'1'});
   // There is deliberately no Fetch interception: these are real HTTP/D1 reads.
   await send('Page.navigate',{url:origin});await until(`document.querySelector('.save-state')?.textContent==='Datos guardados'&&!!document.querySelector('.sidebar')`);
   await evaluate(`[...document.querySelectorAll('.desktop-navigation button')].find(b=>b.textContent.trim()==='Perfil y objetivo').click()`);await until(`!!document.querySelector('.profile-form')`);
   for(const [label,value] of [['Nombre',expected.profile.name],['Kilómetros semanales actuales',expected.profile.weeklyKm]])assert.equal(await evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(e=>e.firstChild?.textContent===${JSON.stringify(label)});return label?.querySelector('input')?.value;})()`),String(value));
   await evaluate(`[...document.querySelectorAll('.desktop-navigation button')].find(b=>b.textContent.trim()==='Historial').click()`);await until(`document.querySelectorAll('.activity-row').length===${expected.activities.filter(isTrainingActivity).length}`);
  }finally{
   await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Target.closeTarget',{targetId:tab.id}).catch(()=>{});ws.close();for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Persistence browser closed'));}
  }
 }
 assert.deepEqual(faults,[]);
 return {result:'PASS',reopenings:2,scope:'Real Chrome and HTTP/D1 in disposable store; separate browser tabs, no API/provider fixtures'};
}
