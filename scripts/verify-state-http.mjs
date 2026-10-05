// Starts an isolated local server and D1 store; never writes to .wrangler/state.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {empty,blankProfile,today,addDays,session,recordActivity,associateActivities,decideTrainingProposal} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview,weekSummary,sessionStatus} from '../lib/training.mjs';
import {localActivityDate} from '../lib/activity-source.mjs';
import {withAIConsent,hasAIConsent} from '../lib/coach-consent.mjs';
import {verifyPersistedUI} from './verify-persisted-ui.mjs';

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
 // Erasure removed the proposal's origin. Recalculate before recreating a plan;
 // keep the fixture's records and history when creating its new calendar.
 const recreated={...state,plan:null};state=acceptPlanPreview(recreated,buildPlanPreview(recreated,{},today(),{revision:3}),today(),3);
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
 // Replay a proposal over HTTP with the latest revision, bypassing browser guards.
 // All writes in this loop use this run's disposable D1 database.
 const reviewBase=(await call('GET')).data;
 const reviewCases=[
  ['pain',s=>({...s,checkIns:[{date:today(),pain:'relevant',fatigue:3}]})],
  ['availability',s=>({...s,profile:{...s.profile,minutes:{...s.profile.minutes,1:15,3:15,6:20}}})],
  ['activity',s=>({...s,activities:[...s.activities,{id:'review-http',date:today(),distance:2,seconds:800,type:'easy',pain:'none',rpe:3,fatigue:2}]})],
  ['goal',s=>({...s,profile:{...s.profile,goal:{...s.profile.goal,date:addDays(today(),56),distance:21.1}}})]
 ];
 for(const [name,change] of reviewCases){
  let row=(await call('GET')).data;
  const preview=buildPlanPreview(row.state,{},today(),{revision:row.revision}),accepted=acceptPlanPreview(row.state,preview,today(),row.revision),changed=change(row.state);
  assert.equal((await call('PUT',{state:changed,revision:row.revision},write)).status,200,name);
  const current=(await call('GET')).data,payload={...changed,plan:accepted.plan,changes:accepted.changes};
  const rejected=await call('PUT',{state:payload,revision:current.revision},write);
  assert.equal(rejected.status,409,name);assert.equal(rejected.data.code,'stale_plan_preview');assert.equal(rejected.data.recalculate,true);
  assert.deepEqual((await call('GET')).data,current,'failed acceptance preserves state and revision');
  // Return to the fixture data by a normal profile/record write; preserve its calendar.
  assert.equal((await call('PUT',{state:reviewBase.state,revision:current.revision},write)).status,200);
 }
 const finalReview=(await call('GET')).data,validPreview=buildPlanPreview(finalReview.state,{},today(),{revision:finalReview.revision});
 const validState=acceptPlanPreview(finalReview.state,validPreview,today(),finalReview.revision);
 assert.equal((await call('PUT',{state:validState,revision:finalReview.revision},write)).status,200,'valid proposals still accept over HTTP');
 assert.deepEqual((await call('GET')).data.state.activities,reviewBase.state.activities);
 // Calibrating without enough observations must hold the paces and remain
 // reproducible by the server, including the explicit review option.
 const calibrationRow=(await call('GET')).data;
 const calibrationPreview=buildPlanPreview(calibrationRow.state,{calibratePaces:true},today(),{revision:calibrationRow.revision});
 const calibratedState=acceptPlanPreview(calibrationRow.state,calibrationPreview,today(),calibrationRow.revision);
 assert.equal((await call('PUT',{state:calibratedState,revision:calibrationRow.revision},write)).status,200,'valid calibration accepts through server reconstruction');
 const calibratedRow=(await call('GET')).data;
 assert.equal(calibratedRow.state.plan.basis.review.options.calibratePaces,true);
 assert.deepEqual(calibratedRow.state.activities,reviewBase.state.activities);
 assert.deepEqual(calibratedRow.state.profile,reviewBase.state.profile);
 const acceptedReview=(await call('GET')).data;await stop();await start();assert.deepEqual((await call('GET')).data,acceptedReview,'accepted review survives restart');
 // Real authenticated chat follow-up, then replay its draft directly over HTTP.
 // No browser control is involved in these acceptance checks.
 let coachRow=(await call('GET')).data;
 const fatigue=await coachCall('POST',{question:'No tengo dolor, pero estoy cansado',mode:'rules',revision:coachRow.revision},write);
 assert.equal(fatigue.status,200);assert.match(fatigue.data.answer,/por separado/);assert(fatigue.data.conversationId);assert.equal(fatigue.data.proposal,null);
 const scored=await coachCall('POST',{question:'8/10',mode:'rules',revision:coachRow.revision,conversationId:fatigue.data.conversationId},write);
 assert.equal(scored.status,200);assert.match(scored.data.answer,/Fatiga declarada.*8\/10/);assert(scored.data.proposal);assert.equal(scored.data.calendarChanged,false);assert.deepEqual((await call('GET')).data,coachRow);
 const pendingCoach={...coachRow.state,proposals:[...coachRow.state.proposals,scored.data.proposal]};
 assert.equal((await call('PUT',{state:pendingCoach,revision:coachRow.revision},write)).status,200);
 coachRow=(await call('GET')).data;assert.deepEqual(coachRow.state.plan,acceptedReview.state.plan);
 const acceptedCoach=decideTrainingProposal(coachRow.state,scored.data.proposal.id,true),changedCoach={...coachRow.state,checkIns:[...(coachRow.state.checkIns||[]).filter(c=>c.date!==today()),{date:today(),pain:'relevant',fatigue:8}]};
 assert.equal((await call('PUT',{state:changedCoach,revision:coachRow.revision},write)).status,200);
 const changedRow=(await call('GET')).data;
 const staleCoach=await call('PUT',{state:{...changedCoach,plan:acceptedCoach.plan,proposals:acceptedCoach.proposals,changes:acceptedCoach.changes},revision:changedRow.revision},write);
 assert.equal(staleCoach.status,409);assert.equal(staleCoach.data.code,'stale_coach_proposal');assert.equal(staleCoach.data.recalculate,true);assert.deepEqual((await call('GET')).data,changedRow);
 const staleFollow=await coachCall('POST',{question:'8/10',mode:'rules',revision:changedRow.revision,conversationId:scored.data.conversationId},write);assert.equal(staleFollow.status,200);assert.equal(staleFollow.data.contextReset,true);assert.equal(staleFollow.data.proposal,null);
 assert.equal((await call('PUT',{state:coachRow.state,revision:changedRow.revision},write)).status,200);const restoredCoach=(await call('GET')).data;
 assert.equal((await call('PUT',{state:acceptedCoach,revision:restoredCoach.revision},write)).status,200,'fresh reviewed chat draft accepts through server validation');
 const afterCoach=(await call('GET')).data;assert.deepEqual(afterCoach.state.activities,coachRow.state.activities);assert.equal(afterCoach.state.proposals.find(p=>p.id===scored.data.proposal.id).status,'accepted');
 await stop();await start();assert.deepEqual((await call('GET')).data,afterCoach,'coach acceptance survives restart');
 if(process.argv.includes('--browser')){const before=(await call('GET')).data;console.log(JSON.stringify(await verifyPersistedUI(origin,before.state)));assert.deepEqual((await call('GET')).data,before);}
 console.log(JSON.stringify({result:'PASS',scope:'Isolated HTTP server and real D1; original database untouched',checks:['save profile/goal/plan','record activity','read persisted state','server restart','stale revision','erasure/recreation protection','authentication','request origin','authorized HTTP reception','local midnight','unknown sensations','idempotent duplicates','blocked Strava origin','explicit group and notes persist','revision notifications','contextual rules without model','coach and MCP consent gates','consent survives restart','revocation stops MCP','no calendar change from chat','same-day stale preview after pain, availability, activity and goal changes','current HTTP revision cannot bypass preview revalidation','valid review acceptance and restart','authenticated coach nonce and scored follow-up','chat draft stored without calendar modification','stale coach acceptance rejected with latest HTTP revision','changed state invalidates coach follow-up','valid explicit coach acceptance and restart']}));
}finally{await stop();}
