import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {createServer} from 'node:http';
import {StravaService} from '../lib/strava-service.mjs';import {LocalStravaService} from '../lib/strava-local.mjs';import {allowedRun,normalizeRun,randomSecret,open,validTokenKey} from '../lib/strava-core.mjs';
import {empty,blankProfile,generate,today,addDays,metrics} from '../lib/engine.mjs';import {CoachService,manualContext} from '../lib/ai-coach.mjs';import {withAIConsent,hasAIConsent} from '../lib/coach-consent.mjs';import {chatReply,coachFacts,validateModelReply,modelStatus,modelConfig} from '../lib/coach-chat.mjs';
import {isTrainingActivity} from '../lib/activity-source.mjs';
function database(){const raw=new DatabaseSync(':memory:');for(const file of ['0000_cool_true_believers.sql','0001_luxuriant_jamie_braddock.sql','0002_abnormal_skreet.sql'])raw.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));return {raw,prepare(sql){return {bind(...args){return {async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(raw.prepare(sql).run(...args).changes)}};}};}};},async batch(items){raw.exec('BEGIN');try{const r=[];for(const item of items)r.push(await item.run());raw.exec('COMMIT');return r;}catch(e){raw.exec('ROLLBACK');throw e;}}};}
const config=()=>({STRAVA_TOKEN_KEY:randomSecret(),STRAVA_CLIENT_ID:'123',STRAVA_CLIENT_SECRET:'fixture-secret',STRAVA_REDIRECT_URI:'https://fixture.invalid/api/strava/callback',STRAVA_RETENTION_JOB_ENABLED:'true'});
const activity={id:123,athlete:{id:1},sport_type:'Run',name:'Fixture run',distance:5000,moving_time:1800,start_date:today()+'T00:00:00Z',start_date_local:today()+'T02:00:00Z',timezone:'(GMT+02:00) Europe/Madrid'};
const tokens={accessToken:'fixture-access',refreshToken:'fixture-refresh',expiresAt:Math.floor(Date.now()/1000)+21600};
const p={...blankProfile(),name:'PRIVATE NAME',experience:'regular',weeklyKm:24,longest:8,easyPace:'6:30',days:[0,1,2,3,4,5,6],minutes:Object.fromEntries(Array.from({length:7},(_,i)=>[i,90])),timezone:'Europe/Madrid',goal:{type:'routine'}};
const base=()=>({...empty(),profile:p,plan:generate(p)});
test('reauthorization resets cache and last sync while preserving private notes and other users',async()=>{
 const db=database(),s=new StravaService(db,config(),async()=>Response.json([]));await s.saveConnection('one','1',tokens,'oauth',['activity:read_all']);await s.saveConnection('two','2',tokens,'oauth',['activity:read']);
 await s.cacheRun(await s.connection('one'),activity);await s.cacheRun(await s.connection('two'),{...activity,id:456,athlete:{id:2}});const old=await s.status('one');await s.note('one',old.activities[0].id,{text:'Own note retained',pain:'none'});db.raw.prepare('UPDATE strava_connection SET last_sync=? WHERE user_id=?').run(100,'one');
 await s.saveConnection('one','1',tokens,'oauth',['activity:read']);const a=await s.status('one');assert.equal(a.lastSync,null);assert.equal(a.syncCompleted,false);assert.equal(a.activities.length,0);assert.equal(a.orphanNotes[0].text,'Own note retained');assert.equal((await s.status('two')).activities.length,1);
});
test('configuration and cached metadata never substitute a current provider verification',async()=>{
 const db=database(),cfg=config(),s=new StravaService(db,cfg);assert.equal(validTokenKey('too-short'),false);assert.equal(new StravaService(db,{...cfg,STRAVA_TOKEN_KEY:'bad'}).configured(),false);
 await s.saveConnection('one','1',tokens,'oauth',['activity:read']);db.raw.prepare('UPDATE strava_connection SET verified_at=1,last_sync=1').run();let a=await s.status('one');assert.equal(a.state,'verification_required');assert.equal(a.connectionVerified,false);assert.equal(a.syncCompleted,false);assert.equal(a.retentionVerified,false);
 db.raw.prepare('UPDATE strava_connection SET scopes=?').run('[]');a=await s.status('one');assert.equal(a.state,'insufficient_permissions');assert.equal(a.activities.length,0);
});
test('terminal failure in one job cannot become synchronized after another job succeeds',async()=>{
 const db=database(),s=new StravaService(db,config(),async url=>url.includes('activities/999')?new Response(null,{status:503}):Response.json([]));await s.saveConnection('one','1',tokens,'oauth',['activity:read']);const c=await s.connection('one');await s.enqueue(c,'detail',{externalId:'999'},'0-failure');await s.enqueue(c,'list',{after:1,page:1},'1-success');db.raw.prepare('UPDATE strava_jobs SET attempts=7 WHERE id=?').run('0-failure');await s.drain(2);
 const a=await s.status('one');assert.equal(a.state,'connection_error');assert.equal(a.syncCompleted,false);assert.equal(a.lastSync,null);
});
test('privacy choice, malformed dates, modification, duplicate list and deletion are respected locally',async()=>{
 assert.equal(allowedRun({...activity,private:true},{includePrivate:false}),false);assert.equal(allowedRun({...activity,visibility:'only_me'},{includePrivate:false}),false);assert.throws(()=>normalizeRun({...activity,start_date_local:'2026-02-31T10:00:00Z'}));
 const db=database(),cfg=config();let list=[activity,activity];const s=new LocalStravaService(db,cfg,async()=>Response.json(list),{log:()=>{}});await s.saveConnection('one','1',tokens,'oauth',['activity:read_all']);assert.equal((await s.status('one')).activities.length,1);
 list=[{...activity,name:'Updated',distance:6000}];assert.equal((await s.status('one')).activities[0].distance,6);list=[];assert.equal((await s.status('one')).activities.length,0);assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM strava_cache').get().n,0);
});
test('provider granted scopes prevail over callback claims and stale tokens cannot survive disconnect',async()=>{
 const db=database(),cfg=config();let calls=0;const s=new StravaService(db,cfg,async()=>{calls++;return Response.json({access_token:'access',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+21600,athlete:{id:1},scope:''});});const u=new URL(await s.begin('one',{},'cookie'));await assert.rejects(s.finish('one',u.searchParams.get('state'),'cookie','code','read,activity:read_all'),e=>e.status===403);assert.equal(await s.connection('one'),null);
 await s.saveConnection('one','1',tokens,'oauth',['activity:read']);const c=await s.connection('one');await s.disconnect('one',false);const before=calls;await assert.rejects(s.access(c));assert.equal(calls,before);
});
test('retention scheduling is verified only after an actual background run',async()=>{
 const db=database(),s=new StravaService(db,config(),async()=>Response.json([]));assert.equal((await s.status('one')).retentionVerified,false);await s.background();assert.equal((await s.status('one')).retentionVerified,true);
});
test('disconnect during a live query and a wrong encryption key cannot retain verified access',async()=>{
 const db=database(),cfg=config();let s,calls=0;s=new LocalStravaService(db,cfg,async()=>{calls++;await s.disconnect('one',false);return Response.json([]);},{log:()=>{}});await s.saveConnection('one','1',tokens,'oauth',['activity:read']);const disconnected=await s.status('one');assert.equal(disconnected.state,'disconnected');assert.equal(disconnected.connectionVerified,false);assert.equal(disconnected.syncCompleted,false);
 await s.saveConnection('one','1',tokens,'oauth',['activity:read']);const unavailable=new LocalStravaService(db,{...cfg,STRAVA_TOKEN_KEY:randomSecret()},async()=>{calls++;return Response.json([]);},{log:()=>{}});const before=calls,result=await unavailable.status('one');assert.equal(result.state,'credentials_unavailable');assert.equal(result.connectionVerified,false);assert.equal(calls,before);
});
test('invalid refresh data preserves current encrypted tokens; returned permissions can only narrow access',async()=>{
 const db=database(),cfg=config(),expired={...tokens,expiresAt:Math.floor(Date.now()/1000)-1};let answer;
 const s=new StravaService(db,cfg,async()=>Response.json(answer));s.diagnostic=()=>{};
 for(const invalid of [{access_token:{bad:true},refresh_token:'new',expires_at:Math.floor(Date.now()/1000)+1000},{access_token:'new',refresh_token:'new',expires_at:1}]){await s.saveConnection('one','1',expired,'oauth',['activity:read_all']);answer=invalid;const c=await s.connection('one');await assert.rejects(s.access(c));assert.equal((await s.connection('one')).cipher,c.cipher);}
 for(const scope of ['read,activity:read','']){await s.saveConnection('one','1',expired,'oauth',['activity:read_all']);const c=await s.connection('one');await s.cacheRun(c,{...activity,private:true});answer={access_token:'new-access',refresh_token:'new-refresh',expires_at:Math.floor(Date.now()/1000)+21600,scope};
  if(scope)assert.equal(await s.access(c),'new-access');else await assert.rejects(s.access(c),e=>e.status===403);
  const updated=await s.connection('one');assert.equal((await open(updated.cipher,cfg.STRAVA_TOKEN_KEY,'one')).refreshToken,'new-refresh');assert.deepEqual(JSON.parse(updated.scopes),scope?['read','activity:read']:[]);assert.equal(db.raw.prepare('SELECT COUNT(*) n FROM strava_cache WHERE user_id=?').get('one').n,0);
 }
});
test('MCP needs consent scoped per user and revoking it leaves local planning intact',async()=>{
 const db=database(),one=base(),two=withAIConsent(base(),true);for(const [id,state] of [['one',one],['two',two]])db.raw.prepare('INSERT INTO runner_state VALUES (?,?,1,?)').run(id,JSON.stringify(state),'');const service=new CoachService(db);
 await assert.rejects(service.call('one','mi_contexto_running'),/Autoriza/);assert.equal((await service.call('two','mi_contexto_running')).profile.weeklyKm,24);const revoked=withAIConsent(two,false);assert.equal(hasAIConsent(revoked),false);db.raw.prepare('UPDATE runner_state SET data=? WHERE user_id=?').run(JSON.stringify(revoked),'two');await assert.rejects(service.call('two','mi_contexto_running'));assert.deepEqual(revoked.plan,two.plan);assert.equal((await chatReply(revoked,{question:'¿Cuál es mi próxima sesión?',mode:'rules'})).mode,'rules');
});
test('requests waiting for a rotating token also respect revoked permissions',async()=>{
 const db=database(),cfg=config();let exchanges=0;const s=new StravaService(db,cfg,async()=>{exchanges++;return Response.json({access_token:'new-access',refresh_token:'new-refresh',expires_at:Math.floor(Date.now()/1000)+21600,scope:''});});s.diagnostic=()=>{};await s.saveConnection('one','1',{...tokens,expiresAt:1},'oauth',['activity:read_all']);const c=await s.connection('one');const results=await Promise.allSettled([s.access(c),s.access(c)]);assert(results.every(r=>r.status==='rejected'&&r.reason.status===403));assert.equal(exchanges,1);
});
test('AI context excludes all provider origins, authorized external files, names and tokens',()=>{
 const state=base();state.activities=[{id:'own',date:addDays(today(),-7),distance:5,seconds:1800,type:'easy'},{id:'provider',provider:'strava',date:addDays(today(),-7),distance:25,seconds:7200},{id:'file',source:'personal-file',date:addDays(today(),-7),distance:15,seconds:5400},{id:'origin',origin:'strava-api',date:addDays(today(),-7),distance:30,seconds:8000}];state.strava={accessToken:'PRIVATE TOKEN'};
 const c=manualContext(state);assert.deepEqual(c.recentActivities.map(a=>a.id),['own']);assert(!JSON.stringify(c).includes('PRIVATE'));assert.equal(c.recentTraining.weeks.at(-1).km,5);
});
test('rules and model failures answer without external data transmission or false model labels',async()=>{
 const state=base();let calls=0;const fetcher=async()=>{calls++;throw Error('offline');};const query={question:'Estoy cansado; revisa mi sesión.',mode:'rules'};assert.equal((await chatReply(state,query,{},fetcher)).mode,'rules');assert.equal(calls,0);
 const noConsent=await chatReply(state,{...query,mode:'ollama'},{ZANCADA_OLLAMA_ENABLED:'true'},fetcher);assert.equal(noConsent.fallback,'consent');assert.equal(calls,0);const enabled=withAIConsent(state,true);const unavailable=await chatReply(enabled,{...query,mode:'ollama'},{ZANCADA_OLLAMA_ENABLED:'true'},fetcher);assert.equal(unavailable.mode,'rules');assert.equal(unavailable.generationVerified,false);
 const forbidden=await chatReply(enabled,{question:'Analiza mis actividades de Strava',mode:'ollama'},{ZANCADA_OLLAMA_ENABLED:'true'},fetcher);assert.equal(forbidden.fallback,'strava');assert.equal(calls,1);assert.equal(modelConfig({OLLAMA_MODEL:'llama:cloud'}).valid,false);
});
test('API provenance remains excluded even if a record has been labeled manual or placed among marks',()=>{
 const mark={date:addDays(today(),-7),distance:5,time:'20:00',effort:'race',measurement:'measured',context:'competition',terrain:'asphalt'};
 assert.equal(metrics({...p,marks:[mark]}).source,'recent-mark');
 for(const origin of [{provider:'strava'},{origin:'strava-api'},{stravaId:'123'},{source:'strava'}]){const marked={...mark,...origin};assert.equal(isTrainingActivity({...marked,source:origin.source||'manual'}),false);assert.notEqual(metrics({...p,marks:[marked]}).source,'recent-mark');assert.equal(manualContext({...base(),profile:{...p,marks:[marked]}}).profile.marks.length,0);}
});
test('free notes and lap annotations stay out of the model context',()=>{
 const state=base();state.profile.injuries='PRIVATE NOTE';state.profile.restrictions='PRIVATE NOTE';state.plan.sessions[0].notes='PRIVATE NOTE';state.plan.sessions[0].blocks[0].notes='PRIVATE NOTE';state.activities=[{id:'manual',date:today(),distance:5,seconds:1800,notes:'PRIVATE NOTE',laps:[{distance:1,seconds:360,name:'PRIVATE NOTE',notes:'PRIVATE NOTE'}]}];
 const context=manualContext(state);assert(!JSON.stringify(context).includes('PRIVATE NOTE'));assert.equal(context.recentActivities[0].laps[0].distance,1);assert.equal(context.plan.sessions[0].id,state.plan.sessions[0].id);
});
test('model cannot invent advice, facts, intensity, past changes or unrequested adjustments',()=>{
 const state=base(),facts=coachFacts('Revisa mi cansancio',state),future=state.plan.sessions.find(s=>s.date>today()&&s.distance>0);assert.throws(()=>validateModelReply({factIds:['invented'],changes:[]},facts,state,'cansado'));assert.throws(()=>validateModelReply({factIds:['next'],text:'Sube la intensidad'},facts,state,'cansado'));
 assert.throws(()=>validateModelReply({factIds:['next'],changes:[{sessionId:future.id,action:'increase'}]},facts,state,'cansado'));assert.throws(()=>validateModelReply({factIds:['next'],changes:[{sessionId:future.id,action:'rest'}]},facts,state,'Explica mi ritmo'));
 const result=validateModelReply({factIds:['alternative'],changes:[{sessionId:future.id,action:'reduce',reduction:.2}]},facts,state,'Estoy cansado');assert.equal(result.proposal.status,'pending');assert.equal(result.proposal.source,'ollama');assert(result.proposal.after.seconds<=result.proposal.before.seconds);assert.equal(state.proposals.length,0);
 const painful={...state,profile:{...p,pain:'relevant'}};assert.throws(()=>validateModelReply({factIds:['next']},coachFacts('cansado',painful),painful,'cansado'));
});
test('a local endpoint with a remote alias or missing model files never receives runner context',async()=>{
 const cfg={ZANCADA_OLLAMA_ENABLED:'true',OLLAMA_MODEL:'fixture-model'},state=withAIConsent(base(),true);let chats=0;
 for(const detail of [{remote_host:'https://remote.invalid',capabilities:['completion'],details:{format:'gguf'},model_info:{architecture:'llama'}},{capabilities:['completion'],details:{},model_info:{}},{capabilities:['embedding'],details:{format:'gguf'},model_info:{architecture:'llama'}}]){
  const fetcher=async url=>{if(url.endsWith('/api/tags'))return Response.json({models:[{name:'fixture-model'}]});if(url.endsWith('/api/show'))return Response.json(detail);chats++;throw Error('Must not transmit context');};
  assert.equal((await modelStatus(cfg,fetcher)).available,false);const result=await chatReply(state,{question:'Mi próxima sesión',mode:'ollama'},cfg,fetcher);assert.equal(result.mode,'rules');assert.equal(result.generationVerified,false);
 }assert.equal(chats,0);
});
test('unsafe, unfinished, foreign-model and failed generation responses fall back without modifying the plan',async()=>{
 const state=withAIConsent(base(),true),before=JSON.stringify(state),cfg={ZANCADA_OLLAMA_ENABLED:'true',OLLAMA_MODEL:'fixture-model'};
 for(const response of [Response.json({model:'other-model',done:true,message:{role:'assistant',content:'{}'}}),Response.json({model:'fixture-model',done:false,message:{role:'assistant',content:'{}'}}),Response.json({model:'fixture-model',done:true,message:{role:'assistant',content:JSON.stringify({factIds:['invented']})}}),new Response(null,{status:503})]){
  const fetcher=async url=>url.endsWith('/api/tags')?Response.json({models:[{name:'fixture-model'}]}):url.endsWith('/api/show')?Response.json({capabilities:['completion'],details:{format:'gguf'},model_info:{architecture:'llama'}}):response;
  const result=await chatReply(state,{question:'Estoy cansado',mode:'ollama'},cfg,fetcher);assert.equal(result.mode,'rules');assert.equal(result.generationVerified,false);assert.equal(result.proposal,null);assert.equal(JSON.stringify(state),before);
 }
});
test('local model HTTP protocol verifies generation and sends only authorized context',async()=>{
 let captured;const server=createServer(async(req,res)=>{let raw='';for await(const piece of req)raw+=piece;res.setHeader('Content-Type','application/json');if(req.url==='/api/tags')res.end(JSON.stringify({models:[{name:'fixture-model'}]}));else if(req.url==='/api/show')res.end(JSON.stringify({capabilities:['completion'],details:{format:'gguf'},model_info:{'general.architecture':'llama'}}));else{captured=JSON.parse(raw);res.end(JSON.stringify({model:'fixture-model',done:true,message:{role:'assistant',content:JSON.stringify({factIds:['next','rules'],changes:[]})}}));}});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(11434,'127.0.0.1',resolve);});
 try{const cfg={ZANCADA_OLLAMA_ENABLED:'true',OLLAMA_MODEL:'fixture-model'},state=withAIConsent(base(),true);state.strava={accessToken:'SECRET'};state.activities=[{id:'provider-secret',source:'strava',distance:25,date:today()}];const status=await modelStatus(cfg);assert.equal(status.available,true);assert.equal(status.generationVerified,false);const r=await chatReply(state,{question:'Explícame la próxima sesión.',mode:'ollama'},cfg);assert.equal(r.mode,'ollama');assert.equal(r.generationVerified,true);assert(!JSON.stringify(captured).includes('SECRET'));assert(!JSON.stringify(captured).includes('provider-secret'));assert(!JSON.stringify(captured).includes('PRIVATE NAME'));assert.equal(captured.stream,false);assert.equal(r.proposal,null);}finally{await new Promise(resolve=>server.close(resolve));}
});
