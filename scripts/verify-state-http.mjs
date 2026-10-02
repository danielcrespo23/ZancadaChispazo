// Starts an isolated local server and D1 store; never writes to .wrangler/state.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {empty,blankProfile,today,addDays,session,recordActivity,associateActivities} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview,weekSummary,sessionStatus} from '../lib/training.mjs';
import {localActivityDate} from '../lib/activity-source.mjs';
import {withAIConsent,hasAIConsent} from '../lib/coach-consent.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),id=randomUUID();
const directory=resolve(root,`.tools/verify-${id}`),store=resolve(directory,'state'),origin='http://127.0.0.1:5174';
mkdirSync(directory,{recursive:true});
const config=resolve(directory,'wrangler.json'),sqlFile=resolve(directory,'schema.sql');
writeFileSync(config,JSON.stringify({name:'zancada-verification',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}]}));
writeFileSync(sqlFile,readdirSync(resolve(root,'drizzle')).filter(f=>/^\d+.*\.sql$/.test(f)).sort().map(f=>readFileSync(resolve(root,'drizzle',f),'utf8')).join('\n'));
const init=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',config,'--persist-to',store,'--file',sqlFile],{cwd:root,encoding:'utf8'});
if(init.status!==0)throw Error('Isolated schema initialization failed: '+init.stderr);

let server,log='';const auth={cookie:'__sites_local_auth=1'},write={...auth,'Content-Type':'application/json',Origin:origin};
const call=async(method,body,headers=auth)=>{const response=await fetch(origin+'/api/state',{method,headers,...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:response.status,data};};
const activities=async(method,body,headers=auth)=>{const response=await fetch(origin+'/api/activities',{method,headers,...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:response.status,data};};
async function start(){
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{cwd:root,env:{...process.env,ZANCADA_VERIFY_RUN_ID:id},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>{log+=chunk;});server.stderr.on('data',chunk=>{log+=chunk;});
 const deadline=Date.now()+55000;
 while(Date.now()<deadline){
  if(server.exitCode!==null)throw Error('Isolated server exited: '+log);
  // Do not query an unrelated listener before our isolated server owns the port.
  if(log.includes('http://127.0.0.1:5174'))try{const result=await call('GET');if(result.status===200)return;}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error('Isolated server did not become ready: '+log);
}
async function stop(){if(!server||server.exitCode!==null)return;const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}
try{
 await start();
 assert.deepEqual((await call('GET')).data,{state:null,revision:0});
 assert.equal((await call('GET',null,{'oai-authenticated-user-id':'spoofed','oai-authenticated-user-email':'x@example.invalid'})).status,401);
 const p={...blankProfile(),name:'Verificación aislada',experience:'regular',weeklyKm:24,weeklySource:'estimated',weeklyTrend:'variable',pauseWeeks:2,recentFrequency:3,consistentWeeks:8,consistency:'intermittent',longest:8,longestSource:'measured',longestDate:addDays(today(),-7),longestResult:'hard',easyPace:'6:00',easySource:'estimated',easyEffort:3,easyConversation:'yes',runningRestriction:'time-limit',restrictionMinutes:25,recovery:'good',fatigue:3,timezone:'Europe/Madrid',marks:[{id:'reference',date:addDays(today(),-14),distance:5,time:'25:00',context:'competition',measurement:'measured',effort:'race',terrain:'asphalt'},{id:'partial',date:'',distance:10,time:'',context:'unknown',measurement:'estimated',effort:'unknown',terrain:'unknown'}],goal:{type:'race',intent:'nonstop',distance:10,date:addDays(today(),70),time:'',flexibility:'date',terrain:'asphalt'}};
 const initial={...empty(),profile:p};let state=acceptPlanPreview(initial,buildPlanPreview(initial));
 assert.equal((await call('PUT',{state,revision:0},write)).status,200);
 state=recordActivity(state,{id:'own-http',date:today(),distance:5,seconds:1800,type:'easy',rpe:3,fatigue:3,pain:'none',feeling:'bien',linkMode:'auto'}).state;
 assert.equal((await call('PUT',{state,revision:1},write)).status,200);
 assert.deepEqual((await call('GET')).data.state,state);
 assert.equal((await call('PUT',{state,revision:1},write)).status,409);
 assert.equal((await call('PUT',{state,revision:2},{...write,Origin:'https://invalid.example'})).status,403);
 await stop();await start();
 assert.deepEqual((await call('GET')).data,{state,revision:2},'D1 survives an actual server restart');
 const erased=await call('DELETE',null,write);assert.equal(erased.status,200);assert.equal(erased.data.revision,3);
 assert.equal((await call('PUT',{state,revision:2},write)).status,409);
 assert.equal((await call('GET')).data.state,null);
 assert.equal((await call('PUT',{state,revision:3},write)).status,200);
 assert.equal((await call('PUT',{state,revision:2},write)).status,409);
 assert.deepEqual((await call('GET')).data,{state,revision:4});
 // Authorized reception uses the same authenticated user and atomic revision as manual records.
 assert.deepEqual((await activities('GET')).data,{revision:4});
 assert.equal((await activities('GET',null,{'oai-authenticated-user-id':'spoofed'})).status,401);
 const receivedDate=addDays(today(),-1),past=session(p,'easy',receivedDate,5,0,0);
 state={...state,plan:{...state.plan,sessions:[past,...state.plan.sessions]}};
 assert.equal((await call('PUT',{state,revision:4},write)).status,200);
 const file=[{id:'watch-http-main',startedAt:receivedDate+'T08:00:00Z',timezone:'Europe/Madrid',distance:4,seconds:1600,type:'easy',notes:'Bloque recibido: conservar'},
 {id:'watch-http-cooldown',startedAt:receivedDate+'T08:30:00Z',timezone:'Europe/Madrid',distance:1,seconds:400,type:'easy',notes:'Vuelta a la calma: conservar'},
 {id:'watch-http-midnight',startedAt:addDays(today(),-1)+'T22:30:00Z',timezone:'Europe/Madrid',distance:2,seconds:850}];
 const payload={source:'personal-file',consent:true,revision:5,activities:file,userId:'unrelated-user'};
 assert.equal((await activities('POST',payload,{'Content-Type':'application/json'})).status,401);
 assert.equal((await activities('POST',payload,{...write,Origin:'https://invalid.example'})).status,403);
 assert.equal((await activities('POST',{...payload,consent:false},write)).status,400);
 assert.equal((await activities('POST',{...payload,revision:4},write)).status,409);
 const received=await activities('POST',payload,write);assert.equal(received.status,200);assert.equal(received.data.received.length,3);assert.equal(received.data.revision,6);
 state=(await call('GET')).data.state;const own=state.activities.filter(a=>a.source==='personal-file');assert.equal(own.length,3);assert(own.every(a=>a.rpe===null&&a.fatigue===null&&a.pain==='unknown'));
 assert.equal(own.find(a=>a.externalId==='watch-http-midnight').date,localActivityDate(file[2]).date);assert.equal(weekSummary(state).actualKm,state.activities.filter(a=>a.date>=weekSummary(state).start&&a.date<addDays(weekSummary(state).start,7)).reduce((n,a)=>n+a.distance,0));
 const beforeDuplicate=JSON.stringify(state),duplicate=await activities('POST',{...payload,revision:6},write);assert.equal(duplicate.status,200);assert.equal(duplicate.data.duplicates,3);assert.equal(duplicate.data.revision,6);assert.equal(JSON.stringify((await call('GET')).data.state),beforeDuplicate);
 const prohibited=await activities('POST',{...payload,revision:6,activities:[{...file[0],id:'strava-marked',provider:'strava'}]},write);assert.equal(prohibited.data.invalid,1);assert.equal(prohibited.data.received.length,0);
 const parts=own.filter(a=>a.externalId!=='watch-http-midnight');state=associateActivities(state,parts.map(a=>a.id),past.id,{roles:Object.fromEntries(parts.map(a=>[a.id,a.externalId==='watch-http-main'?'main':'cooldown']))});
 assert.equal(sessionStatus(past,state),'completed');assert.equal((await call('PUT',{state,revision:6},write)).status,200);assert.deepEqual((await activities('GET')).data,{revision:7});
 await stop();await start();assert.deepEqual((await call('GET')).data,{state,revision:7},'Received source, grouping, unknown values and notes survive an actual server restart');assert.deepEqual((await activities('GET')).data,{revision:7});
 const coachCall=async(method,body,headers=auth,path='/api/coach')=>{const response=await fetch(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:response.status,data};};
 const question={question:'¿Cuál es mi próxima sesión?',mode:'rules',revision:7},beforeCoach=JSON.stringify(state.plan);
 const health=await coachCall('GET');assert.equal(health.status,200);assert.equal(health.data.defaultMode,'rules');assert.equal(health.data.apiRequired,false);assert.equal(health.data.generationVerified,false);
 assert.equal((await coachCall('GET',null,{'oai-authenticated-user-id':'spoofed'})).status,401);
 assert.equal((await coachCall('POST',question,{...write,Origin:'https://invalid.example'})).status,403);
 assert.equal((await coachCall('POST',{...question,revision:6},write)).status,409);
 assert.equal((await coachCall('POST',{...question,context:{userId:'another'}},write)).status,400);
 assert.equal((await coachCall('POST',{...question,mode:'ollama'},write)).status,403);
 const local=await coachCall('POST',question,write);assert.equal(local.status,200);assert.equal(local.data.mode,'rules');assert.equal(local.data.calendarChanged,false);assert.equal((await call('GET')).data.revision,7);
 const tool={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'mi_contexto_running',arguments:{}}};
 assert.equal((await coachCall('POST',tool,write,'/mcp')).data.result.isError,true);
 state=withAIConsent(state,true);assert.equal((await call('PUT',{state,revision:7},write)).status,200);
 const context=await coachCall('POST',tool,write,'/mcp');assert.equal(context.data.result.isError,false);const manual=JSON.parse(context.data.result.content[0].text);assert(!manual.recentActivities.some(a=>a.source==='personal-file'));assert(!JSON.stringify(manual).includes(p.name));
 const absent=await coachCall('POST',{...question,mode:'ollama',revision:8},write);assert.equal(absent.status,200);assert.equal(absent.data.mode,'rules');assert.equal(absent.data.generationVerified,false);assert.equal(JSON.stringify((await call('GET')).data.state.plan),beforeCoach);
 await stop();await start();assert(hasAIConsent((await call('GET')).data.state));assert.equal((await call('GET')).data.revision,8);
 state=withAIConsent(state,false);assert.equal((await call('PUT',{state,revision:8},write)).status,200);assert.equal((await coachCall('POST',tool,write,'/mcp')).data.result.isError,true);assert.equal(JSON.stringify((await call('GET')).data.state.plan),beforeCoach);
 console.log(JSON.stringify({result:'PASS',scope:'Isolated HTTP server and real D1; original database untouched',checks:['save profile/goal/plan','record activity','read persisted state','server restart','stale revision','erasure/recreation protection','authentication','request origin','authorized HTTP reception','local midnight','unknown sensations','idempotent duplicates','blocked Strava origin','explicit group and notes persist','revision notifications','contextual rules without model','coach and MCP consent gates','consent survives restart','revocation stops MCP','no calendar change from chat']}));
}finally{await stop();}
