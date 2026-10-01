import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {LocalStravaService} from '../lib/strava-local.mjs';
import {StravaService} from '../lib/strava-service.mjs';
import {randomSecret} from '../lib/strava-core.mjs';
function database(){
 const raw=new DatabaseSync(':memory:');
 for(const file of ['0001_luxuriant_jamie_braddock.sql','0002_abnormal_skreet.sql'])raw.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 return {raw,prepare(sql){return {bind(...args){return {async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(raw.prepare(sql).run(...args).changes)}};}};}};},async batch(items){return Promise.all(items.map(i=>i.run()));}};
}
const config=()=>({STRAVA_CLIENT_ID:'123',STRAVA_CLIENT_SECRET:'secret',STRAVA_TOKEN_KEY:randomSecret(),STRAVA_REDIRECT_URI:'http://localhost:5173/api/strava/callback',STRAVA_RETENTION_JOB_ENABLED:'false'});
const activity={id:12,name:'Private run',sport_type:'Run',start_date:'2026-10-01T08:00:00Z',start_date_local:'2026-10-01T10:00:00Z',distance:5000,moving_time:1800,elapsed_time:1900};
test('local OAuth works without cron and never persists activities or jobs; deployed service remains gated',async()=>{
 const db=database(),cfg=config();let deleted=false;
 const provider=async url=>url.includes('/oauth/token')?Response.json({access_token:'token',refresh_token:'refresh',expires_at:2e9,athlete:{id:1},scope:'activity:read'}):url.endsWith('/athlete')?Response.json({id:1}):Response.json(deleted?[]:[activity]);
 const service=new LocalStravaService(db,cfg,provider);
 const url=new URL(await service.begin('one',{},'cookie'));
 await assert.rejects(service.finish('two',url.searchParams.get('state'),'cookie','code','activity:read'));
 await service.finish('one',url.searchParams.get('state'),'cookie','code','activity:read');
 const status=await service.status('one');assert.equal(status.activities.length,1);assert(status.retentionConfigured);assert(status.localLive);
 assert.equal((await service.status('two')).activities.length,0);
 for(const table of ['strava_cache','strava_jobs'])assert.equal(db.raw.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
 assert(!db.raw.prepare('SELECT cipher FROM strava_connection').get().cipher.includes('token'));
 deleted=true;assert.equal((await service.status('one')).activities.length,0);
 await assert.rejects(new StravaService(db,cfg,provider).begin('one',{},'cookie'),/retention_pending/);
});
test('local provider failures return no stale data and keep credentials private',async()=>{
 const db=database(),service=new LocalStravaService(db,config(),async()=>new Response(null,{status:401}));
 await service.saveConnection('one','1',{accessToken:'private-token',expiresAt:2e9},'oauth',['activity:read']);
 const status=await service.status('one');assert.equal(status.state,'authorization_expired');assert.deepEqual(status.activities,[]);assert(!JSON.stringify(status).includes('private-token'));
});
