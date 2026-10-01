import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {LocalStravaService} from '../lib/strava-local.mjs';
import {randomSecret,open} from '../lib/strava-core.mjs';
import {oauthCookie,oauthCookieValue,localRedirect,stravaDiagnostic} from '../lib/strava-diagnostics.mjs';
import {stravaView} from '../lib/strava-feedback.mjs';
const require=createRequire(import.meta.url),now=Date.parse('2026-10-26T00:30:00Z');
function database(){const raw=new DatabaseSync(':memory:');for(const file of ['0001_luxuriant_jamie_braddock.sql','0002_abnormal_skreet.sql'])raw.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));return {raw,prepare(sql){return {bind(...args){return {async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(raw.prepare(sql).run(...args).changes)}};}};}};},async batch(items){return Promise.all(items.map(i=>i.run()));}};}
const run=(id=11,sport='Run',start='2026-10-25T23:15:00Z')=>({id,sport_type:sport,name:'Test activity',start_date:start,start_date_local:'2026-10-26T00:15:00Z',timezone:'(GMT+01:00) Europe/Madrid',distance:5230,moving_time:1800,elapsed_time:1900,average_heartrate:145});
function setup(){
 const db=database(),cfg={STRAVA_CLIENT_ID:'123',STRAVA_CLIENT_SECRET:'test-only-secret',STRAVA_TOKEN_KEY:randomSecret(),STRAVA_REDIRECT_URI:'http://localhost:5173/api/strava/callback',STRAVA_RETENTION_JOB_ENABLED:'false'};
 const log=[],calls=[];let items=[run(),run(12,'TrailRun'),run(13,'Walk'),run(14,'Ride')],fail=0,offline=false,syncOnly=false;
 const provider=async(url,init={})=>{calls.push({url,init});if(offline)throw new TypeError('fetch failed');if(url.includes('/oauth/token'))return Response.json({access_token:'test-only-access',refresh_token:'test-only-refresh',expires_at:Math.floor(Date.now()/1000)+21600,athlete:{id:1},scope:'read activity:read activity:read_all'});if(url.endsWith('/athlete'))return Response.json({id:1});if(fail&&(!syncOnly||url.includes('after=')))return new Response(null,{status:fail});return Response.json(items);};
 const service=request=>new LocalStravaService(db,{...cfg,STRAVA_REDIRECT_URI:request?localRedirect(request,cfg.STRAVA_REDIRECT_URI):cfg.STRAVA_REDIRECT_URI},provider,{clock:()=>now,log:line=>log.push(line)});
 let user={userId:'one'};
 const source=readFileSync(new URL('../app/api/strava/[...path]/route.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,module={exports:{}};
 new Function('require','module','exports',code)(name=>name==='cloudflare:workers'?{env:cfg}:name.includes('chatgpt-auth')?{getChatGPTUser:async()=>user}:name.includes('strava-runtime')?{stravaService:service}:name.includes('strava-core')?require('../lib/strava-core.mjs'):name.includes('strava-diagnostics')?require('../lib/strava-diagnostics.mjs'):require(name),module,module.exports);
 return {db,cfg,log,calls,service,route:module.exports,setUser:value=>user=value,setItems:value=>items=value,setFail:value=>fail=value,setSyncFail:()=>{syncOnly=true;fail=500;},setOffline:value=>offline=value};
}
async function authorize(f,host='localhost'){
 const base=`http://${host}:5173`,request=new Request(base+'/api/strava/connect',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
 const response=await f.route.POST(request);assert.equal(response.status,200);
 const cookie=response.headers.get('Set-Cookie'),data=await response.json(),url=new URL(data.url);
 assert.equal(url.searchParams.get('redirect_uri'),base+'/api/strava/callback');assert(url.searchParams.get('scope').includes('activity:read_all'));
 assert(!cookie.includes('; Secure'));assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Lax'));
 const callback=new Request(`${base}/api/strava/callback?code=test-only-code&state=${encodeURIComponent(url.searchParams.get('state'))}&scope=activity:read_all`,{headers:{cookie:cookie.split(';')[0]}});
 return f.route.GET(callback);
}
test('HTTP OAuth callback queries the last seven days automatically; resync is deduplicated and per user',async()=>{
 const f=setup(),response=await authorize(f,'127.0.0.1');assert.equal(response.headers.get('location'),'/?strava=connected');
 const queries=f.calls.filter(c=>c.url.includes('after='));assert.equal(queries.length,1,'callback must actually query, not wait for status');
 const q=new URL(queries[0].url),expected=Math.floor(now/1000)-7*86400;assert.equal(+q.searchParams.get('after'),expected-1);assert.equal(+q.searchParams.get('before'),Math.floor(now/1000)+1);assert(+q.searchParams.get('after')<1e11);
 const status=await f.service().status('one');assert.equal(status.activities.length,2);assert.equal(status.settings.days,7);assert.equal(status.activities[0].date,'2026-10-26');assert.equal(status.activities[0].distance,5.23);assert.equal(status.activities[0].movingSeconds,1800);assert.equal(status.activities[0].avgHR,145);assert.equal(status.activities[0].paceSeconds,1800/5.23);
 f.setItems([run(),run(),run(12,'TrailRun')]);const base='http://127.0.0.1:5173';const sync=await f.route.POST(new Request(base+'/api/strava/sync',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{"days":7}'}));assert.equal(sync.status,200);assert.equal((await sync.json()).status.activities.length,2);
 assert.equal((await f.service().status('two')).activities.length,0);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM strava_cache').get().n,0);
 assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM strava_jobs').get().n,0);
 const saved=await f.service().connection('one');assert.equal((await open(saved.cipher,f.cfg.STRAVA_TOKEN_KEY,'one')).refreshToken,'test-only-refresh');
 assert(!f.log.join('').includes('test-only-'));assert(stravaView(status)==='ready');
});
test('reproduces missing-cookie callback and offline exchange; neither becomes successful empty sync',async()=>{
 const f=setup(),base='http://localhost:5173';
 let response=await f.route.POST(new Request(base+'/api/strava/connect',{method:'POST',headers:{Origin:base},body:'{}'}));let url=new URL((await response.json()).url);
 response=await f.route.GET(new Request(`${base}/api/strava/callback?state=${url.searchParams.get('state')}&code=test-only-code`));assert.equal(response.headers.get('location'),'/?strava=invalid_oauth_state');assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM strava_connection').get().n,0);
 f.setOffline(true);response=await authorize(f);assert.equal(response.headers.get('location'),'/?strava=connection_error');assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM strava_connection').get().n,0);
 f.setOffline(false);await authorize(f);f.setFail(500);const status=await f.service().status('one');assert(status.error);assert.equal(status.syncCompleted,false);assert.equal(stravaView(status),'error');assert.equal(status.activities.length,0);
});
test('empty success, private permission warning, date boundaries and malformed records are distinct',async()=>{
 const f=setup();await authorize(f);f.setItems([]);let status=await f.service().status('one');assert.equal(stravaView(status),'empty');assert(!status.error);
 const boundary=new Date(now-7*86400000).toISOString(),old=new Date(now-7*86400000-1000).toISOString();
 f.setItems([run(1,'Run',boundary),run(2,'Run',old),run(3,'Run',new Date(now+3600000).toISOString())]);status=await f.service().status('one');assert.deepEqual(status.activities.map(a=>a.id),['1']);
 f.setItems([{...run(),start_date_local:'bad'}]);status=await f.service().status('one');assert.equal(stravaView(status),'error');
 f.setItems([run()]);f.db.raw.prepare('UPDATE strava_connection SET scopes=?').run('["activity:read"]');status=await f.service().status('one');assert(status.partialVisibility);
});
test('401/403/429 remain errors and renewed tokens are saved before reading activities',async()=>{
 const f=setup();await authorize(f);for(const code of [401,403,429]){f.setFail(code);const status=await f.service().status('one');assert.equal(stravaView(status),'error');assert(status.error);}
 f.setFail(0);f.db.raw.prepare("DELETE FROM strava_control WHERE key='blocked_until'").run();
 await f.service().saveConnection('one','1',{accessToken:'expired-test-token',refreshToken:'old-test-refresh',expiresAt:1},'oauth',['activity:read_all']);
 const status=await f.service().status('one');assert.equal(status.state,'connected');const saved=await f.service().connection('one');assert.equal((await open(saved.cipher,f.cfg.STRAVA_TOKEN_KEY,'one')).refreshToken,'test-only-refresh');
 f.setUser(null);const response=await f.route.GET(new Request('http://localhost:5173/api/strava/callback?code=private-code'));assert.equal(response.headers.get('location'),'/?strava=login_required');
});
test('cookie security and diagnostics do not expose supplied secrets or URL parameters',()=>{
 const request=new Request('http://127.0.0.1:5173/api/strava/connect');assert(oauthCookie(request,'secret',{local:false}).includes('Secure'));assert(!oauthCookie(request,'secret',{local:true}).includes('Secure'));
 assert(oauthCookie(new Request('https://example.test/api/strava/connect'),'secret',{local:true}).includes('Secure'));
 assert.equal(oauthCookieValue(new Request(request.url,{headers:{cookie:'zancada-strava=one; zancada-strava=two'}})),'');
 const logs=[];stravaDiagnostic({stage:'test',outcome:'success',token:'private',url:'?code=private',user:'private'},line=>logs.push(line));assert(!logs[0].includes('private'));
});
test('the activities panel never labels loading, disconnection or API failure as an empty success',()=>{
 const source=readFileSync(new URL('../app/strava-panel.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,module={exports:{}};
 new Function('require','module','exports',code)(name=>name.includes('strava-feedback')?require('../lib/strava-feedback.mjs'):require(name),module,module.exports);
 const render=data=>renderToStaticMarkup(React.createElement(module.exports.default,{demo:false,data,refresh:async()=>{}}));
 for(const data of [null,{state:'disconnected'},{state:'connection_error',error:'Provider unavailable',account:'Atleta 1',localLive:true,activities:[]}])assert(!render(data).includes('no se encontraron carreras'));
 assert(render({state:'connection_error',error:'Provider unavailable',account:'Atleta 1',localLive:true,activities:[]}).includes('No se pudo completar la consulta'));
 assert(render({state:'connected',account:'Atleta 1',syncCompleted:true,settings:{days:7},activities:[]}).includes('no se encontraron carreras'));
});
test('refresh is serialized so two requests cannot overwrite rotating credentials',async()=>{
 const f=setup();await authorize(f);
 await f.service().saveConnection('one','1',{accessToken:'expired-test-token',refreshToken:'old-test-refresh',expiresAt:1},'oauth',['activity:read_all']);
 const service=f.service(),c=await service.connection('one'),before=f.calls.filter(c=>c.url.includes('/oauth/token')).length;
 const results=await Promise.allSettled([service.access(c),service.access(c)]);
 assert(results.some(r=>r.status==='fulfilled'));assert(results.some(r=>r.status==='rejected'&&r.reason.status===429));
 assert.equal(f.calls.filter(c=>c.url.includes('/oauth/token')).length-before,1);
});
test('failed initial sync keeps the authenticated connection; two connected users receive only their own runs',async()=>{
 const f=setup();f.setSyncFail();const response=await authorize(f);assert.equal(response.headers.get('location'),'/?strava=sync_failed');assert(await f.service().connection('one'));
 const provider=async(_url,init)=>{const second=init.headers.Authorization==='Bearer second-test-token';return Response.json([{...run(second?22:11),athlete:{id:second?2:1}}]);};
 const s=new LocalStravaService(f.db,f.cfg,provider,{clock:()=>now,log:()=>{}});
 await s.saveConnection('one','1',{accessToken:'first-test-token',expiresAt:2e9},'oauth',['activity:read_all']);
 await s.saveConnection('two','2',{accessToken:'second-test-token',expiresAt:2e9},'oauth',['activity:read_all']);
 assert.deepEqual((await s.status('one')).activities.map(a=>a.id),['11']);assert.deepEqual((await s.status('two')).activities.map(a=>a.id),['22']);
 const forged=new LocalStravaService(f.db,f.cfg,async()=>Response.json([{...run(33),athlete:{id:2}}]),{clock:()=>now,log:()=>{}});
 const blocked=await forged.status('one');assert.equal(blocked.state,'insufficient_permissions');assert.deepEqual(blocked.activities,[]);
});
